"use client";

import ChevronDown from "@carbon/icons-react/es/ChevronDown";
import { RentalContractStatus } from "@crm/db/enums";
import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Spinner } from "@crm/ui/components/spinner";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import { parseAsString, useQueryStates } from "nuqs";
import { useId, useState } from "react";
import { toast } from "sonner";
import { RentalStatusIndicator } from "@/components/crm/rental-status";
import { RENTAL_STATUS_OPTIONS } from "@/lib/rental-status";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

const cancelReasonParams = {
	cancelling: parseAsString,
};

function useStatusMutation(onDone?: () => void) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	return useMutation(
		trpc.rentalContracts.setStatus.mutationOptions({
			onSuccess: async (_, variables) => {
				await cache.rentalContract(variables.id);
				onDone?.();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
}

export function RentalStatusMenu({
	contractId,
	status,
	variant = "inline",
}: {
	contractId: string;
	status: RentalContractStatus;
	variant?: "inline" | "control";
}) {
	const [, setCancelParams] = useQueryStates(cancelReasonParams);
	const setStatus = useStatusMutation();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				{variant === "control" ? (
					<Button
						variant="outline"
						size="sm"
						disabled={setStatus.isPending}
						onClick={(event) => event.stopPropagation()}
					>
						<RentalStatusIndicator
							status={status}
							className="text-foreground"
						/>
						<Icon icon={ChevronDown} className="text-muted-foreground" />
					</Button>
				) : (
					<button
						type="button"
						onClick={(event) => event.stopPropagation()}
						disabled={setStatus.isPending}
						className="flex min-w-0 items-center text-left hover:text-foreground disabled:opacity-50"
					>
						<RentalStatusIndicator status={status} />
					</button>
				)}
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align={variant === "control" ? "end" : "start"}
				className="min-w-52"
				onClick={(event) => event.stopPropagation()}
			>
				<DropdownMenuRadioGroup
					value={status}
					onValueChange={(next) => {
						const chosen = next as RentalContractStatus;
						if (chosen === status) return;
						if (chosen === RentalContractStatus.CANCELLED) {
							void setCancelParams({ cancelling: contractId });
							return;
						}
						setStatus.mutate({ id: contractId, status: chosen });
					}}
				>
					{RENTAL_STATUS_OPTIONS.map((option) => (
						<DropdownMenuRadioItem key={option.value} value={option.value}>
							{option.label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function CancelReasonDialog() {
	const reasonId = useId();
	const [{ cancelling }, setCancelParams] = useQueryStates(cancelReasonParams);
	const [reason, setReason] = useState("");

	const close = () => {
		setReason("");
		void setCancelParams({ cancelling: null });
	};

	const setStatus = useStatusMutation(() => {
		toast.success("Contract cancelled.");
		close();
	});

	const open = Boolean(cancelling);

	return (
		<Dialog open={open} onOpenChange={(next) => !next && close()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Annuler ce contrat</DialogTitle>
					<DialogDescription>
						Why is it being cancelled? It helps if a deposit dispute comes up
						later.
					</DialogDescription>
				</DialogHeader>

				<form
					id="cancel-reason"
					className="px-4"
					onSubmit={(event) => {
						event.preventDefault();
						if (!cancelling) return;
						setStatus.mutate({
							id: cancelling,
							status: RentalContractStatus.CANCELLED,
							cancelledReason: reason,
						});
					}}
				>
					<Field>
						<FieldLabel htmlFor={reasonId}>Motif</FieldLabel>
						<Textarea
							id={reasonId}
							value={reason}
							onChange={(event) => setReason(event.target.value)}
							placeholder="Client no-show, deposit refunded"
							rows={3}
						/>
					</Field>
				</form>

				<DialogFooter>
					<Button
						type="submit"
						form="cancel-reason"
						disabled={setStatus.isPending || reason.trim() === ""}
					>
						{setStatus.isPending ? <Spinner /> : null}
						Save
					</Button>
					<Button variant="outline" onClick={close}>
						Cancel
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
