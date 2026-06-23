export type ErrorLog = {
	timestamp: string;
	source: 'server' | 'client';
	routeId: string | null;
	url: string | null;
	method: string | null;
	message: string;
	stack: string | null;
	name: string | null;
	status: number | null;
	details: Record<string, unknown>;
};
