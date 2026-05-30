import fs from 'node:fs';
import path from 'node:path';
import { normalizeWorkspacePath } from '$stylist/server/function/script/normalize-workspace-path';

export function createWorkspaceTextFile(filePath: string, content = ''): void {
	const absolutePath = normalizeWorkspacePath(filePath);

	if (!absolutePath) {
		throw new Error('Path is outside workspace.');
	}

	if (fs.existsSync(absolutePath)) {
		throw new Error('File already exists.');
	}

	fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
	fs.writeFileSync(absolutePath, content, 'utf8');
}
