"use client";

import TrashCan from "@carbon/icons-react/es/TrashCan";
import {
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from "@crm/ui/components/dropdown-menu";
import { formatCount } from "@crm/ui/lib/format";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
	BulkActionsMenu,
	BulkDeleteDialog,
	BulkOwnerMenu,
	reportBulk,
} from "@/components/crm/bulk-actions";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

function contracts(count: number): string {
	return formatCount(count, "contract");
}

export function RentalContractsBulkActions({
	ids,
	onDone,
}: {
	ids: string[];
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const users = useQuery(trpc.users.list.queryOptions());
	const [confirming, setConfirming] = useState(false);

	const onError = (error: { message: string }) => toast.error(error.message);

	const assignOwner = useMutation(
		trpc.rentalContracts.bulkAssignOwner.mutationOptions({
			onSuccess: async (result) => {
				await cache.rentalContract();
				reportBulk(result, (count) => `${contracts(count)} reassigned.`);
				onDone();
			},
			onError,
		}),
	);

	const remove = useMutation(
		trpc.rentalContracts.bulkDelete.mutationOptions({
			onSuccess: async (result, variables) => {
				await cache.removedMany({ kind: "rentalContract", ids: variables.ids });
				reportBulk(result, (count) => `${contracts(count)} deleted.`);
				setConfirming(false);
				onDone();
			},
			onError,
		}),
	);

	const pending = assignOwner.isPending || remove.isPending;

	return (
		<>
			<BulkActionsMenu pending={pending}>
				<BulkOwnerMenu
					users={users.data ?? []}
					onSelect={(ownerId) =>
						ownerId && assignOwner.mutate({ ids, ownerId })
					}
				/>
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
				title={`Delete ${contracts(ids.length)}?`}
				description="Their payments, incidents and inspections go too. This cannot be undone."
				onConfirm={() => remove.mutate({ ids })}
			/>
		</>
	);
}
