import fs from 'node:fs';
import path, { resolve, sep } from 'node:path';
import { LIB_DIRECTORY_PATH } from '$stylist/server/const/value/lib-directory-path';

export class FileManager {
	static normalizeWorkspacePath(inputPath: string): string | null {
		const workspacePath = resolve(process.cwd());
		const normalizedPath = inputPath.replace(/\\/g, '/').replace(/^\/+/, '');
		const absolutePath = resolve(workspacePath, normalizedPath);
		const workspacePrefix = `${workspacePath}${sep}`;

		if (absolutePath !== workspacePath && !absolutePath.startsWith(workspacePrefix)) {
			return null;
		}

		return absolutePath;
	}

	static normalizeLibPath(inputPath: string): string | null {
		const normalizedPath = inputPath.replace(/\\/g, '/').replace(/^\/+/, '');
		const absolutePath = resolve(LIB_DIRECTORY_PATH, normalizedPath);
		const libPrefix = `${LIB_DIRECTORY_PATH}${sep}`;

		if (absolutePath !== LIB_DIRECTORY_PATH && !absolutePath.startsWith(libPrefix)) {
			return null;
		}

		return absolutePath;
	}

	static normalizeRepoRelativePath(inputPath: string): string {
		const cwd = path.resolve(process.cwd());
		const repoRoot = path.basename(cwd) === 'stylist-svelte' ? path.resolve(cwd, '..') : cwd;
		const absolutePath = path.resolve(inputPath);
		const relativePath = path.relative(repoRoot, absolutePath).replace(/\\/g, '/');

		if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
			return '';
		}

		return relativePath;
	}

	static createWorkspaceDirectory(directoryPath: string): void {
		const absolutePath = this.normalizeWorkspacePath(directoryPath);

		if (!absolutePath) {
			throw new Error('Path is outside workspace.');
		}

		fs.mkdirSync(absolutePath, { recursive: true });
	}

	static workspacePathExists(filePath: string): boolean {
		const absolutePath = this.normalizeWorkspacePath(filePath);

		if (!absolutePath) {
			return false;
		}

		return fs.existsSync(absolutePath);
	}

	static readWorkspaceTextFile(filePath: string): string {
		const absolutePath = this.normalizeWorkspacePath(filePath);

		if (!absolutePath) {
			throw new Error('Path is outside workspace.');
		}

		if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
			throw new Error('File not found.');
		}

		return fs.readFileSync(absolutePath, 'utf8');
	}

	static readWorkspaceJsonl<T>(filePath: string): T[] {
		const content = this.readWorkspaceTextFile(filePath);
		const lines = content
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean);

		return lines.map((line) => JSON.parse(line) as T);
	}

	static writeWorkspaceTextFile(filePath: string, content: string): void {
		const absolutePath = this.normalizeWorkspacePath(filePath);

		if (!absolutePath) {
			throw new Error('Path is outside workspace.');
		}

		fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
		fs.writeFileSync(absolutePath, content, 'utf8');
	}

	static appendWorkspaceJsonl(filePath: string, value: unknown): void {
		const absolutePath = this.normalizeWorkspacePath(filePath);

		if (!absolutePath) {
			throw new Error('Path is outside workspace.');
		}

		fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
		fs.appendFileSync(absolutePath, `${JSON.stringify(value)}\n`, 'utf8');
	}

	static readLibTextFile(filePath: string): string {
		const absolutePath = this.normalizeLibPath(filePath);

		if (!absolutePath) {
			throw new Error('Path is outside lib.');
		}

		if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
			throw new Error('File not found.');
		}

		return fs.readFileSync(absolutePath, 'utf8');
	}

	static writeLibTextFile(filePath: string, content: string): void {
		const absolutePath = this.normalizeLibPath(filePath);

		if (!absolutePath) {
			throw new Error('Path is outside lib.');
		}

		fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
		fs.writeFileSync(absolutePath, content, 'utf8');
	}
}
