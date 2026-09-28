"use client";

import { RentalContractStatus } from "@crm/db/enums";
import { TONE_COLOR } from "@crm/ui/components/status-indicator";
import { cn } from "@crm/ui/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { RentalStatusIndicator } from "@/components/crm/rental-status";
import {
	isClosedStatus,
	OPEN_STATUSES,
	rentalStatusLabel,
	rentalStatusPresentation,
} from "@/lib/rental-status";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

const RAIL = [
	...OPEN_STATUSES,
	RentalContractStatus.COMPLETED,
] as readonly RentalContractStatus[];

export function StatusStepper({
	contractId,
	status,
}: {
	contractId: string;
	status: RentalContractStatus;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const setStatus = useMutation(
		trpc.rentalContracts.setStatus.mutationOptions({
			onSuccess: async (result) => {
				await cache.rentalContract(contractId);
				if (result.changed) toast.success("Status updated.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const exited =
		isClosedStatus(status) && status !== RentalContractStatus.COMPLETED;
	const steps = exited ? OPEN_STATUSES : RAIL;
	const currentIndex = steps.indexOf(status);

	return (
		<ol className="flex w-full gap-1">
			{steps.map((option, index) => {
				const reached = !exited && index <= currentIndex;
				const current = !exited && option === status;
				const color = TONE_COLOR[rentalStatusPresentation(option).tone];
				return (
					<li key={option} className="flex min-w-0 flex-1">
						<button
							type="button"
							aria-current={current ? "step" : undefined}
							disabled={setStatus.isPending}
							onClick={() =>
								setStatus.mutate({ id: contractId, status: option })
							}
							style={reached ? { borderColor: color, color } : undefined}
							className={cn(
								"min-w-0 flex-1 border-t-2 pt-2 text-left text-xs transition-colors disabled:pointer-events-none disabled:opacity-50",
								!reached &&
									"border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground",
								current && "font-medium",
							)}
						>
							<span className="block truncate">
								{current && option === RentalContractStatus.COMPLETED ? (
									<RentalStatusIndicator status={status} className="text-xs" />
								) : (
									rentalStatusLabel(option)
								)}
							</span>
						</button>
					</li>
				);
			})}

			{exited ? (
				<li className="flex min-w-0 flex-1">
					<div
						className="min-w-0 flex-1 border-t-2 pt-2"
						style={{
							borderColor: TONE_COLOR[rentalStatusPresentation(status).tone],
						}}
					>
						<RentalStatusIndicator status={status} className="text-xs" />
					</div>
				</li>
			) : null}
		</ol>
	);
}
