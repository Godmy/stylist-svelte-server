import { json, type RequestEvent } from '@sveltejs/kit';
import { appendWorkspaceJsonl } from '$stylist/server/function/script/append-workspace-jsonl';
import { getIssueBacklogRelativePath } from '$stylist/server/function/script/get-issue-backlog-relative-path';
import { getIssueBacklogWorkspacePath } from '$stylist/server/function/script/get-issue-backlog-workspace-path';
import { getIssueMessageKey } from '$stylist/server/function/script/get-issue-message-key';
import { isIssueMessage } from '$stylist/server/function/script/is-issue-message';
import { workspacePathExists } from '$stylist/server/function/script/workspace-path-exists';
import type { TypeIssueMessage } from '$stylist/server/type/struct/issue-message';

export async function postBacklogIssueResponse(event: RequestEvent): Promise<Response> {
	const payload = (await event.request.json()) as { issues?: unknown };

	if (!Array.isArray(payload.issues)) {
		return json({ error: 'Invalid backlog issue payload.' }, { status: 400 });
	}

	const issues = payload.issues.filter((value): value is TypeIssueMessage => isIssueMessage(value));

	if (issues.length !== payload.issues.length) {
		return json({ error: 'Invalid issue record in payload.' }, { status: 400 });
	}

	const items = issues.map((issue) => {
		const workspacePath = getIssueBacklogWorkspacePath(issue.id, issue.text);
		const relativePath = getIssueBacklogRelativePath(issue.id, issue.text);
		const messageKey = getIssueMessageKey(issue.id, issue.text);

		if (!workspacePathExists(workspacePath)) {
			appendWorkspaceJsonl(workspacePath, {
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
