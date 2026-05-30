import { resolve } from 'node:path';
import { ERROR_LOG_FILE } from '$stylist/server/const/value/error-log-file';

export function getErrorLogFilePath(): string {
	return resolve(process.cwd(), '.logs', ERROR_LOG_FILE);
}
