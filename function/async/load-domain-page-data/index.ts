import fs from 'node:fs';
import path from 'node:path';
import { LIB_DIRECTORY_PATH } from '$stylist/server/const/value/lib-directory-path';

export async function loadDomainPageData() {
	const DATA_JOINT_EXTENSION = new Map([
		['svg', '.svg'],
		['json', '.json'],
		['md', '.md'],
		['yaml', '.yaml'],
		['vert', '.vert'],
		['frag', '.frag']
	]);

	function toRelativeLibPath(filePath: string): string {
		return path.relative(LIB_DIRECTORY_PATH, filePath).split(path.sep).join('/');
	}

	function getDirectories(directoryPath: string): string[] {
		if (!fs.existsSync(directoryPath)) return [];

		return fs
			.readdirSync(directoryPath, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.sort((a, b) => a.localeCompare(b));
	}

	function getFiles(directoryPath: string) {
		if (!fs.existsSync(directoryPath)) return [];

		return fs
			.readdirSync(directoryPath, { withFileTypes: true })
			.filter((entry) => entry.isFile())
			.map((entry) => ({
				name: entry.name,
				path: toRelativeLibPath(path.join(directoryPath, entry.name))
			}))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	function getFilesRecursive(directoryPath: string, extension: string) {
		if (!fs.existsSync(directoryPath)) return [];

		const files: Array<{ name: string; path: string }> = [];
		const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

		for (const entry of entries) {
			const entryPath = path.join(directoryPath, entry.name);

			if (entry.isDirectory()) {
				files.push(...getFilesRecursive(entryPath, extension));
				continue;
			}

			if (entry.isFile() && entry.name.endsWith(extension)) {
				files.push({
					name: entry.name,
					path: toRelativeLibPath(entryPath)
				});
			}
		}

		return files.sort((a, b) => a.path.localeCompare(b.path));
	}

	function stripExtensions(filename: string): string {
		return filename.replace(/(\.[^/.]+)+$/, '');
	}

	function getEntities(jointPath: string, jointName: string) {
		const dataExtension = DATA_JOINT_EXTENSION.get(jointName);

		if (dataExtension) {
			return getFilesRecursive(jointPath, dataExtension).map((file) => {
				const segments = file.path.split('/').slice(3);
				const familyParts = segments.slice(0, -1);
				const name = familyParts.length > 0
					? familyParts.join('/')
					: stripExtensions(segments[segments.length - 1]);
				return { name, path: file.path, files: [file] };
			});
		}

		const directories = getDirectories(jointPath);

		if (directories.length > 0) {
			return directories.map((entityName) => {
				const entityPath = path.join(jointPath, entityName);
				return {
					name: entityName,
					path: toRelativeLibPath(entityPath),
					files: getFiles(entityPath)
				};
			});
		}

		const files = getFiles(jointPath);
		if (files.length === 0) return [];

		const grouped = new Map<string, typeof files>();
		for (const file of files) {
			const base = stripExtensions(file.name);
			const key = base === 'index' ? jointName : base;
			if (!grouped.has(key)) grouped.set(key, []);
			grouped.get(key)!.push(file);
		}

		return Array.from(grouped.entries()).map(([name, entityFiles]) => ({
			name,
			path: entityFiles.length === 1 ? entityFiles[0].path : toRelativeLibPath(jointPath),
			files: entityFiles
		}));
	}

	return {
		tree: getDirectories(LIB_DIRECTORY_PATH).map((domainName) => {
			const domainPath = path.join(LIB_DIRECTORY_PATH, domainName);

			return {
				name: domainName,
				clusters: getDirectories(domainPath).map((clusterName) => {
					const clusterPath = path.join(domainPath, clusterName);

					return {
						name: clusterName,
						joints: getDirectories(clusterPath).map((jointName) => {
							const jointPath = path.join(clusterPath, jointName);

							return {
								name: jointName,
								entities: getEntities(jointPath, jointName)
							};
						})
					};
				})
			};
		})
	};
}
