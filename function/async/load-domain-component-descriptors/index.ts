import fs from 'node:fs';
import path from 'node:path';
import { LIB_DIRECTORY_PATH } from '$stylist/server/const/value/lib-directory-path';
import type { TypeDomainComponentDescriptor } from '$stylist/domain/type/struct/domain-component-descriptor';

export function loadDomainComponentDescriptors(): TypeDomainComponentDescriptor[] {
	type ComponentJoint = 'atom' | 'molecule' | 'organism' | 'template' | 'page';

	function toRelativePath(absolutePath: string): string {
		return path.relative(LIB_DIRECTORY_PATH, absolutePath).replace(/\\/g, '/');
	}

	function resolveLibPath(...segments: string[]): string {
		return path.join(LIB_DIRECTORY_PATH, ...segments);
	}

	function getExistingFilePath(...segments: string[]): string | null {
		const absolutePath = resolveLibPath(...segments);
		return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()
			? toRelativePath(absolutePath)
			: null;
	}

	function collectJsonPaths(domainName: string): string[] {
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
	}

	function filterJsonPaths(jsonPaths: string[], pattern: string): string[] {
		return jsonPaths.filter((jsonPath) => jsonPath.includes(pattern));
	}

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


