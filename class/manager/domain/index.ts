import { json, type RequestEvent } from '@sveltejs/kit';
import { CONTENT_PREVIEW_MAX_FILE_SIZE } from '$stylist/server/const/value/content-preview-max-file-size';
import manifest from '$stylist/domain/data/json/domain-page-manifest/index.json';
import type { TypeDomainComponentDescriptor } from '$stylist/domain/type/object/domain-component-descriptor';
import type { TypeDomainComponentProjection } from '$stylist/domain/type/object/domain-component-projection';
import type { TypeDomainTreeNode } from '$stylist/domain/type/object/domain-tree-node';

type TypeDomainPageData = {
	tree: TypeDomainTreeNode[];
	descriptors: TypeDomainComponentDescriptor[];
};

const LIB_SOURCE_MOUNT_PATH = '/generated/lib-source';

function normalizeRelativeLibPath(inputPath: string): string | null {
	const segments = inputPath
		.replace(/\\/g, '/')
		.split('/')
		.filter((segment) => segment.length > 0);

	if (segments.some((segment) => segment === '..' || segment === '.')) {
		return null;
	}

	return segments.length > 0 ? segments.join('/') : null;
}

function toLibSourceAssetUrl(relativeLibPath: string): string {
	const encodedSegments = relativeLibPath.split('/').map(encodeURIComponent);
	return `${LIB_SOURCE_MOUNT_PATH}/${encodedSegments.join('/')}`;
}

export class DomainManager {
	static async getContentFileResponse(event: RequestEvent): Promise<Response> {
		const requestedPath = event.url.searchParams.get('path');

		if (!requestedPath) {
			return json({ error: 'Missing "path" query parameter.' }, { status: 400 });
		}

		const relativeLibPath = normalizeRelativeLibPath(requestedPath);

		if (!relativeLibPath) {
			return json({ error: 'Path is outside src/lib.' }, { status: 400 });
		}

		const content = await this.readLibTextFile(event, relativeLibPath);

		if (content === null) {
			return json({ error: 'File not found.' }, { status: 404 });
		}

		if (new TextEncoder().encode(content).length > CONTENT_PREVIEW_MAX_FILE_SIZE) {
			return json({ error: 'File is too large to preview.' }, { status: 413 });
		}

		return json({ content });
	}

	static async getDomainComponentProjectionResponse(event: RequestEvent): Promise<Response> {
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

		const readJsonFiles = async (paths: string[]): Promise<unknown[]> => {
			const values = await Promise.all(paths.map((filePath) => this.readLibJsonFile(event, filePath)));
			return values.filter((value): value is unknown => value !== null);
		};

		const [recipeJson, enumJson, mapJson, stateJson, controlJson, contractFiles] = await Promise.all([
			readJsonFiles(descriptor.interfaceRecipeJsonPaths),
			readJsonFiles(descriptor.constEnumJsonPaths),
			readJsonFiles(descriptor.constMapJsonPaths),
			readJsonFiles(descriptor.functionStateJsonPaths),
			readJsonFiles(descriptor.controlDefinitionJsonPaths),
			Promise.all(
				descriptor.contractPaths.map(async (filePath) => ({
					path: filePath,
					content: await this.readLibTextFile(event, filePath)
				}))
			)
		]);

		const projection: TypeDomainComponentProjection = {
			entityPath: descriptor.entityPath,
			architecture: {
				componentModulePath: descriptor.componentModulePath,
				recipeTypePath: descriptor.recipeTypePath,
				stateFunctionPath: descriptor.stateFunctionPath,
				contractPaths: descriptor.contractPaths
			},
			information: { recipeJson, enumJson, mapJson },
			interaction: {
				stateJson,
				storyModulePath: descriptor.storyModulePath,
				hasStatePipeline: descriptor.hasStatePipeline
			},
			controls: { controlJson },
			contracts: { files: contractFiles }
		};

		return json(projection);
	}

	static getDomainPageData(): TypeDomainPageData {
		return manifest as TypeDomainPageData;
	}

	static loadDomainComponentDescriptors(): TypeDomainComponentDescriptor[] {
		return manifest.descriptors as TypeDomainComponentDescriptor[];
	}

	private static async readLibJsonFile(event: RequestEvent, filePath: string): Promise<unknown | null> {
		const text = await this.readLibTextFile(event, filePath);

		if (text === null) {
			return null;
		}

		try {
			return JSON.parse(text);
		} catch {
			return null;
		}
	}

	private static async readLibTextFile(event: RequestEvent, filePath: string): Promise<string | null> {
		const relativeLibPath = normalizeRelativeLibPath(filePath);

		if (!relativeLibPath) {
			return null;
		}

		const assetUrl = new URL(toLibSourceAssetUrl(relativeLibPath), event.url.origin);

		try {
			// On Cloudflare, static assets live outside SvelteKit's own routing, so
			// event.fetch() (which short-circuits same-origin requests internally)
			// never reaches them — the Assets binding must be called directly.
			const response = event.platform?.env?.ASSETS
				? await event.platform.env.ASSETS.fetch(assetUrl)
				: await event.fetch(assetUrl);
			return response.ok ? await response.text() : null;
		} catch {
			return null;
		}
	}
}
