"use client";

import OverflowMenuVertical from "@carbon/icons-react/es/OverflowMenuVertical";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@crm/ui/components/alert-dialog";
import { Button } from "@crm/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Icon } from "@crm/ui/components/icon";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import {
	type RecordKind,
	type RecordRef,
	useRecordStack,
} from "./record-stack";

const NOUN: Record<RecordKind, string> = {
	contact: "contact",
	vehicle: "vehicle",
	rentalContract: "rental contract",
};

function useDeleteRecord(record: RecordRef) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const { close } = useRecordStack();

	const announce = (label: string | undefined) => {
		toast.success(`${label || `The ${NOUN[record.kind]}`} was deleted.`);
		void cache.removed(record);
		close();
	};

	const onError = (error: { message: string }) => toast.error(error.message);

	const deleteContact = useMutation(
		trpc.contacts.delete.mutationOptions({
			onSuccess: (deleted) => announce(deleted.name),
			onError,
		}),
	);
	const deleteVehicle = useMutation(
		trpc.vehicles.delete.mutationOptions({
			onSuccess: (deleted) => announce(deleted.plateNumber),
			onError,
		}),
	);
	const deleteRentalContract = useMutation(
		trpc.rentalContracts.delete.mutationOptions({
			onSuccess: () => announce(undefined),
			onError,
		}),
	);

	switch (record.kind) {
		case "contact":
			return deleteContact;
		case "vehicle":
			return deleteVehicle;
		case "rentalContract":
			return deleteRentalContract;
	}
}

export function RecordActions({
	record,
	name,
	consequence,
}: {
	record: RecordRef;
	name: string;
	consequence: string;
}) {
	const [confirming, setConfirming] = useState(false);
	const remove = useDeleteRecord(record);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon-sm" disabled={remove.isPending}>
						<Icon icon={OverflowMenuVertical} />
						<span className="sr-only">Plus d’actions</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="min-w-44">
					<DropdownMenuItem
						variant="destructive"
						onSelect={() => setConfirming(true)}
					>
						<Icon icon={TrashCan} />
						Delete {NOUN[record.kind]}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<AlertDialog open={confirming} onOpenChange={setConfirming}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete {name}?</AlertDialogTitle>
						<AlertDialogDescription>{consequence}</AlertDialogDescription>
					</AlertDialogHeader>

					<AlertDialogFooter>
						<AlertDialogCancel>Annuler</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => remove.mutate({ id: record.id })}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
