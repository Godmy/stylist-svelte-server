import path from 'node:path';
import { LIB_DIRECTORY_PATH } from '$stylist/server/const/value/lib-directory-path';

export function normalizeLibPath(value: string): string | null {
	if (!value || path.isAbsolute(value)) return null;

	const resolved = path.resolve(LIB_DIRECTORY_PATH, value);
	const relative = path.relative(LIB_DIRECTORY_PATH, resolved);

	if (relative.startsWith('..') || path.isAbsolute(relative)) return null;

	return resolved;
}
