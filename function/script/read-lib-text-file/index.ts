import fs from 'node:fs';
import { normalizeLibPath } from '$stylist/server/function/script/normalize-lib-path';

export function readLibTextFile(filePath: string): string {
	const absolutePath = normalizeLibPath(filePath);

	if (!absolutePath) {
		throw new Error('Path is outside lib.');
	}

	if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
		throw new Error('File not found.');
	}

	return fs.readFileSync(absolutePath, 'utf8');
}
