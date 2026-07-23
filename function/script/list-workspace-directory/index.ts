import fs from 'node:fs';
import path from 'node:path';
import { normalizeWorkspacePath } from '$stylist/server/function/script/normalize-workspace-path';

export function listWorkspaceDirectory(directoryPath: string): Array<{
	name: string;
	path: string;
	kind: 'file' | 'directory';
}> {
	const absolutePath = normalizeWorkspacePath(directoryPath);

	if (!absolutePath) {
		throw new Error('Path is outside workspace.');
	}

	if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isDirectory()) {
		throw new Error('Directory not found.');
	}

	return fs
		.readdirSync(absolutePath, { withFileTypes: true })
		.map((entry) => ({
			name: entry.name,
			path: path.relative(process.cwd(), path.join(absolutePath, entry.name)).replace(/\\/g, '/'),
			kind: entry.isDirectory() ? ('directory' as const) : ('file' as const)
		}))
		.sort((left, right) => left.name.localeCompare(right.name));
}


