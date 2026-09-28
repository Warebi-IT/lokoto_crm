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
	const [make, setMake] = useState("");
	const [model, setModel] = useState("");
	const [plateNumber, setPlateNumber] = useState("");
	const [dailyRate, setDailyRate] = useState("");

	const makeId = useId();
	const modelId = useId();
	const plateId = useId();
	const rateId = useId();

	const create = useMutation(
		trpc.vehicles.create.mutationOptions({
			onSuccess: async (vehicle) => {
				await cache.vehicle(vehicle.id);
				toast.success(`${vehicle.plateNumber} added.`);
				await setOpen(null);
				setMake("");
				setModel("");
				setPlateNumber("");
				setDailyRate("");
				openRecord({ kind: "vehicle", id: vehicle.id });
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const ready =
		make.trim() !== "" && model.trim() !== "" && plateNumber.trim() !== "";

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
						const parsed = Number.parseFloat(dailyRate);
						create.mutate({
							type: type as never,
							fuelType: fuelType as never,
							make,
							model,
							plateNumber,
							dailyRateCents: Number.isFinite(parsed)
								? Math.round(parsed * 100)
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
							<FieldLabel htmlFor={makeId}>Marque</FieldLabel>
							<Input
								id={makeId}
								value={make}
								onChange={(event) => setMake(event.target.value)}
								placeholder="Toyota"
								autoComplete="off"
								required
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={modelId}>Modèle</FieldLabel>
							<Input
								id={modelId}
								value={model}
								onChange={(event) => setModel(event.target.value)}
								placeholder="Corolla"
								autoComplete="off"
								required
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
