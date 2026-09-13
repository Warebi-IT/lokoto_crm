"use client";

import Add from "@carbon/icons-react/es/Add";
import { Button } from "@crm/ui/components/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandItem,
	CommandList,
} from "@crm/ui/components/command";
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@crm/ui/components/popover";
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
	const [plateNumber, setPlateNumber] = useState("");
	const [dailyRate, setDailyRate] = useState("");

	const seatsId = useId();
	const yearId = useId();
	const plateId = useId();
	const rateId = useId();

	const makeCatalog = useQuery({
		...trpc.vehicles.catalog.queryOptions({ q: make }),
		enabled: make.trim().length > 0,
	});
	const modelCatalog = useQuery({
		...trpc.vehicles.catalog.queryOptions({ q: model, make }),
		enabled: make.trim().length > 0,
	});

	const makeOptions = [
		...new Map(
			(makeCatalog.data ?? []).map((row) => [row.make, row.make]),
		).values(),
	].slice(0, 8);
	const modelOptions = (modelCatalog.data ?? []).slice(0, 8);

	const create = useMutation(
		trpc.vehicles.create.mutationOptions({
			onSuccess: async (vehicle) => {
				await cache.vehicle(vehicle.id);
				toast.success(`${vehicle.plateNumber} added.`);
				await setOpen(null);
				setMake("");
				setModel("");
				setCatalogId(null);
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
			<SheetContent side="right">
				<SheetHeader>
					<SheetTitle>Nouveau véhicule</SheetTitle>
					<SheetDescription>
						Ajoutez-le à la flotte avec son immatriculation.
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

						<CatalogField
							label="Marque"
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

						<CatalogField
							label="Modèle"
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

function CatalogField({
	label,
	placeholder,
	value,
	options,
	disabled,
	onValueChange,
	onSelect,
}: {
	label: string;
	placeholder: string;
	value: string;
	options: { key: string; label: string }[];
	disabled?: boolean;
	onValueChange: (value: string) => void;
	onSelect: (key: string) => void;
}) {
	const id = useId();
	const [open, setOpen] = useState(false);
	const showSuggestions = open && !disabled && options.length > 0;

	return (
		<Field>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Popover open={showSuggestions} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Input
						id={id}
						value={value}
						onChange={(event) => {
							onValueChange(event.target.value);
							setOpen(true);
						}}
						onFocus={() => setOpen(true)}
						placeholder={placeholder}
						autoComplete="off"
						disabled={disabled}
						required
					/>
				</PopoverTrigger>
				<PopoverContent
					size="fit"
					align="start"
					className="w-(--radix-popover-trigger-width)"
					onOpenAutoFocus={(event) => event.preventDefault()}
				>
					<Command shouldFilter={false}>
						<CommandList>
							<CommandEmpty>Aucun résultat.</CommandEmpty>
							<CommandGroup>
								{options.map((option) => (
									<CommandItem
										key={option.key}
										onSelect={() => {
											onSelect(option.key);
											setOpen(false);
										}}
									>
										{option.label}
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</Field>
	);
}
