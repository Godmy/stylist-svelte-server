import fs from 'node:fs';
import path from 'node:path';

export function readStylistOutputJsonFile<T = unknown>(inputPath: string): T | null {
	const absolutePath = path.resolve(inputPath);

	if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
		return null;
	}

	return JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as T;
}
