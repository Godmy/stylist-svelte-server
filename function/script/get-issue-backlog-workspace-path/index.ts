import { BACKLOG_JSONL_DIRECTORY_PATH } from '$stylist/server/const/value/backlog-jsonl-directory-path';
import { formatJsonlSegment } from '$stylist/server/function/script/format-jsonl-segment';

export function getIssueBacklogWorkspacePath(id: string, text: string): string {
	return `${BACKLOG_JSONL_DIRECTORY_PATH}/${formatJsonlSegment(id)}/${formatJsonlSegment(text)}.jsonl`;
}
