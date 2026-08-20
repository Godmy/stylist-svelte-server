import fs from 'node:fs';
import path from 'node:path';
import { json, type RequestEvent } from '@sveltejs/kit';
import { ERROR_LOG_FILE } from '$stylist/server/const/value/error-log-file';
import { FileManager } from '$stylist/server/class/manager/file';
import type { ErrorLog } from '$stylist/server/type/object/error-log';

export class DiagnosticManager {
	static appendErrorLog(payload: {
		timestamp: string;
		source: ErrorLog['source'];
		routeId: string | null;
		url: string;
		method: string;
		message: string;
		stack: string | null;
		name: string | null;
		status: number;
		details?: unknown;
	}): void {
		const entry: ErrorLog = {
			timestamp: payload.timestamp,
			source: payload.source,
			routeId: payload.routeId,
			url: payload.url,
			method: payload.method,
			message: payload.message,
			stack: payload.stack,
			name: payload.name,
			status: payload.status,
			details:
				payload.details && typeof payload.details === 'object'
					? (payload.details as Record<string, unknown>)
					: {}
		};

		try {
			const logFilePath = this.getErrorLogFilePath();
			fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
			fs.appendFileSync(logFilePath, `${JSON.stringify(entry)}\n`, 'utf8');
		} catch (error) {
			const fallbackLogFilePath = path.resolve(process.cwd(), '.logs', 'runtime-errors.jsonl');
			const fallbackEntry = {
				...entry,
				details: {
					...entry.details,
					logWriteFailure:
						error instanceof Error
							? { message: error.message, stack: error.stack ?? null }
							: { message: String(error), stack: null }
				}
			};

			try {
				fs.mkdirSync(path.dirname(fallbackLogFilePath), { recursive: true });
				fs.appendFileSync(fallbackLogFilePath, `${JSON.stringify(fallbackEntry)}\n`, 'utf8');
			} catch (fallbackError) {
				console.error('appendErrorLog failed', fallbackEntry, fallbackError);
			}
		}
	}

	static findLatestStylistOutputDirectory(source: 'auditor' | 'errors') {
		const repoRoot = this.getRepoRootPath();
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
					path: FileManager.normalizeRepoRelativePath(absolutePath),
					updatedAt: fs.statSync(absolutePath).mtime.toISOString()
				};
			})
			.sort((left, right) => right.runId.localeCompare(left.runId))[0];

		return latestDirectory ?? null;
	}

	static listStylistOutputFiles(inputDirectoryPath: string) {
		const directoryPath = path.resolve(inputDirectoryPath);

		if (!fs.existsSync(directoryPath) || !fs.statSync(directoryPath).isDirectory()) {
			return [];
		}

		const files: Array<{
			path: string;
			name: string;
			extension: string;
			size: number;
			updatedAt: string;
		}> = [];

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
						path: FileManager.normalizeRepoRelativePath(entryPath),
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

	static readStylistOutputJsonFile<T = unknown>(inputPath: string): T | null {
		const absolutePath = path.resolve(inputPath);

		if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
			return null;
		}

		return JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as T;
	}

	static readStylistOutputMarkdownFile(inputPath: string) {
		const absolutePath = path.resolve(inputPath);
		const previewLimit = 128 * 1024;

		if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
			return null;
		}

		const content = fs.readFileSync(absolutePath, 'utf8');

		return {
			path: FileManager.normalizeRepoRelativePath(absolutePath),
			content: content.slice(0, previewLimit),
			truncated: content.length > previewLimit,
			size: fs.statSync(absolutePath).size
		};
	}

	static readStylistDiOutput() {
		const outputPath = path.join(this.getRepoRootPath(), 'stylist', 'di', 'output');

		return {
			outputPath,
			outputRelativePath: FileManager.normalizeRepoRelativePath(outputPath),
			files: this.listStylistOutputFiles(outputPath),
			dependencyTreePath: FileManager.normalizeRepoRelativePath(
				path.join(outputPath, 'step-3-component-dependency-trees.json')
			),
			filesByKeyPath: FileManager.normalizeRepoRelativePath(
				path.join(outputPath, 'step-1-files-by-key.json')
			),
			crossdomainLinksPath: FileManager.normalizeRepoRelativePath(
				path.join(outputPath, 'step-6-crossdomain-links.json')
			)
		};
	}

	static readStylistIndexationOutput() {
		const outputPath = path.join(this.getRepoRootPath(), 'stylist', 'indexation', 'output');

		return {
			outputPath,
			outputRelativePath: FileManager.normalizeRepoRelativePath(outputPath),
			files: this.listStylistOutputFiles(outputPath),
			markdownPreview: this.readStylistOutputMarkdownFile(path.join(outputPath, 'result.md')),
			tree: this.readStylistOutputJsonFile(path.join(outputPath, 'stylist-svelte.json')),
			componentMap: this.readStylistOutputJsonFile<Record<string, unknown>>(
				path.join(outputPath, 'stylist-svelte-components.json')
			)
		};
	}

	static readDependencyJsonFile<T>(fileName: string): T | null {
		const filePath = this.getDiOutputFilePath(fileName);

		if (!filePath || !fs.existsSync(filePath)) {
			return null;
		}

		return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
	}

	static getDependencyResponse(event: RequestEvent): Response {
		type DependencyTreeNode = {
			key: string;
			children?: DependencyTreeNode[];
		};

		type TreeNode = {
			id: string;
			label: string;
			children?: TreeNode[];
			expanded?: boolean;
		};

		type DependencyFileEntry = {
			file?: string;
			raw_content?: string;
		};

		type DependencySourceEntry = {
			files?: DependencyFileEntry[];
		};

		const flattenDependencyTree = (
			node: DependencyTreeNode | null
		): Array<{ key: string; depth: number }> => {
			if (!node?.children) {
				return [];
			}

			const seen = new Set<string>();
			const dependencies: Array<{ key: string; depth: number }> = [];

			function visit(children: DependencyTreeNode[], depth: number): void {
				for (const child of children) {
					if (!seen.has(child.key)) {
						seen.add(child.key);
						dependencies.push({ key: child.key, depth });
					}

					if (child.children) {
						visit(child.children, depth + 1);
					}
				}
			}

			visit(node.children, 1);
			return dependencies;
		};

		const mapDependencyTreeNodes = (nodes: DependencyTreeNode[] | undefined): TreeNode[] =>
			nodes?.map((node) => ({
				id: node.key,
				label: node.key,
				expanded: true,
				children: mapDependencyTreeNodes(node.children)
			})) ?? [];

		const componentKey = event.url.searchParams.get('component')?.replace(/\//g, '\\') ?? '';
		const requestedDependencyKey =
			event.url.searchParams.get('dependency')?.replace(/\//g, '\\') ?? '';

		if (!componentKey) {
			return json({ error: 'Missing "component" query parameter.' }, { status: 400 });
		}

		const dependencyTrees = this.readDependencyJsonFile<Record<string, DependencyTreeNode>>(
			'step-3-component-dependency-trees.json'
		);

		if (!dependencyTrees) {
			return json({ error: 'DI dependency tree output is not available.' }, { status: 404 });
		}

		const componentTree = dependencyTrees[componentKey] ?? null;
		const dependencies = flattenDependencyTree(componentTree);
		const selectedDependencyKey =
			dependencies.find((dependency) => dependency.key === requestedDependencyKey)?.key ??
			dependencies[0]?.key ??
			'';
		const sourceByKey = selectedDependencyKey
			? this.readDependencyJsonFile<Record<string, DependencySourceEntry>>('step-1-files-by-key.json')
			: null;
		const selectedDependencyFiles =
			sourceByKey?.[selectedDependencyKey]?.files?.map((file) => ({
				name: file.file ?? 'source',
				content: file.raw_content ?? ''
			})) ?? [];

		return json({
			componentKey,
			dependencies,
			dependencyTreeNodes: mapDependencyTreeNodes(componentTree?.children),
			selectedDependencyKey,
			selectedDependencyFiles
		});
	}

	private static getDiOutputFilePath(fileName: string): string | null {
		const outputDirectoryPath = [
			path.resolve(process.cwd(), '..', 'stylist', 'di', 'output'),
			path.resolve(process.cwd(), 'stylist', 'di', 'output')
		].find((candidate) => fs.existsSync(candidate));

		if (!outputDirectoryPath) {
			return null;
		}

		return path.join(outputDirectoryPath, fileName);
	}

	private static getErrorLogFilePath(): string {
		return path.resolve(process.cwd(), '.logs', ERROR_LOG_FILE);
	}

	private static getRepoRootPath(): string {
		const cwd = path.resolve(process.cwd());
		return path.basename(cwd) === 'stylist-svelte' ? path.resolve(cwd, '..') : cwd;
	}
}
