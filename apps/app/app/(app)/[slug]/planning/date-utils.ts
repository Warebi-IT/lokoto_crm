export const WEEK_DAYS = 7;
export const HOUR_PX = 48;
export const DAY_PX = 24 * HOUR_PX;

export function dateInput(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

export function addDays(value: string, days: number): string {
	const date = new Date(`${value}T00:00:00`);
	date.setDate(date.getDate() + days);
	return dateInput(date);
}

export function startOfMonth(value: string): string {
	const date = new Date(`${value}T00:00:00`);
	return dateInput(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function addMonths(value: string, months: number): string {
	const date = new Date(`${value}T00:00:00`);
	return dateInput(new Date(date.getFullYear(), date.getMonth() + months, 1));
}

export function daysInMonth(value: string): number {
	const date = new Date(`${value}T00:00:00`);
	return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function dayIndexOf(iso: string, rangeStart: string): number {
	const start = new Date(`${rangeStart}T00:00:00`);
	const date = new Date(iso);
	const diffMs =
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) -
		Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
	return Math.round(diffMs / 86_400_000);
}

export function timeToMinutes(time: string | null | undefined): number {
	if (!time) return 0;
	const match = /^(\d{1,2}):(\d{2})$/.exec(time);
	if (!match) return 0;
	return Number(match[1]) * 60 + Number(match[2]);
}

export function minutesLabel(minutes: number): string {
	const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
	const mins = String(minutes % 60).padStart(2, "0");
	return `${hours}:${mins}`;
}

export interface DayEvent {
	id: string;
	startMinutes: number;
	endMinutes: number;
}

export interface LaidOutEvent<T extends DayEvent> {
	event: T;
	lane: number;
	columns: number;
}

/** Greedy interval layout: side-by-side lanes for events overlapping in time. */
export function layoutDayEvents<T extends DayEvent>(
	events: readonly T[],
): LaidOutEvent<T>[] {
	const sorted = [...events].sort(
		(a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes,
	);
	const laneEnds: number[] = [];
	const laneOf = new Map<string, number>();

	for (const event of sorted) {
		let lane = laneEnds.findIndex((end) => end <= event.startMinutes);
		if (lane === -1) {
			lane = laneEnds.length;
			laneEnds.push(event.endMinutes);
		} else {
			laneEnds[lane] = event.endMinutes;
		}
		laneOf.set(event.id, lane);
	}

	const columns = Math.max(1, laneEnds.length);
	return sorted.map((event) => ({
		event,
		lane: laneOf.get(event.id) ?? 0,
		columns,
	}));
}
