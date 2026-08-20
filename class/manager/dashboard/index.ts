import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import { DiagnosticManager } from '$stylist/server/class/manager/diagnostic';
import { FileManager } from '$stylist/server/class/manager/file';

export class DashboardManager {
	static getDashboardReportsLatestResponse(): Response {
		const cwd = path.resolve(process.cwd());
		const repoRoot = path.basename(cwd) === 'stylist-svelte' ? path.resolve(cwd, '..') : cwd;
		const now = new Date().toISOString();
		const auditor = DiagnosticManager.findLatestStylistOutputDirectory('auditor');
		const errors = DiagnosticManager.findLatestStylistOutputDirectory('errors');
		const indexation = DiagnosticManager.readStylistIndexationOutput();
		const di = DiagnosticManager.readStylistDiOutput();
		const auditorJson = auditor
			? DiagnosticManager.readStylistOutputJsonFile<{
					timestamp?: string;
					total_files_scanned?: number;
					total_issues?: number;
					reports?: Array<{ issues?: Array<{ severity?: string }> }>;
				}>(path.join(auditor.absolutePath, 'json', 'consolidated.json'))
			: null;
		const auditorIssues = auditorJson?.reports?.flatMap((report) => report.issues ?? []) ?? [];
		const errorsFiles = errors ? DiagnosticManager.listStylistOutputFiles(errors.absolutePath) : [];
		const errorJsonFiles = errorsFiles.filter((file) => file.extension === 'json');
		const analyzerPayloads = [
			path.join(repoRoot, 'stylist', 'errors', 'npx', 'tsc_stylist_playground.json'),
			path.join(repoRoot, 'stylist', 'errors', 'npx', 'tsc_stylist_svelte.json'),
			path.join(repoRoot, 'stylist', 'errors', 'yarn', 'yarn_check_stylist_svelte.json'),
			path.join(repoRoot, 'stylist', 'errors', 'yarn', 'yarn_check_stylist_playground.json')
		]
			.map((analyzerPath) =>
				DiagnosticManager.readStylistOutputJsonFile<{
					timestamp?: string;
					summary?: { total_errors?: number; total_files_with_errors?: number };
				}>(analyzerPath)
			)
			.filter(
				(
					payload
				): payload is {
					timestamp?: string;
					summary?: { total_errors?: number; total_files_with_errors?: number };
				} => Boolean(payload)
			);
		const analyzerErrorCount = analyzerPayloads.reduce(
			(count, payload) => count + (payload.summary?.total_errors ?? 0),
			0
		);
		const analyzerFilesWithErrors = analyzerPayloads.reduce(
			(count, payload) => count + (payload.summary?.total_files_with_errors ?? 0),
			0
		);
		const reports = [
			{
				id: auditor?.runId ?? 'auditor-missing',
				tool: 'auditor',
				title: 'Auditor',
				status: !auditor
					? 'unknown'
					: auditorIssues.some((issue) => issue.severity === 'error')
						? 'failed'
						: auditorIssues.length > 0
							? 'warning'
							: 'success',
				updatedAt: auditorJson?.timestamp ?? auditor?.updatedAt,
				outputPath: auditor?.path,
				readmePath: auditor
					? FileManager.normalizeRepoRelativePath(path.join(auditor.absolutePath, 'README.md'))
					: undefined,
				jsonPaths: auditor
					? [
							FileManager.normalizeRepoRelativePath(
								path.join(auditor.absolutePath, 'json', 'consolidated.json')
							)
						]
					: [],
				errorCount: auditorIssues.filter((issue) => issue.severity === 'error').length,
				warningCount: auditorIssues.filter((issue) => issue.severity === 'warning').length,
				totalFiles: auditorJson?.total_files_scanned ?? 0,
				serverOnly: true
			},
			{
				id: errors?.runId ?? 'errors-missing',
				tool: 'errors',
				title: 'Errors',
				status: !errors ? 'unknown' : analyzerErrorCount > 0 ? 'failed' : 'success',
				updatedAt:
					analyzerPayloads
						.map((payload) => payload.timestamp)
						.filter((value): value is string => typeof value === 'string')
						.sort()
						.at(-1) ?? errors?.updatedAt,
				outputPath: errors?.path,
				readmePath: errors
					? FileManager.normalizeRepoRelativePath(path.join(errors.absolutePath, 'README.md'))
					: undefined,
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
				readmePath: FileManager.normalizeRepoRelativePath(path.join(indexation.outputPath, 'result.md')),
				jsonPaths: [
					FileManager.normalizeRepoRelativePath(path.join(indexation.outputPath, 'stylist-svelte.json')),
					FileManager.normalizeRepoRelativePath(
						path.join(indexation.outputPath, 'stylist-svelte-components.json')
					)
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
				jsonPaths: [di.dependencyTreePath, di.filesByKeyPath, di.crossdomainLinksPath].filter(
					Boolean
				),
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

	static getDashboardIndexationLatestResponse(): Response {
		const indexation = DiagnosticManager.readStylistIndexationOutput();
		const outputPath = indexation.outputPath;
		const files = indexation.files;
		const tree = indexation.tree as {
			name?: string;
			path?: string;
			children?: unknown[];
			files?: string[];
		} | null;
		const componentMap = indexation.componentMap;
		const updatedAt = files.map((file) => file.updatedAt).sort().at(-1) ?? null;
		const summarizeNode = (
			node: { name?: string; path?: string; children?: unknown[]; files?: string[] } | null,
			depth = 0
		): unknown => ({
			name: node?.name ?? '',
			path: node?.path ? FileManager.normalizeRepoRelativePath(node.path) : null,
			fileCount: node?.files?.length ?? 0,
			childCount: node?.children?.length ?? 0,
			children:
				depth >= 2
					? []
					: (node?.children ?? [])
							.slice(0, 50)
							.map((child) =>
								summarizeNode(
									child as {
										name?: string;
										path?: string;
										children?: unknown[];
										files?: string[];
									},
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
				outputPath: FileManager.normalizeRepoRelativePath(outputPath),
				readmePath: FileManager.normalizeRepoRelativePath(path.join(outputPath, 'result.md')),
				jsonPaths: [
					FileManager.normalizeRepoRelativePath(path.join(outputPath, 'stylist-svelte.json')),
					FileManager.normalizeRepoRelativePath(
						path.join(outputPath, 'stylist-svelte-components.json')
					)
				],
				errorCount: 0,
				warningCount: 0,
				totalFiles: files.length,
				serverOnly: true
			},
			summary: {
				status: files.length > 0 ? 'success' : 'unknown',
				updatedAt,
				resultPath: FileManager.normalizeRepoRelativePath(path.join(outputPath, 'result.md')),
				treePath: FileManager.normalizeRepoRelativePath(path.join(outputPath, 'stylist-svelte.json')),
				componentMapPath: FileManager.normalizeRepoRelativePath(
					path.join(outputPath, 'stylist-svelte-components.json')
				),
				outputPath: FileManager.normalizeRepoRelativePath(outputPath),
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

	static getDashboardErrorsLatestResponse(): Response {
		const cwd = path.resolve(process.cwd());
		const repoRoot = path.basename(cwd) === 'stylist-svelte' ? path.resolve(cwd, '..') : cwd;
		const latest = DiagnosticManager.findLatestStylistOutputDirectory('errors');

		if (!latest) {
			return json({ error: 'Errors output is not available.' }, { status: 404 });
		}

		const files = DiagnosticManager.listStylistOutputFiles(latest.absolutePath);
		const jsonFiles = files.filter((file) => file.extension === 'json');
		const items = jsonFiles.flatMap((file) => {
			const payload = DiagnosticManager.readStylistOutputJsonFile<{
				project?: string;
				file?: string;
				errors?: Array<{
					tool?: string;
					line?: number;
					column?: number;
					severity?: string;
					code?: string;
					message?: string;
				}>;
			}>(path.join(repoRoot, file.path));
			return (payload?.errors ?? []).map((error) => ({
				id: `${latest.runId}:${payload?.project ?? 'unknown'}:${payload?.file ?? file.path}:${error.line ?? 0}:${error.column ?? 0}:${error.code ?? ''}`,
				project:
					payload?.project === 'stylist-svelte' || payload?.project === 'stylist-playground'
						? payload.project
						: 'unknown',
				path: payload?.file ? FileManager.normalizeRepoRelativePath(payload.file) : file.path,
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
				const payload = DiagnosticManager.readStylistOutputJsonFile<{
					timestamp?: string;
					project?: string;
					success?: boolean;
					return_code?: number;
					summary?: { total_errors?: number; total_files_with_errors?: number };
				}>(analyzerPath);
				return {
					path: FileManager.normalizeRepoRelativePath(analyzerPath),
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
				status:
					items.length > 0 || analyzers.some((analyzer) => analyzer.totalErrors > 0)
						? 'failed'
						: 'success',
				updatedAt: latest.updatedAt,
				outputPath: latest.path,
				readmePath: FileManager.normalizeRepoRelativePath(path.join(latest.absolutePath, 'README.md')),
				jsonPaths: jsonFiles.map((file) => file.path),
				errorCount: Math.max(
					items.length,
					analyzers.reduce((count, analyzer) => count + analyzer.totalErrors, 0)
				),
				warningCount: 0,
				totalFiles: files.length,
				serverOnly: true
			},
			analyzers,
			items,
			markdownPreview: DiagnosticManager.readStylistOutputMarkdownFile(
				path.join(latest.absolutePath, 'README.md')
			)
		});
	}

	static getDashboardAuditTreeResponse(): Response {
		const latest = DiagnosticManager.findLatestStylistOutputDirectory('auditor');

		if (!latest) {
			return json({ error: 'Auditor output is not available.' }, { status: 404 });
		}

		const consolidated = DiagnosticManager.readStylistOutputJsonFile<{
			timestamp?: string;
			total_files_scanned?: number;
			total_issues?: number;
			reports?: Array<{
				cluster?: string;
				joint?: string;
				files_scanned?: number;
				domains?: string[];
				files_by_domain?: Record<string, number>;
				issues?: Array<{ file?: string; severity?: string; message?: string; timestamp?: string }>;
			}>;
		}>(path.join(latest.absolutePath, 'json', 'consolidated.json'));

		if (!consolidated) {
			return json({ error: 'Auditor consolidated report is not available.' }, { status: 404 });
		}

		type AuditTreeNode = {
			id: string;
			label: string;
			kind: string;
			path: string;
			children: AuditTreeNode[];
			errorCount: number;
			warningCount: number;
			fileCount: number;
			status: string;
			domain?: string;
			cluster?: string;
			joint?: string;
			family?: string;
		};

		const nodeMap = new Map<string, AuditTreeNode>();
		const root: AuditTreeNode = {
			id: 'root',
			label: 'stylist-svelte',
			kind: 'root',
			path: 'stylist-svelte/src/lib',
			children: [],
			errorCount: 0,
			warningCount: 0,
			fileCount: 0,
			status: 'ok'
		};
		const addNode = (
			id: string,
			label: string,
			kind: string,
			pathValue: string,
			parent: AuditTreeNode,
			domain?: string,
			cluster?: string,
			joint?: string,
			family?: string
		): AuditTreeNode => {
			const existing = nodeMap.get(id);
			if (existing) return existing;
			const next: AuditTreeNode = {
				id,
				label,
				kind,
				path: pathValue,
				children: [],
				errorCount: 0,
				warningCount: 0,
				fileCount: 0,
				status: 'ok',
				domain:
					kind === 'domain' ||
					kind === 'cluster' ||
					kind === 'joint' ||
					kind === 'family' ||
					kind === 'file'
						? domain
						: undefined,
				cluster:
					kind === 'cluster' || kind === 'joint' || kind === 'family' || kind === 'file'
						? cluster
						: undefined,
				joint: kind === 'joint' || kind === 'family' || kind === 'file' ? joint : undefined,
				family: kind === 'family' || kind === 'file' ? family : undefined
			};
			nodeMap.set(id, next);
			parent.children.push(next);
			return next;
		};

		for (const report of consolidated.reports ?? []) {
			const cluster = report.cluster;
			const joint = report.joint;
			for (const [domain, fileCount] of Object.entries(report.files_by_domain ?? {})) {
				const domainNode = addNode(
					`domain:${domain}`,
					domain,
					'domain',
					`stylist-svelte/src/lib/${domain}`,
					root,
					domain
				);
				const clusterNode = cluster
					? addNode(
							`cluster:${domain}/${cluster}`,
							cluster,
							'cluster',
							`stylist-svelte/src/lib/${domain}/${cluster}`,
							domainNode,
							domain,
							cluster
						)
					: domainNode;
				const jointNode =
					cluster && joint
						? addNode(
								`joint:${domain}/${cluster}/${joint}`,
								joint,
								'joint',
								`stylist-svelte/src/lib/${domain}/${cluster}/${joint}`,
								clusterNode,
								domain,
								cluster,
								joint
							)
						: clusterNode;
				domainNode.fileCount += fileCount;
				if (clusterNode !== domainNode) clusterNode.fileCount += fileCount;
				if (jointNode !== clusterNode) jointNode.fileCount += fileCount;
			}
		}

		const issues = (consolidated.reports ?? []).flatMap((report) =>
			(report.issues ?? []).map((issue) => {
				const relativeFile = issue.file ? FileManager.normalizeRepoRelativePath(issue.file) : '';
				const segments = relativeFile.split('/src/lib/')[1]?.split('/') ?? [];
				const domain = segments[0] ?? null;
				const cluster = report.cluster ?? segments[1] ?? null;
				const joint = report.joint ?? segments[2] ?? null;
				const family = segments[3] ?? null;
				const severity = issue.severity === 'warning' ? 'warning' : 'error';
				const domainNode = domain
					? addNode(
							`domain:${domain}`,
							domain,
							'domain',
							`stylist-svelte/src/lib/${domain}`,
							root,
							domain
						)
					: root;
				const clusterNode =
					domain && cluster
						? addNode(
								`cluster:${domain}/${cluster}`,
								cluster,
								'cluster',
								`stylist-svelte/src/lib/${domain}/${cluster}`,
								domainNode,
								domain,
								cluster
							)
						: domainNode;
				const jointNode =
					domain && cluster && joint
						? addNode(
								`joint:${domain}/${cluster}/${joint}`,
								joint,
								'joint',
								`stylist-svelte/src/lib/${domain}/${cluster}/${joint}`,
								clusterNode,
								domain,
								cluster,
								joint
							)
						: clusterNode;
				const familyNode =
					domain && cluster && joint && family
						? addNode(
								`family:${domain}/${cluster}/${joint}/${family}`,
								family,
								'family',
								`stylist-svelte/src/lib/${domain}/${cluster}/${joint}/${family}`,
								jointNode,
								domain,
								cluster,
								joint,
								family
							)
						: jointNode;
				const fileId = relativeFile ? `file:${relativeFile}` : '';
				const knownFileNode = fileId ? nodeMap.has(fileId) : true;
				const fileNode = relativeFile
					? addNode(
							fileId,
							path.basename(relativeFile),
							'file',
							relativeFile,
							familyNode,
							domain ?? undefined,
							cluster ?? undefined,
							joint ?? undefined,
							family ?? undefined
						)
					: null;
				if (fileNode && !knownFileNode) {
					fileNode.fileCount = 1;
					if (familyNode !== fileNode && familyNode.kind === 'family') familyNode.fileCount += 1;
				}
				for (const node of [root, domainNode, clusterNode, jointNode, familyNode]) {
					if (severity === 'warning') node.warningCount += 1;
					else node.errorCount += 1;
					node.status = node.errorCount > 0 ? 'error' : node.warningCount > 0 ? 'warning' : 'ok';
				}
				if (fileNode) {
					if (severity === 'warning') fileNode.warningCount += 1;
					else fileNode.errorCount += 1;
					fileNode.status =
						fileNode.errorCount > 0 ? 'error' : fileNode.warningCount > 0 ? 'warning' : 'ok';
				}
				return {
					file: relativeFile,
					domain,
					cluster,
					joint,
					family,
					severity,
					message: issue.message ?? '',
					timestamp: issue.timestamp ?? null,
					source: 'auditor'
				};
			})
		);

		return json({
			report: {
				id: latest.runId,
				tool: 'auditor',
				title: 'Auditor',
				status: root.errorCount > 0 ? 'failed' : root.warningCount > 0 ? 'warning' : 'success',
				updatedAt: consolidated.timestamp ?? latest.updatedAt,
				outputPath: latest.path,
				readmePath: FileManager.normalizeRepoRelativePath(path.join(latest.absolutePath, 'README.md')),
				jsonPaths: [
					FileManager.normalizeRepoRelativePath(
						path.join(latest.absolutePath, 'json', 'consolidated.json')
					)
				],
				errorCount: root.errorCount,
				warningCount: root.warningCount,
				totalFiles: consolidated.total_files_scanned ?? 0,
				serverOnly: true
			},
			root: {
				...root,
				status: root.errorCount > 0 ? 'error' : root.warningCount > 0 ? 'warning' : 'ok',
				fileCount: consolidated.total_files_scanned ?? root.fileCount
			},
			issues,
			markdownPreview: DiagnosticManager.readStylistOutputMarkdownFile(
				path.join(latest.absolutePath, 'README.md')
			)
		});
	}
}
