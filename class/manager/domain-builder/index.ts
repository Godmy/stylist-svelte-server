import fs from 'node:fs';
import { json, type RequestEvent } from '@sveltejs/kit';
import { BUILDER_LAYOUT_LIB_PATH } from '$stylist/server/const/value/builder-layout-lib-path/index';
import { FileManager } from '$stylist/server/class/manager/file';

export class DomainBuilderManager {
	static getBuilderLayoutResponse(): Response {
		const content = FileManager.readWorkspaceTextFile(BUILDER_LAYOUT_LIB_PATH);
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

		FileManager.writeWorkspaceTextFile(
			BUILDER_LAYOUT_LIB_PATH,
			`${JSON.stringify(payload, null, 2)}\n`
		);

		return json({ ok: true });
	}

	static async postTemplateExportFileResponse(event: RequestEvent): Promise<Response> {
		const payload = await event.request.json();
		const slugPattern = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

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

		if (!slugPattern.test(payload.domain) || !slugPattern.test(payload.family)) {
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
}
