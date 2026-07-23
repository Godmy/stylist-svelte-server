import fs from 'node:fs';
import path from 'node:path';
import { json, type RequestEvent } from '@sveltejs/kit';
import { LIB_DIRECTORY_PATH } from '$stylist/server/const/value/lib-directory-path';

export async function postContentBacklogResponse(event: RequestEvent) {
	const payload = (await event.request.json()) as {
		file?: unknown;
		id?: unknown;
		text?: unknown;
		image?: unknown;
		audio?: unknown;
	};

	if (
		typeof payload.file !== 'string' ||
		typeof payload.id !== 'string' ||
		typeof payload.text !== 'string'
	) {
		return json({ error: 'Invalid request payload.' }, { status: 400 });
	}

	if (
		payload.file.trim().length === 0 ||
		payload.id.trim().length === 0 ||
		payload.text.trim().length === 0
	) {
		return json({ error: 'Issue payload cannot be empty.' }, { status: 400 });
	}

	const normalizedFilePath = payload.file.replace(/\\/g, '/').replace(/^\/+/, '');
	const absoluteFilePath = path.resolve(LIB_DIRECTORY_PATH, normalizedFilePath);

	if (!absoluteFilePath.startsWith(LIB_DIRECTORY_PATH)) {
		return json({ error: 'Unsafe file path.' }, { status: 400 });
	}

	const issuesDirectoryPath = path.resolve(
		LIB_DIRECTORY_PATH,
		'data',
		'jsonl',
		'component',
		'issues'
	);
	const issuesFilePath = path.join(issuesDirectoryPath, 'index.jsonl');
	const issueRecord = {
		created_at: new Date().toISOString(),
		file: absoluteFilePath.replace(/\\/g, '/'),
		id: payload.id,
		text: payload.text,
		image: payload.image ?? null,
		audio: payload.audio ?? null
	};

	fs.mkdirSync(issuesDirectoryPath, { recursive: true });
	fs.appendFileSync(issuesFilePath, `${JSON.stringify(issueRecord)}\n`, 'utf8');

	return json({ ok: true, path: 'management/data/jsonl/component/issues/index.jsonl' });
}


