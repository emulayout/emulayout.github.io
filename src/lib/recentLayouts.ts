import type { LayoutData } from '$lib/layout';

export interface LayoutsByDay {
	day: string;
	label: string;
	layouts: LayoutData[];
}

function localDayKey(date: Date): string {
	return date.toLocaleDateString('en-CA');
}

function formatDayLabel(dayKey: string): string {
	const [year, month, day] = dayKey.split('-').map(Number);
	const date = new Date(year, month - 1, day);
	return date.toLocaleDateString(undefined, {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		year: 'numeric'
	});
}

export function getRecentLayoutsByDay(layouts: LayoutData[], days = 7): LayoutsByDay[] {
	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - days);
	cutoff.setHours(0, 0, 0, 0);

	const byDay = new Map<string, LayoutData[]>();

	for (const layout of layouts) {
		const updated = new Date(layout.updatedAt);
		if (updated < cutoff) continue;

		const day = localDayKey(updated);
		const group = byDay.get(day);
		if (group) {
			group.push(layout);
		} else {
			byDay.set(day, [layout]);
		}
	}

	return [...byDay.entries()]
		.sort(([a], [b]) => b.localeCompare(a))
		.map(([day, dayLayouts]) => ({
			day,
			label: formatDayLabel(day),
			layouts: dayLayouts.sort((a, b) => a.name.localeCompare(b.name))
		}));
}
