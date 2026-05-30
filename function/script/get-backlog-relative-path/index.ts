export function getBacklogRelativePath(domain: string, family: string): string {
	return `management/data/json/component/backlog/${domain}--${family}.json`;
}
