"use client";

import GasStation from "@carbon/icons-react/es/GasStation";
import GasStationEco from "@carbon/icons-react/es/GasStationEco";
import Meter from "@carbon/icons-react/es/Meter";
import {
	DataTable,
	type DataTableColumn,
	type DataTableFacet,
} from "@crm/ui/components/data-table";
import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import {
	IndicatorDot,
	StatusIndicator,
} from "@crm/ui/components/status-indicator";
import { useTableSelection } from "@crm/ui/hooks/use-table-selection";
import { formatMoney } from "@crm/ui/lib/format";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useFieldColumns } from "@/components/crm/fields/field-columns";
import { usePrefetchRecord } from "@/components/crm/record-sheet/record-prefetch";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { ListSearch } from "@/components/data-table/list-search";
import { useTableQuery } from "@/components/data-table/use-table-query";
import { LocalRelativeTime } from "@/components/local-date-time";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { VehiclesBulkActions } from "./vehicles-bulk-actions";
import { vehiclesSearchParams } from "./vehicles-search-params";

type VehicleRow = RouterOutputs["vehicles"]["list"]["rows"][number];

const TYPE_LABEL: Record<string, string> = {
	CAR: "Car",
	MOTORCYCLE: "Motorcycle",
	SCOOTER: "Scooter",
	TRUCK: "Truck",
	MINIBUS: "Minibus",
};

const FUEL_LABEL: Record<string, string> = {
	DIESEL: "Diesel",
	GASOLINE: "Gasoline",
	ELECTRIC: "Electric",
};

const STATUS_TONE: Record<
	string,
	"neutral" | "info" | "warning" | "success" | "error"
> = {
	AVAILABLE: "success",
	RESERVED: "info",
	RENTED: "info",
	MAINTENANCE: "warning",
	OUT_OF_SERVICE: "warning",
	STOLEN: "error",
};

const STATUS_LABEL: Record<string, string> = {
	AVAILABLE: "Disponible",
	RESERVED: "Réservé",
	RENTED: "Loué",
	MAINTENANCE: "Entretien",
	OUT_OF_SERVICE: "Hors service",
	STOLEN: "Volé",
};

const COLUMNS: DataTableColumn<VehicleRow>[] = [
	{
		id: "make",
		header: "Véhicule",
		sortable: true,
		hideable: false,
		width: "w-[24%]",
		cell: (row) => (
			<span className="truncate">
				<span className="font-medium">
					{row.make} {row.model}
				</span>
				<span className="text-muted-foreground"> · {row.plateNumber}</span>
			</span>
		),
	},
	{
		id: "type",
		header: "Type",
		sortable: true,
		width: "w-[12%]",
		cell: (row) => TYPE_LABEL[row.type] ?? row.type,
	},
	{
		id: "fuelType",
		header: "Carburant",
		width: "w-[12%]",
		cell: (row) => FUEL_LABEL[row.fuelType] ?? row.fuelType,
	},
	{
		id: "status",
		header: "Statut",
		sortable: true,
		width: "w-[14%]",
		cell: (row) => (
			<StatusIndicator
				tone={STATUS_TONE[row.status] ?? "neutral"}
				label={STATUS_LABEL[row.status] ?? row.status}
			/>
		),
	},
	{
		id: "dailyRate",
		header: "Tarif journalier",
		sortable: true,
		align: "right",
		width: "w-[12%]",
		hideBelow: "sm",
		cell: (row) =>
			row.dailyRateCents === null ? (
				<EmptyCellValue />
			) : (
				<span className="tabular-nums">
					{formatMoney(row.dailyRateCents, row.currency)}
				</span>
			),
	},
	{
		id: "mileage",
		header: "Kilométrage",
		sortable: true,
		align: "right",
		width: "w-[10%]",
		hideBelow: "md",
		cell: (row) => (
			<span className="tabular-nums text-muted-foreground">
				{row.mileage.toLocaleString()} km
			</span>
		),
	},
	{
		id: "lastActivity",
		header: "Dernière activité",
		sortable: true,
		align: "right",
		width: "w-[12%]",
		hideBelow: "lg",
		cell: (row) => (
			<span className="text-muted-foreground">
				{row.lastActivityAt ? (
					<LocalRelativeTime date={row.lastActivityAt} />
				) : (
					<EmptyCellValue />
				)}
			</span>
		),
	},
];

const PLACEHOLDER_PHOTO = "/2008-bugatti-veyron-side-right.webp";

const FUEL_ICON: Record<string, typeof GasStation> = {
	DIESEL: GasStation,
	GASOLINE: GasStation,
	ELECTRIC: GasStationEco,
};

function Pill({
	icon: Icon,
	children,
}: {
	icon?: typeof GasStation;
	children: ReactNode;
}) {
	return (
		<span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-sm bg-muted px-2 font-medium text-[11px] text-muted-foreground">
			{Icon && <Icon size={11} className="shrink-0" />}
			<span className="truncate">{children}</span>
		</span>
	);
}

function VehicleCard({ vehicle }: { vehicle: VehicleRow }) {
	const FuelIcon = FUEL_ICON[vehicle.fuelType] ?? GasStation;

	return (
		<div className="relative flex h-full min-h-[380px] flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition-shadow hover:shadow-md">
			<div className="shrink-0 px-4 pt-2">
				<div className="translate-x-5 font-bold text-md uppercase leading-tight tracking-tight">
					{vehicle.make} {vehicle.model}
				</div>
				<div className="mt-0.5 text-muted-foreground text-xs">
					{TYPE_LABEL[vehicle.type] ?? vehicle.type}
				</div>
				<div className="mt-2.5 flex flex-wrap items-center gap-1.5">
					<Pill icon={FuelIcon}>
						{FUEL_LABEL[vehicle.fuelType] ?? vehicle.fuelType}
					</Pill>
					<Pill icon={Meter}>{vehicle.mileage.toLocaleString()} km</Pill>
				</div>
			</div>

			<div className="relative min-h-[180px] flex-1 overflow-hidden">
				<div
					aria-hidden
					className="absolute inset-x-0 bottom-16 mx-auto h-3 w-2/3 rounded-full bg-black/25 blur-md"
				/>
				<Image
					src={PLACEHOLDER_PHOTO}
					alt={`${vehicle.make} ${vehicle.model}`}
					fill
					className="scale-90 object-contain p-3"
				/>
			</div>

			<div className="shrink-0 px-4 pb-4">
				<div className="mb-1.5 flex items-center gap-1.5">
					<IndicatorDot
						tone={STATUS_TONE[vehicle.status] ?? "neutral"}
						className="size-1.5 shrink-0"
						bloom="low"
					/>
					<span className="text-xs">
						{STATUS_LABEL[vehicle.status] ?? vehicle.status}
					</span>
				</div>
				<div>
					{vehicle.dailyRateCents === null ? (
						<EmptyCellValue />
					) : (
						<>
							<span className="font-bold text-xl tabular-nums">
								{formatMoney(vehicle.dailyRateCents, vehicle.currency)}
							</span>
							<span className="ml-1 text-muted-foreground text-xs">/day</span>
						</>
					)}
				</div>
			</div>
		</div>
	);
}

export function VehiclesTable() {
	const openRecord = useOpenRecord();
	const trpc = useTRPC();
	const prefetchRecord = usePrefetchRecord();
	const { query, input } = useTableQuery(vehiclesSearchParams);

	const vehicles = useQuery({
		...trpc.vehicles.list.queryOptions(input),
		placeholderData: (previous) => previous,
	});
	const rows = vehicles.data?.rows ?? [];
	const selection = useTableSelection(
		useMemo(() => rows.map((row) => row.id), [rows]),
	);

	const facetCounts = vehicles.data?.facetCounts;

	const facets: DataTableFacet[] = [
		{
			id: "status",
			label: "Status",
			options: Object.entries(STATUS_LABEL).flatMap(([value, label]) =>
				(facetCounts?.status?.[value] ?? 0) > 0 ? [{ value, label }] : [],
			),
		},
		{
			id: "type",
			label: "Type",
			options: Object.entries(TYPE_LABEL).flatMap(([value, label]) =>
				(facetCounts?.type?.[value] ?? 0) > 0 ? [{ value, label }] : [],
			),
		},
	];

	const unconverted = vehicles.data?.unconverted;

	const fieldColumns = useFieldColumns<VehicleRow>("VEHICLE");
	const columns = useMemo(() => [...COLUMNS, ...fieldColumns], [fieldColumns]);

	return (
		<DataTable
			query={query}
			search={
				<ListSearch placeholder="Search vehicles by plate, make or model…" />
			}
			columns={columns}
			renderCard={(row) => <VehicleCard vehicle={row} />}
			rows={rows}
			total={vehicles.data?.total ?? 0}
			facetCounts={facetCounts}
			facets={facets}
			selection={{
				state: selection,
				actions: (
					<VehiclesBulkActions ids={selection.ids} onDone={selection.clear} />
				),
				rowLabel: (row) => `${row.make} ${row.model}`,
			}}
			getRowId={(row) => row.id}
			loading={vehicles.isFetching}
			onRowHover={(row) => prefetchRecord({ kind: "vehicle", id: row.id })}
			onRowClick={(row) => openRecord({ kind: "vehicle", id: row.id })}
			empty="No vehicles match this view."
			meta={
				unconverted && unconverted.count > 0 ? (
					<span className="text-muted-foreground">
						{vehicles.data?.total ?? 0} vehicles · {unconverted.count} not
						counted (no {unconverted.currencies.join(", ")} rate)
					</span>
				) : (
					<span>{vehicles.data?.total ?? 0} vehicles</span>
				)
			}
		/>
	);
}
