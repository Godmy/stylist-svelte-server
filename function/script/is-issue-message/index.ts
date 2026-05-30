import type { TypeIssueMessage } from '$stylist/server/type/struct/issue-message';

export function isIssueMessage(value: unknown): value is TypeIssueMessage {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	const candidate = value as Record<string, unknown>;

	return (
		typeof candidate.created_at === 'string' &&
		typeof candidate.file === 'string' &&
		typeof candidate.id === 'string' &&
		typeof candidate.text === 'string' &&
		(candidate.image === null || typeof candidate.image === 'string') &&
		(candidate.audio === null || typeof candidate.audio === 'string')
	);
}
