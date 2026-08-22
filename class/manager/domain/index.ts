import fs from 'node:fs';
import path from 'node:path';
import { json, type RequestEvent } from '@sveltejs/kit';
import { CONTENT_PREVIEW_MAX_FILE_SIZE } from '$stylist/server/const/value/content-preview-max-file-size';
import { LIB_DIRECTORY_PATH } from '$stylist/server/const/value/lib-directory-path';
import { FileManager } from '$stylist/server/class/manager/file';
import type { TypeDomainComponentDescriptor } from '$stylist/domain/type/object/domain-component-descriptor';
import type { TypeDomainComponentProjection } from '$stylist/domain/type/object/domain-component-projection';

export class DomainManager {
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
