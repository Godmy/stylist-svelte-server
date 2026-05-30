import { postContentBacklogResponse } from '$stylist/server/function/async/post-content-backlog-response';
import type { RequestEvent } from '@sveltejs/kit';

export async function postContentResponse(event: RequestEvent): Promise<Response> {
	return postContentBacklogResponse(event);
}
