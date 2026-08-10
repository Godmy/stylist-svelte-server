import fs from 'node:fs';
import path from 'node:path';
import { normalizeRepoRelativePath } from '$stylist/server/function/script/normalize-repo-relative-path';

export function listStylistOutputFiles(inputDirectoryPath: string) {
	const directoryPath = path.resolve(inputDirectoryPath);

	if (!fs.existsSync(directoryPath) || !fs.statSync(directoryPath).isDirectory()) {
		return [];
	}

	const files: Array<{ path: string; name: string; extension: string; size: number; updatedAt: string }> =
		[];

	function walk(currentDirectoryPath: string): void {
		for (const entry of fs.readdirSync(currentDirectoryPath, { withFileTypes: true })) {
			const entryPath = path.join(currentDirectoryPath, entry.name);

			if (entry.isDirectory()) {
				walk(entryPath);
				continue;
			}

			if (entry.isFile()) {
				const stat = fs.statSync(entryPath);
				files.push({
					path: normalizeRepoRelativePath(entryPath),
					name: entry.name,
					extension: path.extname(entry.name).replace(/^\./, ''),
					size: stat.size,
					updatedAt: stat.mtime.toISOString()
				});
			}
		}
	}

	walk(directoryPath);
	return files.sort((left, right) => left.path.localeCompare(right.path));
}
