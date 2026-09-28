import { RentalContractStatus } from "./generated/prisma/enums";

export const OPEN_RENTAL_STATUSES = [
	RentalContractStatus.DRAFT,
	RentalContractStatus.RESERVED,
	RentalContractStatus.ACTIVE,
] as const;

export const CLOSED_RENTAL_STATUSES = [
	RentalContractStatus.COMPLETED,
	RentalContractStatus.CANCELLED,
] as const;

export function isClosedRentalStatus(status: RentalContractStatus): boolean {
	return !OPEN_RENTAL_STATUSES.includes(
		status as (typeof OPEN_RENTAL_STATUSES)[number],
	);
}
