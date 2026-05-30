import { formatJsonlSegment } from '$stylist/server/function/script/format-jsonl-segment';

export function getIssueMessageKey(id: string, text: string): string {
	return `${formatJsonlSegment(id)}::${formatJsonlSegment(text)}`;
}
