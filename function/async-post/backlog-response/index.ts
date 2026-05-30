import { json, type RequestEvent } from '@sveltejs/kit';
import { BACKLOG_HISTORY_DIRECTORY_PATH } from '$stylist/server/const/value/backlog-history-directory-path';
import { createWorkspaceDirectory } from '$stylist/server/function/script/create-workspace-directory';
import { formatBackupTimestamp } from '$stylist/server/function/script/format-backup-timestamp';
import { getBacklogHistoryWorkspacePath } from '$stylist/server/function/script/get-backlog-history-workspace-path';
import { getBacklogRelativePath } from '$stylist/server/function/script/get-backlog-relative-path';
import { getBacklogWorkspacePath } from '$stylist/server/function/script/get-backlog-workspace-path';
import { isSafeSegment } from '$stylist/server/function/script/is-safe-segment';
import { readWorkspaceTextFile } from '$stylist/server/function/script/read-workspace-text-file';
import { writeWorkspaceTextFile } from '$stylist/server/function/script/write-workspace-text-file';
import type { TypeBacklogDocument } from '$stylist/server/type/struct/backlog-document';

export async function postBacklogResponse(event: RequestEvent): Promise<Response> {
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

	if (!isSafeSegment(payload.domain) || !isSafeSegment(payload.family)) {
		return json({ error: 'Unsafe domain or family name.' }, { status: 400 });
	}

	const historyTimestamp = formatBackupTimestamp(new Date());
	const targetPath = getBacklogWorkspacePath(payload.domain, payload.family);
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
		const existingContent = readWorkspaceTextFile(targetPath);
		createWorkspaceDirectory(BACKLOG_HISTORY_DIRECTORY_PATH);
		writeWorkspaceTextFile(
			getBacklogHistoryWorkspacePath(payload.domain, payload.family, historyTimestamp),
			existingContent.endsWith('\n') ? existingContent : `${existingContent}\n`
		);
	} catch {
		// Skip history snapshot when the backlog file does not exist yet.
	}

	writeWorkspaceTextFile(targetPath, `${content}\n`);

	return json({
		ok: true,
		source: {
			domain: payload.domain,
			family: payload.family,
			requestedPath: getBacklogRelativePath(payload.domain, payload.family),
			resolvedPath: getBacklogRelativePath(payload.domain, payload.family),
			isFallback: false
		},
		historyPath: `management/data/json/component/backlog/history/${payload.domain}--${payload.family}--${historyTimestamp}.json`
	});
}
