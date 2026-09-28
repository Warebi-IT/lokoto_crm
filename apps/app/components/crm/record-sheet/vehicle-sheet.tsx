"use client";

import Calendar from "@carbon/icons-react/es/Calendar";
import Currency from "@carbon/icons-react/es/Currency";
import Edit from "@carbon/icons-react/es/Edit";
import Meter from "@carbon/icons-react/es/Meter";
import ToolKit from "@carbon/icons-react/es/ToolKit";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import Warning from "@carbon/icons-react/es/Warning";
import { ChargeFrequency, FinancingType } from "@crm/db/enums";
import type { FieldValueJson } from "@crm/db/fields";
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
import type { ChartConfig } from "@crm/ui/components/chart";
import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import { EntityLogo } from "@crm/ui/components/entity-logo";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { TableCell } from "@crm/ui/components/table";
import { Textarea } from "@crm/ui/components/textarea";
import { formatMoney, formatMoneyCompact } from "@crm/ui/lib/format";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { AgentPanel } from "@/components/crm/agent-panel";
import { FieldsCog, RecordFields } from "@/components/crm/fields/record-fields";
import {
	InlineDateField,
	InlineField,
	InlineSelectField,
	savingValue,
} from "@/components/crm/inline-field";
import { RentalStatusIndicator } from "@/components/crm/rental-status";
import { Timeline } from "@/components/crm/timeline/timeline";
import { AreaTrend } from "@/components/dashboard-charts";
import {
	DetailSheetBody,
	DetailSheetEmpty,
	DetailSheetProperties,
	DetailSheetProperty,
	DetailSheetSection,
	DetailSheetStat,
	DetailSheetStats,
	type DetailSheetTab,
} from "@/components/detail-sheet";
import { LocalDay } from "@/components/local-date-time";
import { savingField } from "@/lib/pending-field";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import type {
	DamageAnnotationDraft,
	DamagePoint,
	DamageSeverity,
	DamageType,
	DamageView,
} from "../vehicle-damage/vehicle-damage-editor";
import { VehicleDamageEditor } from "../vehicle-damage/vehicle-damage-editor";
import { QuickAddForm } from "./quick-add";
import { RecordActions } from "./record-actions";
import { RecordSheetFrame } from "./record-parts";
import { useOpenRecord, useRecordSheetView } from "./record-stack";

type Vehicle = RouterOutputs["vehicles"]["byId"];
type VehicleCharge = RouterOutputs["vehicleCharges"]["listByVehicle"][number];
type PersistedDamageAnnotation = {
	id: string;
	view: string;
	type: string;
	severity: string;
	x: number;
	y: number;
	points: unknown;
	description: string | null;
};
type VehicleIncidentRow = {
	id: string;
	description: string;
	responsibleParty: string;
	damageAnnotations: PersistedDamageAnnotation[];
};

const VEHICLE_TYPE_OPTIONS = [
	{ value: "CAR", label: "Voiture" },
	{ value: "MOTORCYCLE", label: "Moto" },
	{ value: "SCOOTER", label: "Scooter" },
	{ value: "TRUCK", label: "Camion" },
	{ value: "MINIBUS", label: "Minibus" },
];

const VEHICLE_FUEL_OPTIONS = [
	{ value: "DIESEL", label: "Gazole" },
	{ value: "GASOLINE", label: "Essence" },
	{ value: "ELECTRIC", label: "Électrique" },
];

const VEHICLE_STATUS_OPTIONS = [
	{ value: "AVAILABLE", label: "Disponible" },
	{ value: "RESERVED", label: "Réservée" },
	{ value: "RENTED", label: "Louée" },
	{ value: "MAINTENANCE", label: "Maintenance" },
	{ value: "OUT_OF_SERVICE", label: "Hors service" },
	{ value: "STOLEN", label: "Volée" },
];

const CONTRACT_COLUMNS = [
	{ id: "renter", header: "Client", width: "w-[28%]", className: "pl-5" },
	{ id: "status", header: "Statut", width: "w-[18%]" },
	{ id: "dates", header: "Dates", width: "w-[28%]" },
	{
		id: "amount",
		header: "Montant",
		width: "w-[16%]",
		align: "right" as const,
	},
];

const MAINTENANCE_COLUMNS = [
	{
		id: "description",
		header: "Intervention",
		width: "w-[34%]",
		className: "pl-5",
	},
	{ id: "when", header: "Date", width: "w-[22%]" },
	{
		id: "odometer",
		header: "Kilométrage",
		width: "w-[18%]",
		align: "right" as const,
	},
	{ id: "cost", header: "Coût", width: "w-[16%]", align: "right" as const },
];

const INCIDENT_COLUMNS = [
	{ id: "type", header: "Type", width: "w-[16%]", className: "pl-5" },
	{ id: "description", header: "Commentaire", width: "w-[30%]" },
	{ id: "areas", header: "Zones", width: "w-[24%]" },
	{ id: "responsible", header: "Responsable", width: "w-[16%]" },
	{ id: "actions", header: "", width: "w-[8%]" },
];

const CHARGE_COLUMNS = [
	{ id: "label", header: "Charge", width: "w-[36%]" },
	{ id: "frequency", header: "Fréquence", width: "w-[18%]" },
	{ id: "period", header: "Période", width: "w-[26%]" },
	{
		id: "amount",
		header: "Montant",
		width: "w-[14%]",
		align: "right" as const,
	},
	{ id: "actions", header: "", width: "w-[6%]" },
];

const FINANCING_TYPE_OPTIONS = [
	{ value: FinancingType.LOAN, label: "Crédit" },
	{ value: FinancingType.LEASING, label: "Leasing" },
];

const CHARGE_FREQUENCY_OPTIONS = [
	{ value: ChargeFrequency.ONE_TIME, label: "Ponctuelle" },
	{ value: ChargeFrequency.MONTHLY, label: "Mensuelle" },
];

const PROFITABILITY_TREND_CONFIG: ChartConfig = {
	revenueCents: { label: "Revenus", color: "var(--success)" },
	expensesCents: { label: "Coûts", color: "var(--chart-5)" },
};

const MILEAGE_TREND_CONFIG: ChartConfig = {
	mileage: { label: "Kilométrage", color: "var(--chart-1)" },
};

export function VehicleSheet({ vehicleId }: { vehicleId: string }) {
	const trpc = useTRPC();
	const { tab, setTab } = useRecordSheetView("overview");

	const query = useQuery(trpc.vehicles.byId.queryOptions({ id: vehicleId }));
	const vehicle = query.data;

	const tabs: DetailSheetTab[] = vehicle
		? [
				{
					value: "overview",
					label: "Vue d’ensemble",
					content: <VehicleOverview vehicle={vehicle} />,
				},
				{
					value: "history",
					label: "Historique des locations",
					content: <VehicleRentalHistory vehicleId={vehicle.id} />,
				},
				{
					value: "maintenance",
					label: "Entretien",
					content: <VehicleMaintenance vehicleId={vehicle.id} />,
				},
				{
					value: "financing",
					label: "Financement",
					content: <VehicleFinancing vehicle={vehicle} />,
				},
				{
					value: "incidents",
					label: "Incidents",
					content: (
						<VehicleIncidents
							vehicleId={vehicle.id}
							vehicleStatus={vehicle.status}
						/>
					),
				},
				{
					value: "activity",
					label: "Activité",
					content: <Timeline anchor={{ vehicleId: vehicle.id }} />,
				},
				{
					value: "agent",
					label: "Agent",
					content: <AgentPanel record={{ kind: "vehicle", id: vehicle.id }} />,
					keepMounted: true,
				},
			]
		: [];

	return (
		<RecordSheetFrame
			loading={query.isPending}
			error={query.error?.message ?? null}
			title={vehicle ? `${vehicle.make} ${vehicle.model}` : "Véhicule"}
			description={vehicle?.plateNumber}
			media={
				vehicle ? (
					<EntityLogo name={vehicle.plateNumber} size="lg" elevation="raised" />
				) : null
			}
			actions={
				vehicle ? (
					<RecordActions
						record={{ kind: "vehicle", id: vehicle.id }}
						name={`${vehicle.make} ${vehicle.model}`}
						consequence="Son historique de location, ses entretiens et ses incidents sont également supprimés."
					/>
				) : null
			}
			stats={
				vehicle ? (
					<DetailSheetStats>
						<DetailSheetStat label="Statut">
							<StatusIndicator
								tone={
									vehicle.status === "AVAILABLE"
										? "success"
										: vehicle.status === "RENTED" ||
												vehicle.status === "RESERVED"
											? "info"
											: vehicle.status === "STOLEN"
												? "error"
												: "warning"
								}
								label={
									VEHICLE_STATUS_OPTIONS.find((o) => o.value === vehicle.status)
										?.label ?? vehicle.status
								}
							/>
						</DetailSheetStat>
						<DetailSheetStat label="Tarif journalier" icon={Currency}>
							{vehicle.dailyRateCents === null ? (
								<EmptyCellValue />
							) : (
								<span className="tabular-nums">
									{formatMoney(vehicle.dailyRateCents, vehicle.currency)}
								</span>
							)}
						</DetailSheetStat>
						<DetailSheetStat label="Kilométrage" icon={Meter}>
							<span className="tabular-nums">
								{vehicle.mileage.toLocaleString()} km
							</span>
						</DetailSheetStat>
					</DetailSheetStats>
				) : null
			}
			tabs={tabs}
			tab={tab}
			onTabChange={setTab}
		/>
	);
}

function VehicleOverview({ vehicle }: { vehicle: Vehicle }) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const update = useMutation(
		trpc.vehicles.update.mutationOptions({
			onSuccess: () => cache.vehicle(vehicle.id, { settle: "record" }),
			onError: (error) => toast.error(error.message),
		}),
	);

	const saveFields = (fields: Record<string, FieldValueJson>) =>
		update.mutate({ id: vehicle.id, data: { fields } });

	const isSavingField = savingValue(update);
	const isSaving = savingField(update);

	const save = (data: Parameters<typeof update.mutate>[0]["data"]) =>
		update.mutate({ id: vehicle.id, data });

	return (
		<DetailSheetBody>
			<DetailSheetSection title="Détails" action={<FieldsCog kind="vehicle" />}>
				<DetailSheetProperties>
					<InlineSelectField
						label="Type"
						value={vehicle.type}
						options={VEHICLE_TYPE_OPTIONS}
						onSave={(type) => save({ type: type as never })}
					/>
					<InlineSelectField
						label="Carburant"
						value={vehicle.fuelType}
						options={VEHICLE_FUEL_OPTIONS}
						onSave={(fuelType) => save({ fuelType: fuelType as never })}
					/>
					<InlineField
						label="Marque"
						value={vehicle.make}
						saving={isSaving("make")}
						onSave={(make) => make && save({ make })}
					/>
					<InlineField
						label="Modèle"
						value={vehicle.model}
						saving={isSaving("model")}
						onSave={(model) => model && save({ model })}
					/>
					<InlineField
						label="Année"
						value={vehicle.year === null ? null : String(vehicle.year)}
						saving={isSaving("year")}
						onSave={(next) => save({ year: next ? Number(next) : null })}
					/>
					<InlineField
						label="Immatriculation"
						value={vehicle.plateNumber}
						saving={isSaving("plateNumber")}
						onSave={(plateNumber) => plateNumber && save({ plateNumber })}
					/>
					<InlineField
						label="Couleur"
						value={vehicle.color}
						saving={isSaving("color")}
						onSave={(color) => save({ color })}
					/>
					<InlineSelectField
						label="Statut"
						value={vehicle.status}
						options={VEHICLE_STATUS_OPTIONS}
						onSave={(status) => save({ status: status as never })}
					/>
					<InlineField
						label="Tarif journalier"
						value={
							vehicle.dailyRateCents === null
								? null
								: String(vehicle.dailyRateCents / 100)
						}
						saving={isSaving("dailyRateCents")}
						onSave={(next) => {
							if (next === "") return save({ dailyRateCents: null });
							const parsed = Number.parseFloat(next);
							if (!Number.isFinite(parsed) || parsed < 0) {
								toast.error("Le tarif journalier doit être un nombre.");
								return;
							}
							save({ dailyRateCents: Math.round(parsed * 100) });
						}}
						render={(value) =>
							formatMoney(Math.round(Number(value) * 100), vehicle.currency)
						}
					/>
					<InlineField
						label="Kilométrage"
						value={String(vehicle.mileage)}
						saving={isSaving("mileage")}
						onSave={(next) => save({ mileage: Number(next) || 0 })}
					/>
					<InlineField
						label="N° de police d’assurance"
						value={vehicle.insurancePolicyNumber}
						saving={isSaving("insurancePolicyNumber")}
						onSave={(insurancePolicyNumber) => save({ insurancePolicyNumber })}
					/>
					<InlineDateField
						label="Expiration de l’assurance"
						value={vehicle.insuranceExpiresAt}
						saving={isSaving("insuranceExpiresAt")}
						onSave={(next) => save({ insuranceExpiresAt: next || null })}
					/>
					<InlineDateField
						label="Expiration de la carte grise"
						value={vehicle.registrationExpiresAt}
						saving={isSaving("registrationExpiresAt")}
						onSave={(next) => save({ registrationExpiresAt: next || null })}
					/>
					<InlineDateField
						label="Prochain entretien"
						value={vehicle.nextMaintenanceAtDate}
						saving={isSaving("nextMaintenanceAtDate")}
						onSave={(next) => save({ nextMaintenanceAtDate: next || null })}
					/>
					<RecordFields
						fields={vehicle.fields}
						saving={isSavingField}
						onSave={saveFields}
					/>
				</DetailSheetProperties>
			</DetailSheetSection>
			<DetailSheetSection title="Évolution du kilométrage">
				{vehicle.mileageHistory.length > 0 ? (
					<AreaTrend
						data={vehicle.mileageHistory.map((entry) => ({
							date: new Intl.DateTimeFormat("fr-FR", {
								day: "2-digit",
								month: "short",
							}).format(new Date(entry.recordedAt)),
							mileage: entry.mileage,
						}))}
						config={MILEAGE_TREND_CONFIG}
						xKey="date"
						height={180}
						formatValue={(value) =>
							`${Number(value).toLocaleString("fr-FR")} km`
						}
					/>
				) : (
					<DetailSheetProperty label="Historique">
						Aucune restitution enregistrée.
					</DetailSheetProperty>
				)}
			</DetailSheetSection>
		</DetailSheetBody>
	);
}

function VehicleRentalHistory({ vehicleId }: { vehicleId: string }) {
	const trpc = useTRPC();
	const openRecord = useOpenRecord();

	const contracts = useQuery(
		trpc.rentalContracts.list.queryOptions({
			q: "",
			sort: "startDate",
			dir: "desc",
			page: 1,
			pageSize: 50,
			status: "all",
			vehicle: vehicleId,
			channel: "all",
		}),
	);

	const rows = contracts.data?.rows ?? [];

	if (!contracts.isPending && rows.length === 0) {
		return (
			<DetailSheetEmpty
				icon={Calendar}
				title="Aucun historique de location"
				description="Ce véhicule n’a encore jamais été loué."
			/>
		);
	}

	return (
		<SimpleTable variant="panel" columns={CONTRACT_COLUMNS}>
			{rows.map((contract) => (
				<SimpleTableRow
					key={contract.id}
					clickable
					onClick={() =>
						openRecord({ kind: "rentalContract", id: contract.id })
					}
				>
					<TableCell className="truncate py-2.5 pr-3 pl-5 font-medium">
						{contract.contact.firstName} {contract.contact.lastName ?? ""}
					</TableCell>
					<TableCell className="px-3 py-2.5">
						<RentalStatusIndicator status={contract.status} />
					</TableCell>
					<TableCell className="truncate px-3 py-2.5 text-muted-foreground">
						<LocalDay date={contract.startDate} /> –{" "}
						<LocalDay date={contract.endDate} />
					</TableCell>
					<TableCell className="px-3 py-2.5 text-right tabular-nums">
						{contract.totalAmountCents === null ? (
							<EmptyCellValue />
						) : (
							formatMoney(contract.totalAmountCents, contract.currency)
						)}
					</TableCell>
				</SimpleTableRow>
			))}
		</SimpleTable>
	);
}

function VehicleMaintenance({ vehicleId }: { vehicleId: string }) {
	const trpc = useTRPC();
	const [adding, setAdding] = useState(false);

	const records = useQuery(
		trpc.maintenanceRecords.listByVehicle.queryOptions({ vehicleId }),
	);

	const rows = records.data ?? [];

	const form = adding ? (
		<MaintenanceForm vehicleId={vehicleId} onDone={() => setAdding(false)} />
	) : null;

	if (!records.isPending && rows.length === 0) {
		return (
			<>
				{form}
				{adding ? null : (
					<DetailSheetEmpty
						icon={ToolKit}
						title="Aucun entretien enregistré"
						description="Aucun entretien n’a encore été enregistré pour ce véhicule."
						action={
							<button
								type="button"
								onClick={() => setAdding(true)}
								className="text-foreground text-sm underline-offset-2 hover:underline"
							>
								Ajouter un entretien
							</button>
						}
					/>
				)}
			</>
		);
	}

	return (
		<>
			{form}
			<SimpleTable variant="panel" columns={MAINTENANCE_COLUMNS}>
				{rows.map((record) => (
					<SimpleTableRow key={record.id}>
						<TableCell className="truncate py-2.5 pr-3 pl-5 font-medium">
							{record.description}
						</TableCell>
						<TableCell className="truncate px-3 py-2.5 text-muted-foreground">
							{record.completedAt ? (
								<LocalDay date={record.completedAt} />
							) : record.scheduledAtDate ? (
								<LocalDay date={record.scheduledAtDate} />
							) : (
								<EmptyCellValue />
							)}
						</TableCell>
						<TableCell className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
							{record.odometerAtService ?? <EmptyCellValue />}
						</TableCell>
						<TableCell className="px-3 py-2.5 text-right tabular-nums">
							{record.costCents === null ? (
								<EmptyCellValue />
							) : (
								formatMoney(record.costCents, record.currency ?? "USD")
							)}
						</TableCell>
					</SimpleTableRow>
				))}
			</SimpleTable>
			{adding ? null : (
				<button
					type="button"
					onClick={() => setAdding(true)}
					className="w-full border-t px-5 py-2 text-left text-muted-foreground text-sm hover:text-foreground"
				>
					Ajouter un entretien
				</button>
			)}
		</>
	);
}

function MaintenanceForm({
	vehicleId,
	onDone,
}: {
	vehicleId: string;
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [description, setDescription] = useState("");
	const [scheduledAtDate, setScheduledAtDate] = useState("");
	const descriptionId = useId();

	const create = useMutation(
		trpc.maintenanceRecords.create.mutationOptions({
			onSuccess: async () => {
				await cache.vehicle(vehicleId);
				toast.success("Entretien ajouté.");
				onDone();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<QuickAddForm
			submitLabel="Ajouter l’entretien"
			pending={create.isPending}
			ready={description.trim() !== ""}
			onCancel={onDone}
			onSubmit={() =>
				create.mutate({
					vehicleId,
					type: "SCHEDULED",
					description,
					scheduledAtDate: scheduledAtDate || null,
				})
			}
		>
			<Field className="sm:col-span-2">
				<FieldLabel htmlFor={descriptionId}>Work</FieldLabel>
				<Input
					id={descriptionId}
					autoFocus
					value={description}
					onChange={(event) => setDescription(event.target.value)}
					placeholder="Vidange et remplacement du filtre"
					autoComplete="off"
				/>
			</Field>
			<Field>
				<FieldLabel>Scheduled for</FieldLabel>
				<Input
					type="date"
					value={scheduledAtDate}
					onChange={(event) => setScheduledAtDate(event.target.value)}
				/>
			</Field>
		</QuickAddForm>
	);
}

function VehicleFinancing({ vehicle }: { vehicle: Vehicle }) {
	return (
		<DetailSheetBody>
			<FinancingSection vehicle={vehicle} />
			<ProfitabilitySection vehicleId={vehicle.id} />
			<ChargesSection vehicleId={vehicle.id} />
		</DetailSheetBody>
	);
}

function FinancingSection({ vehicle }: { vehicle: Vehicle }) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [editing, setEditing] = useState(false);

	const clear = useMutation(
		trpc.vehicles.clearFinancing.mutationOptions({
			onSuccess: async () => {
				await cache.vehicle(vehicle.id);
				toast.success("Financement supprimé.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (editing || !vehicle.financing) {
		return (
			<DetailSheetSection title="Financement">
				<FinancingForm
					vehicle={vehicle}
					onDone={() => setEditing(false)}
					onCancel={vehicle.financing ? () => setEditing(false) : undefined}
				/>
			</DetailSheetSection>
		);
	}

	const financing = vehicle.financing;

	return (
		<DetailSheetSection
			title="Financement"
			action={
				<div className="flex items-center gap-1">
					<Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
						Modifier
					</Button>
					<Button
						variant="ghost"
						size="sm"
						disabled={clear.isPending}
						onClick={() => clear.mutate({ vehicleId: vehicle.id })}
					>
						Supprimer
					</Button>
				</div>
			}
		>
			<DetailSheetProperties>
				<DetailSheetProperty label="Type">
					{FINANCING_TYPE_OPTIONS.find((o) => o.value === financing.type)
						?.label ?? financing.type}
				</DetailSheetProperty>
				<DetailSheetProperty label="Mensualité">
					{financing.monthlyPaymentCents === null ? (
						<EmptyCellValue />
					) : (
						formatMoney(financing.monthlyPaymentCents, financing.currency)
					)}
				</DetailSheetProperty>
				{financing.principalAmountCents === null ? null : (
					<DetailSheetProperty label="Capital financé">
						{formatMoney(financing.principalAmountCents, financing.currency)}
					</DetailSheetProperty>
				)}
				{financing.interestRate === null ? null : (
					<DetailSheetProperty label="Taux d’intérêt">
						{financing.interestRate}%
					</DetailSheetProperty>
				)}
				{financing.termMonths === null ? null : (
					<DetailSheetProperty label="Durée">
						{financing.termMonths} mois
					</DetailSheetProperty>
				)}
				<DetailSheetProperty label="Date de début">
					<LocalDay date={financing.startDate} />
				</DetailSheetProperty>
			</DetailSheetProperties>
		</DetailSheetSection>
	);
}

function FinancingForm({
	vehicle,
	onDone,
	onCancel,
}: {
	vehicle: Vehicle;
	onDone: () => void;
	onCancel?: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const existing = vehicle.financing;

	const [type, setType] = useState<FinancingType>(
		existing?.type ?? FinancingType.LOAN,
	);
	const [principal, setPrincipal] = useState(
		existing?.principalAmountCents === null ||
			existing?.principalAmountCents === undefined
			? ""
			: String(existing.principalAmountCents / 100),
	);
	const [monthlyPayment, setMonthlyPayment] = useState(
		existing?.monthlyPaymentCents === null ||
			existing?.monthlyPaymentCents === undefined
			? ""
			: String(existing.monthlyPaymentCents / 100),
	);
	const [interestRate, setInterestRate] = useState(
		existing?.interestRate === null || existing?.interestRate === undefined
			? ""
			: String(existing.interestRate),
	);
	const [termMonths, setTermMonths] = useState(
		existing?.termMonths === null || existing?.termMonths === undefined
			? ""
			: String(existing.termMonths),
	);
	const [startDate, setStartDate] = useState(
		existing?.startDate ? existing.startDate.slice(0, 10) : "",
	);

	const typeId = useId();
	const principalId = useId();
	const monthlyPaymentId = useId();
	const interestRateId = useId();
	const termMonthsId = useId();
	const startDateId = useId();

	const save = useMutation(
		trpc.vehicles.setFinancing.mutationOptions({
			onSuccess: async () => {
				await cache.vehicle(vehicle.id);
				toast.success("Financement enregistré.");
				onDone();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const monthlyPaymentCents = parseAmountCents(monthlyPayment);
	const ready = monthlyPaymentCents !== null && startDate !== "";

	return (
		<QuickAddForm
			submitLabel={
				existing ? "Enregistrer le financement" : "Ajouter un financement"
			}
			pending={save.isPending}
			ready={ready}
			onCancel={onCancel ?? onDone}
			onSubmit={() => {
				if (monthlyPaymentCents === null) return;
				save.mutate({
					vehicleId: vehicle.id,
					type,
					currency: vehicle.currency,
					monthlyPaymentCents,
					principalAmountCents:
						type === FinancingType.LOAN ? parseAmountCents(principal) : null,
					interestRate:
						type === FinancingType.LOAN && interestRate.trim() !== ""
							? Number.parseFloat(interestRate)
							: null,
					termMonths: termMonths.trim() === "" ? null : Number(termMonths),
					startDate,
				});
			}}
		>
			<Field>
				<FieldLabel htmlFor={typeId}>Type</FieldLabel>
				<Select
					value={type}
					onValueChange={(next) => setType(next as FinancingType)}
				>
					<SelectTrigger id={typeId} className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{FINANCING_TYPE_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</Field>
			<Field>
				<FieldLabel htmlFor={monthlyPaymentId}>Mensualité</FieldLabel>
				<Input
					id={monthlyPaymentId}
					autoFocus
					inputMode="decimal"
					value={monthlyPayment}
					onChange={(event) => setMonthlyPayment(event.target.value)}
					placeholder="350"
				/>
			</Field>
			{type === FinancingType.LOAN ? (
				<Field>
					<FieldLabel htmlFor={principalId}>Capital financé</FieldLabel>
					<Input
						id={principalId}
						inputMode="decimal"
						value={principal}
						onChange={(event) => setPrincipal(event.target.value)}
						placeholder="18000"
					/>
				</Field>
			) : null}
			{type === FinancingType.LOAN ? (
				<Field>
					<FieldLabel htmlFor={interestRateId}>Taux d’intérêt (%)</FieldLabel>
					<Input
						id={interestRateId}
						inputMode="decimal"
						value={interestRate}
						onChange={(event) => setInterestRate(event.target.value)}
						placeholder="7.5"
					/>
				</Field>
			) : null}
			<Field>
				<FieldLabel htmlFor={termMonthsId}>Durée (mois)</FieldLabel>
				<Input
					id={termMonthsId}
					inputMode="numeric"
					value={termMonths}
					onChange={(event) => setTermMonths(event.target.value)}
					placeholder="48"
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor={startDateId}>Date de début</FieldLabel>
				<Input
					id={startDateId}
					type="date"
					value={startDate}
					onChange={(event) => setStartDate(event.target.value)}
				/>
			</Field>
		</QuickAddForm>
	);
}

function ChargesSection({ vehicleId }: { vehicleId: string }) {
	const trpc = useTRPC();
	const [adding, setAdding] = useState(false);

	const charges = useQuery(
		trpc.vehicleCharges.listByVehicle.queryOptions({ vehicleId }),
	);

	const rows = charges.data ?? [];

	return (
		<DetailSheetSection
			title="Charges"
			action={
				adding ? null : (
					<Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
						Ajouter une charge
					</Button>
				)
			}
		>
			{adding ? (
				<ChargeForm vehicleId={vehicleId} onDone={() => setAdding(false)} />
			) : null}
			{rows.length === 0 ? (
				adding ? null : (
					<p className="text-muted-foreground text-xs/5">
						Aucune charge récurrente pour ce véhicule.
					</p>
				)
			) : (
				<SimpleTable columns={CHARGE_COLUMNS}>
					{rows.map((charge) => (
						<ChargeRow key={charge.id} charge={charge} vehicleId={vehicleId} />
					))}
				</SimpleTable>
			)}
		</DetailSheetSection>
	);
}

function ChargeRow({
	charge,
	vehicleId,
}: {
	charge: VehicleCharge;
	vehicleId: string;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const remove = useMutation(
		trpc.vehicleCharges.delete.mutationOptions({
			onSuccess: async () => {
				await cache.vehicle(vehicleId);
				toast.success("Charge supprimée.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<SimpleTableRow>
			<TableCell className="truncate py-2.5 pr-3 font-medium">
				{charge.label}
			</TableCell>
			<TableCell className="px-3 py-2.5 text-muted-foreground">
				{
					CHARGE_FREQUENCY_OPTIONS.find((o) => o.value === charge.frequency)
						?.label
				}
			</TableCell>
			<TableCell className="truncate px-3 py-2.5 text-muted-foreground">
				<LocalDay date={charge.startDate} />
				{charge.endDate ? (
					<>
						{" – "}
						<LocalDay date={charge.endDate} />
					</>
				) : charge.frequency === ChargeFrequency.MONTHLY ? (
					" – ongoing"
				) : null}
			</TableCell>
			<TableCell className="px-3 py-2.5 text-right tabular-nums">
				{charge.amountCents === null ? (
					<EmptyCellValue />
				) : (
					formatMoney(charge.amountCents, charge.currency)
				)}
			</TableCell>
			<TableCell className="py-1 pr-1 text-right">
				<Button
					variant="ghost"
					size="icon-sm"
					disabled={remove.isPending}
					onClick={() => remove.mutate({ id: charge.id })}
				>
					<Icon icon={TrashCan} />
					<span className="sr-only">Supprimer cette charge</span>
				</Button>
			</TableCell>
		</SimpleTableRow>
	);
}

function ChargeForm({
	vehicleId,
	onDone,
}: {
	vehicleId: string;
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [label, setLabel] = useState("");
	const [amount, setAmount] = useState("");
	const [frequency, setFrequency] = useState<ChargeFrequency>(
		ChargeFrequency.MONTHLY,
	);
	const [startDate, setStartDate] = useState("");

	const labelId = useId();
	const amountId = useId();
	const frequencyId = useId();
	const startDateId = useId();

	const create = useMutation(
		trpc.vehicleCharges.create.mutationOptions({
			onSuccess: async () => {
				await cache.vehicle(vehicleId);
				toast.success("Charge ajoutée.");
				onDone();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const amountCents = parseAmountCents(amount);
	const ready = label.trim() !== "" && amountCents !== null && startDate !== "";

	return (
		<QuickAddForm
			submitLabel="Ajouter la charge"
			pending={create.isPending}
			ready={ready}
			onCancel={onDone}
			onSubmit={() => {
				if (amountCents === null) return;
				create.mutate({
					vehicleId,
					label,
					amountCents,
					frequency,
					startDate,
				});
			}}
		>
			<Field>
				<FieldLabel htmlFor={labelId}>Libellé</FieldLabel>
				<Input
					id={labelId}
					autoFocus
					value={label}
					onChange={(event) => setLabel(event.target.value)}
					placeholder="Assurance mensuelle"
					autoComplete="off"
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor={amountId}>Montant</FieldLabel>
				<Input
					id={amountId}
					inputMode="decimal"
					value={amount}
					onChange={(event) => setAmount(event.target.value)}
					placeholder="40"
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor={frequencyId}>Fréquence</FieldLabel>
				<Select
					value={frequency}
					onValueChange={(next) => setFrequency(next as ChargeFrequency)}
				>
					<SelectTrigger id={frequencyId} className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{CHARGE_FREQUENCY_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</Field>
			<Field>
				<FieldLabel htmlFor={startDateId}>Date de début</FieldLabel>
				<Input
					id={startDateId}
					type="date"
					value={startDate}
					onChange={(event) => setStartDate(event.target.value)}
				/>
			</Field>
		</QuickAddForm>
	);
}

function ProfitabilitySection({ vehicleId }: { vehicleId: string }) {
	const trpc = useTRPC();
	const query = useQuery(
		trpc.profitability.byVehicle.queryOptions({ vehicleId }),
	);
	const data = query.data;

	if (!data) return null;

	const money = (cents: number | string) =>
		formatMoneyCompact(Number(cents), data.reportingCurrency);
	const percent = (value: number | null) =>
		value === null ? "—" : `${value.toFixed(1).replace(".", ",")} %`;
	const hasTrend = data.trend.some(
		(point) => point.revenueCents > 0 || point.expensesCents > 0,
	);
	const monthlyIsProfitable = data.monthly.netCents >= 0;

	return (
		<DetailSheetSection title="Rentabilité du véhicule">
			<DetailSheetProperties>
				<DetailSheetProperty label="Statut">
					<StatusIndicator
						tone={monthlyIsProfitable ? "success" : "error"}
						label={
							monthlyIsProfitable ? "Rentable ce mois" : "Déficitaire ce mois"
						}
					/>
				</DetailSheetProperty>
				<DetailSheetProperty label="Total rapporté">
					{money(data.totalReportedCents)}
				</DetailSheetProperty>
				<DetailSheetProperty label="Marge cumulée">
					{percent(data.marginPercent)}
				</DetailSheetProperty>
				<DetailSheetProperty label="Couverture des coûts">
					{percent(data.costCoveragePercent)}
				</DetailSheetProperty>
			</DetailSheetProperties>
			<DetailSheetStats>
				<DetailSheetStat label="Revenus ce mois">
					{money(data.monthly.revenueCents)}
				</DetailSheetStat>
				<DetailSheetStat label="Coûts ce mois">
					{money(data.monthly.expensesCents)}
				</DetailSheetStat>
				<DetailSheetStat label="Résultat net">
					{money(data.monthly.netCents)}
				</DetailSheetStat>
				<DetailSheetStat label="Marge ce mois">
					{percent(data.monthly.marginPercent)}
				</DetailSheetStat>
			</DetailSheetStats>
			<DetailSheetProperties>
				<DetailSheetProperty label="Revenus cumulés">
					{money(data.lifetime.revenueCents)}
				</DetailSheetProperty>
				<DetailSheetProperty label="Coûts cumulés">
					{money(data.lifetime.expensesCents)}
				</DetailSheetProperty>
				<DetailSheetProperty label="Résultat cumulé">
					{money(data.lifetime.netCents)}
				</DetailSheetProperty>
			</DetailSheetProperties>
			{hasTrend ? (
				<div className="pt-2">
					<AreaTrend
						data={data.trend}
						config={PROFITABILITY_TREND_CONFIG}
						xKey="month"
						height={140}
						variant="gradient"
						bloom="low"
						formatValue={money}
					/>
				</div>
			) : null}
		</DetailSheetSection>
	);
}

function parseAmountCents(value: string): number | null {
	const trimmed = value.trim();
	if (trimmed === "") return null;
	const parsed = Number.parseFloat(trimmed);
	if (!Number.isFinite(parsed) || parsed < 0) return null;
	return Math.round(parsed * 100);
}

function VehicleIncidents({
	vehicleId,
	vehicleStatus,
}: {
	vehicleId: string;
	vehicleStatus: Vehicle["status"];
}) {
	const trpc = useTRPC();
	const [adding, setAdding] = useState(false);

	const incidents = useQuery(
		trpc.incidents.listByVehicle.queryOptions({ vehicleId }),
	);

	const rows = (incidents.data ?? []) as unknown as VehicleIncidentRow[];

	const form = adding ? (
		<IncidentForm
			vehicleId={vehicleId}
			vehicleStatus={vehicleStatus}
			onDone={() => setAdding(false)}
		/>
	) : null;

	if (!incidents.isPending && rows.length === 0) {
		return (
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
				{form}
				{adding ? null : (
					<DetailSheetEmpty
						icon={Warning}
						title="Aucun incident"
						description="Aucun incident n’a été signalé pour ce véhicule."
						action={
							<Button
								variant="outline"
								size="sm"
								onClick={() => setAdding(true)}
							>
								Signaler un incident
							</Button>
						}
					/>
				)}
			</div>
		);
	}

	return (
		<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
			{form}
			<SimpleTable variant="panel" columns={INCIDENT_COLUMNS}>
				{rows.map((incident) => (
					<IncidentRow
						key={incident.id}
						incident={incident}
						vehicleId={vehicleId}
						vehicleStatus={vehicleStatus}
					/>
				))}
			</SimpleTable>
			{adding ? null : (
				<div className="p-3">
					<Button variant="outline" size="sm" onClick={() => setAdding(true)}>
						Signaler un incident
					</Button>
				</div>
			)}
		</div>
	);
}

function IncidentForm({
	vehicleId,
	vehicleStatus,
	incident,
	onDone,
}: {
	vehicleId: string;
	vehicleStatus: Vehicle["status"];
	incident?: VehicleIncidentRow;
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [description, setDescription] = useState(incident?.description ?? "");
	const [nextVehicleStatus, setNextVehicleStatus] = useState("UNCHANGED");
	const persistedAnnotations = (incident?.damageAnnotations ??
		[]) as unknown as PersistedDamageAnnotation[];
	const [annotations, setAnnotations] = useState<DamageAnnotationDraft[]>(
		persistedAnnotations.map(toDamageAnnotationDraft),
	);
	const descriptionId = useId();
	const updateVehicle = useMutation(
		trpc.vehicles.update.mutationOptions({
			onError: (error) => toast.error(error.message),
		}),
	);
	const applyVehicleStatus = async () => {
		if (
			nextVehicleStatus === "UNCHANGED" ||
			nextVehicleStatus === vehicleStatus
		) {
			return;
		}
		await updateVehicle.mutateAsync({
			id: vehicleId,
			data: { status: nextVehicleStatus as Vehicle["status"] },
		});
	};

	const create = useMutation(
		trpc.incidents.create.mutationOptions({
			onSuccess: async () => {
				await applyVehicleStatus();
				await cache.vehicle(vehicleId);
				toast.success("Incident signalé.");
				onDone();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const update = useMutation(
		trpc.incidents.update.mutationOptions({
			onError: (error) => toast.error(error.message),
		}),
	);
	const createAnnotation = useMutation(
		trpc.incidents.createDamageAnnotation.mutationOptions(),
	);
	const updateAnnotation = useMutation(
		trpc.incidents.updateDamageAnnotation.mutationOptions(),
	);
	const deleteAnnotation = useMutation(
		trpc.incidents.deleteDamageAnnotation.mutationOptions(),
	);
	const pending =
		create.isPending ||
		update.isPending ||
		updateVehicle.isPending ||
		createAnnotation.isPending ||
		updateAnnotation.isPending ||
		deleteAnnotation.isPending;
	const submit = async () => {
		if (incident) {
			await update.mutateAsync({
				id: incident.id,
				data: { description },
			});
			const originalIds = new Set(
				incident.damageAnnotations.map((annotation) => annotation.id),
			);
			await Promise.all([
				...annotations.map((annotation) =>
					annotation.id
						? updateAnnotation.mutateAsync({
								id: annotation.id,
								data: toApiDamageAnnotation(annotation),
							})
						: createAnnotation.mutateAsync({
								incidentId: incident.id,
								...toApiDamageAnnotation(annotation),
							}),
				),
				...incident.damageAnnotations
					.filter(
						(annotation) =>
							!annotations.some((current) => current.id === annotation.id),
					)
					.filter((annotation) => originalIds.has(annotation.id))
					.map((annotation) =>
						deleteAnnotation.mutateAsync({ id: annotation.id }),
					),
			]);
			await applyVehicleStatus();
			await cache.vehicle(vehicleId);
			toast.success("Incident modifié.");
			onDone();
			return;
		}
		create.mutate({
			vehicleId,
			type: "DAMAGE",
			description,
			damageAnnotations: annotations.map(toApiDamageAnnotation),
		});
	};

	return (
		<QuickAddForm
			submitLabel={
				incident ? "Enregistrer les modifications" : "Signaler l’incident"
			}
			pending={pending}
			ready={description.trim() !== ""}
			onCancel={onDone}
			onSubmit={submit}
		>
			<Field className="sm:col-span-2">
				<FieldLabel htmlFor="incident-vehicle-status">
					Disponibilité du véhicule
				</FieldLabel>
				<Select value={nextVehicleStatus} onValueChange={setNextVehicleStatus}>
					<SelectTrigger id="incident-vehicle-status" className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="UNCHANGED">Ne pas modifier</SelectItem>
						<SelectItem value="MAINTENANCE">
							En maintenance · indisponible
						</SelectItem>
						<SelectItem value="OUT_OF_SERVICE">
							Accidenté · hors service
						</SelectItem>
						<SelectItem value="AVAILABLE">Remettre disponible</SelectItem>
					</SelectContent>
				</Select>
			</Field>
			<Field className="sm:col-span-2">
				<FieldLabel htmlFor={descriptionId}>Commentaire</FieldLabel>
				<Textarea
					id={descriptionId}
					autoFocus
					value={description}
					onChange={(event) => setDescription(event.target.value)}
					placeholder="Rayure sur le pare-chocs arrière constatée au retour."
					rows={3}
				/>
			</Field>
			<Field className="sm:col-span-2">
				<FieldLabel>Parties concernées</FieldLabel>
				<p className="text-muted-foreground text-xs">
					Sélectionnez une ou plusieurs zones sur le schéma.
				</p>
				<VehicleDamageEditor value={annotations} onChange={setAnnotations} />
			</Field>
		</QuickAddForm>
	);
}

function IncidentRow({
	incident,
	vehicleId,
	vehicleStatus,
}: {
	incident: VehicleIncidentRow;
	vehicleId: string;
	vehicleStatus: Vehicle["status"];
}) {
	const [editing, setEditing] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const trpc = useTRPC();
	const cache = useCrmCache();
	const remove = useMutation(
		trpc.incidents.delete.mutationOptions({
			onSuccess: async () => {
				await cache.vehicle(vehicleId);
				toast.success("Incident supprimé.");
				setConfirming(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (editing) {
		return (
			<SimpleTableRow>
				<TableCell colSpan={5} className="p-0">
					<IncidentForm
						vehicleId={vehicleId}
						vehicleStatus={vehicleStatus}
						incident={incident}
						onDone={() => setEditing(false)}
					/>
				</TableCell>
			</SimpleTableRow>
		);
	}

	return (
		<>
			<SimpleTableRow>
				<TableCell className="truncate py-2.5 pr-3 pl-5 font-medium">
					Dommage
				</TableCell>
				<TableCell className="truncate px-3 py-2.5 text-muted-foreground">
					{incident.description}
				</TableCell>
				<TableCell className="px-3 py-2.5 text-muted-foreground">
					{incident.damageAnnotations.length > 0
						? `${incident.damageAnnotations.length} dommage${incident.damageAnnotations.length > 1 ? "s" : ""} annoté${incident.damageAnnotations.length > 1 ? "s" : ""}`
						: "Non précisé"}
				</TableCell>
				<TableCell className="px-3 py-2.5 text-muted-foreground">
					{incident.responsibleParty}
				</TableCell>
				<TableCell className="py-1 pr-1 text-right">
					<div className="flex justify-end gap-1">
						<Button
							variant="ghost"
							size="icon-sm"
							onClick={() => setEditing(true)}
						>
							<Icon icon={Edit} />
							<span className="sr-only">Modifier cet incident</span>
						</Button>
						<Button
							variant="ghost"
							size="icon-sm"
							disabled={remove.isPending}
							onClick={() => setConfirming(true)}
						>
							<Icon icon={TrashCan} />
							<span className="sr-only">Supprimer cet incident</span>
						</Button>
					</div>
				</TableCell>
			</SimpleTableRow>
			<AlertDialog open={confirming} onOpenChange={setConfirming}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Supprimer cet incident ?</AlertDialogTitle>
						<AlertDialogDescription>
							Cette action supprimera définitivement cet élément de l’historique
							du véhicule.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Annuler</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => remove.mutate({ id: incident.id })}
						>
							Supprimer
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

function toDamageAnnotationDraft(
	annotation: PersistedDamageAnnotation,
): DamageAnnotationDraft {
	return {
		id: annotation.id,
		view: annotation.view as DamageView,
		type: annotation.type as DamageType,
		severity: annotation.severity as DamageSeverity,
		x: annotation.x,
		y: annotation.y,
		points: Array.isArray(annotation.points)
			? annotation.points.filter(isDamagePoint)
			: [],
		description: annotation.description ?? "",
	};
}

function isDamagePoint(value: unknown): value is DamagePoint {
	if (!value || typeof value !== "object") return false;
	const point = value as Record<string, unknown>;
	return (
		typeof point.x === "number" &&
		typeof point.y === "number" &&
		point.x >= 0 &&
		point.x <= 100 &&
		point.y >= 0 &&
		point.y <= 100
	);
}

function toApiDamageAnnotation(annotation: DamageAnnotationDraft) {
	return {
		view: annotation.view,
		type: annotation.type,
		severity: annotation.severity,
		x: annotation.x,
		y: annotation.y,
		points: annotation.points,
		description: annotation.description || null,
	};
}
