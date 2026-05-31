import fs from 'node:fs';
import path from 'node:path';
import { resolve } from 'node:path';

export class TypeScanner {
	readonly libDir: string;

	constructor(libDir = resolve(process.cwd(), 'src', 'lib')) {
		this.libDir = libDir;
	}

	getDomainsWithJoint(joint: string): string[] {
		if (!fs.existsSync(this.libDir)) return [];
		return fs
			.readdirSync(this.libDir, { withFileTypes: true })
			.filter((e) => e.isDirectory() && e.name !== 'json')
			.filter((e) => fs.existsSync(path.join(this.libDir, e.name, 'type', joint)))
			.map((e) => e.name)
			.sort();
	}

	scanFiles(typeDir: string): string[] {
		const result: string[] = [];
		if (!fs.existsSync(typeDir)) return result;
		this.#walk(typeDir, (full, src) => {
			if (!this.#isBarrel(src)) result.push(full);
		});
		return result.sort();
	}

	findTypeAliases(content: string): Array<{ name: string; pos: number }> {
		const result: Array<{ name: string; pos: number }> = [];
		const re = /export type (\w+)/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(content)) !== null) {
			const after = content.slice(m.index + 'export type '.length).trimStart();
			if (after.startsWith('{')) continue;
			result.push({ name: m[1], pos: m.index + m[0].length });
		}
		return result;
	}

	findInterfaces(content: string): Array<{ name: string; pos: number }> {
		const result: Array<{ name: string; pos: number }> = [];
		const re = /export interface (\w+)/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(content)) !== null) {
			result.push({ name: m[1], pos: m.index + m[0].length });
		}
		return result;
	}

	getTypeBodyPos(content: string, from: number, kind: 'type' | 'interface'): number | null {
		let sawEq = false;
		let angleDepth = 0;
		const limit = Math.min(from + 600, content.length);
		for (let i = from; i < limit; i++) {
			const c = content[i];
			if (c === '<') angleDepth++;
			else if (c === '>' && angleDepth > 0) angleDepth--;
			else if (kind === 'type' && c === '=' && angleDepth === 0) {
				const next = content[i + 1];
				if (next !== '=' && next !== '>') sawEq = true;
			} else if (c === '{' && angleDepth === 0) {
				if (kind === 'interface' || sawEq) return i;
			}
		}
		return null;
	}

	extractTypeKeys(content: string, pos: number): string[] {
		let depth = 0,
			end = -1,
			inStr = false,
			strCh = '';
		for (let i = pos; i < content.length; i++) {
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
		const body = content.slice(pos + 1, end);
		const keys: string[] = [];
		const indentMatch = body.match(/^([ \t]+)\S/m);
		const unit = indentMatch ? indentMatch[1] : '\t';
		const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const re = new RegExp(`^${esc(unit)}(?!${esc(unit)})(?:readonly\s+)?(\w+)\??[:(]`, 'gm');
		let m: RegExpExecArray | null;
		while ((m = re.exec(body)) !== null) keys.push(m[1]);
		return keys;
	}

	#isBarrel(content: string): boolean {
		return !/export\s+(?:type\s+\w+\s*(?:[=<(])|interface\s+\w+)/.test(content);
	}

	#walk(dir: string, cb: (full: string, src: string) => void): void {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) this.#walk(full, cb);
			else if (entry.name === 'index.ts') cb(full, fs.readFileSync(full, 'utf-8'));
		}
	}
}
