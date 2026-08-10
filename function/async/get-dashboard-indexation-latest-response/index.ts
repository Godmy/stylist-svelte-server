import { json } from '@sveltejs/kit';
import path from 'node:path';
import { normalizeRepoRelativePath } from '$stylist/server/function/script/normalize-repo-relative-path';
import { readStylistIndexationOutput } from '$stylist/server/function/script/read-stylist-indexation-output';

export function getDashboardIndexationLatestResponse(): Response {
	const indexation = readStylistIndexationOutput();
	const outputPath = indexation.outputPath;
	const files = indexation.files;
	const tree = indexation.tree as { name?: string; path?: string; children?: unknown[]; files?: string[] } | null;
	const componentMap = indexation.componentMap;
	const updatedAt = files.map((file) => file.updatedAt).sort().at(-1) ?? null;
	const summarizeNode = (node: { name?: string; path?: string; children?: unknown[]; files?: string[] } | null, depth = 0): unknown => ({
		name: node?.name ?? '',
		path: node?.path ? normalizeRepoRelativePath(node.path) : null,
		fileCount: node?.files?.length ?? 0,
		childCount: node?.children?.length ?? 0,
		children:
			depth >= 2
				? []
				: (node?.children ?? [])
						.slice(0, 50)
						.map((child) =>
							summarizeNode(
								child as { name?: string; path?: string; children?: unknown[]; files?: string[] },
								depth + 1
							)
						)
	});

	return json({
		report: {
			id: 'indexation-current',
			tool: 'indexation',
			title: 'Indexation',
			status: files.length > 0 ? 'success' : 'unknown',
			updatedAt,
			outputPath: normalizeRepoRelativePath(outputPath),
			readmePath: normalizeRepoRelativePath(path.join(outputPath, 'result.md')),
			jsonPaths: [
				normalizeRepoRelativePath(path.join(outputPath, 'stylist-svelte.json')),
				normalizeRepoRelativePath(path.join(outputPath, 'stylist-svelte-components.json'))
			],
			errorCount: 0,
			warningCount: 0,
			totalFiles: files.length,
			serverOnly: true
		},
		summary: {
			status: files.length > 0 ? 'success' : 'unknown',
			updatedAt,
			resultPath: normalizeRepoRelativePath(path.join(outputPath, 'result.md')),
			treePath: normalizeRepoRelativePath(path.join(outputPath, 'stylist-svelte.json')),
			componentMapPath: normalizeRepoRelativePath(path.join(outputPath, 'stylist-svelte-components.json')),
			outputPath: normalizeRepoRelativePath(outputPath),
			processedFileTypes: ['ts', 'svelte', 'story', 'svg', 'frag', 'vert', 'json'],
			changedIndexPaths: [],
			affectedDomains: [],
			generatedIndexCount: 0,
			componentCount: Object.keys(componentMap ?? {}).length,
			outputFiles: files
		},
		tree: summarizeNode(tree ?? null),
		markdownPreview: indexation.markdownPreview
	});
}
