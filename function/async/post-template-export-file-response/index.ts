import fs from 'node:fs';
import { json, type RequestEvent } from '@sveltejs/kit';
import { buildTemplateLayoutSource } from '$stylist/server/function/transform/template-layout-source';
import { normalizeLibPath } from '$stylist/server/function/script/normalize-lib-path';
import { writeLibTextFile } from '$stylist/server/function/script/write-lib-text-file';

const SLUG_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export async function postTemplateExportFileResponse(event: RequestEvent): Promise<Response> {
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

	if (!SLUG_PATTERN.test(payload.domain) || !SLUG_PATTERN.test(payload.family)) {
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
	const absolutePath = normalizeLibPath(relativePath);

	if (!absolutePath) {
		return json({ error: 'Resolved path is outside the lib directory.' }, { status: 400 });
	}

	const overwritten = fs.existsSync(absolutePath);
	const source = buildTemplateLayoutSource({
		family: payload.family,
		sections: payload.sections,
		instances: payload.instances.map((instance: { id: string; componentPath: string; config?: unknown }) => ({
			id: instance.id,
			componentPath: instance.componentPath,
			config:
				typeof instance.config === 'object' && instance.config !== null
					? (instance.config as Record<string, unknown>)
					: {}
		}))
	});

	writeLibTextFile(relativePath, source);

	return json({ ok: true, path: relativePath, overwritten });
}
