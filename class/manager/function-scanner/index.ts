import fs from 'node:fs';
import path from 'node:path';
import { resolve } from 'node:path';

export class FunctionScanner {
	readonly libDir: string;

	constructor(libDir = resolve(process.cwd(), 'src', 'lib')) {
		this.libDir = libDir;
	}

	getDomainsWithJoint(joint: string): string[] {
		if (!fs.existsSync(this.libDir)) return [];
		return fs
			.readdirSync(this.libDir, { withFileTypes: true })
			.filter((e) => e.isDirectory() && e.name !== 'json')
			.filter((e) => fs.existsSync(path.join(this.libDir, e.name, 'function', joint)))
			.map((e) => e.name)
			.sort();
	}

	scanStateFiles(stateDir: string): string[] {
		const result: string[] = [];
		if (!fs.existsSync(stateDir)) return result;
		this.#walk(stateDir, 'index.svelte.ts', (full, src) => {
			if (/export function \w+/.test(src)) result.push(full);
		});
		return result.sort();
	}

	scanScriptFiles(scriptDir: string): string[] {
		const result: string[] = [];
		if (!fs.existsSync(scriptDir)) return result;
		this.#walk(scriptDir, 'index.ts', (full, src) => {
			if (/export (?:async\s+)?function \w+/.test(src)) result.push(full);
		});
		return result.sort();
	}

	findFunctions(content: string): Array<{ name: string; pos: number }> {
		const result: Array<{ name: string; pos: number }> = [];
		const re = /export (?:async\s+)?function (\w+)/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(content)) !== null) {
			result.push({ name: m[1], pos: m.index + m[0].length });
		}
		return result;
	}

	extractFunctionParams(content: string, pos: number): string[] {
		let i = pos;
		while (i < content.length && /\s/.test(content[i])) i++;
		if (content[i] === '<') {
			let angleDepth = 0;
			while (i < content.length) {
				if (content[i] === '<') angleDepth++;
				else if (content[i] === '>') {
					if (--angleDepth === 0) {
						i++;
						break;
					}
				}
				i++;
			}
		}
		const openParen = content.indexOf('(', i);
		if (openParen === -1) return [];
		let depth = 0,
			end = -1,
			inStr = false,
			strCh = '';
		for (let j = openParen; j < content.length; j++) {
			const c = content[j];
			if (inStr) {
				if (c === '\\') {
					j++;
					continue;
				}
				if (c === strCh) inStr = false;
				continue;
			}
			if (c === '"' || c === "'" || c === '`') {
				inStr = true;
				strCh = c;
			} else if (c === '(') depth++;
			else if (c === ')') {
				if (--depth === 0) {
					end = j;
					break;
				}
			}
		}
		if (end === -1) return [];
		const paramStr = content.slice(openParen + 1, end).trim();
		if (!paramStr) return [];
		const rawParams: string[] = [];
		let paramDepth = 0,
			start = 0;
		for (let j = 0; j < paramStr.length; j++) {
			const c = paramStr[j];
			if (c === '<' || c === '(' || c === '{' || c === '[') paramDepth++;
			else if (c === '>' || c === ')' || c === '}' || c === ']') paramDepth--;
			else if (c === ',' && paramDepth === 0) {
				rawParams.push(paramStr.slice(start, j).trim());
				start = j + 1;
			}
		}
		if (start < paramStr.length) rawParams.push(paramStr.slice(start).trim());
		return rawParams
			.map((p) => p.trim())
			.filter((p) => p.length > 0)
			.map((p) => {
				p = p.replace(/^\.\.\./, '');
				if (p.startsWith('{') || p.startsWith('[')) return null;
				const m = p.match(/^(\w+)\??(?:\s*[:=]|$)/);
				return m ? m[1] : null;
			})
			.filter((p): p is string => p !== null);
	}

	extractReturnMembers(content: string): string[] {
		const searchStr = 'return {';
		let returnPos = -1;
		let idx = content.indexOf(searchStr);
		while (idx !== -1) {
			returnPos = idx;
			idx = content.indexOf(searchStr, idx + 1);
		}
		if (returnPos === -1) return [];
		const openBrace = returnPos + 'return '.length;
		let depth = 0,
			end = -1,
			inStr = false,
			strCh = '';
		for (let i = openBrace; i < content.length; i++) {
			const c = content[i];
			if (inStr) {
				if (c === '\\') {
					i++;
					continue;
				}
				if (c === strCh) inStr = false;
				continue;
			}
			if (c === '"' || c === "'" || c === '`') {
				inStr = true;
				strCh = c;
			} else if (c === '{') depth++;
			else if (c === '}') {
				if (--depth === 0) {
					end = i;
					break;
				}
			}
		}
		if (end === -1) return [];
		const body = content.slice(openBrace + 1, end);
		const members: string[] = [];
		const seen = new Set<string>();
		const add = (name: string) => {
			if (!seen.has(name)) {
				seen.add(name);
				members.push(name);
			}
		};
		let m: RegExpExecArray | null;
		const accessorRe = /\bget\s+(\w+)\s*\(/g;
		while ((m = accessorRe.exec(body)) !== null) add(m[1]);
		const shorthandRe = /^[ \t]+(\w+),?[ \t]*$/gm;
		while ((m = shorthandRe.exec(body)) !== null) add(m[1]);
		return members;
	}

	#walk(dir: string, filename: string, cb: (full: string, src: string) => void): void {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) this.#walk(full, filename, cb);
			else if (entry.name === filename) cb(full, fs.readFileSync(full, 'utf-8'));
		}
	}
}
