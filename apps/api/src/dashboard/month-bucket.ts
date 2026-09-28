export const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "short" });

export function monthStart(from: Date, offset: number): Date {
	return new Date(from.getFullYear(), from.getMonth() + offset, 1);
}

export function monthKey(date: Date): number {
	return date.getFullYear() * 12 + date.getMonth();
}

export function monthsBetween(start: Date, end: Date): number {
	return monthKey(end) - monthKey(start);
}
