import { BACKLOG_HISTORY_DIRECTORY_PATH } from '$stylist/server/const/value/backlog-history-directory-path';

export function getBacklogHistoryWorkspacePath(
	domain: string,
	family: string,
	timestamp: string
): string {
	return `${BACKLOG_HISTORY_DIRECTORY_PATH}/${domain}--${family}--${timestamp}.json`;
}
