import fs from 'node:fs';
import path from 'node:path';
import { normalizeWorkspacePath } from '$stylist/server/function/script/normalize-workspace-path';

export function getWorkspacePathInfo(targetPath: string): {
	path: string;
	exists: boolean;
	kind: 'missing' | 'file' | 'directory';
	size: number;
} {
	const absolutePath = normalizeWorkspacePath(targetPath);

	if (!absolutePath) {
		throw new Error('Path is outside workspace.');
	}

	if (!fs.existsSync(absolutePath)) {
		return {
			path: targetPath.replace(/\\/g, '/'),
			exists: false,
			kind: 'missing',
			size: 0
		};
	}

	const stats = fs.statSync(absolutePath);

	return {
		path: path.relative(process.cwd(), absolutePath).replace(/\\/g, '/'),
		exists: true,
		kind: stats.isDirectory() ? 'directory' : 'file',
		size: stats.size
	};
}


