"use client";

import Add from "@carbon/icons-react/es/Add";
import { Button } from "@crm/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
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
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

const TYPE_OPTIONS = [
	{ value: "CAR", label: "Car" },
	{ value: "MOTORCYCLE", label: "Motorcycle" },
	{ value: "SCOOTER", label: "Scooter" },
	{ value: "TRUCK", label: "Truck" },
	{ value: "MINIBUS", label: "Minibus" },
];

const FUEL_OPTIONS = [
	{ value: "DIESEL", label: "Diesel" },
	{ value: "GASOLINE", label: "Gasoline" },
	{ value: "ELECTRIC", label: "Electric" },
];

function AddButton(props: ComponentProps<typeof Button>) {
	return (
		<Button {...props}>
			<Icon icon={Add} data-icon="inline-start" />
			Nouveau véhicule
		</Button>
	);
}

export function CreateVehicleSheet() {
	return (
		<Suspense fallback={<AddButton disabled />}>
			<CreateVehicleForm />
		</Suspense>
	);
}

function CreateVehicleForm() {
	const openRecord = useOpenRecord();
	const trpc = useTRPC();
	const cache = useCrmCache();

	const [open, setOpen] = useQueryState(
		"new",
		parseAsBoolean.withDefault(false),
	);
	const [type, setType] = useState("CAR");
	const [fuelType, setFuelType] = useState("GASOLINE");
	const [seats, setSeats] = useState("");
	const [year, setYear] = useState("");
	const [make, setMake] = useState("");
	const [model, setModel] = useState("");
	const [catalogId, setCatalogId] = useState<string | null>(null);
	const [resetKey, setResetKey] = useState(0);
	const [plateNumber, setPlateNumber] = useState("");
	const [dailyRate, setDailyRate] = useState("");

	const seatsId = useId();
	const yearId = useId();
	const plateId = useId();
	const rateId = useId();

	const makeCatalog = useQuery(trpc.vehicles.makes.queryOptions());
	const modelCatalog = useQuery({
		...trpc.vehicles.catalog.queryOptions({ q: "", make }),
		enabled: make.trim().length > 0,
	});

	const makeOptions = makeCatalog.data ?? [];
	const modelOptions = modelCatalog.data ?? [];

	const create = useMutation(
		trpc.vehicles.create.mutationOptions({
			onSuccess: async (vehicle) => {
				await cache.vehicle(vehicle.id);
				toast.success(`${vehicle.plateNumber} added.`);
				await setOpen(null);
				setMake("");
				setModel("");
				setCatalogId(null);
				setResetKey((current) => current + 1);
				setYear("");
				setSeats("");
				setPlateNumber("");
				setDailyRate("");
				openRecord({ kind: "vehicle", id: vehicle.id });
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const parsedSeats = Number.parseInt(seats, 10);
	const parsedYear = Number.parseInt(year, 10);

	const ready =
		make.trim() !== "" &&
		model.trim() !== "" &&
		plateNumber.trim() !== "" &&
		Number.isFinite(parsedSeats) &&
		parsedSeats > 0;

	return (
		<Sheet open={open} onOpenChange={(next) => setOpen(next || null)}>
			<SheetTrigger asChild>
				<AddButton />
			</SheetTrigger>
			<SheetContent side="right" size="2xl">
				<SheetHeader>
					<SheetTitle size="lg">Nouveau véhicule</SheetTitle>
					<SheetDescription>
						Renseignez les informations du véhicule pour l’ajouter à la flotte.
					</SheetDescription>
				</SheetHeader>

				<form
					id="create-vehicle"
					className="flex-1 overflow-y-auto px-4"
					onSubmit={(event) => {
						event.preventDefault();
						const parsedRate = Number.parseFloat(dailyRate);
						create.mutate({
							type: type as never,
							fuelType: fuelType as never,
							seats: parsedSeats,
							vehicleCatalogId: catalogId ?? undefined,
							make,
							model,
							year: Number.isFinite(parsedYear) ? parsedYear : null,
							plateNumber,
							dailyRateCents: Number.isFinite(parsedRate)
								? Math.round(parsedRate * 100)
								: null,
						});
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="create-vehicle-type">Type</FieldLabel>
							<FieldDescription>
								Détermine la catégorie du véhicule.
							</FieldDescription>
							<Select value={type} onValueChange={setType}>
								<SelectTrigger id="create-vehicle-type">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{TYPE_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>

						<Field>
							<FieldLabel htmlFor="create-vehicle-fuel">Carburant</FieldLabel>
							<FieldDescription>
								Indiquez l’énergie utilisée par le véhicule.
							</FieldDescription>
							<Select value={fuelType} onValueChange={setFuelType}>
								<SelectTrigger id="create-vehicle-fuel">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{FUEL_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>

						<Field>
							<FieldLabel htmlFor={seatsId}>Nombre de sièges</FieldLabel>
							<FieldDescription>
								Nombre de personnes pouvant être transportées.
							</FieldDescription>
							<Input
								id={seatsId}
								value={seats}
								onChange={(event) => setSeats(event.target.value)}
								placeholder="5"
								inputMode="numeric"
								autoComplete="off"
								required
							/>
						</Field>

						<CatalogSelect
							key={`make-${resetKey}`}
							label="Marque"
							description="Choisissez une marque, ou « Autre » pour la saisir."
							placeholder="Toyota"
							value={make}
							options={makeOptions.map((option) => ({
								key: option,
								label: option,
							}))}
							onValueChange={(next) => {
								setMake(next);
								setModel("");
								setCatalogId(null);
							}}
							onSelect={(next) => {
								setMake(next);
								setModel("");
								setCatalogId(null);
							}}
						/>

						<CatalogSelect
							key={`model-${make}-${resetKey}`}
							label="Modèle"
							description="Le modèle est filtré selon la marque choisie."
							placeholder="Corolla"
							value={model}
							disabled={make.trim() === ""}
							options={modelOptions.map((option) => ({
								key: option.id,
								label: option.model,
							}))}
							onValueChange={(next) => {
								setModel(next);
								setCatalogId(null);
							}}
							onSelect={(id) => {
								const picked = modelOptions.find((option) => option.id === id);
								if (!picked) return;
								setModel(picked.model);
								setCatalogId(picked.id);
							}}
						/>

						<Field>
							<FieldLabel htmlFor={yearId}>Année</FieldLabel>
							<FieldDescription>
								Année de première mise en circulation.
							</FieldDescription>
							<Input
								id={yearId}
								value={year}
								onChange={(event) => setYear(event.target.value)}
								placeholder="2020"
								inputMode="numeric"
								autoComplete="off"
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={plateId}>Immatriculation</FieldLabel>
							<FieldDescription>
								Identifiant unique utilisé dans les contrats.
							</FieldDescription>
							<Input
								id={plateId}
								value={plateNumber}
								onChange={(event) => setPlateNumber(event.target.value)}
								placeholder="DK-1234-AA"
								autoComplete="off"
								required
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={rateId}>Tarif journalier</FieldLabel>
							<FieldDescription>
								Prix de location par jour, dans la devise de la société.
							</FieldDescription>
							<Input
								id={rateId}
								value={dailyRate}
								onChange={(event) => setDailyRate(event.target.value)}
								placeholder="45"
								inputMode="decimal"
								autoComplete="off"
							/>
						</Field>
					</FieldGroup>
				</form>

				<SheetFooter>
					<Button
						type="submit"
						form="create-vehicle"
						disabled={create.isPending || !ready}
					>
						{create.isPending ? <Spinner /> : null}
						Add vehicle
					</Button>
					<SheetClose asChild>
						<Button variant="outline">Annuler</Button>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}

const OTHER_OPTION = "__other";

function CatalogSelect({
	label,
	description,
	placeholder,
	value,
	options,
	disabled,
	onValueChange,
	onSelect,
}: {
	label: string;
	description: string;
	placeholder: string;
	value: string;
	options: { key: string; label: string }[];
	disabled?: boolean;
	onValueChange: (value: string) => void;
	onSelect: (key: string) => void;
}) {
	const id = useId();
	const [other, setOther] = useState(false);
	const picked = options.find((option) => option.label === value);
	const selected = other ? OTHER_OPTION : (picked?.key ?? "");

	return (
		<Field>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<FieldDescription>{description}</FieldDescription>
			<Select
				value={selected}
				disabled={disabled}
				onValueChange={(next) => {
					if (next === OTHER_OPTION) {
						setOther(true);
						onValueChange("");
						return;
					}
					setOther(false);
					onSelect(next);
				}}
			>
				<SelectTrigger id={id}>
					<SelectValue placeholder={placeholder} />
				</SelectTrigger>
				<SelectContent>
					{options.map((option) => (
						<SelectItem key={option.key} value={option.key}>
							{option.label}
						</SelectItem>
					))}
					<SelectItem value={OTHER_OPTION}>Autre…</SelectItem>
				</SelectContent>
			</Select>
			{other ? (
				<Input
					value={value}
					onChange={(event) => onValueChange(event.target.value)}
					placeholder={placeholder}
					autoComplete="off"
					required
				/>
			) : null}
		</Field>
	);
}
