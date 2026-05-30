import { getContentFileResponse } from '$stylist/server/function/async/get-content-file-response';
import type { RequestEvent } from '@sveltejs/kit';

export function getContentResponse(event: RequestEvent): Response {
	return getContentFileResponse(event);
}
