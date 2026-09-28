"use client";

import type { ChartConfig } from "@crm/ui/components/chart";
import {
	ChartCard,
	DashboardRow,
	DashboardSection,
	StatGroup,
} from "@crm/ui/components/dashboard";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { StatCard, type StatDelta } from "@crm/ui/components/stat-card";
import { TableCell } from "@crm/ui/components/table";
import {
	formatCount,
	formatMoney,
	formatMoneyCompact,
	formatPercent,
} from "@crm/ui/lib/format";
import { useQuery } from "@tanstack/react-query";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { AreaTrend, DonutStat } from "@/components/dashboard-charts";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type TopVehicle = RouterOutputs["profitability"]["topVehicles"][number];
type TopClient = RouterOutputs["profitability"]["topClients"][number];
type Segment = RouterOutputs["profitability"]["bySegment"][number];

const TREND_CONFIG: ChartConfig = {
	revenueCents: { label: "Revenus", color: "var(--success)" },
	expensesCents: { label: "Dépenses", color: "var(--chart-5)" },
};

const TYPE_LABEL: Record<string, string> = {
	CAR: "Voitures",
	MOTORCYCLE: "Motos",
	SCOOTER: "Scooters",
	TRUCK: "Camions",
	MINIBUS: "Minibus",
};

const TOP_LIMIT = 5;

function changeDelta(
	current: number,
	previous: number,
	label: string,
): StatDelta | undefined {
	if (previous === 0) return undefined;
	const change = Math.round(((current - previous) / previous) * 100);
	return {
		value: `${change >= 0 ? "+" : ""}${change}%`,
		direction: change > 0 ? "up" : change < 0 ? "down" : "neutral",
		label,
	};
}

export function FinanceView() {
	const trpc = useTRPC();

	const summary = useQuery(trpc.profitability.summary.queryOptions({}));
	const topVehicles = useQuery(trpc.profitability.topVehicles.queryOptions({}));
	const topClients = useQuery(trpc.profitability.topClients.queryOptions({}));
	const bySegment = useQuery(trpc.profitability.bySegment.queryOptions({}));

	if (!summary.data) return null;

	const data = summary.data;
	const currency = data.reportingCurrency;
	const money = (cents: number) => formatMoneyCompact(cents, currency);
	const exact = (value: number | string) =>
		formatMoney(Number(value), currency);
	const ratio = (numerator: number, denominator: number) =>
		denominator > 0 ? formatPercent(numerator / denominator) : "—";

	const hasTrend = data.trend.some(
		(point) => point.revenueCents > 0 || point.expensesCents > 0,
	);

	const expenses = data.expenseBreakdown;
	const expenseSlices = [
		{
			key: "loan",
			label: "Crédit",
			value: expenses.loanCents,
			color: "var(--chart-2)",
		},
		{
			key: "leasing",
			label: "Leasing",
			value: expenses.leasingCents,
			color: "var(--chart-4)",
		},
		{
			key: "charges",
			label: "Charges diverses",
			value: expenses.chargesCents,
			color: "var(--chart-5)",
		},
		{
			key: "maintenance",
			label: "Entretien",
			value: expenses.maintenanceCents,
			color: "var(--warning)",
		},
		{
			key: "incidents",
			label: "Incidents",
			value: expenses.incidentsCents,
			color: "var(--destructive)",
		},
	].filter((slice) => slice.value > 0);

	const vehicles = topVehicles.data ?? [];
	const mostProfitable = [...vehicles]
		.sort((a, b) => b.netCents - a.netCents)
		.slice(0, TOP_LIMIT);
	const mostRevenue = [...vehicles]
		.sort((a, b) => b.revenueCents - a.revenueCents)
		.slice(0, TOP_LIMIT);

	return (
		<div className="flex flex-col gap-6">
			<DashboardSection
				title="Chiffre d’affaires"
				description="Depuis le début de l’activité"
			>
				<StatGroup>
					<StatCard
						label="CA depuis le début"
						value={money(data.lifetime.revenueCents)}
						description={exact(data.lifetime.revenueCents)}
					/>
					<StatCard
						label="Dépenses depuis le début"
						value={money(data.lifetime.expensesCents)}
					/>
					<StatCard
						label="Net"
						value={money(data.lifetime.netCents)}
						description={`Marge de ${ratio(data.lifetime.netCents, data.lifetime.revenueCents)}`}
					/>
					<StatCard
						label="Ce mois-ci vs l’an dernier"
						value={money(data.monthly.revenueCents)}
						delta={changeDelta(
							data.monthly.revenueCents,
							data.previousYearMonth.revenueCents,
							`vs ${money(data.previousYearMonth.revenueCents)} même mois l’an dernier`,
						)}
					/>
				</StatGroup>
			</DashboardSection>

			<DashboardRow split="hero">
				<ChartCard
					className="min-w-0"
					title="Revenus et dépenses"
					description="Six derniers mois, sur l’ensemble de la flotte"
				>
					{hasTrend ? (
						<div className="flex flex-1 flex-col justify-center py-4">
							<AreaTrend
								data={data.trend}
								config={TREND_CONFIG}
								xKey="month"
								height={220}
								variant="gradient"
								bloom="high"
								showLegend
								formatValue={exact}
							/>
						</div>
					) : (
						<EmptyChart label="Aucun revenu ou coût enregistré pour le moment" />
					)}
				</ChartCard>

				<ChartCard
					className="min-w-0"
					title="Composition des charges"
					description="Crédit, leasing, charges, entretien et incidents"
				>
					{expenseSlices.length > 0 ? (
						<div className="flex flex-1 flex-col justify-between gap-1 pt-4">
							<DonutStat
								data={expenseSlices}
								height={168}
								centerValue={money(data.lifetime.expensesCents)}
								centerLabel="dépenses"
								formatValue={exact}
							/>
							<ul className="flex flex-col px-5 pb-1 md:px-6">
								{expenseSlices.map((slice) => (
									<li key={slice.key} className="border-t first:border-t-0">
										<div className="flex items-center gap-2.5 py-2 text-xs">
											<span
												aria-hidden
												className="size-1.5 shrink-0"
												style={{ backgroundColor: slice.color }}
											/>
											<span className="min-w-0 flex-1 truncate">
												{slice.label}
											</span>
											<span className="w-14 shrink-0 text-right font-medium tabular-nums">
												{money(slice.value)}
											</span>
										</div>
									</li>
								))}
							</ul>
						</div>
					) : (
						<EmptyChart label="Aucune charge enregistrée pour le moment" />
					)}
				</ChartCard>
			</DashboardRow>

			<DashboardSection
				title="Poids du financement"
				description="Part du crédit et du leasing dans les charges totales"
			>
				<StatGroup>
					<StatCard
						label="Crédit"
						value={money(expenses.loanCents)}
						description={`${ratio(expenses.loanCents, data.lifetime.expensesCents)} des charges`}
					/>
					<StatCard
						label="Leasing"
						value={money(expenses.leasingCents)}
						description={`${ratio(expenses.leasingCents, data.lifetime.expensesCents)} des charges`}
					/>
					<StatCard
						label="Financement total"
						value={money(expenses.financingCents)}
						description={`${ratio(expenses.financingCents, data.lifetime.expensesCents)} des charges`}
					/>
					<StatCard
						label="Reste (charges, entretien, incidents)"
						value={money(data.lifetime.expensesCents - expenses.financingCents)}
						description={`${ratio(data.lifetime.expensesCents - expenses.financingCents, data.lifetime.expensesCents)} des charges`}
					/>
				</StatGroup>
			</DashboardSection>

			<DashboardSection
				title="Rentabilité par secteur"
				description="Revenus et marge nette par type de véhicule"
			>
				<SegmentTable
					segments={bySegment.data ?? []}
					money={money}
					ratio={ratio}
				/>
			</DashboardSection>

			<DashboardRow split="even">
				<DashboardSection
					title="Véhicules les plus rentables"
					description="Net le plus élevé (revenus moins charges)"
				>
					<VehicleTable vehicles={mostProfitable} money={money} metric="net" />
				</DashboardSection>

				<DashboardSection
					title="Véhicules qui rapportent le plus"
					description="Chiffre d’affaires brut le plus élevé"
				>
					<VehicleTable vehicles={mostRevenue} money={money} metric="revenue" />
				</DashboardSection>
			</DashboardRow>

			<DashboardSection
				title="Top clients"
				description="Chiffre d’affaires cumulé par client"
			>
				<ClientTable clients={topClients.data ?? []} money={money} />
			</DashboardSection>
		</div>
	);
}

function SegmentTable({
	segments,
	money,
	ratio,
}: {
	segments: Segment[];
	money: (cents: number) => string;
	ratio: (numerator: number, denominator: number) => string;
}) {
	if (segments.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				Aucune donnée par secteur pour le moment.
			</p>
		);
	}

	return (
		<SimpleTable
			columns={[
				{ id: "type", header: "Type" },
				{ id: "count", header: "Véhicules", align: "right" },
				{ id: "revenue", header: "CA", align: "right" },
				{ id: "net", header: "Net", align: "right" },
				{ id: "margin", header: "Marge", align: "right" },
			]}
		>
			{segments.map((segment) => (
				<SimpleTableRow key={segment.type}>
					<TableCell className="py-2.5 pl-5 font-medium">
						{TYPE_LABEL[segment.type] ?? segment.type}
					</TableCell>
					<TableCell className="py-2.5 text-right text-muted-foreground tabular-nums">
						{formatCount(segment.vehicleCount, "véhicule")}
					</TableCell>
					<TableCell className="py-2.5 text-right tabular-nums">
						{money(segment.revenueCents)}
					</TableCell>
					<TableCell className="py-2.5 text-right tabular-nums">
						{money(segment.netCents)}
					</TableCell>
					<TableCell className="py-2.5 pr-5 text-right text-muted-foreground tabular-nums">
						{ratio(segment.netCents, segment.revenueCents)}
					</TableCell>
				</SimpleTableRow>
			))}
		</SimpleTable>
	);
}

function VehicleTable({
	vehicles,
	money,
	metric,
}: {
	vehicles: TopVehicle[];
	money: (cents: number) => string;
	metric: "net" | "revenue";
}) {
	const openRecord = useOpenRecord();

	if (vehicles.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				Aucun véhicule avec des revenus enregistrés.
			</p>
		);
	}

	return (
		<SimpleTable
			columns={[
				{ id: "vehicle", header: "Véhicule" },
				{
					id: "value",
					header: metric === "net" ? "Net" : "CA",
					align: "right",
				},
			]}
		>
			{vehicles.map((vehicle) => (
				<SimpleTableRow
					key={vehicle.vehicleId}
					clickable
					onClick={() => openRecord({ kind: "vehicle", id: vehicle.vehicleId })}
				>
					<TableCell className="truncate py-2.5 pl-5 font-medium">
						{vehicle.make} {vehicle.model}
						<span className="text-muted-foreground">
							{" "}
							· {vehicle.plateNumber}
						</span>
					</TableCell>
					<TableCell className="py-2.5 pr-5 text-right tabular-nums">
						{money(metric === "net" ? vehicle.netCents : vehicle.revenueCents)}
					</TableCell>
				</SimpleTableRow>
			))}
		</SimpleTable>
	);
}

function ClientTable({
	clients,
	money,
}: {
	clients: TopClient[];
	money: (cents: number) => string;
}) {
	const openRecord = useOpenRecord();

	if (clients.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				Aucun client avec des paiements enregistrés.
			</p>
		);
	}

	return (
		<SimpleTable
			columns={[
				{ id: "client", header: "Client" },
				{ id: "contracts", header: "Contrats", align: "right" },
				{ id: "revenue", header: "CA", align: "right" },
			]}
		>
			{clients.map((client) => (
				<SimpleTableRow
					key={client.contactId}
					clickable
					onClick={() => openRecord({ kind: "contact", id: client.contactId })}
				>
					<TableCell className="truncate py-2.5 pl-5 font-medium">
						{client.firstName} {client.lastName ?? ""}
					</TableCell>
					<TableCell className="py-2.5 text-right text-muted-foreground tabular-nums">
						{formatCount(client.contractCount, "contrat")}
					</TableCell>
					<TableCell className="py-2.5 pr-5 text-right tabular-nums">
						{money(client.revenueCents)}
					</TableCell>
				</SimpleTableRow>
			))}
		</SimpleTable>
	);
}

function EmptyChart({ label }: { label: string }) {
	return (
		<div className="flex flex-1 items-center justify-center px-5 py-10 text-muted-foreground text-sm md:px-6">
			{label}
		</div>
	);
}
