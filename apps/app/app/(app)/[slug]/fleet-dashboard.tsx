"use client";

import CarFront from "@carbon/icons-react/es/CarFront";
import CheckmarkOutline from "@carbon/icons-react/es/CheckmarkOutline";
import Currency from "@carbon/icons-react/es/Currency";
import Renew from "@carbon/icons-react/es/Renew";
import Time from "@carbon/icons-react/es/Time";
import Wallet from "@carbon/icons-react/es/Wallet";
import { Button } from "@crm/ui/components/button";
import type { ChartConfig } from "@crm/ui/components/chart";
import {
	ChartCard,
	DashboardRow,
	DashboardSection,
	StatGroup,
} from "@crm/ui/components/dashboard";
import { Icon } from "@crm/ui/components/icon";
import { StatCard, type StatDelta } from "@crm/ui/components/stat-card";
import {
	formatCount,
	formatMoney,
	formatMoneyCompact,
	formatPercent,
} from "@crm/ui/lib/format";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AreaTrend, DonutStat } from "@/components/dashboard-charts";
import { rentalStatusLabel } from "@/lib/rental-status";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type Summary = RouterOutputs["dashboard"]["summary"];

const TREND_CONFIG: ChartConfig = {
	completed: { label: "Terminées", color: "var(--success)" },
	created: { label: "Nouvelles réservations", color: "var(--chart-1)" },
};

const STATUS_COLOR: Record<string, string> = {
	DRAFT: "var(--chart-5)",
	RESERVED: "var(--chart-1)",
	ACTIVE: "var(--chart-2)",
};

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

export function FleetDashboardOverview({ summary }: { summary: Summary }) {
	const workspaceUrl = useWorkspaceUrl();

	const { fleet, today, dueBackThisMonth, reportingCurrency, unconverted } =
		summary;

	const money = (cents: number) => formatMoneyCompact(cents, reportingCurrency);
	const exact = (value: unknown) =>
		formatMoney(
			typeof value === "number" ? value : Number(value),
			reportingCurrency,
		);

	const statusSlices = fleet.statuses.flatMap((status) =>
		status.valueCents > 0
			? [
					{
						key: status.status,
						label: rentalStatusLabel(status.status),
						value: status.valueCents,
						color: STATUS_COLOR[status.status] ?? "var(--chart-5)",
						count: status.count,
					},
				]
			: [],
	);

	return (
		<div className="flex flex-col gap-6">
			<ChartCard
				className="min-w-0"
				title="Valeur des contrats ouverts"
				description={
					fleet.totalContracts > 0
						? `${formatCount(fleet.totalContracts, "contrat")} en cours · ${money(dueBackThisMonth.valueCents)} à récupérer ce mois-ci`
						: "Réservations et locations actuellement en cours"
				}
				action={
					<Button asChild variant="contrast" size="sm">
						<Link href={workspaceUrl("/rental-contracts")}>
							Voir les contrats
						</Link>
					</Button>
				}
			>
				{statusSlices.length > 0 ? (
					<div className="flex flex-1 flex-col gap-4 pt-4 lg:flex-row lg:items-center lg:gap-10 lg:px-5 lg:pt-0 md:lg:px-6">
						<DonutStat
							data={statusSlices}
							height={200}
							centerValue={money(fleet.totalCents)}
							centerLabel="ouverts"
							formatValue={exact}
							className="lg:shrink-0"
						/>
						<ul className="flex min-w-0 flex-1 flex-col px-5 pb-1 md:px-6 lg:px-0 lg:pb-0">
							{statusSlices.map((slice) => (
								<li key={slice.key} className="border-t first:border-t-0">
									<Link
										href={`${workspaceUrl("/rental-contracts")}?status=${slice.key}`}
										className="flex items-center gap-2.5 py-2.5 text-sm hover:underline"
									>
										<span
											aria-hidden
											className="size-1.5 shrink-0"
											style={{ backgroundColor: slice.color }}
										/>
										<span className="min-w-0 flex-1 truncate">
											{slice.label}
										</span>
										<span className="shrink-0 text-muted-foreground tabular-nums">
											{slice.count}
										</span>
										<span className="w-16 shrink-0 text-right font-medium tabular-nums">
											{money(slice.value)}
										</span>
									</Link>
								</li>
							))}
						</ul>
					</div>
				) : (
					<EmptyChart label="Aucun contrat actif" />
				)}
			</ChartCard>

			<DashboardSection
				title="Aujourd’hui"
				description="La situation opérationnelle et financière de la flotte aujourd’hui"
			>
				<StatGroup>
					<StatCard
						icon={<Icon icon={Time} />}
						label="Locations en cours"
						value={formatCount(today.rentalsInProgress, "location")}
						description="Contrats actuellement en cours"
					/>
					<StatCard
						icon={<Icon icon={CarFront} />}
						label="Véhicules mobilisés"
						value={formatCount(today.vehiclesRented, "véhicule")}
						description="Réservés ou en location aujourd’hui"
					/>
					<StatCard
						icon={<Icon icon={Renew} />}
						label="Retours prévus aujourd’hui"
						value={formatCount(today.returnsDue, "retour")}
						description="Contrats dont le retour est prévu aujourd’hui"
					/>
					<StatCard
						icon={<Icon icon={CheckmarkOutline} />}
						label="Véhicules disponibles"
						value={formatCount(today.availableVehicles, "véhicule")}
						description="Prêts à être attribués"
					/>
					<StatCard
						icon={<Icon icon={Wallet} />}
						label="Valeur des locations en cours"
						value={money(today.valueInProgressCents)}
						description="Contrats réservés ou actifs aujourd’hui"
					/>
					<StatCard
						icon={<Icon icon={Currency} />}
						label="Encaissements du jour"
						value={money(today.paymentsCents)}
						description="Paiements enregistrés depuis minuit"
					/>
				</StatGroup>
			</DashboardSection>

			{unconverted.count > 0 ? (
				<p className="text-muted-foreground text-xs">
					Les montants ci-dessus sont exprimés en {reportingCurrency}.{" "}
					{formatCount(unconverted.count, "enregistrement")} en{" "}
					{unconverted.currencies.join(", ")}{" "}
					{unconverted.count === 1 ? "n’est pas inclus" : "ne sont pas inclus"}{" "}
					: aucun taux de conversion n’est disponible.{" "}
					<Link
						href={workspaceUrl("/settings/currencies")}
						className="underline hover:no-underline"
					>
						Configurer un taux
					</Link>
					.
				</p>
			) : null}
		</div>
	);
}

export function FleetDashboardTrends({ summary }: { summary: Summary }) {
	const {
		completedThisMonth,
		completedPrevMonth,
		performance,
		trend,
		dueBackThisMonth,
		reportingCurrency,
	} = summary;

	const money = (cents: number) => formatMoneyCompact(cents, reportingCurrency);
	const exact = (value: unknown) =>
		formatMoney(
			typeof value === "number" ? value : Number(value),
			reportingCurrency,
		);

	const hasTrend = trend.some(
		(point) => point.completed > 0 || point.created > 0,
	);

	return (
		<div className="flex flex-col gap-6">
			<DashboardSection
				title="Ce mois-ci"
				description="Contrats terminés, nouvelles réservations et retours attendus"
			>
				<DashboardRow split="hero">
					<ChartCard
						className="min-w-0"
						title="Contrats terminés et nouvelles réservations"
						description="Six derniers mois, selon le mois du retour ou de la création du contrat"
					>
						{hasTrend ? (
							<div className="flex flex-1 flex-col justify-center py-4">
								<AreaTrend
									data={trend}
									config={TREND_CONFIG}
									xKey="month"
									height={196}
									variant="gradient"
									bloom="high"
									showLegend
									formatValue={exact}
								/>
							</div>
						) : (
							<EmptyChart label="Aucun contrat terminé ou créé pour le moment" />
						)}
					</ChartCard>

					<div className="flex min-w-0 flex-col gap-4">
						<div className="rounded-xl border bg-card shadow-xs">
							<StatCard
								label="Contrats terminés ce mois-ci"
								value={money(completedThisMonth.valueCents)}
								delta={changeDelta(
									completedThisMonth.valueCents,
									completedPrevMonth.valueCents,
									"vs mois dernier",
								)}
								description={`${formatCount(completedThisMonth.count, "contrat")} · ${money(completedPrevMonth.valueCents)} le mois dernier`}
							/>
						</div>
						<div className="rounded-xl border bg-card shadow-xs">
							<StatCard
								label="Retours prévus ce mois-ci"
								value={formatCount(dueBackThisMonth.count, "retour")}
								description={`${money(dueBackThisMonth.valueCents)} de valeur contractuelle`}
							/>
						</div>
					</div>
				</DashboardRow>
			</DashboardSection>

			<DashboardSection
				title="Performance (90 jours)"
				description="Taux de réalisation et contrat moyen sur les 90 derniers jours"
			>
				<StatGroup>
					<StatCard
						label="Taux de réalisation"
						value={
							performance.completionRate === null
								? "—"
								: formatPercent(performance.completionRate)
						}
						description={
							performance.completedCount + performance.cancelledCount === 0
								? "Aucun contrat terminé"
								: `${performance.completedCount} terminés · ${performance.cancelledCount} annulés`
						}
					/>
					<StatCard
						label="Contrat moyen"
						value={
							performance.avgContractCents === null
								? "—"
								: money(performance.avgContractCents)
						}
						description={
							performance.avgDurationDays === null
								? "Aucun retour à mesurer"
								: `Durée moyenne de ${performance.avgDurationDays} jours`
						}
					/>
					<StatCard
						label="Annulations"
						value={formatCount(performance.cancelledCount, "contrat")}
						description="Contrats annulés sur la période analysée"
					/>
				</StatGroup>
			</DashboardSection>

			<ProfitabilitySection />
		</div>
	);
}

function ProfitabilitySection() {
	const trpc = useTRPC();
	const workspaceUrl = useWorkspaceUrl();
	const query = useQuery(trpc.profitability.summary.queryOptions({}));
	const data = query.data;

	if (!data) return null;

	const money = (cents: number) =>
		formatMoneyCompact(cents, data.reportingCurrency);
	const margin =
		data.lifetime.revenueCents > 0
			? formatPercent(data.lifetime.netCents / data.lifetime.revenueCents)
			: "—";

	return (
		<DashboardSection
			title="Rentabilité"
			description="Revenus comparés aux charges, sur l’ensemble de la flotte"
			action={
				<Button asChild variant="outline" size="sm">
					<Link href={workspaceUrl("/finance")}>Voir les finances</Link>
				</Button>
			}
		>
			<StatGroup>
				<StatCard label="Revenus" value={money(data.lifetime.revenueCents)} />
				<StatCard label="Dépenses" value={money(data.lifetime.expensesCents)} />
				<StatCard label="Net" value={money(data.lifetime.netCents)} />
				<StatCard label="Marge" value={margin} />
			</StatGroup>
		</DashboardSection>
	);
}

function EmptyChart({ label }: { label: string }) {
	return (
		<div className="flex flex-1 items-center justify-center px-5 py-10 text-muted-foreground text-sm md:px-6">
			{label}
		</div>
	);
}
