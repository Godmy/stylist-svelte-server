import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { normalizeText } from '$stylist/typography/function/script/text-normatize';
import { truncateText } from '$stylist/typography/function/script/text-truncate';
import { ERROR_LOG_FILE } from '$stylist/server/const/value/error-log-file';
import type { ErrorLogEntry } from '$stylist/development/type/struct/error-log-entry';

export function appendErrorLog(entry: ErrorLogEntry): void {
	mkdirSync(dirname(ERROR_LOG_FILE), { recursive: true });

	const normalizedEntry: ErrorLogEntry = {
		...entry,
		message: normalizeText(entry.message, 'Unknown runtime error'),
		stack: truncateText(entry.stack, 12000),
		name: truncateText(entry.name, 512),
		url: truncateText(entry.url, 2048),
		method: truncateText(entry.method, 32),
		routeId: truncateText(entry.routeId, 512)
	};

	appendFileSync(ERROR_LOG_FILE, `${JSON.stringify(normalizedEntry)}\n`, 'utf-8');
}
