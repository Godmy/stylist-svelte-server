import fs from 'node:fs';
import { normalizeWorkspacePath } from '$stylist/server/function/script/normalize-workspace-path';

export function readWorkspaceTextFile(filePath: string): string {
	const absolutePath = normalizeWorkspacePath(filePath);

	if (!absolutePath) {
		throw new Error('Path is outside workspace.');
	}

	if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
		throw new Error('File not found.');
	}

	return fs.readFileSync(absolutePath, 'utf8');
}
