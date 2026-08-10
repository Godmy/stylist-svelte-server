import { postTemplateExportFileResponse } from '$stylist/server/function/async/post-template-export-file-response';
import type { RequestEvent } from '@sveltejs/kit';

export async function postTemplateExportResponse(event: RequestEvent): Promise<Response> {
	return postTemplateExportFileResponse(event);
}
