import { json } from '@sveltejs/kit';
import { BUILDER_LAYOUT_LIB_PATH } from '$stylist/server/const/value/builder-layout-lib-path/index';
import { readLibTextFile } from '$stylist/server/function/script/read-lib-text-file/index';

export function getBuilderLayoutResponse(): Response {
	const content = readLibTextFile(BUILDER_LAYOUT_LIB_PATH);
	return json(JSON.parse(content));
}
