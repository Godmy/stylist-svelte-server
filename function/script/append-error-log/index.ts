import fs from 'node:fs';
import path from 'node:path';
import type { ErrorLog } from '$stylist/server/type/object/error-log';
import { getErrorLogFilePath } from '$stylist/server/function/script/get-error-log-file-path';

export function appendErrorLog(payload: {
	timestamp: string;
	source: ErrorLog['source'];
	routeId: string | null;
	url: string;
	method: string;
	message: string;
	stack: string | null;
	name: string | null;
	status: number;
	details?: unknown;
}): void {
	const entry: ErrorLog = {
		timestamp: payload.timestamp,
		source: payload.source,
		routeId: payload.routeId,
		url: payload.url,
		method: payload.method,
		message: payload.message,
		stack: payload.stack,
		name: payload.name,
		status: payload.status,
		details:
			payload.details && typeof payload.details === 'object'
				? (payload.details as Record<string, unknown>)
				: {}
	};

	try {
		const logFilePath = getErrorLogFilePath();
		fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
		fs.appendFileSync(logFilePath, `${JSON.stringify(entry)}\n`, 'utf8');
	} catch (error) {
		const fallbackLogFilePath = path.resolve(process.cwd(), '.logs', 'runtime-errors.jsonl');
		const fallbackEntry = {
			...entry,
			details: {
				...entry.details,
				logWriteFailure:
					error instanceof Error
						? { message: error.message, stack: error.stack ?? null }
						: { message: String(error), stack: null }
			}
		};

		try {
			fs.mkdirSync(path.dirname(fallbackLogFilePath), { recursive: true });
			fs.appendFileSync(fallbackLogFilePath, `${JSON.stringify(fallbackEntry)}\n`, 'utf8');
		} catch (fallbackError) {
			console.error('appendErrorLog failed', fallbackEntry, fallbackError);
		}
	}
}
