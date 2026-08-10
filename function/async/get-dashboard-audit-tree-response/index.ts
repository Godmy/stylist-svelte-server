import { json } from '@sveltejs/kit';
import path from 'node:path';
import { findLatestStylistOutputDirectory } from '$stylist/server/function/script/find-latest-stylist-output-directory';
import { normalizeRepoRelativePath } from '$stylist/server/function/script/normalize-repo-relative-path';
import { readStylistOutputJsonFile } from '$stylist/server/function/script/read-stylist-output-json-file';
import { readStylistOutputMarkdownFile } from '$stylist/server/function/script/read-stylist-output-markdown-file';

export function getDashboardAuditTreeResponse(): Response {
	const latest = findLatestStylistOutputDirectory('auditor');

	if (!latest) {
		return json({ error: 'Auditor output is not available.' }, { status: 404 });
	}

	const consolidated = readStylistOutputJsonFile<{
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

	const nodeMap = new Map<string, { id: string; label: string; kind: string; path: string; children: unknown[]; errorCount: number; warningCount: number; fileCount: number; status: string; domain?: string; cluster?: string; joint?: string; family?: string }>();
	const root = { id: 'root', label: 'stylist-svelte', kind: 'root', path: 'stylist-svelte/src/lib', children: [] as unknown[], errorCount: 0, warningCount: 0, fileCount: 0, status: 'ok' };
	const addNode = (id: string, label: string, kind: string, pathValue: string, parent: { children: unknown[] }, domain?: string, cluster?: string, joint?: string, family?: string): { id: string; label: string; kind: string; path: string; children: unknown[]; errorCount: number; warningCount: number; fileCount: number; status: string; domain?: string; cluster?: string; joint?: string; family?: string } => {
		const existing = nodeMap.get(id);
		if (existing) return existing;
		const next = {
			id,
			label,
			kind,
			path: pathValue,
			children: [],
			errorCount: 0,
			warningCount: 0,
			fileCount: 0,
			status: 'ok',
			domain: kind === 'domain' || kind === 'cluster' || kind === 'joint' || kind === 'family' || kind === 'file' ? domain : undefined,
			cluster: kind === 'cluster' || kind === 'joint' || kind === 'family' || kind === 'file' ? cluster : undefined,
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
			const domainNode = addNode(`domain:${domain}`, domain, 'domain', `stylist-svelte/src/lib/${domain}`, root, domain);
			const clusterNode = cluster
				? addNode(`cluster:${domain}/${cluster}`, cluster, 'cluster', `stylist-svelte/src/lib/${domain}/${cluster}`, domainNode, domain, cluster)
				: domainNode;
			const jointNode = cluster && joint
				? addNode(`joint:${domain}/${cluster}/${joint}`, joint, 'joint', `stylist-svelte/src/lib/${domain}/${cluster}/${joint}`, clusterNode, domain, cluster, joint)
				: clusterNode;
			domainNode.fileCount += fileCount;
			if (clusterNode !== domainNode) clusterNode.fileCount += fileCount;
			if (jointNode !== clusterNode) jointNode.fileCount += fileCount;
		}
	}

	const issues = (consolidated.reports ?? []).flatMap((report) =>
		(report.issues ?? []).map((issue) => {
			const relativeFile = issue.file ? normalizeRepoRelativePath(issue.file) : '';
			const segments = relativeFile.split('/src/lib/')[1]?.split('/') ?? [];
			const domain = segments[0] ?? null;
			const cluster = report.cluster ?? segments[1] ?? null;
			const joint = report.joint ?? segments[2] ?? null;
			const family = segments[3] ?? null;
			const severity = issue.severity === 'warning' ? 'warning' : 'error';
			const domainNode = domain ? addNode(`domain:${domain}`, domain, 'domain', `stylist-svelte/src/lib/${domain}`, root, domain) : root;
			const clusterNode = domain && cluster ? addNode(`cluster:${domain}/${cluster}`, cluster, 'cluster', `stylist-svelte/src/lib/${domain}/${cluster}`, domainNode, domain, cluster) : domainNode;
			const jointNode = domain && cluster && joint ? addNode(`joint:${domain}/${cluster}/${joint}`, joint, 'joint', `stylist-svelte/src/lib/${domain}/${cluster}/${joint}`, clusterNode, domain, cluster, joint) : clusterNode;
			const familyNode = domain && cluster && joint && family ? addNode(`family:${domain}/${cluster}/${joint}/${family}`, family, 'family', `stylist-svelte/src/lib/${domain}/${cluster}/${joint}/${family}`, jointNode, domain, cluster, joint, family) : jointNode;
			const fileId = relativeFile ? `file:${relativeFile}` : '';
			const knownFileNode = fileId ? nodeMap.has(fileId) : true;
			const fileNode = relativeFile ? addNode(fileId, path.basename(relativeFile), 'file', relativeFile, familyNode, domain ?? undefined, cluster ?? undefined, joint ?? undefined, family ?? undefined) : null;
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
				fileNode.status = fileNode.errorCount > 0 ? 'error' : fileNode.warningCount > 0 ? 'warning' : 'ok';
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
			readmePath: normalizeRepoRelativePath(path.join(latest.absolutePath, 'README.md')),
			jsonPaths: [normalizeRepoRelativePath(path.join(latest.absolutePath, 'json', 'consolidated.json'))],
			errorCount: root.errorCount,
			warningCount: root.warningCount,
			totalFiles: consolidated.total_files_scanned ?? 0,
			serverOnly: true
		},
		root: { ...root, status: root.errorCount > 0 ? 'error' : root.warningCount > 0 ? 'warning' : 'ok', fileCount: consolidated.total_files_scanned ?? root.fileCount },
		issues,
		markdownPreview: readStylistOutputMarkdownFile(path.join(latest.absolutePath, 'README.md'))
	});
}
