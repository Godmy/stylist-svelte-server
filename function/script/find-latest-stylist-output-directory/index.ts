import fs from 'node:fs';
import path from 'node:path';
import { normalizeRepoRelativePath } from '$stylist/server/function/script/normalize-repo-relative-path';

export function findLatestStylistOutputDirectory(source: 'auditor' | 'errors') {
	const cwd = path.resolve(process.cwd());
	const repoRoot = path.basename(cwd) === 'stylist-svelte' ? path.resolve(cwd, '..') : cwd;
	const outputDirectoryPath = path.join(repoRoot, 'stylist', source, 'output');

	if (!fs.existsSync(outputDirectoryPath) || !fs.statSync(outputDirectoryPath).isDirectory()) {
		return null;
	}

	const runIdPattern = /^\d{8}-\d{6}$/;
	const latestDirectory = fs
		.readdirSync(outputDirectoryPath, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && runIdPattern.test(entry.name))
		.map((entry) => {
			const absolutePath = path.join(outputDirectoryPath, entry.name);
			return {
				runId: entry.name,
				absolutePath,
				path: normalizeRepoRelativePath(absolutePath),
				updatedAt: fs.statSync(absolutePath).mtime.toISOString()
			};
		})
		.sort((left, right) => right.runId.localeCompare(left.runId))[0];

	return latestDirectory ?? null;
}
