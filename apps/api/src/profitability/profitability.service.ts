import { type Db, FinancingType, PaymentStatus, PaymentType } from "@crm/db";
import { Injectable } from "@nestjs/common";
import { toCents } from "../crm/values";
import { ConversionService } from "../currency/conversion.service";
import { MONTH_LABEL, monthKey, monthStart } from "../dashboard/month-bucket";
import { InjectDatabase } from "../database/database.constants";

const TREND_MONTHS = 6;

const NON_REVENUE_PAYMENT_TYPES: PaymentType[] = [
	PaymentType.DEPOSIT,
	PaymentType.DEPOSIT_REFUND,
];

export type ProfitabilityBucket = {
	month: string;
	revenueCents: number;
	expensesCents: number;
	netCents: number;
};

export type ProfitabilitySummary = {
	reportingCurrency: string;
	lifetime: {
		revenueCents: number;
		expensesCents: number;
		netCents: number;
		minimumRevenueToBeProfitableCents: number;
	};
	monthly: {
		revenueCents: number;
		expensesCents: number;
		netCents: number;
		minimumRevenueToBeProfitableCents: number;
		marginPercent: number | null;
		costCoveragePercent: number | null;
	};
	marginPercent: number | null;
	costCoveragePercent: number | null;
	totalReportedCents: number;
	trend: ProfitabilityBucket[];
	previousYearMonth: {
		revenueCents: number;
		expensesCents: number;
		netCents: number;
	};
	expenseBreakdown: {
		financingCents: number;
		loanCents: number;
		leasingCents: number;
		purchaseCents: number;
		amortizationCents: number;
		chargesCents: number;
		maintenanceCents: number;
		incidentsCents: number;
	};
};

export type ProfitabilityByVehicle = ProfitabilitySummary & {
	previousYearMonth: {
		revenueCents: number;
		expensesCents: number;
		netCents: number;
	};
	expenseBreakdown: {
		financingCents: number;
		loanCents: number;
		leasingCents: number;
		purchaseCents: number;
		amortizationCents: number;
		chargesCents: number;
		maintenanceCents: number;
		incidentsCents: number;
	};
};

export type TopVehicle = {
	vehicleId: string;
	make: string;
	model: string;
	plateNumber: string;
	type: string;
	revenueCents: number;
	expensesCents: number;
	netCents: number;
};

export type TopClient = {
	contactId: string;
	firstName: string;
	lastName: string | null;
	revenueCents: number;
	contractCount: number;
};

export type SegmentBreakdown = {
	type: string;
	revenueCents: number;
	expensesCents: number;
	netCents: number;
	vehicleCount: number;
};

const TOP_CLIENTS_LIMIT = 10;

type Scope = { vehicleId?: string };

type Accumulator = {
	lifetime: number;
	buckets: number[];
	yoy: number;
};

type VehicleTotals = { revenueCents: number; expensesCents: number };

@Injectable()
export class ProfitabilityService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly conversion: ConversionService,
	) {}

	async summary(): Promise<ProfitabilityByVehicle> {
		return this.compute({});
	}

	async byVehicle(vehicleId: string): Promise<ProfitabilityByVehicle> {
		return this.compute({ vehicleId });
	}

	async topVehicles(): Promise<TopVehicle[]> {
		const [totals, vehicles] = await Promise.all([
			this.computeAllVehicles(),
			this.db.vehicle.findMany({
				select: {
					id: true,
					make: true,
					model: true,
					plateNumber: true,
					type: true,
				},
			}),
		]);

		return vehicles.map((vehicle) => {
			const t = totals.get(vehicle.id) ?? { revenueCents: 0, expensesCents: 0 };
			return {
				vehicleId: vehicle.id,
				make: vehicle.make,
				model: vehicle.model,
				plateNumber: vehicle.plateNumber,
				type: vehicle.type,
				revenueCents: t.revenueCents,
				expensesCents: t.expensesCents,
				netCents: t.revenueCents - t.expensesCents,
			};
		});
	}

	async bySegment(): Promise<SegmentBreakdown[]> {
		const [totals, vehicles] = await Promise.all([
			this.computeAllVehicles(),
			this.db.vehicle.findMany({ select: { id: true, type: true } }),
		]);

		const byType = new Map<string, SegmentBreakdown>();
		for (const vehicle of vehicles) {
			const t = totals.get(vehicle.id) ?? { revenueCents: 0, expensesCents: 0 };
			const entry = byType.get(vehicle.type) ?? {
				type: vehicle.type,
				revenueCents: 0,
				expensesCents: 0,
				netCents: 0,
				vehicleCount: 0,
			};
			entry.revenueCents += t.revenueCents;
			entry.expensesCents += t.expensesCents;
			entry.netCents += t.revenueCents - t.expensesCents;
			entry.vehicleCount += 1;
			byType.set(vehicle.type, entry);
		}

		return [...byType.values()].sort((a, b) => b.revenueCents - a.revenueCents);
	}

	async topClients(): Promise<TopClient[]> {
		const base = await this.conversion.reportingCurrency();
		const payments = await this.db.payment.findMany({
			where: {
				status: PaymentStatus.COMPLETED,
				type: { notIn: NON_REVENUE_PAYMENT_TYPES },
			},
			select: {
				baseAmount: true,
				baseCurrency: true,
				rentalContractId: true,
				rentalContract: { select: { contactId: true } },
			},
		});

		const byContact = new Map<
			string,
			{ revenueCents: number; contracts: Set<string> }
		>();
		for (const payment of payments) {
			if (payment.baseCurrency !== base) continue;
			const contactId = payment.rentalContract.contactId;
			const entry = byContact.get(contactId) ?? {
				revenueCents: 0,
				contracts: new Set<string>(),
			};
			entry.revenueCents += toCents(payment.baseAmount) ?? 0;
			entry.contracts.add(payment.rentalContractId);
			byContact.set(contactId, entry);
		}

		const contactIds = [...byContact.keys()];
		const contacts = await this.db.contact.findMany({
			where: { id: { in: contactIds } },
			select: { id: true, firstName: true, lastName: true },
		});
		const contactById = new Map(
			contacts.map((contact) => [contact.id, contact]),
		);

		return contactIds
			.map((contactId) => {
				const entry = byContact.get(contactId);
				const contact = contactById.get(contactId);
				return {
					contactId,
					firstName: contact?.firstName ?? "—",
					lastName: contact?.lastName ?? null,
					revenueCents: entry?.revenueCents ?? 0,
					contractCount: entry?.contracts.size ?? 0,
				};
			})
			.sort((a, b) => b.revenueCents - a.revenueCents)
			.slice(0, TOP_CLIENTS_LIMIT);
	}

	private async computeAllVehicles(): Promise<Map<string, VehicleTotals>> {
		const base = await this.conversion.reportingCurrency();
		const now = new Date();
		const currentKey = monthKey(now);
		const map = new Map<string, VehicleTotals>();

		const bump = (
			vehicleId: string,
			key: keyof VehicleTotals,
			cents: number,
		) => {
			const entry = map.get(vehicleId) ?? { revenueCents: 0, expensesCents: 0 };
			entry[key] += cents;
			map.set(vehicleId, entry);
		};

		const payments = await this.db.payment.findMany({
			where: {
				status: PaymentStatus.COMPLETED,
				type: { notIn: NON_REVENUE_PAYMENT_TYPES },
			},
			select: {
				baseAmount: true,
				baseCurrency: true,
				rentalContract: { select: { vehicleId: true } },
			},
		});
		for (const payment of payments) {
			if (payment.baseCurrency !== base) continue;
			bump(
				payment.rentalContract.vehicleId,
				"revenueCents",
				toCents(payment.baseAmount) ?? 0,
			);
		}

		const financingPlans = await this.db.vehicleFinancing.findMany({
			select: {
				vehicleId: true,
				type: true,
				baseAmount: true,
				baseCurrency: true,
				principalAmount: true,
				currency: true,
				fiscalDepreciationRate: true,
				startDate: true,
				termMonths: true,
			},
		});
		for (const plan of financingPlans) {
			if (plan.baseCurrency !== base) continue;
			const cents = toCents(plan.baseAmount) ?? 0;
			const startKey = monthKey(plan.startDate);
			const lastKey = plan.termMonths
				? startKey + plan.termMonths - 1
				: currentKey;
			const months = Math.max(0, Math.min(currentKey, lastKey) - startKey + 1);
			bump(plan.vehicleId, "expensesCents", cents * months);
			if (
				(plan.type === FinancingType.LOAN ||
					plan.type === FinancingType.PURCHASE) &&
				plan.principalAmount &&
				plan.termMonths
			) {
				const converted = await this.conversion.convert(
					plan.principalAmount,
					plan.currency,
				);
				const amortizationCents = Math.round(
					(toCents(converted?.baseAmount ?? null) ?? 0) *
						(plan.fiscalDepreciationRate
							? plan.fiscalDepreciationRate.toNumber() / 100 / 12
							: 1 / (plan.termMonths ?? 1)),
				);
				bump(plan.vehicleId, "expensesCents", amortizationCents * months);
			}
		}

		const vehicleCharges = await this.db.vehicleCharge.findMany({
			select: {
				vehicleId: true,
				baseAmount: true,
				baseCurrency: true,
				frequency: true,
				startDate: true,
				endDate: true,
			},
		});
		for (const charge of vehicleCharges) {
			if (charge.baseCurrency !== base) continue;
			const cents = toCents(charge.baseAmount) ?? 0;
			if (charge.frequency === "ONE_TIME") {
				bump(charge.vehicleId, "expensesCents", cents);
				continue;
			}
			const startKey = monthKey(charge.startDate);
			const endKey = Math.min(currentKey, monthKey(charge.endDate ?? now));
			const months = Math.max(0, endKey - startKey + 1);
			bump(charge.vehicleId, "expensesCents", cents * months);
		}

		const maintenanceRecords = await this.db.maintenanceRecord.findMany({
			where: { completedAt: { not: null }, cost: { not: null } },
			select: { vehicleId: true, cost: true, currency: true },
		});
		for (const record of maintenanceRecords) {
			if (!record.currency) continue;
			const converted = await this.conversion.convert(
				record.cost,
				record.currency,
			);
			if (!converted) continue;
			bump(
				record.vehicleId,
				"expensesCents",
				toCents(converted.baseAmount) ?? 0,
			);
		}

		const incidentRows = await this.db.incident.findMany({
			where: { actualCost: { not: null } },
			select: { vehicleId: true, actualCost: true, currency: true },
		});
		for (const incident of incidentRows) {
			if (!incident.currency) continue;
			const converted = await this.conversion.convert(
				incident.actualCost,
				incident.currency,
			);
			if (!converted) continue;
			bump(
				incident.vehicleId,
				"expensesCents",
				toCents(converted.baseAmount) ?? 0,
			);
		}

		return map;
	}

	private async compute(scope: Scope): Promise<ProfitabilityByVehicle> {
		const base = await this.conversion.reportingCurrency();
		const now = new Date();
		const trendStart = monthStart(now, -(TREND_MONTHS - 1));
		const firstBucket = monthKey(trendStart);
		const yoyKey = monthKey(now) - 12;

		const empty = (): Accumulator => ({
			lifetime: 0,
			buckets: Array.from({ length: TREND_MONTHS }, () => 0),
			yoy: 0,
		});

		const add = (acc: Accumulator, month: Date, cents: number) => {
			acc.lifetime += cents;
			const index = monthKey(month) - firstBucket;
			if (index >= 0 && index < TREND_MONTHS) {
				acc.buckets[index] = (acc.buckets[index] ?? 0) + cents;
			}
			if (monthKey(month) === yoyKey) acc.yoy += cents;
		};

		const revenue = empty();
		const financing = empty();
		const loan = empty();
		const leasing = empty();
		const purchase = empty();
		const amortization = empty();
		const charges = empty();
		const maintenance = empty();
		const incidents = empty();

		const payments = await this.db.payment.findMany({
			where: {
				status: PaymentStatus.COMPLETED,
				type: { notIn: NON_REVENUE_PAYMENT_TYPES },
				...(scope.vehicleId
					? { rentalContract: { vehicleId: scope.vehicleId } }
					: {}),
			},
			select: {
				baseAmount: true,
				baseCurrency: true,
				paidAt: true,
				createdAt: true,
			},
		});
		for (const payment of payments) {
			if (payment.baseCurrency !== base) continue;
			const cents = toCents(payment.baseAmount) ?? 0;
			add(revenue, payment.paidAt ?? payment.createdAt, cents);
		}

		const financingPlans = await this.db.vehicleFinancing.findMany({
			where: scope.vehicleId ? { vehicleId: scope.vehicleId } : {},
			select: {
				baseAmount: true,
				baseCurrency: true,
				principalAmount: true,
				currency: true,
				fiscalDepreciationRate: true,
				startDate: true,
				termMonths: true,
				type: true,
			},
		});
		for (const plan of financingPlans) {
			if (plan.baseCurrency !== base) continue;
			const cents = toCents(plan.baseAmount) ?? 0;
			const lastMonth = plan.termMonths
				? monthKey(plan.startDate) + plan.termMonths - 1
				: monthKey(now);
			const elapsedMonths =
				Math.min(monthKey(now), lastMonth) - monthKey(plan.startDate) + 1;
			const monthsElapsed = Math.max(0, elapsedMonths);
			financing.lifetime += monthsElapsed * cents;
			const byType =
				plan.type === FinancingType.LOAN
					? loan
					: plan.type === FinancingType.PURCHASE
						? purchase
						: leasing;
			byType.lifetime += monthsElapsed * cents;
			let monthlyAmortization = 0;
			if (
				(plan.type === FinancingType.LOAN ||
					plan.type === FinancingType.PURCHASE) &&
				plan.principalAmount &&
				plan.termMonths
			) {
				const converted = await this.conversion.convert(
					plan.principalAmount,
					plan.currency,
				);
				monthlyAmortization = Math.round(
					(toCents(converted?.baseAmount ?? null) ?? 0) *
						(plan.fiscalDepreciationRate
							? plan.fiscalDepreciationRate.toNumber() / 100 / 12
							: 1 / (plan.termMonths ?? 1)),
				);
				amortization.lifetime += monthsElapsed * monthlyAmortization;
				financing.lifetime += monthsElapsed * monthlyAmortization;
				const amortizationType =
					plan.type === FinancingType.LOAN ? loan : purchase;
				amortizationType.lifetime += monthsElapsed * monthlyAmortization;
			}

			for (let index = 0; index < TREND_MONTHS; index++) {
				const bucketKey = firstBucket + index;
				if (bucketKey < monthKey(plan.startDate) || bucketKey > lastMonth) {
					continue;
				}
				financing.buckets[index] = (financing.buckets[index] ?? 0) + cents;
				byType.buckets[index] = (byType.buckets[index] ?? 0) + cents;
				if (monthlyAmortization > 0) {
					financing.buckets[index] =
						(financing.buckets[index] ?? 0) + monthlyAmortization;
					const amortizationType =
						plan.type === FinancingType.LOAN ? loan : purchase;
					amortizationType.buckets[index] =
						(amortizationType.buckets[index] ?? 0) + monthlyAmortization;
					amortization.buckets[index] =
						(amortization.buckets[index] ?? 0) + monthlyAmortization;
				}
			}

			if (yoyKey >= monthKey(plan.startDate) && yoyKey <= lastMonth) {
				financing.yoy += cents;
				byType.yoy += cents;
				if (monthlyAmortization > 0) {
					financing.yoy += monthlyAmortization;
					const amortizationType =
						plan.type === FinancingType.LOAN ? loan : purchase;
					amortizationType.yoy += monthlyAmortization;
					amortization.yoy += monthlyAmortization;
				}
			}
		}

		const vehicleCharges = await this.db.vehicleCharge.findMany({
			where: scope.vehicleId ? { vehicleId: scope.vehicleId } : {},
			select: {
				baseAmount: true,
				baseCurrency: true,
				frequency: true,
				startDate: true,
				endDate: true,
			},
		});
		for (const charge of vehicleCharges) {
			if (charge.baseCurrency !== base) continue;
			const cents = toCents(charge.baseAmount) ?? 0;

			if (charge.frequency === "ONE_TIME") {
				add(charges, charge.startDate, cents);
				continue;
			}

			const lastMonth = monthKey(charge.endDate ?? now);
			const elapsedMonths =
				Math.min(monthKey(now), lastMonth) - monthKey(charge.startDate) + 1;
			charges.lifetime += Math.max(0, elapsedMonths) * cents;

			for (let index = 0; index < TREND_MONTHS; index++) {
				const bucketKey = firstBucket + index;
				if (bucketKey < monthKey(charge.startDate) || bucketKey > lastMonth) {
					continue;
				}
				charges.buckets[index] = (charges.buckets[index] ?? 0) + cents;
			}

			if (yoyKey >= monthKey(charge.startDate) && yoyKey <= lastMonth) {
				charges.yoy += cents;
			}
		}

		const maintenanceRecords = await this.db.maintenanceRecord.findMany({
			where: {
				completedAt: { not: null },
				cost: { not: null },
				...(scope.vehicleId ? { vehicleId: scope.vehicleId } : {}),
			},
			select: { cost: true, currency: true, completedAt: true },
		});
		for (const record of maintenanceRecords) {
			if (!record.completedAt || !record.currency) continue;
			const converted = await this.conversion.convert(
				record.cost,
				record.currency,
			);
			if (!converted) continue;
			add(maintenance, record.completedAt, toCents(converted.baseAmount) ?? 0);
		}

		const incidentRows = await this.db.incident.findMany({
			where: {
				actualCost: { not: null },
				...(scope.vehicleId ? { vehicleId: scope.vehicleId } : {}),
			},
			select: {
				actualCost: true,
				currency: true,
				resolvedAt: true,
				reportedAt: true,
			},
		});
		for (const incident of incidentRows) {
			if (!incident.currency) continue;
			const converted = await this.conversion.convert(
				incident.actualCost,
				incident.currency,
			);
			if (!converted) continue;
			add(
				incidents,
				incident.resolvedAt ?? incident.reportedAt,
				toCents(converted.baseAmount) ?? 0,
			);
		}

		const expensesLifetime =
			financing.lifetime +
			charges.lifetime +
			maintenance.lifetime +
			incidents.lifetime;

		const trend: ProfitabilityBucket[] = Array.from(
			{ length: TREND_MONTHS },
			(_, index) => {
				const revenueCents = revenue.buckets[index] ?? 0;
				const expensesCents =
					(financing.buckets[index] ?? 0) +
					(charges.buckets[index] ?? 0) +
					(maintenance.buckets[index] ?? 0) +
					(incidents.buckets[index] ?? 0);
				return {
					month: MONTH_LABEL.format(monthStart(trendStart, index)),
					revenueCents,
					expensesCents,
					netCents: revenueCents - expensesCents,
				};
			},
		);
		const monthly = trend[trend.length - 1] ?? {
			revenueCents: 0,
			expensesCents: 0,
			netCents: 0,
		};
		const marginPercent = (revenueCents: number, netCents: number) => {
			if (revenueCents > 0) return (netCents / revenueCents) * 100;
			return netCents < 0 ? -100 : 0;
		};
		const costCoveragePercent = (
			revenueCents: number,
			expensesCents: number,
		) => (expensesCents > 0 ? (revenueCents / expensesCents) * 100 : null);

		return {
			reportingCurrency: base,
			lifetime: {
				revenueCents: revenue.lifetime,
				expensesCents: expensesLifetime,
				netCents: revenue.lifetime - expensesLifetime,
				minimumRevenueToBeProfitableCents: expensesLifetime,
			},
			monthly: {
				revenueCents: monthly.revenueCents,
				expensesCents: monthly.expensesCents,
				netCents: monthly.netCents,
				minimumRevenueToBeProfitableCents: monthly.expensesCents,
				marginPercent: marginPercent(monthly.revenueCents, monthly.netCents),
				costCoveragePercent: costCoveragePercent(
					monthly.revenueCents,
					monthly.expensesCents,
				),
			},
			marginPercent: marginPercent(
				revenue.lifetime,
				revenue.lifetime - expensesLifetime,
			),
			costCoveragePercent: costCoveragePercent(
				revenue.lifetime,
				expensesLifetime,
			),
			totalReportedCents: revenue.lifetime,
			trend,
			previousYearMonth: {
				revenueCents: revenue.yoy,
				expensesCents:
					financing.yoy + charges.yoy + maintenance.yoy + incidents.yoy,
				netCents:
					revenue.yoy -
					(financing.yoy + charges.yoy + maintenance.yoy + incidents.yoy),
			},
			expenseBreakdown: {
				financingCents: financing.lifetime,
				loanCents: loan.lifetime,
				leasingCents: leasing.lifetime,
				purchaseCents: purchase.lifetime,
				amortizationCents: amortization.lifetime,
				chargesCents: charges.lifetime,
				maintenanceCents: maintenance.lifetime,
				incidentsCents: incidents.lifetime,
			},
		};
	}
}
