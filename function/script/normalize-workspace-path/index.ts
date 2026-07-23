import { resolve, sep } from 'node:path';

export function normalizeWorkspacePath(inputPath: string): string | null {
	const workspacePath = resolve(process.cwd());
	const normalizedPath = inputPath.replace(/\\/g, '/').replace(/^\/+/, '');
	const absolutePath = resolve(workspacePath, normalizedPath);
	const workspacePrefix = `${workspacePath}${sep}`;

	if (absolutePath !== workspacePath && !absolutePath.startsWith(workspacePrefix)) {
		return null;
	}

	return absolutePath;
}


