import type { Prisma } from "@crm/db";
import { Prisma as PrismaNamespace } from "@crm/db";
import { BadRequestException } from "@nestjs/common";

export function toCents(amount: Prisma.Decimal | null): number | null {
	return amount === null ? null : amount.times(100).toNumber();
}

export function fromCents(cents: number | null | undefined): number | null {
	return cents === null || cents === undefined ? null : cents / 100;
}

export function decimalFromCents(
	cents: number | null | undefined,
): Prisma.Decimal | null {
	return cents === null || cents === undefined
		? null
		: new PrismaNamespace.Decimal(cents).dividedBy(100);
}

export function blankToNull(value: string): string | null {
	const trimmed = value.trim();
	return trimmed === "" ? null : trimmed;
}

export function normalizeEmail(value: string): string | null {
	return blankToNull(value)?.toLowerCase() ?? null;
}

export function parseDate(value: string | null | undefined): Date | null {
	if (value === null || value === undefined || value === "") return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new BadRequestException(`"${value}" is not a date.`);
	}
	return date;
}
