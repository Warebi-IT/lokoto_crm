"use client";

import Add from "@carbon/icons-react/es/Add";
import Calendar from "@carbon/icons-react/es/Calendar";
import Close from "@carbon/icons-react/es/Close";
import Edit from "@carbon/icons-react/es/Edit";
import OverflowMenuVertical from "@carbon/icons-react/es/OverflowMenuVertical";
import PiggyBank from "@carbon/icons-react/es/PiggyBank";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import UserAvatar from "@carbon/icons-react/es/UserAvatar";
import UserMultiple from "@carbon/icons-react/es/UserMultiple";
import Wallet from "@carbon/icons-react/es/Wallet";
import Warning from "@carbon/icons-react/es/Warning";
import { normalizeCurrency } from "@crm/db/currency";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { PersonAvatar } from "@crm/ui/components/person-avatar";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import {
	SimpleTable,
	type SimpleTableColumn,
	SimpleTableRow,
} from "@crm/ui/components/simple-table";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { TableCell } from "@crm/ui/components/table";
import { Textarea } from "@crm/ui/components/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { formatMoney } from "@crm/ui/lib/format";
import { cn } from "@crm/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { AgentPanel } from "@/components/crm/agent-panel";
import { contactName } from "@/components/crm/contact-name";
import { FieldsCog, RecordFields } from "@/components/crm/fields/record-fields";
import {
	InlineDateField,
	InlineField,
	InlineTextArea,
	savingValue,
} from "@/components/crm/inline-field";
import { OwnerCell } from "@/components/crm/owner-cell";
import { RentalStatusMenu } from "@/components/crm/status-change";
import { StatusStepper } from "@/components/crm/status-stepper";
import { Timeline } from "@/components/crm/timeline/timeline";
import type { DamageAnnotationDraft } from "@/components/crm/vehicle-damage/vehicle-damage-editor";
import { VehicleDamageEditor } from "@/components/crm/vehicle-damage/vehicle-damage-editor";
import {
	DetailSheetBody,
	DetailSheetEmpty,
	DetailSheetProperties,
	DetailSheetProperty,
	DetailSheetSection,
	DetailSheetStat,
	DetailSheetStats,
	type DetailSheetTab,
	PROPERTY_LABEL,
	PROPERTY_ROW,
} from "@/components/detail-sheet";
import { LocalDateTime, LocalDay } from "@/components/local-date-time";
import { savingField } from "@/lib/pending-field";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { QuickAddForm } from "./quick-add";
import { AttachDriver } from "./quick-add-rental";
import { RecordActions } from "./record-actions";
import { AddRow, MoneyAmount, RecordSheetFrame } from "./record-parts";
import { useOpenRecord, useRecordSheetView } from "./record-stack";

type RentalContract = RouterOutputs["rentalContracts"]["byId"];
type ContractIncidentRow = {
	id: string;
	type: string;
	description: string;
	insuranceStatus: string;
};

const FUEL_OPTIONS = [
	{ value: "FULL", label: "Plein" },
	{ value: "THREE_QUARTER", label: "3/4" },
	{ value: "HALF", label: "Moitié" },
	{ value: "QUARTER", label: "1/4" },
	{ value: "EMPTY", label: "Vide" },
];

const PAYMENT_TYPE_OPTIONS = [
	{ value: "RENTAL_FEE", label: "Location" },
	{ value: "DEPOSIT", label: "Caution" },
	{ value: "DEPOSIT_REFUND", label: "Remboursement de caution" },
	{ value: "EXTRA_FEE", label: "Frais supplémentaires" },
	{ value: "PENALTY", label: "Pénalité" },
	{ value: "MAINTENANCE_CHARGE", label: "Frais d’entretien" },
];

const PAYMENT_METHOD_OPTIONS = [
	{ value: "CASH", label: "Espèces" },
	{ value: "WAVE", label: "Wave" },
	{ value: "ORANGE_MONEY", label: "Orange Money" },
	{ value: "CARD", label: "Carte bancaire" },
	{ value: "BANK_TRANSFER", label: "Virement bancaire" },
];

const PAYMENT_STATUS_OPTIONS = [
	{ value: "PENDING", label: "En attente" },
	{ value: "COMPLETED", label: "Encaissé" },
	{ value: "FAILED", label: "Échoué" },
	{ value: "REFUNDED", label: "Remboursé" },
];

const DRIVER_COLUMNS: SimpleTableColumn[] = [
	{ id: "name", header: "Nom", width: "w-[36%]", className: "pl-5" },
	{ id: "role", header: "Rôle", width: "w-[28%]" },
	{ id: "remove", srLabel: "Retirer", width: "w-10" },
];

const PAYMENT_COLUMNS: SimpleTableColumn[] = [
	{ id: "type", header: "Type", width: "w-[20%]" },
	{ id: "method", header: "Mode", width: "w-[18%]" },
	{
		id: "amount",
		header: "Montant",
		width: "w-[16%]",
		align: "right" as const,
	},
	{ id: "when", header: "Date", width: "w-[18%]" },
	{ id: "status", header: "Statut", width: "w-[18%]" },
	{ id: "actions", srLabel: "Actions", width: "w-10" },
];

const INCIDENT_COLUMNS: SimpleTableColumn[] = [
	{ id: "type", header: "Type", width: "w-[16%]", className: "pl-5" },
	{ id: "description", header: "Description", width: "w-[40%]" },
	{ id: "insurance", header: "Assurance", width: "w-[18%]" },
];

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
	month: "short",
	day: "numeric",
	year: "numeric",
};

function depositTone(status: RentalContract["depositStatus"]) {
	if (status === "RETURNED") return "success" as const;
	if (status === "PARTIALLY_RETURNED") return "warning" as const;
	if (status === "FORFEITED") return "error" as const;
	return "neutral" as const;
}

function depositLabel(status: RentalContract["depositStatus"]) {
	return {
		HELD: "Retenue",
		PARTIALLY_RETURNED: "Partiellement remboursée",
		RETURNED: "Remboursée",
		FORFEITED: "Perdue",
	}[status];
}

function depositRetainedCents(contract: RentalContract): number {
	if (contract.depositStatus === "HELD") return 0;
	const due = contract.depositAmountCents ?? 0;
	if (contract.depositReturnedAmountCents === null) return due;
	return Math.max(0, due - contract.depositReturnedAmountCents);
}

function isOutgoingPayment(type: string): boolean {
	return type === "DEPOSIT_REFUND";
}

function paymentStatusTone(status: string) {
	if (status === "COMPLETED") return "success" as const;
	if (status === "FAILED") return "error" as const;
	if (status === "REFUNDED") return "info" as const;
	return "neutral" as const;
}

export function RentalContractSheet({ contractId }: { contractId: string }) {
	const trpc = useTRPC();
	const openRecord = useOpenRecord();
	const {
		tab,
		setTab,
		form: adding,
		setForm: setAdding,
	} = useRecordSheetView("overview");

	const query = useQuery(
		trpc.rentalContracts.byId.queryOptions({ id: contractId }),
	);
	const contract = query.data;

	const tabs: DetailSheetTab[] = contract
		? [
				{
					value: "overview",
					label: "Vue d’ensemble",
					content: <ContractOverview contract={contract} />,
				},
				{
					value: "drivers",
					label: "Conducteurs",
					count: contract.drivers.length,
					content: (
						<ContractDrivers
							contract={contract}
							adding={adding === "driver"}
							onAdd={() => setAdding("driver")}
							onDone={() => setAdding(null)}
						/>
					),
				},
				{
					value: "payments",
					label: "Paiements",
					content: <ContractPayments contract={contract} />,
				},
				{
					value: "incidents",
					label: "Incidents",
					destructive: true,
					content: (
						<ContractIncidents
							contractId={contract.id}
							vehicleId={contract.vehicle.id}
							depositCurrency={contract.depositCurrency}
						/>
					),
				},
				{
					value: "inspections",
					label: "États des lieux",
					content: <ContractInspections contract={contract} />,
				},
				{
					value: "activity",
					label: "Activité",
					content: <Timeline anchor={{ rentalContractId: contract.id }} />,
				},
				{
					value: "agent",
					label: "Agent",
					content: (
						<AgentPanel record={{ kind: "rentalContract", id: contract.id }} />
					),
					keepMounted: true,
				},
			]
		: [];

	return (
		<RecordSheetFrame
			loading={query.isPending}
			error={query.error?.message ?? null}
			title={
				contract
					? `${contract.vehicle.make} ${contract.vehicle.model}`
					: "Contrat de location"
			}
			description={
				contract ? (
					<button
						type="button"
						onClick={() =>
							openRecord({ kind: "contact", id: contract.contact.id })
						}
						className="text-foreground underline-offset-2 hover:underline"
					>
						{contactName(contract.contact)}
					</button>
				) : undefined
			}
			actions={
				contract ? (
					<>
						<RentalStatusMenu
							contractId={contract.id}
							status={contract.status}
							variant="control"
						/>
						<RecordActions
							record={{ kind: "rentalContract", id: contract.id }}
							name={`${contract.vehicle.make} ${contract.vehicle.model}`}
							consequence="Ses paiements, incidents, états des lieux et conversations sont également supprimés. Le véhicule et le client restent dans le CRM."
						/>
					</>
				) : null
			}
			stats={
				contract ? (
					<DetailSheetStats>
						<DetailSheetStat label="Total" icon={Wallet}>
							<MoneyAmount
								amountCents={contract.totalAmountCents}
								currency={contract.currency}
							/>
						</DetailSheetStat>
						<DetailSheetStat label="Caution" icon={PiggyBank}>
							<StatusIndicator
								tone={depositTone(contract.depositStatus)}
								label={depositLabel(contract.depositStatus)}
								className="text-primary-foreground"
							/>
						</DetailSheetStat>
						<DetailSheetStat label="Dates" icon={Calendar}>
							<span className="text-primary-foreground/80">
								<LocalDay date={contract.startDate} /> –{" "}
								<LocalDay date={contract.endDate} />
							</span>
						</DetailSheetStat>
						<DetailSheetStat label="Vendeur" icon={UserAvatar}>
							<OwnerCell owner={contract.owner} />
						</DetailSheetStat>
					</DetailSheetStats>
				) : null
			}
			note={
				contract?.isLate ? (
					<StatusIndicator tone="error" label="En retard" />
				) : null
			}
			tabs={tabs}
			tab={tab}
			onTabChange={setTab}
		/>
	);
}

type MileageTier = { kilometers: number | null; pricePerKmCents: number };
type MileageTierDraft = MileageTier & { localId: string };

function MileageTiers({
	rules,
	currency,
	saving,
	onSave,
}: {
	rules: MileageTier[];
	currency: string;
	saving: boolean;
	onSave: (rules: MileageTier[]) => void;
}) {
	const [tiers, setTiers] = useState<MileageTierDraft[]>(() =>
		rules.map((rule) => ({ ...rule, localId: crypto.randomUUID() })),
	);

	const commit = (next: MileageTierDraft[]) => {
		setTiers(next);
		onSave(next.map(({ localId: _localId, ...rule }) => rule));
	};

	const updateTier = (localId: string, patch: Partial<MileageTier>) => {
		commit(
			tiers.map((tier) =>
				tier.localId === localId ? { ...tier, ...patch } : tier,
			),
		);
	};

	const removeTier = (localId: string) => {
		commit(tiers.filter((tier) => tier.localId !== localId));
	};

	const addTier = () => {
		if (tiers.length === 0) {
			commit([
				{ localId: crypto.randomUUID(), kilometers: null, pricePerKmCents: 0 },
			]);
			return;
		}
		const last = tiers[tiers.length - 1];
		const previousBound =
			tiers.length > 1 ? tiers[tiers.length - 2]?.kilometers : null;
		commit([
			...tiers.slice(0, -1),
			{
				localId: crypto.randomUUID(),
				kilometers: (previousBound ?? 0) + 50,
				pricePerKmCents: last?.pricePerKmCents ?? 0,
			},
			{ localId: crypto.randomUUID(), kilometers: null, pricePerKmCents: 0 },
		]);
	};

	return (
		<div className="space-y-2">
			{tiers.length === 0 ? (
				<p className="text-muted-foreground text-xs">
					Aucune tranche : le tarif kilométrique simple s’applique.
				</p>
			) : (
				<div className="space-y-1.5">
					{tiers.map((tier, index) => {
						const isLast = index === tiers.length - 1;
						return (
							<div key={tier.localId} className="flex items-center gap-1.5">
								{isLast ? (
									<span className="w-28 shrink-0 text-muted-foreground text-xs">
										Au-delà
									</span>
								) : (
									<span className="flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs">
										Jusqu’à
										<Input
											type="number"
											inputMode="numeric"
											min={1}
											defaultValue={tier.kilometers ?? ""}
											className="h-7 max-w-16 px-1.5 text-xs"
											onBlur={(event) => {
												const value = Number.parseInt(event.target.value, 10);
												if (Number.isFinite(value) && value > 0) {
													updateTier(tier.localId, { kilometers: value });
												}
											}}
										/>
										km
									</span>
								)}
								<Input
									type="number"
									inputMode="decimal"
									min={0}
									step="0.01"
									defaultValue={tier.pricePerKmCents / 100}
									className="h-7 max-w-20 px-1.5 text-xs"
									onBlur={(event) => {
										const value = Number.parseFloat(event.target.value);
										if (Number.isFinite(value) && value >= 0) {
											updateTier(tier.localId, {
												pricePerKmCents: Math.round(value * 100),
											});
										}
									}}
								/>
								<span className="shrink-0 text-muted-foreground text-xs">
									{currency}/km
								</span>
								<Button
									variant="ghost"
									size="icon-xs"
									disabled={saving}
									onClick={() => removeTier(tier.localId)}
								>
									<Icon icon={TrashCan} />
									<span className="sr-only">Supprimer cette tranche</span>
								</Button>
							</div>
						);
					})}
				</div>
			)}
			<Button variant="outline" size="xs" disabled={saving} onClick={addTier}>
				<Icon icon={Add} data-icon="inline-start" />
				Ajouter une tranche
			</Button>
		</div>
	);
}

function daysBetween(start: string, end: string): number {
	const diff = new Date(end).getTime() - new Date(start).getTime();
	return Math.max(1, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

function ContractCostSummary({
	contract,
	currency,
}: {
	contract: RentalContract;
	currency: string;
}) {
	const days = daysBetween(contract.startDate, contract.endDate);
	const rentalAmountCents = (contract.pricePerDayCents ?? 0) * days;
	const extraMileageAmountCents = contract.extraMileageAmountCents;
	const depositSettled = contract.depositStatus !== "HELD";
	const retainedDepositCents = depositRetainedCents(contract);

	const Line = ({
		label,
		amountCents,
		muted = true,
	}: {
		label: string;
		amountCents: number;
		muted?: boolean;
	}) => (
		<div className="flex items-center justify-between gap-4 text-sm">
			<span className={muted ? "text-muted-foreground" : "font-medium"}>
				{label}
			</span>
			<span className={cn("tabular-nums", !muted && "font-medium")}>
				{formatMoney(amountCents, currency)}
			</span>
		</div>
	);

	return (
		<div className="space-y-1.5">
			<Line
				label={`Location (${days} jour${days > 1 ? "s" : ""} × ${formatMoney(contract.pricePerDayCents ?? 0, currency)})`}
				amountCents={rentalAmountCents}
			/>
			{extraMileageAmountCents !== null && extraMileageAmountCents !== 0 ? (
				<Line
					label="Kilométrage supplémentaire"
					amountCents={extraMileageAmountCents}
				/>
			) : null}
			{retainedDepositCents > 0 ? (
				<Line label="Caution retenue" amountCents={retainedDepositCents} />
			) : null}
			<div className="border-t pt-1.5">
				<Line
					label="Total"
					amountCents={contract.totalAmountCents ?? 0}
					muted={false}
				/>
			</div>
			{!depositSettled && extraMileageAmountCents === null ? (
				<p className="pt-1 text-muted-foreground text-xs">
					Le kilométrage supplémentaire et la caution ne sont pas encore
					définitifs : ils s’ajoutent au retour et au règlement de la caution.
				</p>
			) : null}
			<div className="flex items-center justify-between gap-4 border-t pt-1.5 text-xs">
				<span className="text-muted-foreground">
					Caution ({depositLabel(contract.depositStatus)})
				</span>
				<span className="tabular-nums text-muted-foreground">
					{formatMoney(
						contract.depositAmountCents ?? 0,
						contract.depositCurrency,
					)}
				</span>
			</div>
			{depositSettled && retainedDepositCents > 0 ? (
				<div className="flex items-center justify-between gap-4 text-xs">
					<span className="text-muted-foreground">dont retenu</span>
					<span className="tabular-nums text-muted-foreground">
						{formatMoney(retainedDepositCents, contract.depositCurrency)}
					</span>
				</div>
			) : null}
		</div>
	);
}

function ContractOverview({ contract }: { contract: RentalContract }) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const update = useMutation(
		trpc.rentalContracts.update.mutationOptions({
			onSuccess: () => cache.rentalContract(contract.id, { settle: "record" }),
			onError: (error) => toast.error(error.message),
		}),
	);

	const setDeposit = useMutation(
		trpc.rentalContracts.setDepositStatus.mutationOptions({
			onSuccess: () => cache.rentalContract(contract.id),
			onError: (error) => toast.error(error.message),
		}),
	);

	const saveFields = (fields: Record<string, FieldValueJson>) =>
		update.mutate({ id: contract.id, data: { fields } });

	const isSavingField = savingValue(update);
	const isSaving = savingField(update);

	const save = (data: Parameters<typeof update.mutate>[0]["data"]) =>
		update.mutate({ id: contract.id, data });

	const currency = normalizeCurrency(contract.currency) || contract.currency;

	return (
		<DetailSheetBody>
			<DetailSheetSection title="Statut">
				<StatusStepper contractId={contract.id} status={contract.status} />

				{contract.cancelledReason ? (
					<DetailSheetProperties>
						<DetailSheetProperty label="Annulé le">
							{contract.cancelledAt ? (
								<LocalDateTime
									date={contract.cancelledAt}
									options={DATE_OPTIONS}
								/>
							) : (
								<EmptyCellValue />
							)}
						</DetailSheetProperty>
						<DetailSheetProperty label="Motif" wide>
							{contract.cancelledReason}
						</DetailSheetProperty>
					</DetailSheetProperties>
				) : null}
			</DetailSheetSection>

			<div className="flex flex-col border-b lg:flex-row lg:items-stretch">
				<DetailSheetSection
					title="Détails"
					action={<FieldsCog kind="rentalContract" />}
					className="max-lg:border-b border-b-0 lg:flex-1 lg:border-r"
				>
					<DetailSheetProperties>
						<div className={cn(PROPERTY_ROW, "items-center")}>
							<span className={PROPERTY_LABEL}>Départ</span>
							<div className="flex min-w-0 items-center gap-2">
								<InlineDateField
									label="Date de départ"
									value={contract.startDate}
									saving={isSaving("startDate")}
									onSave={(next) => next && save({ startDate: next })}
									className="max-w-40"
									size="lg"
									bare
								/>
								<InlineField
									label="Heure de départ"
									value={contract.pickupTime}
									type="time"
									placeholder="09:00"
									saving={isSaving("pickupTime")}
									onSave={(next) => save({ pickupTime: next || null })}
									className="max-w-24"
									bare
								/>
							</div>
						</div>
						<div className={cn(PROPERTY_ROW, "items-center")}>
							<span className={PROPERTY_LABEL}>Retour</span>
							<div className="flex min-w-0 items-center gap-2">
								<InlineDateField
									label="Date de retour"
									value={contract.endDate}
									saving={isSaving("endDate")}
									onSave={(next) => next && save({ endDate: next })}
									className="max-w-40"
									size="lg"
									bare
								/>
								<InlineField
									label="Heure de retour"
									value={contract.returnTime}
									type="time"
									placeholder="18:00"
									saving={isSaving("returnTime")}
									onSave={(next) => save({ returnTime: next || null })}
									className="max-w-24"
									bare
								/>
							</div>
						</div>
						<InlineField
							label="Prix par jour"
							value={String((contract.pricePerDayCents ?? 0) / 100)}
							saving={isSaving("pricePerDayCents")}
							onSave={(next) => {
								const parsed = Number.parseFloat(next);
								if (!Number.isFinite(parsed) || parsed < 0) {
									toast.error("Le prix doit être un nombre.");
									return;
								}
								save({ pricePerDayCents: Math.round(parsed * 100) });
							}}
							render={(value) =>
								formatMoney(Math.round(Number(value) * 100), currency)
							}
							className="max-w-32"
						/>
						<InlineField
							label="Kilomètres inclus / jour"
							value={
								contract.mileageIncludedPerDay === null
									? null
									: String(contract.mileageIncludedPerDay)
							}
							saving={isSaving("mileageIncludedPerDay")}
							onSave={(next) =>
								save({ mileageIncludedPerDay: next ? Number(next) : null })
							}
							render={(value) => `${value} km`}
							className="max-w-28"
						/>
						<RecordFields
							fields={contract.fields}
							saving={isSavingField}
							onSave={saveFields}
						/>
					</DetailSheetProperties>
				</DetailSheetSection>

				<DetailSheetSection
					title="Récapitulatif"
					className="border-b-0 lg:w-80 lg:shrink-0"
				>
					<ContractCostSummary contract={contract} currency={currency} />
				</DetailSheetSection>
			</div>

			<DetailSheetSection title="Kilométrage supplémentaire">
				<DetailSheetProperties>
					<DetailSheetProperty label="Montant calculé">
						{contract.extraMileageAmountCents === null
							? "À calculer à la restitution"
							: formatMoney(contract.extraMileageAmountCents, currency)}
					</DetailSheetProperty>
				</DetailSheetProperties>
				<MileageTiers
					rules={contract.mileagePricingRules}
					currency={currency}
					saving={isSaving("mileagePricingRules")}
					onSave={(mileagePricingRules) => save({ mileagePricingRules })}
				/>
			</DetailSheetSection>

			<DetailSheetSection title="Caution">
				<DetailSheetProperties>
					<DetailSheetProperty label="Montant retenu">
						{formatMoney(
							contract.depositAmountCents ?? 0,
							contract.depositCurrency,
						)}
					</DetailSheetProperty>
					<DetailSheetProperty label="Mode">
						{contract.depositMethod}
					</DetailSheetProperty>
					<DetailSheetProperty label="Statut">
						{depositLabel(contract.depositStatus)}
					</DetailSheetProperty>
					{contract.depositReturnedAmountCents !== null ? (
						<DetailSheetProperty label="Remboursé">
							{formatMoney(
								contract.depositReturnedAmountCents,
								contract.depositCurrency,
							)}
						</DetailSheetProperty>
					) : null}
				</DetailSheetProperties>

				{contract.depositStatus === "HELD" ? (
					<DepositSettleForm
						depositAmountCents={contract.depositAmountCents ?? 0}
						currency={contract.depositCurrency}
						pending={setDeposit.isPending}
						onSettle={(status, amountCents) =>
							setDeposit.mutate({
								id: contract.id,
								depositStatus: status,
								depositReturnedAmountCents: amountCents,
							})
						}
					/>
				) : null}
			</DetailSheetSection>

			<DetailSheetSection title="Notes">
				<InlineTextArea
					label="Notes"
					value={contract.notes}
					placeholder="Ajoutez toute information utile concernant cette location."
					saving={isSaving("notes")}
					onSave={(notes) => save({ notes })}
				/>
			</DetailSheetSection>
		</DetailSheetBody>
	);
}

function DepositSettleForm({
	depositAmountCents,
	currency,
	pending,
	onSettle,
}: {
	depositAmountCents: number;
	currency: string;
	pending: boolean;
	onSettle: (
		status: "PARTIALLY_RETURNED" | "RETURNED" | "FORFEITED",
		amountCents: number | null,
	) => void;
}) {
	const [amount, setAmount] = useState(String(depositAmountCents / 100));

	return (
		<div className="flex flex-wrap items-end gap-2 pt-3">
			<Field className="w-32">
				<FieldLabel>Returning</FieldLabel>
				<Input
					value={amount}
					onChange={(event) => setAmount(event.target.value)}
					inputMode="decimal"
				/>
			</Field>
			<Button
				variant="outline"
				size="sm"
				disabled={pending}
				onClick={() => {
					const parsed = Number.parseFloat(amount);
					if (!Number.isFinite(parsed) || parsed < 0) {
						toast.error("Saisissez un montant.");
						return;
					}
					const cents = Math.round(parsed * 100);
					onSettle(
						cents >= depositAmountCents ? "RETURNED" : "PARTIALLY_RETURNED",
						cents,
					);
				}}
			>
				Return {formatMoney(Math.round(Number(amount) * 100) || 0, currency)}
			</Button>
			<Button
				variant="outline"
				size="sm"
				disabled={pending}
				onClick={() => onSettle("FORFEITED", null)}
			>
				Forfeit deposit
			</Button>
		</div>
	);
}

function ContractDrivers({
	contract,
	adding,
	onAdd,
	onDone,
}: {
	contract: RentalContract;
	adding: boolean;
	onAdd: () => void;
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const openRecord = useOpenRecord();

	const detach = useMutation(
		trpc.rentalContracts.detachDriver.mutationOptions({
			onSuccess: () => cache.rentalContract(contract.id, { settle: "record" }),
			onError: (error) => toast.error(error.message),
		}),
	);

	const form = adding ? (
		<AttachDriver contractId={contract.id} onDone={onDone} />
	) : null;

	if (contract.drivers.length === 0) {
		return (
			<>
				{form}
				{adding ? null : (
					<DetailSheetEmpty
						icon={UserMultiple}
						title="Aucun conducteur"
						description="Ajoutez le client et toute personne autorisée à conduire ce véhicule."
						action={
							<Button variant="outline" size="sm" onClick={onAdd}>
								<Icon icon={Add} data-icon="inline-start" />
								Ajouter un conducteur
							</Button>
						}
					/>
				)}
			</>
		);
	}

	return (
		<>
			{form}
			<SimpleTable variant="panel" columns={DRIVER_COLUMNS}>
				{contract.drivers.map((driver) => (
					<SimpleTableRow
						key={driver.id}
						clickable
						onClick={() => openRecord({ kind: "contact", id: driver.id })}
					>
						<TableCell className="truncate py-2.5 pr-3 pl-5 font-medium">
							<span className="flex min-w-0 items-center gap-2">
								<PersonAvatar
									src={driver.imageUrl}
									name={contactName(driver)}
									email={driver.email}
									size="sm"
								/>
								<span className="truncate">{contactName(driver)}</span>
							</span>
						</TableCell>
						<TableCell className="truncate px-3 py-2.5 text-muted-foreground">
							{driver.role === "PRIMARY" ? "Client" : "Conducteur additionnel"}
						</TableCell>
						<TableCell className="px-3 py-2.5">
							{driver.role === "PRIMARY" ? null : (
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="icon-xs"
											disabled={detach.isPending}
											onClick={(event) => {
												event.stopPropagation();
												detach.mutate({
													contractId: contract.id,
													contactId: driver.id,
												});
											}}
										>
											<Icon icon={Close} />
											<span className="sr-only">
												Take {contactName(driver)} off this contract
											</span>
										</Button>
									</TooltipTrigger>
									<TooltipContent>Take off this contract</TooltipContent>
								</Tooltip>
							)}
						</TableCell>
					</SimpleTableRow>
				))}

				<AddRow
					label="Ajouter un conducteur"
					columns={DRIVER_COLUMNS.length}
					onClick={onAdd}
				/>
			</SimpleTable>
		</>
	);
}

function ContractPayments({ contract }: { contract: RentalContract }) {
	const trpc = useTRPC();
	const [adding, setAdding] = useState(false);

	const payments = useQuery(
		trpc.payments.listByContract.queryOptions({
			rentalContractId: contract.id,
		}),
	);

	const rows = payments.data ?? [];
	const completedPayments = rows.filter(
		(payment) => payment.status === "COMPLETED",
	);
	const rentalPaidCents = completedPayments
		.filter(
			(payment) =>
				payment.type === "RENTAL_FEE" &&
				normalizeCurrency(payment.currency) ===
					normalizeCurrency(contract.currency),
		)
		.reduce((total, payment) => total + (payment.amountCents ?? 0), 0);
	const depositPaidCents = completedPayments
		.filter(
			(payment) =>
				payment.type === "DEPOSIT" &&
				normalizeCurrency(payment.currency) ===
					normalizeCurrency(contract.depositCurrency),
		)
		.reduce((total, payment) => total + (payment.amountCents ?? 0), 0);
	const rentalDueCents = contract.totalAmountCents ?? 0;
	const depositDueCents = contract.depositAmountCents ?? 0;
	const rentalRemainingCents = Math.max(0, rentalDueCents - rentalPaidCents);
	const depositRemainingCents = Math.max(0, depositDueCents - depositPaidCents);
	const retainedCents = depositRetainedCents(contract);

	const form = adding ? (
		<PaymentForm
			key={`${contract.totalAmountCents}-${contract.depositAmountCents}`}
			contract={contract}
			onDone={() => setAdding(false)}
		/>
	) : null;

	return (
		<DetailSheetBody>
			<DetailSheetSection title="Location">
				<DetailSheetProperties>
					<DetailSheetProperty label="Prévu">
						{formatMoney(rentalDueCents, contract.currency)}
					</DetailSheetProperty>
					<DetailSheetProperty label="Encaissé">
						{formatMoney(rentalPaidCents, contract.currency)}
					</DetailSheetProperty>
					<DetailSheetProperty label="Reste à payer" wide>
						<StatusIndicator
							tone={rentalRemainingCents > 0 ? "warning" : "success"}
							label={
								rentalRemainingCents > 0
									? formatMoney(rentalRemainingCents, contract.currency)
									: "Payé en totalité"
							}
						/>
					</DetailSheetProperty>
				</DetailSheetProperties>
			</DetailSheetSection>

			<DetailSheetSection title="Caution">
				<DetailSheetProperties>
					<DetailSheetProperty label="Prévue">
						{formatMoney(depositDueCents, contract.depositCurrency)}
					</DetailSheetProperty>
					<DetailSheetProperty label="Encaissée">
						{formatMoney(depositPaidCents, contract.depositCurrency)}
					</DetailSheetProperty>
					<DetailSheetProperty label="Reste à encaisser" wide>
						<StatusIndicator
							tone={depositRemainingCents > 0 ? "warning" : "success"}
							label={
								depositRemainingCents > 0
									? formatMoney(depositRemainingCents, contract.depositCurrency)
									: "Encaissée en totalité"
							}
						/>
					</DetailSheetProperty>
					<DetailSheetProperty label="Statut">
						<StatusIndicator
							tone={depositTone(contract.depositStatus)}
							label={depositLabel(contract.depositStatus)}
						/>
					</DetailSheetProperty>
					{retainedCents > 0 ? (
						<DetailSheetProperty label="Retenue">
							<StatusIndicator
								tone="error"
								label={formatMoney(retainedCents, contract.depositCurrency)}
							/>
						</DetailSheetProperty>
					) : null}
					{contract.depositReturnedAmountCents !== null ? (
						<DetailSheetProperty label="Remboursée">
							{formatMoney(
								contract.depositReturnedAmountCents,
								contract.depositCurrency,
							)}
						</DetailSheetProperty>
					) : null}
				</DetailSheetProperties>
			</DetailSheetSection>

			<DetailSheetSection title="Historique des paiements">
				{form}
				{rows.length > 0 ? (
					<SimpleTable columns={PAYMENT_COLUMNS}>
						{rows.map((payment) => {
							const outgoing = isOutgoingPayment(payment.type);
							return (
								<SimpleTableRow key={payment.id}>
									<TableCell className="truncate font-medium">
										{PAYMENT_TYPE_OPTIONS.find((o) => o.value === payment.type)
											?.label ?? payment.type}
									</TableCell>
									<TableCell className="truncate text-muted-foreground">
										{PAYMENT_METHOD_OPTIONS.find(
											(o) => o.value === payment.method,
										)?.label ?? payment.method}
										{payment.reference ? ` · ${payment.reference}` : ""}
									</TableCell>
									<TableCell
										className={cn(
											"text-right tabular-nums",
											outgoing && "text-muted-foreground",
										)}
									>
										{formatMoney(
											outgoing
												? -(payment.amountCents ?? 0)
												: (payment.amountCents ?? 0),
											payment.currency,
										)}
									</TableCell>
									<TableCell className="text-muted-foreground">
										{payment.paidAt ? (
											<LocalDay date={payment.paidAt} />
										) : (
											<EmptyCellValue />
										)}
									</TableCell>
									<TableCell>
										<StatusIndicator
											tone={paymentStatusTone(payment.status)}
											label={
												PAYMENT_STATUS_OPTIONS.find(
													(o) => o.value === payment.status,
												)?.label ?? payment.status
											}
										/>
									</TableCell>
									<TableCell>
										<PaymentRowActions
											payment={payment}
											contractId={contract.id}
										/>
									</TableCell>
								</SimpleTableRow>
							);
						})}
					</SimpleTable>
				) : (
					<DetailSheetEmpty
						icon={Wallet}
						title="Aucun paiement enregistré"
						description="Aucun paiement n’a encore été enregistré pour ce contrat."
					/>
				)}
				{adding ? null : (
					<button
						type="button"
						onClick={() => setAdding(true)}
						className="w-full border-t pt-2 text-left text-muted-foreground text-sm hover:text-foreground"
					>
						Enregistrer le paiement
					</button>
				)}
			</DetailSheetSection>
		</DetailSheetBody>
	);
}

function PaymentForm({
	contract,
	onDone,
}: {
	contract: RentalContract;
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [type, setType] = useState("RENTAL_FEE");
	const [method, setMethod] = useState("CASH");
	const [amount, setAmount] = useState(
		String(
			((type === "DEPOSIT"
				? contract.depositAmountCents
				: contract.totalAmountCents) ?? 0) / 100,
		),
	);
	const amountId = useId();

	const create = useMutation(
		trpc.payments.create.mutationOptions({
			onSuccess: async () => {
				await cache.rentalContract(contract.id);
				toast.success("Paiement enregistré.");
				onDone();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<QuickAddForm
			submitLabel="Enregistrer le paiement"
			pending={create.isPending}
			ready={amount.trim() !== ""}
			onCancel={onDone}
			onSubmit={() => {
				const parsed = Number.parseFloat(amount);
				if (!Number.isFinite(parsed) || parsed < 0) {
					toast.error("Le montant doit être un nombre.");
					return;
				}
				create.mutate({
					rentalContractId: contract.id,
					type: type as never,
					method: method as never,
					currency:
						type === "DEPOSIT" ? contract.depositCurrency : contract.currency,
					amountCents: Math.round(parsed * 100),
				});
			}}
		>
			<Field>
				<FieldLabel htmlFor={amountId}>Montant</FieldLabel>
				<Input
					id={amountId}
					autoFocus
					value={amount}
					onChange={(event) => setAmount(event.target.value)}
					inputMode="decimal"
					autoComplete="off"
				/>
			</Field>
			<Field>
				<FieldLabel>Type</FieldLabel>
				<Select
					value={type}
					onValueChange={(next) => {
						setType(next);
						setAmount(
							String(
								((next === "DEPOSIT"
									? contract.depositAmountCents
									: contract.totalAmountCents) ?? 0) / 100,
							),
						);
					}}
				>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{PAYMENT_TYPE_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</Field>
			<Field>
				<FieldLabel>Moyen de paiement</FieldLabel>
				<Select value={method} onValueChange={setMethod}>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{PAYMENT_METHOD_OPTIONS.map((option) => (
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

type Payment = RouterOutputs["payments"]["listByContract"][number];

function PaymentRowActions({
	payment,
	contractId,
}: {
	payment: Payment;
	contractId: string;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [editing, setEditing] = useState(false);
	const [confirming, setConfirming] = useState(false);

	const remove = useMutation(
		trpc.payments.delete.mutationOptions({
			onSuccess: async () => {
				await cache.rentalContract(contractId);
				toast.success("Paiement supprimé.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon-xs"
						disabled={remove.isPending}
						onClick={(event) => event.stopPropagation()}
					>
						<Icon icon={OverflowMenuVertical} />
						<span className="sr-only">Actions du paiement</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="end"
					className="min-w-44"
					onClick={(event) => event.stopPropagation()}
				>
					<DropdownMenuItem onSelect={() => setEditing(true)}>
						<Icon icon={Edit} />
						Modifier
					</DropdownMenuItem>
					<DropdownMenuItem
						variant="destructive"
						onSelect={() => setConfirming(true)}
					>
						<Icon icon={TrashCan} />
						Supprimer
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<EditPaymentDialog
				payment={payment}
				contractId={contractId}
				open={editing}
				onOpenChange={setEditing}
			/>

			<AlertDialog open={confirming} onOpenChange={setConfirming}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Supprimer ce paiement ?</AlertDialogTitle>
						<AlertDialogDescription>
							Cette action est définitive. Les montants encaissés pour ce
							contrat seront recalculés.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Annuler</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							disabled={remove.isPending}
							onClick={() => remove.mutate({ id: payment.id })}
						>
							Supprimer
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

function EditPaymentDialog({
	payment,
	contractId,
	open,
	onOpenChange,
}: {
	payment: Payment;
	contractId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [status, setStatus] = useState(payment.status);
	const [reference, setReference] = useState(payment.reference ?? "");
	const [paidAt, setPaidAt] = useState(
		payment.paidAt ? payment.paidAt.slice(0, 10) : "",
	);
	const [notes, setNotes] = useState(payment.notes ?? "");
	const referenceId = useId();
	const paidAtId = useId();
	const notesId = useId();

	const update = useMutation(
		trpc.payments.update.mutationOptions({
			onSuccess: async () => {
				await cache.rentalContract(contractId);
				toast.success("Paiement mis à jour.");
				onOpenChange(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Modifier le paiement</DialogTitle>
					<DialogDescription>
						Le type, le montant et le moyen de paiement ne peuvent pas être
						modifiés : supprimez ce paiement et enregistrez-en un nouveau si
						l’un de ces éléments est erroné.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4 px-4">
					<Field>
						<FieldLabel>Statut</FieldLabel>
						<Select
							value={status}
							onValueChange={(next) => setStatus(next as typeof status)}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{PAYMENT_STATUS_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor={paidAtId}>Date</FieldLabel>
						<Input
							id={paidAtId}
							type="date"
							value={paidAt}
							onChange={(event) => setPaidAt(event.target.value)}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={referenceId}>Référence</FieldLabel>
						<Input
							id={referenceId}
							value={reference}
							onChange={(event) => setReference(event.target.value)}
							autoComplete="off"
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={notesId}>Notes</FieldLabel>
						<Textarea
							id={notesId}
							value={notes}
							onChange={(event) => setNotes(event.target.value)}
							rows={3}
						/>
					</Field>
				</div>

				<DialogFooter>
					<Button
						disabled={update.isPending}
						onClick={() =>
							update.mutate({
								id: payment.id,
								data: {
									status,
									reference: reference.trim() || null,
									paidAt: paidAt || null,
									notes: notes.trim() || null,
								},
							})
						}
					>
						Enregistrer
					</Button>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Annuler
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function ContractIncidents({
	contractId,
	vehicleId,
	depositCurrency,
}: {
	contractId: string;
	vehicleId: string;
	depositCurrency: string;
}) {
	const trpc = useTRPC();
	const [adding, setAdding] = useState(false);

	const incidents = useQuery(
		trpc.incidents.listByContract.queryOptions({
			rentalContractId: contractId,
		}),
	);

	const rows = (incidents.data ?? []) as unknown as ContractIncidentRow[];

	const form = adding ? (
		<ContractIncidentForm
			contractId={contractId}
			vehicleId={vehicleId}
			depositCurrency={depositCurrency}
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
						description="Nothing has been reported on this contract."
						action={
							<Button
								variant="outline"
								size="sm"
								onClick={() => setAdding(true)}
							>
								<Icon icon={Add} data-icon="inline-start" />
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
					<SimpleTableRow key={incident.id}>
						<TableCell className="truncate py-2.5 pr-3 pl-5 font-medium">
							{incident.type}
						</TableCell>
						<TableCell className="truncate px-3 py-2.5 text-muted-foreground">
							{incident.description}
						</TableCell>
						<TableCell className="px-3 py-2.5 text-muted-foreground">
							{incident.insuranceStatus}
						</TableCell>
					</SimpleTableRow>
				))}
			</SimpleTable>
			{adding ? null : (
				<div className="border-t p-3">
					<Button variant="outline" size="sm" onClick={() => setAdding(true)}>
						<Icon icon={Add} data-icon="inline-start" />
						Signaler un incident
					</Button>
				</div>
			)}
		</div>
	);
}

function ContractIncidentForm({
	contractId,
	vehicleId,
	depositCurrency,
	onDone,
}: {
	contractId: string;
	vehicleId: string;
	depositCurrency: string;
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [description, setDescription] = useState("");
	const [annotations, setAnnotations] = useState<DamageAnnotationDraft[]>([]);
	const [depositOutcome, setDepositOutcome] = useState("NONE");
	const [depositDeductedAmount, setDepositDeductedAmount] = useState("");
	const [document, setDocument] = useState<File | null>(null);
	const [documentType, setDocumentType] = useState("PHOTO");
	const [documentAmount, setDocumentAmount] = useState("");
	const [insuranceReimbursedAmount, setInsuranceReimbursedAmount] =
		useState("");
	const descriptionId = useId();

	const create = useMutation(
		trpc.incidents.create.mutationOptions({
			onError: (error) => toast.error(error.message),
		}),
	);

	const submit = async () => {
		const incident = await create.mutateAsync({
			vehicleId,
			rentalContractId: contractId,
			type: "DAMAGE",
			description,
			depositOutcome: depositOutcome as "NONE" | "PARTIAL" | "FULL",
			depositDeductedAmountCents: depositDeductedAmount
				? Math.round(Number(depositDeductedAmount) * 100)
				: undefined,
			depositCurrency: depositDeductedAmount ? depositCurrency : undefined,
			damageAnnotations: annotations.map(({ id, ...annotation }) => ({
				...annotation,
				description: annotation.description || null,
			})),
		});

		if (document) {
			const body = new FormData();
			body.append("file", document);
			body.append(
				"type",
				document.type === "application/pdf" ? documentType : "PHOTO",
			);
			if (documentAmount)
				body.append("amountCents", String(Number(documentAmount) * 100));
			if (insuranceReimbursedAmount) {
				body.append(
					"insuranceReimbursedAmountCents",
					String(Number(insuranceReimbursedAmount) * 100),
				);
			}
			body.append("currency", depositCurrency);
			const response = await fetch(`/api/incidents/${incident.id}/documents`, {
				method: "POST",
				body,
			});
			if (!response.ok) {
				toast.error(
					"The incident was saved, but the document failed to upload.",
				);
			}
		}

		await Promise.all([
			cache.rentalContract(contractId),
			cache.vehicle(vehicleId),
		]);
		toast.success("Incident signalé.");
		onDone();
	};

	return (
		<QuickAddForm
			submitLabel="Signaler l’incident"
			pending={create.isPending}
			ready={description.trim() !== ""}
			onCancel={onDone}
			onSubmit={() => void submit()}
		>
			<Field className="sm:col-span-2">
				<FieldLabel htmlFor={descriptionId}>Que s’est-il passé ?</FieldLabel>
				<Textarea
					id={descriptionId}
					autoFocus
					value={description}
					onChange={(event) => setDescription(event.target.value)}
					rows={3}
				/>
			</Field>
			<Field className="sm:col-span-2">
				<FieldLabel>Localisation des dommages</FieldLabel>
				<VehicleDamageEditor value={annotations} onChange={setAnnotations} />
			</Field>
			<Field>
				<FieldLabel>Impact sur la caution</FieldLabel>
				<Select value={depositOutcome} onValueChange={setDepositOutcome}>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="NONE">Aucune retenue</SelectItem>
						<SelectItem value="PARTIAL">Partiellement perdue</SelectItem>
						<SelectItem value="FULL">Totalement perdue</SelectItem>
					</SelectContent>
				</Select>
			</Field>
			<Field>
				<FieldLabel htmlFor="deposit-deducted">Montant retenu</FieldLabel>
				<Input
					id="deposit-deducted"
					inputMode="decimal"
					placeholder={`Montant en ${depositCurrency}`}
					value={depositDeductedAmount}
					onChange={(event) => setDepositDeductedAmount(event.target.value)}
				/>
			</Field>
			<Field className="sm:col-span-2">
				<FieldLabel htmlFor="incident-document">
					Photos ou constat de police
				</FieldLabel>
				<Input
					id="incident-document"
					type="file"
					accept="image/jpeg,image/png,image/webp,application/pdf"
					onChange={(event) => setDocument(event.target.files?.[0] ?? null)}
				/>
			</Field>
			{document?.type === "application/pdf" ? (
				<Field>
					<FieldLabel>Type de document</FieldLabel>
					<Select value={documentType} onValueChange={setDocumentType}>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="POLICE_REPORT">Constat de police</SelectItem>
							<SelectItem value="INVOICE">Facture</SelectItem>
							<SelectItem value="OTHER">Autre document</SelectItem>
						</SelectContent>
					</Select>
				</Field>
			) : null}
			{documentType === "INVOICE" ? (
				<>
					<Field>
						<FieldLabel htmlFor="invoice-amount">
							Montant de la facture
						</FieldLabel>
						<Input
							id="invoice-amount"
							inputMode="decimal"
							placeholder={`Montant en ${depositCurrency}`}
							value={documentAmount}
							onChange={(event) => setDocumentAmount(event.target.value)}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="insurance-reimbursed">
							Remboursé par l’assurance
						</FieldLabel>
						<Input
							id="insurance-reimbursed"
							inputMode="decimal"
							placeholder={`Montant en ${depositCurrency}`}
							value={insuranceReimbursedAmount}
							onChange={(event) =>
								setInsuranceReimbursedAmount(event.target.value)
							}
						/>
					</Field>
				</>
			) : null}
		</QuickAddForm>
	);
}

function ContractInspections({ contract }: { contract: RentalContract }) {
	const trpc = useTRPC();

	const inspections = useQuery(
		trpc.vehicleInspections.listByContract.queryOptions({
			rentalContractId: contract.id,
		}),
	);

	const rows = inspections.data ?? [];
	const checkOut = rows.find((row) => row.type === "CHECK_OUT");
	const checkIn = rows.find((row) => row.type === "CHECK_IN");

	return (
		<DetailSheetBody>
			<DetailSheetSection title="Départ">
				{checkOut ? (
					<DetailSheetProperties>
						<DetailSheetProperty label="Kilométrage">
							{checkOut.odometer.toLocaleString()} km
						</DetailSheetProperty>
						<DetailSheetProperty label="Carburant">
							{FUEL_OPTIONS.find((o) => o.value === checkOut.fuelLevel)?.label}
						</DetailSheetProperty>
						<DetailSheetProperty label="Date">
							<LocalDateTime
								date={checkOut.inspectedAt}
								options={DATE_OPTIONS}
							/>
						</DetailSheetProperty>
						{checkOut.damageNotes ? (
							<DetailSheetProperty label="Notes" wide>
								{checkOut.damageNotes}
							</DetailSheetProperty>
						) : null}
					</DetailSheetProperties>
				) : (
					<InspectionForm contract={contract} type="CHECK_OUT" />
				)}
			</DetailSheetSection>

			<DetailSheetSection title="Retour">
				{checkIn ? (
					<DetailSheetProperties>
						<DetailSheetProperty label="Kilométrage">
							{checkIn.odometer.toLocaleString()} km
						</DetailSheetProperty>
						<DetailSheetProperty label="Carburant">
							{FUEL_OPTIONS.find((o) => o.value === checkIn.fuelLevel)?.label}
						</DetailSheetProperty>
						<DetailSheetProperty label="Date">
							<LocalDateTime
								date={checkIn.inspectedAt}
								options={DATE_OPTIONS}
							/>
						</DetailSheetProperty>
						{checkIn.damageNotes ? (
							<DetailSheetProperty label="Notes" wide>
								{checkIn.damageNotes}
							</DetailSheetProperty>
						) : null}
					</DetailSheetProperties>
				) : checkOut ? (
					<InspectionForm contract={contract} type="CHECK_IN" />
				) : (
					<p className="text-muted-foreground text-sm">
						Enregistrez d’abord le départ.
					</p>
				)}
			</DetailSheetSection>
		</DetailSheetBody>
	);
}

function InspectionForm({
	contract,
	type,
}: {
	contract: RentalContract;
	type: "CHECK_OUT" | "CHECK_IN";
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [odometer, setOdometer] = useState("");
	const [fuelLevel, setFuelLevel] = useState("FULL");
	const odometerId = useId();

	const create = useMutation(
		trpc.vehicleInspections.create.mutationOptions({
			onError: (error) => toast.error(error.message),
		}),
	);

	const recordPickup = useMutation(
		trpc.rentalContracts.recordPickup.mutationOptions({
			onError: (error) => toast.error(error.message),
		}),
	);

	const recordReturn = useMutation(
		trpc.rentalContracts.recordReturn.mutationOptions({
			onError: (error) => toast.error(error.message),
		}),
	);

	const pending =
		create.isPending || recordPickup.isPending || recordReturn.isPending;

	const submit = async () => {
		const mileage = Number(odometer) || 0;
		try {
			await create.mutateAsync({
				rentalContractId: contract.id,
				type,
				odometer: mileage,
				fuelLevel: fuelLevel as never,
			});
			if (type === "CHECK_OUT") {
				await recordPickup.mutateAsync({
					id: contract.id,
					mileageAtPickup: mileage,
					fuelLevelAtPickup: fuelLevel as never,
				});
			} else {
				await recordReturn.mutateAsync({
					id: contract.id,
					mileageAtReturn: mileage,
					fuelLevelAtReturn: fuelLevel as never,
				});
			}
			await cache.rentalContract(contract.id);
			toast.success(
				type === "CHECK_OUT" ? "Départ enregistré." : "Retour enregistré.",
			);
		} catch {
			// Individual mutations already surface their own error toast.
		}
	};

	return (
		<div className="flex flex-wrap items-end gap-2">
			<Field className="w-32">
				<FieldLabel htmlFor={odometerId}>Kilométrage</FieldLabel>
				<Input
					id={odometerId}
					value={odometer}
					onChange={(event) => setOdometer(event.target.value)}
					inputMode="numeric"
				/>
			</Field>
			<Field className="w-32">
				<FieldLabel>Carburant</FieldLabel>
				<Select value={fuelLevel} onValueChange={setFuelLevel}>
					<SelectTrigger className="w-full">
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
			<Button
				variant="outline"
				size="sm"
				disabled={pending || odometer.trim() === ""}
				onClick={() => void submit()}
			>
				{type === "CHECK_OUT"
					? "Enregistrer le départ"
					: "Enregistrer le retour"}
			</Button>
		</div>
	);
}
