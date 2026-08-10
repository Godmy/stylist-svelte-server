import fs from 'node:fs';
import path from 'node:path';
import { normalizeRepoRelativePath } from '$stylist/server/function/script/normalize-repo-relative-path';

export function readStylistOutputMarkdownFile(inputPath: string) {
	const absolutePath = path.resolve(inputPath);
	const previewLimit = 128 * 1024;

	if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
		return null;
	}

	const content = fs.readFileSync(absolutePath, 'utf8');

	return {
		path: normalizeRepoRelativePath(absolutePath),
		content: content.slice(0, previewLimit),
		truncated: content.length > previewLimit,
		size: fs.statSync(absolutePath).size
	};
}
