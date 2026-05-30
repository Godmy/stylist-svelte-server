export function getBacklogWorkspacePath(domain: string, family: string): string {
	return `stylist-svelte/src/lib/management/data/json/component/backlog/${domain}--${family}.json`;
}
