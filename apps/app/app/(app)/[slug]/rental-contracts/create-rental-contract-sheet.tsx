"use client";

import Add from "@carbon/icons-react/es/Add";
import { Button } from "@crm/ui/components/button";
import { DatePicker } from "@crm/ui/components/date-picker";
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { parseAsBoolean, useQueryState } from "nuqs";
import { type ComponentProps, Suspense, useId, useState } from "react";
import { toast } from "sonner";
import { contactName } from "@/components/crm/contact-name";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

const UNSET = "";

type MileageRuleForm = { id: string; kilometers: string; pricePerKm: string };

function AddButton(props: ComponentProps<typeof Button>) {
	return (
		<Button {...props}>
			<Icon icon={Add} data-icon="inline-start" />
			Nouveau contrat de location
		</Button>
	);
}

export function CreateRentalContractSheet() {
	return (
		<Suspense fallback={<AddButton disabled />}>
			<CreateRentalContractForm />
		</Suspense>
	);
}

function CreateRentalContractForm() {
	const openRecord = useOpenRecord();
	const trpc = useTRPC();
	const cache = useCrmCache();

	const [open, setOpen] = useQueryState(
		"new",
		parseAsBoolean.withDefault(false),
	);
	const [vehicleId, setVehicleId] = useState(UNSET);
	const [contactId, setContactId] = useState(UNSET);
	const [ownerId, setOwnerId] = useState(UNSET);
	const [startDate, setStartDate] = useState("");
	const [endDate, setEndDate] = useState("");
	const [pickupTime, setPickupTime] = useState("09:00");
	const [returnTime, setReturnTime] = useState("18:00");
	const [pricePerDay, setPricePerDay] = useState("");
	const [depositAmount, setDepositAmount] = useState("");
	const [mileageIncludedPerDay, setMileageIncludedPerDay] = useState("");
	const [mileageRules, setMileageRules] = useState<MileageRuleForm[]>([]);
	const newMileageRule = () => ({
		id: crypto.randomUUID(),
		kilometers: "",
		pricePerKm: "",
	});

	const pricePerDayId = useId();
	const depositId = useId();

	const users = useQuery(trpc.users.list.queryOptions());
	const me = useQuery(trpc.users.me.queryOptions());
	const contacts = useQuery(trpc.contacts.options.queryOptions({ q: "" }));
	const dateRangeValid =
		startDate !== "" && endDate !== "" && endDate > startDate;
	const availability = useQuery({
		...trpc.vehicles.availability.queryOptions({ startDate, endDate }),
		enabled: dateRangeValid,
	});
	const availableVehicles = dateRangeValid
		? (availability.data?.rows ?? [])
		: [];

	const resolvedOwner = ownerId || me.data?.id || UNSET;

	const create = useMutation(
		trpc.rentalContracts.create.mutationOptions({
			onSuccess: async (contract) => {
				await cache.rentalContract(contract.id);
				toast.success("Contrat de location créé.");
				await setOpen(null);
				setVehicleId(UNSET);
				setContactId(UNSET);
				setStartDate("");
				setEndDate("");
				setPickupTime("09:00");
				setReturnTime("18:00");
				setPricePerDay("");
				setDepositAmount("");
				setMileageIncludedPerDay("");
				setMileageRules([]);
				openRecord({ kind: "rentalContract", id: contract.id });
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const ready =
		vehicleId !== UNSET &&
		contactId !== UNSET &&
		resolvedOwner !== UNSET &&
		startDate !== "" &&
		endDate !== "" &&
		pickupTime !== "" &&
		returnTime !== "" &&
		pricePerDay.trim() !== "" &&
		depositAmount.trim() !== "";

	return (
		<Sheet open={open} onOpenChange={(next) => setOpen(next || null)}>
			<SheetTrigger asChild>
				<AddButton />
			</SheetTrigger>
			<SheetContent side="right">
				<SheetHeader>
					<SheetTitle>Nouveau contrat de location</SheetTitle>
					<SheetDescription>
						Réservez un véhicule pour un client sur une période donnée.
					</SheetDescription>
				</SheetHeader>

				<form
					id="create-rental-contract"
					className="flex-1 overflow-y-auto px-4"
					onSubmit={(event) => {
						event.preventDefault();
						const price = Number.parseFloat(pricePerDay.replace(",", "."));
						const deposit = Number.parseFloat(depositAmount.replace(",", "."));
						if (!Number.isFinite(price) || price < 0) {
							toast.error("Le prix par jour doit être un nombre.");
							return;
						}
						if (!Number.isFinite(deposit) || deposit < 0) {
							toast.error("La caution doit être un nombre.");
							return;
						}
						const included = mileageIncludedPerDay
							? Number.parseInt(mileageIncludedPerDay, 10)
							: null;
						if (
							included !== null &&
							(!Number.isInteger(included) || included < 0)
						) {
							toast.error(
								"Le forfait kilométrique doit être un nombre entier.",
							);
							return;
						}
						const parsedRules = mileageRules.map((rule) => ({
							kilometers: rule.kilometers.trim()
								? Number.parseInt(rule.kilometers, 10)
								: null,
							pricePerKm: Number.parseFloat(rule.pricePerKm.replace(",", ".")),
						}));
						if (
							parsedRules.some(
								(rule) =>
									(rule.kilometers !== null &&
										(!Number.isInteger(rule.kilometers) ||
											rule.kilometers <= 0)) ||
									!Number.isFinite(rule.pricePerKm) ||
									rule.pricePerKm < 0,
							)
						) {
							toast.error("Vérifiez les tranches kilométriques.");
							return;
						}
						if (
							parsedRules.length > 0 &&
							parsedRules[parsedRules.length - 1]?.kilometers !== null
						) {
							toast.error("La dernière tranche doit être sans limite.");
							return;
						}
						create.mutate({
							vehicleId,
							contactId,
							ownerId: resolvedOwner,
							startDate,
							endDate,
							pickupTime,
							returnTime,
							pricePerDayCents: Math.round(price * 100),
							depositAmountCents: Math.round(deposit * 100),
							mileageIncludedPerDay: included,
							mileagePricingRules: parsedRules.map((rule) => ({
								kilometers: rule.kilometers,
								pricePerKmCents: Math.round(rule.pricePerKm * 100),
							})),
						});
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="create-contract-vehicle">
								Véhicule
							</FieldLabel>
							<Select
								value={vehicleId}
								onValueChange={setVehicleId}
								disabled={!dateRangeValid || availability.isPending}
							>
								<SelectTrigger id="create-contract-vehicle">
									<SelectValue
										placeholder={
											!dateRangeValid
												? "Choisissez d’abord les dates"
												: availability.isPending
													? "Checking availability…"
													: "Choisir un véhicule disponible"
										}
									/>
								</SelectTrigger>
								<SelectContent>
									{availableVehicles.map((vehicle) => (
										<SelectItem key={vehicle.id} value={vehicle.id}>
											{vehicle.make} {vehicle.model} · {vehicle.plateNumber}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{dateRangeValid && !availability.isPending ? (
								<p className="text-muted-foreground text-xs">
									{availableVehicles.length === 0
										? "Aucun véhicule n’est disponible à ces dates."
										: `${availableVehicles.length} véhicule${availableVehicles.length === 1 ? "" : "s"} disponible${availableVehicles.length === 1 ? "" : "s"} pour cette période.`}
								</p>
							) : null}
						</Field>

						<Field>
							<FieldLabel htmlFor="create-contract-contact">Client</FieldLabel>
							<Select value={contactId} onValueChange={setContactId}>
								<SelectTrigger id="create-contract-contact">
									<SelectValue placeholder="Choisir un client" />
								</SelectTrigger>
								<SelectContent>
									{(contacts.data ?? []).map((contact) => (
										<SelectItem key={contact.id} value={contact.id}>
											{contactName(contact)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>

						<Field>
							<FieldLabel htmlFor="create-contract-owner">Vendeur</FieldLabel>
							<Select value={resolvedOwner} onValueChange={setOwnerId}>
								<SelectTrigger id="create-contract-owner">
									<SelectValue placeholder="Choisir un vendeur" />
								</SelectTrigger>
								<SelectContent>
									{(users.data ?? []).map((user) => (
										<SelectItem key={user.id} value={user.id}>
											{user.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>

						<Field>
							<FieldLabel htmlFor="create-contract-start">
								Date de départ
							</FieldLabel>
							<DatePicker
								id="create-contract-start"
								value={startDate}
								onChange={(value) => {
									setStartDate(value);
									setVehicleId(UNSET);
								}}
								placeholder="Date de départ"
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor="create-contract-pickup-time">
								Heure de départ
							</FieldLabel>
							<Input
								id="create-contract-pickup-time"
								type="time"
								value={pickupTime}
								onChange={(event) => setPickupTime(event.target.value)}
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor="create-contract-return-time">
								Heure de retour
							</FieldLabel>
							<Input
								id="create-contract-return-time"
								type="time"
								value={returnTime}
								onChange={(event) => setReturnTime(event.target.value)}
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor="create-contract-end">
								Date de retour
							</FieldLabel>
							<DatePicker
								id="create-contract-end"
								value={endDate}
								onChange={(value) => {
									setEndDate(value);
									setVehicleId(UNSET);
								}}
								placeholder="Date de retour"
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={pricePerDayId}>Prix par jour</FieldLabel>
							<Input
								id={pricePerDayId}
								value={pricePerDay}
								onChange={(event) => setPricePerDay(event.target.value)}
								placeholder="45"
								inputMode="decimal"
								autoComplete="off"
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={depositId}>Caution</FieldLabel>
							<Input
								id={depositId}
								value={depositAmount}
								onChange={(event) => setDepositAmount(event.target.value)}
								placeholder="90"
								inputMode="decimal"
								autoComplete="off"
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor="create-contract-mileage-included">
								Kilomètres inclus par jour
							</FieldLabel>
							<Input
								id="create-contract-mileage-included"
								value={mileageIncludedPerDay}
								onChange={(event) =>
									setMileageIncludedPerDay(event.target.value)
								}
								placeholder="100"
								inputMode="numeric"
							/>
						</Field>

						<FieldGroup>
							<div className="flex items-center justify-between">
								<FieldLabel>
									Tarification des kilomètres supplémentaires
								</FieldLabel>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() =>
										setMileageRules((current) => [...current, newMileageRule()])
									}
								>
									Ajouter une tranche
								</Button>
							</div>
							{mileageRules.map((rule, index) => (
								<div className="flex items-end gap-2" key={rule.id}>
									<Field className="flex-1">
										<FieldLabel>Km dans la tranche</FieldLabel>
										<Input
											value={rule.kilometers}
											onChange={(event) =>
												setMileageRules((current) =>
													current.map((item, itemIndex) =>
														itemIndex === index
															? { ...item, kilometers: event.target.value }
															: item,
													),
												)
											}
											placeholder={
												index === mileageRules.length - 1 ? "Illimité" : "100"
											}
											inputMode="numeric"
										/>
									</Field>
									<Field className="flex-1">
										<FieldLabel>Prix / km</FieldLabel>
										<Input
											value={rule.pricePerKm}
											onChange={(event) =>
												setMileageRules((current) =>
													current.map((item, itemIndex) =>
														itemIndex === index
															? { ...item, pricePerKm: event.target.value }
															: item,
													),
												)
											}
											placeholder="0,30"
											inputMode="decimal"
										/>
									</Field>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() =>
											setMileageRules((current) =>
												current.filter((_, itemIndex) => itemIndex !== index),
											)
										}
									>
										Supprimer
									</Button>
								</div>
							))}
						</FieldGroup>
					</FieldGroup>
				</form>

				<SheetFooter>
					<Button
						type="submit"
						form="create-rental-contract"
						disabled={create.isPending || !ready}
					>
						{create.isPending ? <Spinner /> : null}
						Créer le contrat
					</Button>
					<SheetClose asChild>
						<Button variant="outline">Annuler</Button>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
