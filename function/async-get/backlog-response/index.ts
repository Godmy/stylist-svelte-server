import { json, type RequestEvent } from '@sveltejs/kit';
import { BACKLOG_DEFAULT_JSON_PATH } from '$stylist/server/const/value/backlog-default-json-path';
import { getBacklogRelativePath } from '$stylist/server/function/script/get-backlog-relative-path';
import { getBacklogWorkspacePath } from '$stylist/server/function/script/get-backlog-workspace-path';
import { isSafeSegment } from '$stylist/server/function/script/is-safe-segment';
import { readWorkspaceTextFile } from '$stylist/server/function/script/read-workspace-text-file';

export function getBacklogResponse(event: RequestEvent): Response {
	const domain = event.url.searchParams.get('domain') ?? '';
	const family = event.url.searchParams.get('family') ?? '';

	if (!isSafeSegment(domain) || !isSafeSegment(family)) {
		return json({ error: 'Unsafe domain or family name.' }, { status: 400 });
	}

	const targetPath = getBacklogWorkspacePath(domain, family);
	const { content, resolvedPath, isFallback } = (() => {
		try {
			return {
				content: readWorkspaceTextFile(targetPath),
				resolvedPath: getBacklogRelativePath(domain, family),
				isFallback: false
			};
		} catch {
			return {
				content: readWorkspaceTextFile(BACKLOG_DEFAULT_JSON_PATH),
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
			requestedPath: getBacklogRelativePath(domain, family),
			resolvedPath,
			isFallback
		}
	});
}
