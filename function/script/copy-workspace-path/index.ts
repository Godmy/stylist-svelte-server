import fs from 'node:fs';
import path from 'node:path';
import { normalizeWorkspacePath } from '$stylist/server/function/script/normalize-workspace-path';

export function copyWorkspacePath(sourcePath: string, destinationPath: string): void {
	const absoluteSourcePath = normalizeWorkspacePath(sourcePath);
	const absoluteDestinationPath = normalizeWorkspacePath(destinationPath);

	if (!absoluteSourcePath || !absoluteDestinationPath) {
		throw new Error('Path is outside workspace.');
	}

	if (!fs.existsSync(absoluteSourcePath)) {
		throw new Error('Source path not found.');
	}

	if (fs.existsSync(absoluteDestinationPath)) {
		throw new Error('Destination path already exists.');
	}

	fs.mkdirSync(path.dirname(absoluteDestinationPath), { recursive: true });
	fs.cpSync(absoluteSourcePath, absoluteDestinationPath, {
		errorOnExist: true,
		force: false,
		recursive: true
	});
}
