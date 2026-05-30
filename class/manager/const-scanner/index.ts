import fs from 'node:fs';
import path from 'node:path';
import { resolve } from 'node:path';

export type SerializablePrimitive = string | number | boolean | null;
export type SerializableValue =
	| SerializablePrimitive
	| SerializableValue[]
	| { [key: string]: SerializableValue };

export class ConstScanner {
	readonly libDir: string;

	constructor(libDir = resolve(process.cwd(), 'src', 'lib')) {
		this.libDir = libDir;
	}

	getDomainsWithJoint(joint: string): string[] {
		if (!fs.existsSync(this.libDir)) return [];
		return fs
			.readdirSync(this.libDir, { withFileTypes: true })
			.filter((e) => e.isDirectory() && e.name !== 'json')
			.filter((e) => fs.existsSync(path.join(this.libDir, e.name, 'const', joint)))
			.map((e) => e.name)
			.sort();
	}

	scanFiles(constDir: string): string[] {
		const result: string[] = [];
		if (!fs.existsSync(constDir)) return result;
		this.#walk(constDir, (full, src) => {
			if (/export const/.test(src)) result.push(full);
		});
		return result.sort();
	}

	findConstExports(content: string): Array<{ name: string; pos: number }> {
		const result: Array<{ name: string; pos: number }> = [];
		const re = /export const (\w+)/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(content)) !== null) {
			result.push({ name: m[1], pos: m.index + m[0].length });
		}
		return result;
	}

	getValuePos(content: string, from: number): number | null {
		let sawEq = false,
			angleDepth = 0;
		const limit = Math.min(from + 400, content.length);
		for (let i = from; i < limit; i++) {
			const c = content[i];
			if (c === '<') angleDepth++;
			else if (c === '>' && angleDepth > 0) angleDepth--;
			else if (c === '=' && angleDepth === 0) {
				const next = content[i + 1];
				if (next !== '=' && next !== '>') sawEq = true;
			} else if (sawEq && (c === '[' || c === '{')) return i;
		}
		return null;
	}

	extractArrayValues(content: string, pos: number): Array<string | number | boolean | null> {
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
			} else if (c === '[') depth++;
			else if (c === ']') {
				if (--depth === 0) {
					end = i;
					break;
				}
			}
		}
		if (end === -1) return [];
		const body = content.slice(pos + 1, end);
		const values: Array<string | number | boolean | null> = [];
		const re =
			/'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"|(-?\d+(?:\.\d+)?)\b|\b(true|false|null)\b/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(body)) !== null) {
			if (m[1] !== undefined) {
				values.push(m[1]);
				continue;
			}
			if (m[2] !== undefined) {
				values.push(m[2]);
				continue;
			}
			if (m[3] !== undefined) {
				values.push(Number(m[3]));
				continue;
			}
			if (m[4] === 'true') {
				values.push(true);
				continue;
			}
			if (m[4] === 'false') {
				values.push(false);
				continue;
			}
			if (m[4] === 'null') values.push(null);
		}
		return values;
	}

	extractMapEntries(content: string, pos: number): Record<string, unknown> {
		const end = this.#findClosing(content, pos, '{', '}');
		if (end === -1) return {};
		return this.#parseObjectBody(content.slice(pos + 1, end).trim());
	}

	extractSimpleMapEntries(
		content: string,
		pos: number
	): Record<string, string | number | boolean | null> | null {
		const end = this.#findClosing(content, pos, '{', '}');
		if (end === -1) return null;
		const body = content.slice(pos + 1, end).trim();
		if (!body) return {};
		const result: Record<string, string | number | boolean | null> = {};
		for (const entry of this.#splitTopLevel(body)) {
			const colonIndex = this.#findTopLevelColon(entry);
			if (colonIndex === -1) return null;
			const key = this.#normalizeKey(entry.slice(0, colonIndex).trim());
			const value = this.#parseSimpleValue(
				entry
					.slice(colonIndex + 1)
					.trim()
					.replace(/,$/, '')
			);
			if (!key || value === undefined) return null;
			result[key] = value;
		}
		return result;
	}

	extractSingleValue(content: string, pos: number): SerializablePrimitive | string | undefined {
		const source = content.slice(pos).trimStart();
		const match = source.match(
			/^(Symbol\([^)]*\)|'([^'\\]|\\.)*'|"([^"\\]|\\.)*"|-?\d+(?:\.\d+)?|true|false|null)(?:\s+as\s+const)?\s*;?/
		);
		if (!match) return undefined;
		const raw = match[1];
		if (raw.startsWith("'") || raw.startsWith('"')) return raw.slice(1, -1);
		if (raw === 'true') return true;
		if (raw === 'false') return false;
		if (raw === 'null') return null;
		if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
		return raw;
	}

	#findClosing(content: string, pos: number, open: string, close: string): number {
		let depth = 0,
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
			} else if (c === open) depth++;
			else if (c === close) {
				if (--depth === 0) return i;
			}
		}
		return -1;
	}

	#parseObjectBody(body: string): Record<string, unknown> {
		if (!body) return {};
		const result: Record<string, unknown> = {};
		for (const entry of this.#splitTopLevel(body)) {
			const colonIndex = this.#findTopLevelColon(entry);
			if (colonIndex === -1) continue;
			const key = this.#normalizeKey(entry.slice(0, colonIndex).trim());
			if (!key) continue;
			result[key] = this.#parseAnyValue(
				entry
					.slice(colonIndex + 1)
					.trim()
					.replace(/,$/, '')
					.trim()
			);
		}
		return result;
	}

	#parseAnyValue(raw: string): unknown {
		const v = raw.trim();
		if (!v) return null;
		if (v.startsWith('{') && v.endsWith('}')) return this.#parseObjectBody(v.slice(1, -1).trim());
		if (v.startsWith('[') && v.endsWith(']')) {
			const inner = v.slice(1, -1).trim();
			return inner ? this.#splitTopLevel(inner).map((e) => this.#parseAnyValue(e.trim())) : [];
		}
		if (
			(v.startsWith("'") && v.endsWith("'")) ||
			(v.startsWith('"') && v.endsWith('"')) ||
			(v.startsWith('`') && v.endsWith('`'))
		)
			return v.slice(1, -1);
		if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
		if (v === 'true') return true;
		if (v === 'false') return false;
		if (v === 'null') return null;
		return v;
	}

	#splitTopLevel(body: string): string[] {
		const entries: string[] = [];
		let start = 0,
			braceDepth = 0,
			bracketDepth = 0,
			parenDepth = 0,
			inStr = false,
			strCh = '';
		for (let i = 0; i < body.length; i++) {
			const c = body[i];
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
			} else if (c === '{') braceDepth++;
			else if (c === '}') braceDepth--;
			else if (c === '[') bracketDepth++;
			else if (c === ']') bracketDepth--;
			else if (c === '(') parenDepth++;
			else if (c === ')') parenDepth--;
			else if (c === ',' && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
				const entry = body.slice(start, i).trim();
				if (entry) entries.push(entry);
				start = i + 1;
			}
		}
		const tail = body.slice(start).trim();
		if (tail) entries.push(tail);
		return entries;
	}

	#findTopLevelColon(entry: string): number {
		let braceDepth = 0,
			bracketDepth = 0,
			parenDepth = 0,
			inStr = false,
			strCh = '';
		for (let i = 0; i < entry.length; i++) {
			const c = entry[i];
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
			} else if (c === '{') braceDepth++;
			else if (c === '}') braceDepth--;
			else if (c === '[') bracketDepth++;
			else if (c === ']') bracketDepth--;
			else if (c === '(') parenDepth++;
			else if (c === ')') parenDepth--;
			else if (c === ':' && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) return i;
		}
		return -1;
	}

	#normalizeKey(rawKey: string): string | null {
		const key = rawKey.trim();
		if (/^\w+$/.test(key)) return key;
		if ((key.startsWith("'") && key.endsWith("'")) || (key.startsWith('"') && key.endsWith('"')))
			return key.slice(1, -1);
		return null;
	}

	#parseSimpleValue(rawValue: string): string | number | boolean | null | undefined {
		const value = rawValue.replace(/\s+as\s+const$/, '').trim();
		if (
			(value.startsWith("'") && value.endsWith("'")) ||
			(value.startsWith('"') && value.endsWith('"'))
		)
			return value.slice(1, -1);
		if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
		if (value === 'true') return true;
		if (value === 'false') return false;
		if (value === 'null') return null;
		return undefined;
	}

	#walk(dir: string, cb: (full: string, src: string) => void): void {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) this.#walk(full, cb);
			else if (entry.name === 'index.ts') cb(full, fs.readFileSync(full, 'utf-8'));
		}
	}
}
