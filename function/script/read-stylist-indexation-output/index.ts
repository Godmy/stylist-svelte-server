import path from 'node:path';
import { listStylistOutputFiles } from '$stylist/server/function/script/list-stylist-output-files';
import { normalizeRepoRelativePath } from '$stylist/server/function/script/normalize-repo-relative-path';
import { readStylistOutputJsonFile } from '$stylist/server/function/script/read-stylist-output-json-file';
import { readStylistOutputMarkdownFile } from '$stylist/server/function/script/read-stylist-output-markdown-file';

export function readStylistIndexationOutput() {
	const cwd = path.resolve(process.cwd());
	const repoRoot = path.basename(cwd) === 'stylist-svelte' ? path.resolve(cwd, '..') : cwd;
	const outputPath = path.join(repoRoot, 'stylist', 'indexation', 'output');

	return {
		outputPath,
		outputRelativePath: normalizeRepoRelativePath(outputPath),
		files: listStylistOutputFiles(outputPath),
		markdownPreview: readStylistOutputMarkdownFile(path.join(outputPath, 'result.md')),
		tree: readStylistOutputJsonFile(path.join(outputPath, 'stylist-svelte.json')),
		componentMap: readStylistOutputJsonFile<Record<string, unknown>>(
			path.join(outputPath, 'stylist-svelte-components.json')
		)
	};
}
