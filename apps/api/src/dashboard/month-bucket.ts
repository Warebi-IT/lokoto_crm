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

export function monthIso(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function dayStart(from: Date, offset: number): Date {
	return new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
}

export function dayKey(date: Date): number {
	return Math.floor(dayStart(date, 0).getTime() / (24 * 60 * 60 * 1000));
}

export function dayIso(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
