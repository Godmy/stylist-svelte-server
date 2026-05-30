import fs from 'node:fs';
import path from 'node:path';
import { resolve } from 'node:path';

export class ClassScanner {
	readonly libDir: string;

	constructor(libDir = resolve(process.cwd(), 'src', 'lib')) {
		this.libDir = libDir;
	}

	getDomainsWithJoint(joint: string): string[] {
		if (!fs.existsSync(this.libDir)) return [];
		return fs
			.readdirSync(this.libDir, { withFileTypes: true })
			.filter((e) => e.isDirectory() && e.name !== 'json')
			.filter((e) => fs.existsSync(path.join(this.libDir, e.name, 'class', joint)))
			.map((e) => e.name)
			.sort();
	}

	scanFiles(classDir: string): string[] {
		const result: string[] = [];
		if (!fs.existsSync(classDir)) return result;
		this.#walk(classDir, (full, src) => {
			if (/export class \w+/.test(src)) result.push(full);
		});
		return result.sort();
	}

	findClasses(content: string): Array<{ name: string; pos: number }> {
		const result: Array<{ name: string; pos: number }> = [];
		const re = /export class (\w+)/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(content)) !== null) {
			result.push({ name: m[1], pos: m.index + m[0].length });
		}
		return result;
	}

	getBodyPos(content: string, from: number): number | null {
		let angleDepth = 0;
		const limit = Math.min(from + 600, content.length);
		for (let i = from; i < limit; i++) {
			const c = content[i];
			if (c === '<') angleDepth++;
			else if (c === '>' && angleDepth > 0) angleDepth--;
			else if (c === '{' && angleDepth === 0) return i;
		}
		return null;
	}

	extractPublicMethods(content: string, pos: number): string[] {
		let depth = 0, end = -1, inStr = false, strCh = '';
		for (let i = pos; i < content.length; i++) {
			const c = content[i];
			if (inStr) { if (c === '\\') { i++; continue; } if (c === strCh) inStr = false; continue; }
			if (c === '"' || c === "'" || c === '`') { inStr = true; strCh = c; }
			else if (c === '{') depth++;
			else if (c === '}') { if (--depth === 0) { end = i; break; } }
		}
		if (end === -1) return [];
		const body = content.slice(pos + 1, end);
		const methods: string[] = [];
		const indentMatch = body.match(/^([ \t]+)\S/m);
		const unit = indentMatch ? indentMatch[1] : '\t';
		const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const u = esc(unit);
		const re = new RegExp(
			`^${u}(?!${u})(?!private[\s#(]|protected[\s(]|readonly[\s(]|#)` +
			`(?:(?:public|static|async|abstract|override)\s+)*(?:get\s+|set\s+)?(\w+)\s*(?:<[^(>]*>)?\s*\(`,
			'gm'
		);
		let m: RegExpExecArray | null;
		while ((m = re.exec(body)) !== null) {
			if (!methods.includes(m[1])) methods.push(m[1]);
		}
		return methods;
	}

	#walk(dir: string, cb: (full: string, src: string) => void): void {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) this.#walk(full, cb);
			else if (entry.name === 'index.ts') cb(full, fs.readFileSync(full, 'utf-8'));
		}
	}
}
