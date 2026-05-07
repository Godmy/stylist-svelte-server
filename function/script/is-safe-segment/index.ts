export function isSafeSegment(value: string): boolean {
	return /^[a-z0-9-]+$/i.test(value);
}
