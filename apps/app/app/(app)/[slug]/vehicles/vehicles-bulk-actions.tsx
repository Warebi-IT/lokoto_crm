"use client";

import TrashCan from "@carbon/icons-react/es/TrashCan";
import {
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
} from "@crm/ui/components/dropdown-menu";
import { formatCount } from "@crm/ui/lib/format";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
	BulkActionsMenu,
	BulkDeleteDialog,
	reportBulk,
} from "@/components/crm/bulk-actions";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

const STATUS_OPTIONS = [
	{ value: "AVAILABLE", label: "Available" },
	{ value: "RESERVED", label: "Reserved" },
	{ value: "RENTED", label: "Rented" },
	{ value: "MAINTENANCE", label: "Maintenance" },
	{ value: "OUT_OF_SERVICE", label: "Out of service" },
	{ value: "STOLEN", label: "Stolen" },
] as const;

function vehicles(count: number): string {
	return formatCount(count, "vehicle");
}

export function VehiclesBulkActions({
	ids,
	onDone,
}: {
	ids: string[];
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [confirming, setConfirming] = useState(false);

	const onError = (error: { message: string }) => toast.error(error.message);

	const setStatus = useMutation(
		trpc.vehicles.bulkSetStatus.mutationOptions({
			onSuccess: async (result) => {
				await cache.vehicle();
				reportBulk(result, (count) => `${vehicles(count)} updated.`);
				onDone();
			},
			onError,
		}),
	);

	const remove = useMutation(
		trpc.vehicles.bulkDelete.mutationOptions({
			onSuccess: async (result, variables) => {
				await cache.removedMany({ kind: "vehicle", ids: variables.ids });
				reportBulk(result, (count) => `${vehicles(count)} deleted.`);
				setConfirming(false);
				onDone();
			},
			onError,
		}),
	);

	const pending = setStatus.isPending || remove.isPending;

	return (
		<>
			<BulkActionsMenu pending={pending}>
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>Modifier le statut</DropdownMenuSubTrigger>
					<DropdownMenuSubContent className="max-h-72 overflow-y-auto">
						<DropdownMenuGroup>
							{STATUS_OPTIONS.map((option) => (
								<DropdownMenuItem
									key={option.value}
									onSelect={() =>
										setStatus.mutate({ ids, status: option.value })
									}
								>
									{option.label}
								</DropdownMenuItem>
							))}
						</DropdownMenuGroup>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem
						variant="destructive"
						onSelect={() => setConfirming(true)}
					>
						<TrashCan />
						Delete
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</BulkActionsMenu>

			<BulkDeleteDialog
				open={confirming}
				onOpenChange={setConfirming}
				title={`Delete ${vehicles(ids.length)}?`}
				description="Their rental history, maintenance record and incidents go too. This cannot be undone."
				onConfirm={() => remove.mutate({ ids })}
			/>
		</>
	);
}
