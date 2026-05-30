import fs from 'node:fs';
import { normalizeWorkspacePath } from '$stylist/server/function/script/normalize-workspace-path';

export function deleteWorkspacePath(targetPath: string): void {
	const absolutePath = normalizeWorkspacePath(targetPath);

	if (!absolutePath) {
		throw new Error('Path is outside workspace.');
	}

	if (!fs.existsSync(absolutePath)) {
		return;
	}

	fs.rmSync(absolutePath, { recursive: true, force: true });
}
