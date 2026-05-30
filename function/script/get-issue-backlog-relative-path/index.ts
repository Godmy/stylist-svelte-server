import { formatJsonlSegment } from '$stylist/server/function/script/format-jsonl-segment';

export function getIssueBacklogRelativePath(id: string, text: string): string {
	return `management/data/jsonl/component/backlog/${formatJsonlSegment(id)}/${formatJsonlSegment(text)}.jsonl`;
}
