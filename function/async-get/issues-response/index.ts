import { json, type RequestEvent } from '@sveltejs/kit';
import { ISSUES_JSONL_PATH } from '$stylist/server/const/value/issues-jsonl-path';
import { getIssueBacklogRelativePath } from '$stylist/server/function/script/get-issue-backlog-relative-path';
import { getIssueBacklogWorkspacePath } from '$stylist/server/function/script/get-issue-backlog-workspace-path';
import { getIssueMessageKey } from '$stylist/server/function/script/get-issue-message-key';
import { readWorkspaceJsonl } from '$stylist/server/function/script/read-workspace-jsonl';
import { workspacePathExists } from '$stylist/server/function/script/workspace-path-exists';
import type { TypeIssueMessage } from '$stylist/server/type/struct/issue-message';

export function getIssuesResponse(_event: RequestEvent): Response {
	const items = readWorkspaceJsonl<TypeIssueMessage>(ISSUES_JSONL_PATH).map((item) => {
		const backlogWorkspacePath = getIssueBacklogWorkspacePath(item.id, item.text);
		const status = workspacePathExists(backlogWorkspacePath) ? 'backlog' : 'new';

		return {
			...item,
			message_key: getIssueMessageKey(item.id, item.text),
			status,
			backlog_path: getIssueBacklogRelativePath(item.id, item.text)
		};
	});

	return json({
		items,
		path: 'management/data/jsonl/component/issues/index.jsonl'
	});
}
