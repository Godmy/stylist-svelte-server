import { resolve, sep } from 'node:path';
import { LIB_DIRECTORY_PATH } from '$stylist/server/const/value/lib-directory-path';

export function normalizeLibPath(inputPath: string): string | null {
	const normalizedPath = inputPath.replace(/\\/g, '/').replace(/^\/+/, '');
	const absolutePath = resolve(LIB_DIRECTORY_PATH, normalizedPath);
	const libPrefix = `${LIB_DIRECTORY_PATH}${sep}`;

	if (absolutePath !== LIB_DIRECTORY_PATH && !absolutePath.startsWith(libPrefix)) {
		return null;
	}

	return absolutePath;
}
