import path from 'node:path';
import { json, type RequestEvent } from '@sveltejs/kit';
import { ISSUES_JSONL_PATH } from '$stylist/server/const/value/issues-jsonl-path';
import { LIB_DIRECTORY_PATH } from '$stylist/server/const/value/lib-directory-path';
import { appendWorkspaceJsonl } from '$stylist/server/function/script/append-workspace-jsonl';
import { isIssueMessage } from '$stylist/server/function/script/is-issue-message';

export async function postIssuesResponse(event: RequestEvent): Promise<Response> {
	const payload = await event.request.json();

	if (!isIssueMessage(payload)) {
		return json({ error: 'Invalid issue payload.' }, { status: 400 });
	}

	const normalizedFile = payload.file.replace(/\\/g, '/').replace(/^\/+/, '');
	const absoluteFilePath = path.resolve(LIB_DIRECTORY_PATH, normalizedFile).replace(/\\/g, '/');

	appendWorkspaceJsonl(ISSUES_JSONL_PATH, {
		...payload,
		file: absoluteFilePath
	});

	return json({
		ok: true,
		path: 'management/data/jsonl/component/issues/index.jsonl'
	});
}


