export type TypeBacklogDocument = {
	meta?: {
		domain?: string;
		family?: string;
		version?: number;
		updatedAt?: string;
	};
	title?: string;
	sprint?: {
		name?: string;
		startDate?: string;
		endDate?: string;
	};
	items?: Array<{
		id: string;
		title: string;
		description?: string;
		assignee?: string;
		priority?: 'low' | 'medium' | 'high';
		estimatedHours?: number;
		status?: 'todo' | 'in-progress' | 'done';
		tags?: string[];
		createdAt?: string;
		updatedAt?: string;
	}>;
};
