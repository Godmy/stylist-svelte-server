import fs from 'node:fs';
import { normalizeWorkspacePath } from '$stylist/server/function/script/normalize-workspace-path';

export function workspacePathExists(filePath: string): boolean {
	const absolutePath = normalizeWorkspacePath(filePath);

	if (!absolutePath) {
		return false;
	}

	return fs.existsSync(absolutePath);
}
