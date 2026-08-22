import fs from 'node:fs';
import path from 'node:path';
import { json, type RequestEvent } from '@sveltejs/kit';
import { BUILDER_LAYOUT_LIB_PATH } from '$stylist/server/const/value/builder-layout-lib-path/index';
import { CONTENT_PREVIEW_MAX_FILE_SIZE } from '$stylist/server/const/value/content-preview-max-file-size';
import { LIB_DIRECTORY_PATH } from '$stylist/server/const/value/lib-directory-path';
import { FileManager } from '$stylist/server/class/manager/file';
import type { TypeDomainComponentDescriptor } from '$stylist/domain/type/object/domain-component-descriptor';
import type { TypeDomainComponentProjection } from '$stylist/domain/type/object/domain-component-projection';

export class DomainManager {
	private static readonly slugPattern = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

	static getBuilderLayoutResponse(): Response {
		const content = FileManager.readLibTextFile(BUILDER_LAYOUT_LIB_PATH);
		return json(JSON.parse(content));
	}

	static async postBuilderLayoutResponse(event: RequestEvent): Promise<Response> {
		const payload = await event.request.json();

		if (
			typeof payload !== 'object' ||
			payload === null ||
			!('version' in payload) ||
			!('sections' in payload) ||
			!('instances' in payload) ||
			typeof payload.version !== 'number' ||
			!Array.isArray(payload.sections) ||
			!Array.isArray(payload.instances)
		) {
			return json({ error: 'Invalid builder payload.' }, { status: 400 });
		}

		for (const instance of payload.instances) {
			if (
				typeof instance !== 'object' ||
				instance === null ||
				!('id' in instance) ||
				!('descriptorEntityPath' in instance) ||
				typeof instance.id !== 'string' ||
				typeof instance.descriptorEntityPath !== 'string'
			) {
				return json({ error: 'Invalid builder instance payload.' }, { status: 400 });
			}
		}

		FileManager.writeLibTextFile(BUILDER_LAYOUT_LIB_PATH, `${JSON.stringify(payload, null, 2)}\n`);

		return json({ ok: true });
	}

	static getContentFileResponse(event: RequestEvent): Response {
		const requestedPath = event.url.searchParams.get('path');

		if (!requestedPath) {
			return json({ error: 'Missing "path" query parameter.' }, { status: 400 });
		}

		const absolutePath = FileManager.normalizeLibPath(requestedPath);

		if (!absolutePath) {
			return json({ error: 'Path is outside src/lib.' }, { status: 400 });
		}

		if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
			return json({ error: 'File not found.' }, { status: 404 });
		}

		if (fs.statSync(absolutePath).size > CONTENT_PREVIEW_MAX_FILE_SIZE) {
			return json({ error: 'File is too large to preview.' }, { status: 413 });
		}

		return json({ content: fs.readFileSync(absolutePath, 'utf8') });
	}

	static async postContentBacklogResponse(event: RequestEvent): Promise<Response> {
		const payload = (await event.request.json()) as {
			file?: unknown;
			id?: unknown;
			text?: unknown;
			image?: unknown;
			audio?: unknown;
		};

		if (
			typeof payload.file !== 'string' ||
			typeof payload.id !== 'string' ||
			typeof payload.text !== 'string'
		) {
			return json({ error: 'Invalid request payload.' }, { status: 400 });
		}

		if (
			payload.file.trim().length === 0 ||
			payload.id.trim().length === 0 ||
			payload.text.trim().length === 0
		) {
			return json({ error: 'Issue payload cannot be empty.' }, { status: 400 });
		}

		const normalizedFilePath = payload.file.replace(/\\/g, '/').replace(/^\/+/, '');
		const absoluteFilePath = path.resolve(LIB_DIRECTORY_PATH, normalizedFilePath);

		if (!absoluteFilePath.startsWith(LIB_DIRECTORY_PATH)) {
			return json({ error: 'Unsafe file path.' }, { status: 400 });
		}

		const issuesDirectoryPath = path.resolve(
			LIB_DIRECTORY_PATH,
			'data',
			'jsonl',
			'component',
			'issues'
		);
		const issuesFilePath = path.join(issuesDirectoryPath, 'index.jsonl');
		const issueRecord = {
			created_at: new Date().toISOString(),
			file: absoluteFilePath.replace(/\\/g, '/'),
			id: payload.id,
			text: payload.text,
			image: payload.image ?? null,
			audio: payload.audio ?? null
		};

		fs.mkdirSync(issuesDirectoryPath, { recursive: true });
		fs.appendFileSync(issuesFilePath, `${JSON.stringify(issueRecord)}\n`, 'utf8');

		return json({ ok: true, path: 'management/data/jsonl/component/issues/index.jsonl' });
	}

	static async postTemplateExportFileResponse(event: RequestEvent): Promise<Response> {
		const payload = await event.request.json();

		if (
			typeof payload !== 'object' ||
			payload === null ||
			!('domain' in payload) ||
			!('family' in payload) ||
			!('sections' in payload) ||
			!('instances' in payload) ||
			typeof payload.domain !== 'string' ||
			typeof payload.family !== 'string' ||
			!Array.isArray(payload.sections) ||
			!Array.isArray(payload.instances)
		) {
			return json({ error: 'Invalid template export payload.' }, { status: 400 });
		}

		if (!this.slugPattern.test(payload.domain) || !this.slugPattern.test(payload.family)) {
			return json(
				{ error: 'Domain and family must be lowercase kebab-case identifiers.' },
				{ status: 400 }
			);
		}

		for (const section of payload.sections) {
			if (
				typeof section !== 'object' ||
				section === null ||
				!('id' in section) ||
				!('columns' in section) ||
				!('items' in section) ||
				typeof section.id !== 'string' ||
				typeof section.columns !== 'number' ||
				!Array.isArray(section.items)
			) {
				return json({ error: 'Invalid section payload.' }, { status: 400 });
			}
		}

		for (const instance of payload.instances) {
			if (
				typeof instance !== 'object' ||
				instance === null ||
				!('id' in instance) ||
				!('componentPath' in instance) ||
				typeof instance.id !== 'string' ||
				typeof instance.componentPath !== 'string'
			) {
				return json({ error: 'Invalid instance payload.' }, { status: 400 });
			}
		}

		if (payload.instances.length === 0) {
			return json({ error: 'Add at least one component before exporting.' }, { status: 400 });
		}

		const relativePath = `${payload.domain}/component/template/${payload.family}/index.svelte`;
		const absolutePath = FileManager.normalizeLibPath(relativePath);

		if (!absolutePath) {
			return json({ error: 'Resolved path is outside the lib directory.' }, { status: 400 });
		}

		const overwritten = fs.existsSync(absolutePath);
		const source = this.buildTemplateLayoutSource({
			family: payload.family,
			sections: payload.sections,
			instances: payload.instances.map(
				(instance: { id: string; componentPath: string; config?: unknown }) => ({
					id: instance.id,
					componentPath: instance.componentPath,
					config:
						typeof instance.config === 'object' && instance.config !== null
							? (instance.config as Record<string, unknown>)
							: {}
				})
			)
		});

		FileManager.writeLibTextFile(relativePath, source);

		return json({ ok: true, path: relativePath, overwritten });
	}

	static getDomainComponentProjectionResponse(event: RequestEvent): Response {
		const entityPath = event.url.searchParams.get('entityPath');

		if (!entityPath) {
			return json({ error: 'Missing entityPath.' }, { status: 400 });
		}

		const descriptor = this.loadDomainComponentDescriptors().find(
			(candidate) => candidate.entityPath === entityPath
		);

		if (!descriptor) {
			return json({ error: 'Descriptor not found.' }, { status: 404 });
		}

		const projection: TypeDomainComponentProjection = {
			entityPath: descriptor.entityPath,
			architecture: {
				componentModulePath: descriptor.componentModulePath,
				recipeTypePath: descriptor.recipeTypePath,
				stateFunctionPath: descriptor.stateFunctionPath,
				contractPaths: descriptor.contractPaths
			},
			information: {
				recipeJson: descriptor.interfaceRecipeJsonPaths
					.map((filePath) => this.readLibJsonFile(filePath))
					.filter((value): value is unknown => value !== null),
				enumJson: descriptor.constEnumJsonPaths
					.map((filePath) => this.readLibJsonFile(filePath))
					.filter((value): value is unknown => value !== null),
				mapJson: descriptor.constMapJsonPaths
					.map((filePath) => this.readLibJsonFile(filePath))
					.filter((value): value is unknown => value !== null)
			},
			interaction: {
				stateJson: descriptor.functionStateJsonPaths
					.map((filePath) => this.readLibJsonFile(filePath))
					.filter((value): value is unknown => value !== null),
				storyModulePath: descriptor.storyModulePath,
				hasStatePipeline: descriptor.hasStatePipeline
			},
			controls: {
				controlJson: descriptor.controlDefinitionJsonPaths
					.map((filePath) => this.readLibJsonFile(filePath))
					.filter((value): value is unknown => value !== null)
			},
			contracts: {
				files: descriptor.contractPaths.map((filePath) => ({
					path: filePath,
					content: this.readLibTextFile(filePath)
				}))
			}
		};

		return json(projection);
	}

	static getDomainPageData() {
		return this.loadDomainPageData();
	}

	static loadDomainPageData(): {
		tree: Array<{
			name: string;
			clusters: Array<{
				name: string;
				joints: Array<{
					name: string;
					entities: Array<{
						name: string;
						path: string;
						files: Array<{
							name: string;
							path: string;
						}>;
					}>;
				}>;
			}>;
		}>;
		descriptors: TypeDomainComponentDescriptor[];
	} {
		type DomainFile = {
			name: string;
			path: string;
		};

		type DomainEntity = {
			name: string;
			path: string;
			files: DomainFile[];
		};

		type DomainJoint = {
			name: string;
			entities: DomainEntity[];
		};

		type DomainCluster = {
			name: string;
			joints: DomainJoint[];
		};

		type DomainTreeNode = {
			name: string;
			clusters: DomainCluster[];
		};

		const buildDomainNode = (domainName: string): DomainTreeNode | null => {
			const domainPath = path.join(LIB_DIRECTORY_PATH, domainName);
			const clusterNames = fs
				.readdirSync(domainPath, { withFileTypes: true })
				.filter((entry) => entry.isDirectory())
				.map((entry) => entry.name)
				.filter((name) => !name.startsWith('.'));

			const clusters = clusterNames
				.map((clusterName) => buildClusterNode(domainName, clusterName))
				.filter((node): node is DomainCluster => node !== null);

			if (clusters.length === 0) {
				return null;
			}

			return { name: domainName, clusters };
		};

		const buildClusterNode = (domainName: string, clusterName: string): DomainCluster | null => {
			const clusterPath = path.join(LIB_DIRECTORY_PATH, domainName, clusterName);
			const jointNames = fs
				.readdirSync(clusterPath, { withFileTypes: true })
				.filter((entry) => entry.isDirectory())
				.map((entry) => entry.name);

			const joints = jointNames
				.map((jointName) => buildJointNode(domainName, clusterName, jointName))
				.filter((node): node is DomainJoint => node !== null);

			if (joints.length === 0) {
				return null;
			}

			return { name: clusterName, joints };
		};

		const buildJointNode = (
			domainName: string,
			clusterName: string,
			jointName: string
		): DomainJoint | null => {
			const jointPath = path.join(LIB_DIRECTORY_PATH, domainName, clusterName, jointName);
			const entities = collectEntities(domainName, clusterName, jointName, jointPath);

			if (entities.length === 0) {
				return null;
			}

			return { name: jointName, entities };
		};

		const collectEntities = (
			domainName: string,
			clusterName: string,
			jointName: string,
			jointPath: string
		): DomainEntity[] => {
			const entities: DomainEntity[] = [];

			for (const entry of fs.readdirSync(jointPath, { withFileTypes: true })) {
				if (!entry.isDirectory()) {
					continue;
				}

				const entityPath = path.join(jointPath, entry.name);
				const files = collectEntityFiles(entityPath);

				if (files.length > 0) {
					entities.push({
						name: entry.name,
						path: `${domainName}/${clusterName}/${jointName}/${entry.name}`,
						files
					});
					continue;
				}

				for (const nestedEntity of collectNestedEntities(
					domainName,
					clusterName,
					jointName,
					entry.name,
					entityPath
				)) {
					entities.push(nestedEntity);
				}
			}

			return entities.sort((left, right) => left.name.localeCompare(right.name));
		};

		const collectNestedEntities = (
			domainName: string,
			clusterName: string,
			jointName: string,
			parentName: string,
			parentPath: string
		): DomainEntity[] => {
			const entities: DomainEntity[] = [];

			for (const entry of fs.readdirSync(parentPath, { withFileTypes: true })) {
				if (!entry.isDirectory()) {
					continue;
				}

				const entityPath = path.join(parentPath, entry.name);
				const files = collectEntityFiles(entityPath);

				if (files.length === 0) {
					continue;
				}

				entities.push({
					name: `${parentName}/${entry.name}`,
					path: `${domainName}/${clusterName}/${jointName}/${parentName}/${entry.name}`,
					files
				});
			}

			return entities.sort((left, right) => left.name.localeCompare(right.name));
		};

		const collectEntityFiles = (entityPath: string): DomainFile[] =>
			fs
				.readdirSync(entityPath, { withFileTypes: true })
				.filter((entry) => entry.isFile())
				.map((entry) => ({
					name: entry.name,
					path: path
						.relative(LIB_DIRECTORY_PATH, path.join(entityPath, entry.name))
						.replace(/\\/g, '/')
				}))
				.sort((left, right) => left.name.localeCompare(right.name));

		const tree = fs
			.readdirSync(LIB_DIRECTORY_PATH, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((domainEntry) => buildDomainNode(domainEntry.name))
			.filter((node): node is DomainTreeNode => node !== null)
			.sort((left, right) => left.name.localeCompare(right.name));

		return {
			tree,
			descriptors: this.loadDomainComponentDescriptors()
		};
	}

	static loadDomainComponentDescriptors(): TypeDomainComponentDescriptor[] {
		type ComponentJoint = 'atom' | 'molecule' | 'organism' | 'template';

		const toRelativePath = (absolutePath: string): string =>
			path.relative(LIB_DIRECTORY_PATH, absolutePath).replace(/\\/g, '/');

		const resolveLibPath = (...segments: string[]): string =>
			path.join(LIB_DIRECTORY_PATH, ...segments);

		const getExistingFilePath = (...segments: string[]): string | null => {
			const absolutePath = resolveLibPath(...segments);
			return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()
				? toRelativePath(absolutePath)
				: null;
		};

		const collectJsonPaths = (domainName: string): string[] => {
			const jsonRootPath = resolveLibPath(domainName, 'data', 'json');

			if (!fs.existsSync(jsonRootPath) || !fs.statSync(jsonRootPath).isDirectory()) {
				return [];
			}

			const jsonPaths: string[] = [];

			function walk(directoryPath: string): void {
				for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
					const entryPath = path.join(directoryPath, entry.name);
					if (entry.isDirectory()) {
						walk(entryPath);
						continue;
					}
					if (entry.isFile() && entry.name.endsWith('.json')) {
						jsonPaths.push(toRelativePath(entryPath));
					}
				}
			}

			walk(jsonRootPath);
			return jsonPaths.sort((left, right) => left.localeCompare(right));
		};

		const filterJsonPaths = (jsonPaths: string[], pattern: string): string[] =>
			jsonPaths.filter((jsonPath) => jsonPath.includes(pattern));

		const descriptors: TypeDomainComponentDescriptor[] = [];
		const domainNames = fs
			.readdirSync(LIB_DIRECTORY_PATH, { withFileTypes: true })
			.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
			.map((entry) => entry.name)
			.sort((left, right) => left.localeCompare(right));

		for (const domainName of domainNames) {
			const jsonPaths = collectJsonPaths(domainName);
			const componentRootPath = resolveLibPath(domainName, 'component');

			if (!fs.existsSync(componentRootPath) || !fs.statSync(componentRootPath).isDirectory()) {
				continue;
			}

			for (const jointName of ['atom', 'molecule', 'organism', 'template'] as const) {
				const jointPath = path.join(componentRootPath, jointName);

				if (!fs.existsSync(jointPath) || !fs.statSync(jointPath).isDirectory()) {
					continue;
				}

				for (const entry of fs.readdirSync(jointPath, { withFileTypes: true })) {
					if (!entry.isDirectory()) {
						continue;
					}

					const familyPath = entry.name;
					const entityPath = `${domainName}/component/${jointName}/${familyPath}`;
					const recipeTypePath = getExistingFilePath(
						domainName,
						'interface',
						'recipe',
						familyPath,
						'index.ts'
					);
					const stateFunctionPath =
						getExistingFilePath(domainName, 'function', 'state', familyPath, 'index.svelte.ts') ??
						getExistingFilePath(domainName, 'function', 'state', familyPath, 'index.ts');
					const storyModulePath = getExistingFilePath(
						domainName,
						'component',
						jointName,
						familyPath,
						'index.story.svelte'
					);

					descriptors.push({
						entityPath,
						domain: domainName,
						cluster: 'component',
						joint: jointName as ComponentJoint,
						family: familyPath,
						componentModulePath: getExistingFilePath(
							domainName,
							'component',
							jointName,
							familyPath,
							'index.svelte'
						),
						recipeTypePath,
						stateFunctionPath,
						jsonPaths,
						contractPaths: [
							getExistingFilePath(domainName, 'interface', 'contract', familyPath, 'index.ts')
						].filter((value): value is string => value !== null),
						interfaceRecipeJsonPaths: filterJsonPaths(jsonPaths, '/interface/recipe/'),
						constEnumJsonPaths: filterJsonPaths(jsonPaths, '/const/enum/'),
						constMapJsonPaths: filterJsonPaths(jsonPaths, '/const/map/'),
						functionStateJsonPaths: filterJsonPaths(jsonPaths, '/function/state/'),
						functionScriptJsonPaths: filterJsonPaths(jsonPaths, '/function/script/'),
						controlDefinitionJsonPaths: filterJsonPaths(jsonPaths, '/control/'),
						hasRecipePipeline: recipeTypePath !== null,
						hasStatePipeline: stateFunctionPath !== null,
						hasStoryPreview: storyModulePath !== null,
						storyModulePath
					});
				}
			}
		}

		return descriptors.sort((left, right) => left.entityPath.localeCompare(right.entityPath));
	}

	private static buildTemplateLayoutSource(input: {
		family: string;
		sections: Array<{ id: string; columns: number; items: string[][] }>;
		instances: Array<{ id: string; componentPath: string; config: Record<string, unknown> }>;
	}): string {
		type ImportEntry = { identifier: string; componentPath: string };

		const toPascalCase = (familySegment: string): string =>
			familySegment
				.split(/[-_]+/)
				.filter(Boolean)
				.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
				.join('');

		const toImportSpecifier = (componentPath: string): string => {
			const normalized = componentPath.replace(/\\/g, '/').replace(/\/index\.svelte$/, '');
			return `$stylist/${normalized}/index.svelte`;
		};

		const familySegmentFromPath = (componentPath: string): string => {
			const segments = componentPath.replace(/\\/g, '/').split('/');
			const familyIndex = segments.indexOf('component') + 2;
			return segments[familyIndex] ?? segments.at(-2) ?? 'component';
		};

		const assignImportIdentifiers = (
			instances: Array<{ componentPath: string }>
		): Map<string, ImportEntry> => {
			const byComponentPath = new Map<string, ImportEntry>();
			const usedIdentifiers = new Set<string>();

			for (const instance of instances) {
				if (byComponentPath.has(instance.componentPath)) {
					continue;
				}

				const baseIdentifier =
					toPascalCase(familySegmentFromPath(instance.componentPath)) || 'Component';
				let identifier = baseIdentifier;
				let suffix = 2;
				while (usedIdentifiers.has(identifier)) {
					identifier = `${baseIdentifier}${suffix}`;
					suffix += 1;
				}

				usedIdentifiers.add(identifier);
				byComponentPath.set(instance.componentPath, {
					identifier,
					componentPath: instance.componentPath
				});
			}

			return byComponentPath;
		};

		const serializeProps = (config: Record<string, unknown>): string => {
			const entries = Object.entries(config);
			if (entries.length === 0) {
				return '';
			}

			const attrs = entries.map(([key, value]) => `${key}={${JSON.stringify(value)}}`);
			return ` ${attrs.join(' ')}`;
		};

		const importsByPath = assignImportIdentifiers(input.instances);
		const instanceById = new Map(input.instances.map((instance) => [instance.id, instance]));
		const importLines = [...importsByPath.values()]
			.sort((left, right) => left.identifier.localeCompare(right.identifier))
			.map(
				(entry) => `\timport ${entry.identifier} from '${toImportSpecifier(entry.componentPath)}';`
			)
			.join('\n');
		const sectionsMarkup = input.sections
			.map((section) => {
				const columnsMarkup = section.items
					.map((columnItems) => {
						const componentsMarkup = columnItems
							.map((instanceId) => {
								const instance = instanceById.get(instanceId);
								if (!instance) return '';
								const importEntry = importsByPath.get(instance.componentPath);
								if (!importEntry) return '';
								return `\t\t\t<${importEntry.identifier}${serializeProps(instance.config)} />`;
							})
							.filter(Boolean)
							.join('\n');

						return `\t\t<div class="t-column">\n${componentsMarkup}\n\t\t</div>`;
					})
					.join('\n');

				return `\t<section class="t-section t-section--cols-${section.columns}">\n${columnsMarkup}\n\t</section>`;
			})
			.join('\n\n');
		const scriptBlock = importLines
			? `<script lang="ts">\n\t// Generated by domain-builder - hand edits after export are fine.\n${importLines}\n</script>\n\n`
			: '';

		return `${scriptBlock}<div class="t-${input.family}">
${sectionsMarkup}
</div>

<style>
	.t-${input.family} {
		display: grid;
		gap: 2rem;
	}

	.t-section {
		display: grid;
		gap: 1.5rem;
	}

	.t-section--cols-1 {
		grid-template-columns: minmax(0, 1fr);
	}

	.t-section--cols-2 {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.t-section--cols-3 {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.t-column {
		display: grid;
		gap: 1rem;
		align-content: start;
	}

	@media (max-width: 960px) {
		.t-section--cols-2,
		.t-section--cols-3 {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
`;
	}

	private static readLibJsonFile(filePath: string): unknown | null {
		try {
			return JSON.parse(FileManager.readLibTextFile(filePath));
		} catch {
			return null;
		}
	}

	private static readLibTextFile(filePath: string): string | null {
		try {
			return FileManager.readLibTextFile(filePath);
		} catch {
			return null;
		}
	}
}
