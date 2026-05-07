import fs from 'node:fs';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { CONTENT_PREVIEW_MAX_FILE_SIZE } from '$stylist/server/const/value/content-preview-max-file-size';
import { normalizeLibPath } from '$stylist/server/function/script/normalize-lib-path';

export async function getContentFileResponse({ url }: RequestEvent): Promise<Response> {
	const requestedPath = url.searchParams.get('path') ?? '';
	const resolvedPath = normalizeLibPath(requestedPath);

	if (!resolvedPath || !fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
		return json({ error: 'File not found' }, { status: 404 });
	}

	const stat = fs.statSync(resolvedPath);

	if (stat.size > CONTENT_PREVIEW_MAX_FILE_SIZE) {
		return json({ error: 'File is too large for preview' }, { status: 413 });
	}

	return json({
		path: requestedPath,
		content: fs.readFileSync(resolvedPath, 'utf8')
	});
}
