import path from 'node:path';
import { listStylistOutputFiles } from '$stylist/server/function/script/list-stylist-output-files';
import { normalizeRepoRelativePath } from '$stylist/server/function/script/normalize-repo-relative-path';

export function readStylistDiOutput() {
	const cwd = path.resolve(process.cwd());
	const repoRoot = path.basename(cwd) === 'stylist-svelte' ? path.resolve(cwd, '..') : cwd;
	const outputPath = path.join(repoRoot, 'stylist', 'di', 'output');

	return {
		outputPath,
		outputRelativePath: normalizeRepoRelativePath(outputPath),
		files: listStylistOutputFiles(outputPath),
		dependencyTreePath: normalizeRepoRelativePath(
			path.join(outputPath, 'step-3-component-dependency-trees.json')
		),
		filesByKeyPath: normalizeRepoRelativePath(path.join(outputPath, 'step-1-files-by-key.json')),
		crossdomainLinksPath: normalizeRepoRelativePath(path.join(outputPath, 'step-6-crossdomain-links.json'))
	};
}
