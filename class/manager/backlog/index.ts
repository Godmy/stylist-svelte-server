import path from 'node:path';
import { json, type RequestEvent } from '@sveltejs/kit';
import { BACKLOG_DEFAULT_JSON_PATH } from '$stylist/server/const/value/backlog-default-json-path';
import { BACKLOG_HISTORY_DIRECTORY_PATH } from '$stylist/server/const/value/backlog-history-directory-path';
import { BACKLOG_JSONL_DIRECTORY_PATH } from '$stylist/server/const/value/backlog-jsonl-directory-path';
import { ISSUES_JSONL_PATH } from '$stylist/server/const/value/issues-jsonl-path';
import { LIB_DIRECTORY_PATH } from '$stylist/server/const/value/lib-directory-path';
import { FileManager } from '$stylist/server/class/manager/file';
import type { TypeBacklogDocument } from '$stylist/server/type/struct/backlog-document';
import type { TypeIssueMessage } from '$stylist/server/type/struct/issue-message';

export class BacklogManager {
	static getBacklogResponse(event: RequestEvent): Response {
		const domain = event.url.searchParams.get('domain') ?? '';
		const family = event.url.searchParams.get('family') ?? '';

		if (!this.isSafeSegment(domain) || !this.isSafeSegment(family)) {
			return json({ error: 'Unsafe domain or family name.' }, { status: 400 });
		}

		const targetPath = this.getBacklogWorkspacePath(domain, family);
		const { content, resolvedPath, isFallback } = (() => {
			try {
				return {
					content: FileManager.readWorkspaceTextFile(targetPath),
					resolvedPath: this.getBacklogRelativePath(domain, family),
					isFallback: false
				};
			} catch {
				return {
					content: FileManager.readWorkspaceTextFile(BACKLOG_DEFAULT_JSON_PATH),
					resolvedPath: 'management/data/json/component/backlog/default.json',
					isFallback: true
				};
			}
		})();

		return json({
			document: JSON.parse(content),
			source: {
				domain,
				family,
				requestedPath: this.getBacklogRelativePath(domain, family),
				resolvedPath,
				isFallback
			}
		});
	}

	static async postBacklogResponse(event: RequestEvent): Promise<Response> {
		const payload = (await event.request.json()) as {
			domain?: unknown;
			family?: unknown;
			document?: unknown;
		};

		if (
			typeof payload.domain !== 'string' ||
			typeof payload.family !== 'string' ||
			typeof payload.document !== 'object' ||
			payload.document === null
		) {
			return json({ error: 'Invalid request payload.' }, { status: 400 });
		}

		if (!this.isSafeSegment(payload.domain) || !this.isSafeSegment(payload.family)) {
			return json({ error: 'Unsafe domain or family name.' }, { status: 400 });
		}

		const historyTimestamp = this.formatBackupTimestamp(new Date());
		const targetPath = this.getBacklogWorkspacePath(payload.domain, payload.family);
		const document = payload.document as TypeBacklogDocument & Record<string, unknown>;
		const content = JSON.stringify(
			{
				...document,
				meta: {
					...((typeof document.meta === 'object' && document.meta !== null
						? document.meta
						: {}) as Record<string, unknown>),
					domain: payload.domain,
					family: payload.family,
					version: 1,
					updatedAt: new Date().toISOString()
				}
			},
			null,
			2
		);

		try {
			const existingContent = FileManager.readWorkspaceTextFile(targetPath);
			FileManager.createWorkspaceDirectory(BACKLOG_HISTORY_DIRECTORY_PATH);
			FileManager.writeWorkspaceTextFile(
				this.getBacklogHistoryWorkspacePath(payload.domain, payload.family, historyTimestamp),
				existingContent.endsWith('\n') ? existingContent : `${existingContent}\n`
			);
		} catch {
			// Skip history snapshot when the backlog file does not exist yet.
		}

		FileManager.writeWorkspaceTextFile(targetPath, `${content}\n`);

		return json({
			ok: true,
			source: {
				domain: payload.domain,
				family: payload.family,
				requestedPath: this.getBacklogRelativePath(payload.domain, payload.family),
				resolvedPath: this.getBacklogRelativePath(payload.domain, payload.family),
				isFallback: false
			},
			historyPath: `management/data/json/component/backlog/history/${payload.domain}--${payload.family}--${historyTimestamp}.json`
		});
	}

	static getIssuesResponse(_event: RequestEvent): Response {
		const items = FileManager.readWorkspaceJsonl<TypeIssueMessage>(ISSUES_JSONL_PATH).map(
			(item) => {
				const backlogWorkspacePath = this.getIssueBacklogWorkspacePath(item.id, item.text);
				const status = FileManager.workspacePathExists(backlogWorkspacePath) ? 'backlog' : 'new';

				return {
					...item,
					message_key: this.getIssueMessageKey(item.id, item.text),
					status,
					backlog_path: this.getIssueBacklogRelativePath(item.id, item.text)
				};
			}
		);

		return json({
			items,
			path: 'management/data/jsonl/component/issues/index.jsonl'
		});
	}

	static async postIssuesResponse(event: RequestEvent): Promise<Response> {
		const payload = await event.request.json();

		if (!this.isIssueMessage(payload)) {
			return json({ error: 'Invalid issue payload.' }, { status: 400 });
		}

		const normalizedFile = payload.file.replace(/\\/g, '/').replace(/^\/+/, '');
		const absoluteFilePath = path.resolve(LIB_DIRECTORY_PATH, normalizedFile).replace(/\\/g, '/');

		FileManager.appendWorkspaceJsonl(ISSUES_JSONL_PATH, {
			...payload,
			file: absoluteFilePath
		});

		return json({
			ok: true,
			path: 'management/data/jsonl/component/issues/index.jsonl'
		});
	}

	static async postBacklogIssueResponse(event: RequestEvent): Promise<Response> {
		const payload = (await event.request.json()) as { issues?: unknown };

		if (!Array.isArray(payload.issues)) {
			return json({ error: 'Invalid backlog issue payload.' }, { status: 400 });
		}

		const issues = payload.issues.filter((value): value is TypeIssueMessage =>
			this.isIssueMessage(value)
		);

		if (issues.length !== payload.issues.length) {
			return json({ error: 'Invalid issue record in payload.' }, { status: 400 });
		}

		const items = issues.map((issue) => {
			const workspacePath = this.getIssueBacklogWorkspacePath(issue.id, issue.text);
			const relativePath = this.getIssueBacklogRelativePath(issue.id, issue.text);
			const messageKey = this.getIssueMessageKey(issue.id, issue.text);

			if (!FileManager.workspacePathExists(workspacePath)) {
				FileManager.appendWorkspaceJsonl(workspacePath, {
					created_at: issue.created_at,
					file: issue.file,
					id: issue.id,
					text: issue.text,
					image: issue.image,
					audio: issue.audio
				});
			}

			return {
				message_key: messageKey,
				backlog_path: relativePath
			};
		});

		return json({ ok: true, items });
	}

	private static getBacklogHistoryWorkspacePath(
		domain: string,
		family: string,
		timestamp: string
	): string {
		return `${BACKLOG_HISTORY_DIRECTORY_PATH}/${domain}--${family}--${timestamp}.json`;
	}

	private static getBacklogRelativePath(domain: string, family: string): string {
		return `management/data/json/component/backlog/${domain}--${family}.json`;
	}

	private static getBacklogWorkspacePath(domain: string, family: string): string {
		return `stylist-svelte/src/lib/management/data/json/component/backlog/${domain}--${family}.json`;
	}

	private static getIssueBacklogRelativePath(id: string, text: string): string {
		return `management/data/jsonl/component/backlog/${this.formatJsonlSegment(id)}/${this.formatJsonlSegment(text)}.jsonl`;
	}

	private static getIssueBacklogWorkspacePath(id: string, text: string): string {
		return `${BACKLOG_JSONL_DIRECTORY_PATH}/${this.formatJsonlSegment(id)}/${this.formatJsonlSegment(text)}.jsonl`;
	}

	private static getIssueMessageKey(id: string, text: string): string {
		return `${this.formatJsonlSegment(id)}::${this.formatJsonlSegment(text)}`;
	}

	private static formatBackupTimestamp(date: Date): string {
		return date
			.toISOString()
			.replace(/[-:]/g, '')
			.replace(/\.\d{3}Z$/, 'Z');
	}

	private static formatJsonlSegment(value: string): string {
		return value
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.replace(/-{2,}/g, '-');
	}

	private static isIssueMessage(value: unknown): value is TypeIssueMessage {
		if (typeof value !== 'object' || value === null) {
			return false;
		}

		const candidate = value as Record<string, unknown>;

		return (
			typeof candidate.created_at === 'string' &&
			typeof candidate.file === 'string' &&
			typeof candidate.id === 'string' &&
			typeof candidate.text === 'string' &&
			(candidate.image === null || typeof candidate.image === 'string') &&
			(candidate.audio === null || typeof candidate.audio === 'string')
		);
	}

	private static isSafeSegment(segment: string): boolean {
		return /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(segment);
	}
}
