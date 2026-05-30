import { postBuilderLayoutResponse } from '$stylist/server/function/async/post-builder-layout-response';
import type { RequestEvent } from '@sveltejs/kit';

export async function postBuilderResponse(event: RequestEvent): Promise<Response> {
	return postBuilderLayoutResponse(event);
}
