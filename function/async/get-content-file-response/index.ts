import fs from 'node:fs';
import { json, type RequestEvent } from '@sveltejs/kit';
import { CONTENT_PREVIEW_MAX_FILE_SIZE } from '$stylist/server/const/value/content-preview-max-file-size';
import { normalizeLibPath } from '$stylist/server/function/script/normalize-lib-path';

export function getContentFileResponse(event: RequestEvent) {
	const requestedPath = event.url.searchParams.get('path');

	if (!requestedPath) {
		return json({ error: 'Missing "path" query parameter.' }, { status: 400 });
	}

	const absolutePath = normalizeLibPath(requestedPath);

	if (!absolutePath) {
		return json({ error: 'Path is outside src/lib.' }, { status: 400 });
	}

	if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
		return json({ error: 'File not found.' }, { status: 404 });
	}

	if (fs.statSync(absolutePath).size > CONTENT_PREVIEW_MAX_FILE_SIZE) {
		return json({ error: 'File is too large to preview.' }, { status: 413 });
	}

	return json({ content: fs.readFileSync(absolutePath, 'utf8') });
}
