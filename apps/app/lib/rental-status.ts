import { RentalContractStatus } from "@crm/db/enums";
import type { StatusTone } from "@crm/ui/components/status-indicator";

const ORDER = [
	RentalContractStatus.DRAFT,
	RentalContractStatus.RESERVED,
	RentalContractStatus.ACTIVE,
	RentalContractStatus.COMPLETED,
	RentalContractStatus.CANCELLED,
] as const;

const PRESENTATION: Record<
	RentalContractStatus,
	{ label: string; tone: StatusTone }
> = {
	DRAFT: { label: "Brouillon", tone: "neutral" },
	RESERVED: { label: "Réservé", tone: "info" },
	ACTIVE: { label: "Actif", tone: "warning" },
	COMPLETED: { label: "Terminé", tone: "success" },
	CANCELLED: { label: "Annulé", tone: "error" },
};

export const OPEN_STATUSES = ORDER.slice(
	0,
	3,
) as readonly RentalContractStatus[];

export const CLOSED_STATUSES: readonly RentalContractStatus[] = [
	RentalContractStatus.COMPLETED,
	RentalContractStatus.CANCELLED,
];

export const RENTAL_STATUS_OPTIONS = ORDER.map((value) => ({
	value,
	label: PRESENTATION[value].label,
}));

export function isClosedStatus(status: RentalContractStatus): boolean {
	return !OPEN_STATUSES.includes(status);
}

export function rentalStatusLabel(status: RentalContractStatus): string {
	return PRESENTATION[status].label;
}

export function rentalStatusPresentation(status: RentalContractStatus) {
	return PRESENTATION[status];
}
