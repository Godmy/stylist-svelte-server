import { resolve } from 'node:path';

export const ERROR_LOG_FILE = resolve(process.cwd(), '.logs', 'runtime-errors.jsonl');
