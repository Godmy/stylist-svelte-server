export function isSafeSegment(segment: string): boolean {
	return /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(segment);
}
