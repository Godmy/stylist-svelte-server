import { getBuilderLayoutResponse } from '$stylist/server/function/async/get-builder-layout-response';

export function getBuilderResponse(): Response {
	return getBuilderLayoutResponse();
}
