import { json, type RequestEvent } from '@sveltejs/kit';
import { BUILDER_LAYOUT_LIB_PATH } from '$stylist/server/const/value/builder-layout-lib-path/index';
import { writeLibTextFile } from '$stylist/server/function/script/write-lib-text-file/index';

export async function postBuilderLayoutResponse(event: RequestEvent): Promise<Response> {
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

	writeLibTextFile(BUILDER_LAYOUT_LIB_PATH, `${JSON.stringify(payload, null, 2)}\n`);

	return json({ ok: true });
}
