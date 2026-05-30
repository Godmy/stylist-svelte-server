import { getDomainComponentProjectionResponse } from '$stylist/server/function/async/get-domain-component-projection-response';
import type { RequestEvent } from '@sveltejs/kit';

export function getDescriptorResponse(event: RequestEvent): Response {
	return getDomainComponentProjectionResponse(event);
}
