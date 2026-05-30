import fs from 'node:fs';
import path from 'node:path';
import { normalizeLibPath } from '$stylist/server/function/script/normalize-lib-path';

export function writeLibTextFile(filePath: string, content: string): void {
	const absolutePath = normalizeLibPath(filePath);

	if (!absolutePath) {
		throw new Error('Path is outside lib.');
	}

	fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
	fs.writeFileSync(absolutePath, content, 'utf8');
}
