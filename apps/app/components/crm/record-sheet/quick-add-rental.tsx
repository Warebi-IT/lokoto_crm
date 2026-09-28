"use client";

import { DriverRole } from "@crm/db/enums";
import { Field, FieldLabel } from "@crm/ui/components/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { contactName } from "@/components/crm/contact-name";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { QuickAddForm } from "./quick-add";

const ROLE_OPTIONS = [
	{ value: DriverRole.PRIMARY, label: "Primary renter" },
	{ value: DriverRole.ADDITIONAL, label: "Additional driver" },
];

export function AttachDriver({
	contractId,
	onDone,
}: {
	contractId: string;
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const [contactId, setContactId] = useState("");
	const [role, setRole] = useState<DriverRole>(DriverRole.ADDITIONAL);

	const personId = useId();
	const roleId = useId();

	const options = useQuery(
		trpc.rentalContracts.driverOptions.queryOptions({ contractId }),
	);
	const candidates = options.data ?? [];

	const attach = useMutation(
		trpc.rentalContracts.attachDriver.mutationOptions({
			onSuccess: async (attached) => {
				const person = candidates.find(
					(candidate) => candidate.id === attached.contactId,
				);
				await cache.rentalContract(contractId);
				toast.success(
					person
						? `${contactName(person)} is driving on this contract.`
						: "Added to the contract.",
				);
				onDone();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const nobody = !options.isPending && candidates.length === 0;

	const placeholder = options.isPending
		? "Loading…"
		: nobody
			? "Nobody else to add"
			: "Choose somebody";

	return (
		<QuickAddForm
			submitLabel="Add driver"
			pending={attach.isPending}
			ready={contactId !== ""}
			onCancel={onDone}
			onSubmit={() => attach.mutate({ contractId, contactId, role })}
		>
			<Field>
				<FieldLabel htmlFor={personId}>Client</FieldLabel>
				<Select value={contactId} onValueChange={setContactId}>
					<SelectTrigger id={personId} className="w-full" disabled={nobody}>
						<SelectValue placeholder={placeholder} />
					</SelectTrigger>
					<SelectContent>
						{candidates.map((candidate) => (
							<SelectItem key={candidate.id} value={candidate.id}>
								{contactName(candidate)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</Field>
			<Field>
				<FieldLabel htmlFor={roleId}>Rôle</FieldLabel>
				<Select
					value={role}
					onValueChange={(next) => setRole(next as DriverRole)}
				>
					<SelectTrigger id={roleId} className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{ROLE_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</Field>
		</QuickAddForm>
	);
}
