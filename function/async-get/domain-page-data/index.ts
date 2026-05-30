import { loadDomainPageData } from '$stylist/server/function/async/load-domain-page-data';

export function getDomainPageData() {
	return loadDomainPageData();
}
