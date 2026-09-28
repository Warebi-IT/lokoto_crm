"use client";

import Add from "@carbon/icons-react/es/Add";
import { Button } from "@crm/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@crm/ui/components/sheet";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation } from "@tanstack/react-query";
import { parseAsBoolean, useQueryState } from "nuqs";
import { type ComponentProps, Suspense, useId, useState } from "react";
import { toast } from "sonner";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

function AddButton(props: ComponentProps<typeof Button>) {
	return (
		<Button {...props}>
			<Icon icon={Add} data-icon="inline-start" />
			New client
		</Button>
	);
}

export function CreateContactSheet() {
	return (
		<Suspense fallback={<AddButton disabled />}>
			<CreateContactForm />
		</Suspense>
	);
}

function CreateContactForm() {
	const openRecord = useOpenRecord();
	const trpc = useTRPC();
	const cache = useCrmCache();

	const [open, setOpen] = useQueryState(
		"new",
		parseAsBoolean.withDefault(false),
	);
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [gender, setGender] = useState<"H" | "F">("H");
	const [email, setEmail] = useState("");

	const firstNameId = useId();
	const lastNameId = useId();
	const emailId = useId();

	const create = useMutation(
		trpc.contacts.create.mutationOptions({
			onSuccess: async (contact) => {
				await cache.contact(contact.id);
				toast.success(
					`${[contact.firstName, contact.lastName].filter(Boolean).join(" ")} added.`,
				);
				await setOpen(null);
				setFirstName("");
				setLastName("");
				setGender("H");
				setEmail("");
				openRecord({ kind: "contact", id: contact.id });
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<Sheet open={open} onOpenChange={(next) => setOpen(next || null)}>
			<SheetTrigger asChild>
				<AddButton />
			</SheetTrigger>
			<SheetContent side="right">
				<SheetHeader>
					<SheetTitle>New client</SheetTitle>
					<SheetDescription>
						L’adresse e-mail est unique. Un même client ne sera pas créé deux
						fois.
					</SheetDescription>
				</SheetHeader>

				<form
					id="create-contact"
					className="flex-1 overflow-y-auto px-4"
					onSubmit={(event) => {
						event.preventDefault();
						create.mutate({
							firstName,
							lastName: lastName || undefined,
							gender,
							email: email || undefined,
						});
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={firstNameId}>Prénom</FieldLabel>
							<Input
								id={firstNameId}
								value={firstName}
								onChange={(event) => setFirstName(event.target.value)}
								autoComplete="off"
								required
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={lastNameId}>Nom</FieldLabel>
							<Input
								id={lastNameId}
								value={lastName}
								onChange={(event) => setLastName(event.target.value)}
								autoComplete="off"
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor="create-contact-gender">Sexe</FieldLabel>
							<Select
								value={gender}
								onValueChange={(value) => setGender(value as "H" | "F")}
							>
								<SelectTrigger id="create-contact-gender">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="H">Homme</SelectItem>
									<SelectItem value="F">Femme</SelectItem>
								</SelectContent>
							</Select>
						</Field>

						<Field>
							<FieldLabel htmlFor={emailId}>E-mail</FieldLabel>
							<Input
								id={emailId}
								type="email"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								autoComplete="off"
							/>
						</Field>
					</FieldGroup>
				</form>

				<SheetFooter>
					<Button
						type="submit"
						form="create-contact"
						disabled={create.isPending || firstName.trim() === ""}
					>
						{create.isPending ? <Spinner /> : null}
						Ajouter le client
					</Button>
					<SheetClose asChild>
						<Button variant="outline">Annuler</Button>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
