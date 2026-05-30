import { readWorkspaceTextFile } from '$stylist/server/function/script/read-workspace-text-file';

export function readWorkspaceJsonl<T>(filePath: string): T[] {
	const content = readWorkspaceTextFile(filePath);
	const lines = content
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);

	return lines.map((line) => JSON.parse(line) as T);
}
