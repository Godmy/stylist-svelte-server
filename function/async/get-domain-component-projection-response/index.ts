import { json, type RequestEvent } from '@sveltejs/kit';
import { loadDomainComponentDescriptors } from '$stylist/server/function/async/load-domain-component-descriptors/index';
import { readLibTextFile } from '$stylist/server/function/script/read-lib-text-file/index';
import type { TypeDomainComponentProjection } from '$stylist/domain/type/object/domain-component-projection';

function readJsonFile(path: string): unknown | null {
	try {
		return JSON.parse(readLibTextFile(path));
	} catch {
		return null;
	}
}

function readTextFile(path: string): string | null {
	try {
		return readLibTextFile(path);
	} catch {
		return null;
	}
}

export function getDomainComponentProjectionResponse(event: RequestEvent): Response {
	const entityPath = event.url.searchParams.get('entityPath');

	if (!entityPath) {
		return json({ error: 'Missing entityPath.' }, { status: 400 });
	}

	const descriptor = loadDomainComponentDescriptors().find(
		(entry) => entry.entityPath === entityPath
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
				.map((path) => readJsonFile(path))
				.filter((value): value is unknown => value !== null),
			enumJson: descriptor.constEnumJsonPaths
				.map((path) => readJsonFile(path))
				.filter((value): value is unknown => value !== null),
			mapJson: descriptor.constMapJsonPaths
				.map((path) => readJsonFile(path))
				.filter((value): value is unknown => value !== null)
		},
		interaction: {
			stateJson: descriptor.functionStateJsonPaths
				.map((path) => readJsonFile(path))
				.filter((value): value is unknown => value !== null),
			storyModulePath: descriptor.storyModulePath,
			hasStatePipeline: descriptor.hasStatePipeline
		},
		controls: {
			controlJson: descriptor.controlDefinitionJsonPaths
				.map((path) => readJsonFile(path))
				.filter((value): value is unknown => value !== null)
		},
		contracts: {
			files: descriptor.contractPaths.map((path) => ({
				path,
				content: readTextFile(path)
			}))
		}
	};

	return json(projection);
}
