import fs from 'node:fs';
import { normalizeWorkspacePath } from '$stylist/server/function/script/normalize-workspace-path';

export function createWorkspaceDirectory(directoryPath: string): void {
	const absolutePath = normalizeWorkspacePath(directoryPath);

	if (!absolutePath) {
		throw new Error('Path is outside workspace.');
	}

	fs.mkdirSync(absolutePath, { recursive: true });
}
