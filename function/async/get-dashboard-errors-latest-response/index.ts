import { json } from '@sveltejs/kit';
import fs from 'node:fs';
import path from 'node:path';
import { findLatestStylistOutputDirectory } from '$stylist/server/function/script/find-latest-stylist-output-directory';
import { listStylistOutputFiles } from '$stylist/server/function/script/list-stylist-output-files';
import { normalizeRepoRelativePath } from '$stylist/server/function/script/normalize-repo-relative-path';
import { readStylistOutputJsonFile } from '$stylist/server/function/script/read-stylist-output-json-file';
import { readStylistOutputMarkdownFile } from '$stylist/server/function/script/read-stylist-output-markdown-file';

export function getDashboardErrorsLatestResponse(): Response {
	const cwd = path.resolve(process.cwd());
	const repoRoot = path.basename(cwd) === 'stylist-svelte' ? path.resolve(cwd, '..') : cwd;
	const latest = findLatestStylistOutputDirectory('errors');

	if (!latest) {
		return json({ error: 'Errors output is not available.' }, { status: 404 });
	}

	const files = listStylistOutputFiles(latest.absolutePath);
	const jsonFiles = files.filter((file) => file.extension === 'json');
	const items = jsonFiles.flatMap((file) => {
		const payload = readStylistOutputJsonFile<{
			project?: string;
			file?: string;
			errors?: Array<{ tool?: string; line?: number; column?: number; severity?: string; code?: string; message?: string }>;
		}>(path.join(repoRoot, file.path));
		return (payload?.errors ?? []).map((error) => ({
			id: `${latest.runId}:${payload?.project ?? 'unknown'}:${payload?.file ?? file.path}:${error.line ?? 0}:${error.column ?? 0}:${error.code ?? ''}`,
			project:
				payload?.project === 'stylist-svelte' || payload?.project === 'stylist-playground'
					? payload.project
					: 'unknown',
			path: payload?.file ? normalizeRepoRelativePath(payload.file) : file.path,
			analyzer:
				error.tool === 'tsc_stylist_svelte' ||
				error.tool === 'tsc_stylist_playground' ||
				error.tool === 'yarn_check_stylist_svelte' ||
				error.tool === 'yarn_check_stylist_playground'
					? error.tool
					: 'unknown',
			line: error.line,
			column: error.column,
			severity: error.severity === 'warning' || error.severity === 'info' ? error.severity : 'error',
			code: error.code,
			message: error.message ?? '',
			runId: latest.runId
		}));
	});
	const analyzerPaths = [
		path.join(repoRoot, 'stylist', 'errors', 'npx', 'tsc_stylist_playground.json'),
		path.join(repoRoot, 'stylist', 'errors', 'npx', 'tsc_stylist_svelte.json'),
		path.join(repoRoot, 'stylist', 'errors', 'yarn', 'yarn_check_stylist_svelte.json'),
		path.join(repoRoot, 'stylist', 'errors', 'yarn', 'yarn_check_stylist_playground.json')
	];
	const analyzers = analyzerPaths
		.filter((analyzerPath) => fs.existsSync(analyzerPath))
		.map((analyzerPath) => {
			const payload = readStylistOutputJsonFile<{
				timestamp?: string;
				project?: string;
				success?: boolean;
				return_code?: number;
				summary?: { total_errors?: number; total_files_with_errors?: number };
			}>(analyzerPath);
			return {
				path: normalizeRepoRelativePath(analyzerPath),
				timestamp: payload?.timestamp ?? null,
				project: payload?.project ?? null,
				success: payload?.success ?? null,
				returnCode: payload?.return_code ?? null,
				totalErrors: payload?.summary?.total_errors ?? 0,
				totalFilesWithErrors: payload?.summary?.total_files_with_errors ?? 0
			};
		});

	return json({
		report: {
			id: latest.runId,
			tool: 'errors',
			title: 'Errors',
			status: items.length > 0 || analyzers.some((analyzer) => analyzer.totalErrors > 0) ? 'failed' : 'success',
			updatedAt: latest.updatedAt,
			outputPath: latest.path,
			readmePath: normalizeRepoRelativePath(path.join(latest.absolutePath, 'README.md')),
			jsonPaths: jsonFiles.map((file) => file.path),
			errorCount: Math.max(items.length, analyzers.reduce((count, analyzer) => count + analyzer.totalErrors, 0)),
			warningCount: 0,
			totalFiles: files.length,
			serverOnly: true
		},
		analyzers,
		items,
		markdownPreview: readStylistOutputMarkdownFile(path.join(latest.absolutePath, 'README.md'))
	});
}
