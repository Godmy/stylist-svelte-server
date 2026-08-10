import { json } from '@sveltejs/kit';
import fs from 'node:fs';
import path from 'node:path';
import { findLatestStylistOutputDirectory } from '$stylist/server/function/script/find-latest-stylist-output-directory';
import { listStylistOutputFiles } from '$stylist/server/function/script/list-stylist-output-files';
import { normalizeRepoRelativePath } from '$stylist/server/function/script/normalize-repo-relative-path';
import { readStylistDiOutput } from '$stylist/server/function/script/read-stylist-di-output';
import { readStylistIndexationOutput } from '$stylist/server/function/script/read-stylist-indexation-output';
import { readStylistOutputJsonFile } from '$stylist/server/function/script/read-stylist-output-json-file';

export function getDashboardReportsLatestResponse(): Response {
	const cwd = path.resolve(process.cwd());
	const repoRoot = path.basename(cwd) === 'stylist-svelte' ? path.resolve(cwd, '..') : cwd;
	const now = new Date().toISOString();
	const auditor = findLatestStylistOutputDirectory('auditor');
	const errors = findLatestStylistOutputDirectory('errors');
	const indexation = readStylistIndexationOutput();
	const di = readStylistDiOutput();
	const auditorJson = auditor
		? readStylistOutputJsonFile<{
				timestamp?: string;
				total_files_scanned?: number;
				total_issues?: number;
				reports?: Array<{ issues?: Array<{ severity?: string }> }>;
			}>(path.join(auditor.absolutePath, 'json', 'consolidated.json'))
		: null;
	const auditorIssues = auditorJson?.reports?.flatMap((report) => report.issues ?? []) ?? [];
	const errorsFiles = errors ? listStylistOutputFiles(errors.absolutePath) : [];
	const errorJsonFiles = errorsFiles.filter((file) => file.extension === 'json');
	const analyzerPayloads = [
		path.join(repoRoot, 'stylist', 'errors', 'npx', 'tsc_stylist_playground.json'),
		path.join(repoRoot, 'stylist', 'errors', 'npx', 'tsc_stylist_svelte.json'),
		path.join(repoRoot, 'stylist', 'errors', 'yarn', 'yarn_check_stylist_svelte.json'),
		path.join(repoRoot, 'stylist', 'errors', 'yarn', 'yarn_check_stylist_playground.json')
	]
		.map((analyzerPath) =>
			readStylistOutputJsonFile<{
				timestamp?: string;
				summary?: { total_errors?: number; total_files_with_errors?: number };
			}>(analyzerPath)
		)
		.filter((payload): payload is { timestamp?: string; summary?: { total_errors?: number; total_files_with_errors?: number } } => Boolean(payload));
	const analyzerErrorCount = analyzerPayloads.reduce((count, payload) => count + (payload.summary?.total_errors ?? 0), 0);
	const analyzerFilesWithErrors = analyzerPayloads.reduce((count, payload) => count + (payload.summary?.total_files_with_errors ?? 0), 0);
	const reports = [
		{
			id: auditor?.runId ?? 'auditor-missing',
			tool: 'auditor',
			title: 'Auditor',
			status: !auditor ? 'unknown' : (auditorIssues.some((issue) => issue.severity === 'error') ? 'failed' : auditorIssues.length > 0 ? 'warning' : 'success'),
			updatedAt: auditorJson?.timestamp ?? auditor?.updatedAt,
			outputPath: auditor?.path,
			readmePath: auditor ? normalizeRepoRelativePath(path.join(auditor.absolutePath, 'README.md')) : undefined,
			jsonPaths: auditor ? [normalizeRepoRelativePath(path.join(auditor.absolutePath, 'json', 'consolidated.json'))] : [],
			errorCount: auditorIssues.filter((issue) => issue.severity === 'error').length,
			warningCount: auditorIssues.filter((issue) => issue.severity === 'warning').length,
			totalFiles: auditorJson?.total_files_scanned ?? 0,
			serverOnly: true
		},
		{
			id: errors?.runId ?? 'errors-missing',
			tool: 'errors',
			title: 'Errors',
			status: !errors ? 'unknown' : (analyzerErrorCount > 0 ? 'failed' : 'success'),
			updatedAt: analyzerPayloads.map((payload) => payload.timestamp).filter((value): value is string => typeof value === 'string').sort().at(-1) ?? errors?.updatedAt,
			outputPath: errors?.path,
			readmePath: errors ? normalizeRepoRelativePath(path.join(errors.absolutePath, 'README.md')) : undefined,
			jsonPaths: errorJsonFiles.map((file) => file.path),
			errorCount: analyzerErrorCount,
			warningCount: 0,
			totalFiles: analyzerFilesWithErrors,
			serverOnly: true
		},
		{
			id: 'indexation-current',
			tool: 'indexation',
			title: 'Indexation',
			status: fs.existsSync(indexation.outputPath) ? 'success' : 'unknown',
			updatedAt: indexation.files.map((file) => file.updatedAt).sort().at(-1),
			outputPath: indexation.outputRelativePath,
			readmePath: normalizeRepoRelativePath(path.join(indexation.outputPath, 'result.md')),
			jsonPaths: [
				normalizeRepoRelativePath(path.join(indexation.outputPath, 'stylist-svelte.json')),
				normalizeRepoRelativePath(path.join(indexation.outputPath, 'stylist-svelte-components.json'))
			],
			errorCount: 0,
			warningCount: 0,
			totalFiles: indexation.files.length,
			serverOnly: true
		},
		{
			id: 'di-current',
			tool: 'di',
			title: 'Dependency Injection',
			status: fs.existsSync(di.outputPath) ? 'success' : 'unknown',
			updatedAt: di.files.map((file) => file.updatedAt).sort().at(-1),
			outputPath: di.outputRelativePath,
			readmePath: undefined,
			jsonPaths: [di.dependencyTreePath, di.filesByKeyPath, di.crossdomainLinksPath].filter(Boolean),
			errorCount: 0,
			warningCount: 0,
			totalFiles: di.files.length,
			serverOnly: true
		}
	];

	return json({
		generatedAt: now,
		reports,
		status: {
			status: reports.some((report) => report.status === 'failed')
				? 'error'
				: reports.some((report) => report.status === 'warning')
					? 'warning'
					: reports.some((report) => report.status === 'unknown')
						? 'unknown'
						: 'ok',
			errorCount: reports.reduce((count, report) => count + report.errorCount, 0),
			warningCount: reports.reduce((count, report) => count + report.warningCount, 0),
			totalFiles: reports.reduce((count, report) => count + report.totalFiles, 0),
			updatedAt: reports
				.map((report) => report.updatedAt)
				.filter((value): value is string => typeof value === 'string')
				.sort()
				.at(-1),
			steps: reports
		}
	});
}
