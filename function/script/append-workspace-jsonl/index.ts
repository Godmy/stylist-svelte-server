import fs from 'node:fs';
import path from 'node:path';
import { normalizeWorkspacePath } from '$stylist/server/function/script/normalize-workspace-path';

export function appendWorkspaceJsonl(filePath: string, value: unknown): void {
	const absolutePath = normalizeWorkspacePath(filePath);

	if (!absolutePath) {
		throw new Error('Path is outside workspace.');
	}

	fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
	fs.appendFileSync(absolutePath, `${JSON.stringify(value)}\n`, 'utf8');
}
