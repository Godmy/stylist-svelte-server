import path from 'node:path';

export function normalizeRepoRelativePath(inputPath: string): string {
	const cwd = path.resolve(process.cwd());
	const repoRoot = path.basename(cwd) === 'stylist-svelte' ? path.resolve(cwd, '..') : cwd;
	const absolutePath = path.resolve(inputPath);
	const relativePath = path.relative(repoRoot, absolutePath).replace(/\\/g, '/');

	if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
		return '';
	}

	return relativePath;
}
