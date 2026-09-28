"use client";

import Renew from "@carbon/icons-react/es/Renew";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import {
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
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

function contacts(count: number): string {
	return formatCount(count, "client");
}

export function ContactsBulkActions({
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

	const enrich = useMutation(
		trpc.contacts.bulkEnrich.mutationOptions({
			onSuccess: async (result) => {
				await cache.contact();
				reportBulk(
					result,
					(count) =>
						`Recherche d’informations sur ${contacts(count)} — la liste sera mise à jour.`,
				);
				onDone();
			},
			onError,
		}),
	);

	const remove = useMutation(
		trpc.contacts.bulkDelete.mutationOptions({
			onSuccess: async (result, variables) => {
				await cache.removedMany({ kind: "contact", ids: variables.ids });
				reportBulk(result, (count) => `${contacts(count)} supprimé(s).`);
				setConfirming(false);
				onDone();
			},
			onError,
		}),
	);

	const pending = enrich.isPending || remove.isPending;

	return (
		<>
			<BulkActionsMenu pending={pending}>
				<DropdownMenuGroup>
					<DropdownMenuItem onSelect={() => enrich.mutate({ ids })}>
						<Renew />
						Actualiser les informations
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem
						variant="destructive"
						onSelect={() => setConfirming(true)}
					>
						<TrashCan />
						Supprimer
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</BulkActionsMenu>

			<BulkDeleteDialog
				open={confirming}
				onOpenChange={setConfirming}
				title={`Supprimer ${contacts(ids.length)} ?`}
				description="Leurs adresses e-mail seront exclues de la synchronisation. Cette action est irréversible."
				onConfirm={() => remove.mutate({ ids })}
			/>
		</>
	);
}
