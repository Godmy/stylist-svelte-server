import fs from 'node:fs';
import path from 'node:path';
import { normalizeWorkspacePath } from '$stylist/server/function/script/normalize-workspace-path';

export function writeWorkspaceTextFile(filePath: string, content: string): void {
	const absolutePath = normalizeWorkspacePath(filePath);

	if (!absolutePath) {
		throw new Error('Path is outside workspace.');
	}

	fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
	fs.writeFileSync(absolutePath, content, 'utf8');
}
