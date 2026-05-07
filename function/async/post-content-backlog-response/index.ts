import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { isSafeSegment } from '$stylist/server/function/script/is-safe-segment';
import { normalizeLibPath } from '$stylist/server/function/script/normalize-lib-path';

export async function postContentBacklogResponse({ request }: RequestEvent): Promise<Response> {
	const payload = (await request.json()) as {
		domain?: string;
		family?: string;
		content?: string;
	};

	const domain = payload.domain?.trim() ?? '';
	const family = payload.family?.trim() ?? '';
	const content = payload.content ?? '';

	if (!isSafeSegment(domain) || !isSafeSegment(family)) {
		return json({ error: 'Invalid domain or family name' }, { status: 400 });
	}

	if (typeof content !== 'string') {
		return json({ error: 'Content must be a string' }, { status: 400 });
	}

	const relativePath = `${domain}/data/md/backlog/${family}/index.md`;
	const resolvedPath = normalizeLibPath(relativePath);

	if (!resolvedPath) {
		return json({ error: 'Invalid target path' }, { status: 400 });
	}

	fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
	fs.writeFileSync(resolvedPath, content, 'utf8');

	return json({
		path: relativePath,
		saved: true
	});
}
