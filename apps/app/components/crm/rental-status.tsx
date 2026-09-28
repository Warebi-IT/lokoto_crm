import type { RentalContractStatus } from "@crm/db/enums";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { rentalStatusPresentation } from "@/lib/rental-status";

export function RentalStatusIndicator({
	status,
	className,
}: {
	status: RentalContractStatus;
	className?: string;
}) {
	const { label, tone } = rentalStatusPresentation(status);
	return <StatusIndicator tone={tone} label={label} className={className} />;
}
