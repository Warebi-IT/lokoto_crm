import {
	ActivityType,
	type Db,
	PaymentStatus,
	RentalContractStatus,
	VehicleStatus,
} from "@crm/db";
import { Injectable } from "@nestjs/common";
import { toCents } from "../crm/values";
import { ConversionService } from "../currency/conversion.service";
import { InjectDatabase } from "../database/database.constants";
import type { DashboardSummaryInput } from "./dashboard.contracts";
import { MONTH_LABEL, monthKey, monthStart } from "./month-bucket";

const OWNER_SELECT = {
	id: true,
	name: true,
	email: true,
	image: true,
} as const;

const OPEN_STATUSES = [
	RentalContractStatus.DRAFT,
	RentalContractStatus.RESERVED,
	RentalContractStatus.ACTIVE,
] as const;

const TREND_MONTHS = 6;

const RATE_WINDOW_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class DashboardService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly conversion: ConversionService,
	) {}

	async summary(actingUserId: string, input: DashboardSummaryInput) {
		const mine = input.scope === "me";
		const owned = mine ? { ownerId: actingUserId } : {};

		const now = new Date();
		const startOfMonth = monthStart(now, 0);
		const startOfNextMonth = monthStart(now, 1);
		const startOfPrevMonth = monthStart(now, -1);
		const startOfToday = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate(),
		);
		const startOfTomorrow = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate() + 1,
		);
		const trendStart = monthStart(now, -(TREND_MONTHS - 1));
		const rateStart = new Date(now.getTime() - RATE_WINDOW_DAYS * DAY_MS);

		const base = await this.conversion.reportingCurrency();
		const counted = this.conversion.countedWhere(base);

		const [
			openByStatus,
			openValueByStatus,
			recentContracts,
			vehiclesRentedToday,
			rentalsInProgress,
			returnsDueToday,
			valueInProgressToday,
			paymentsToday,
			availableVehicles,
			dueBackThisMonth,
			topActiveContracts,
			overdueTasks,
			recentActivity,
			unconverted,
		] = await Promise.all([
			this.db.rentalContract.groupBy({
				by: ["status"],
				where: { ...owned, status: { in: [...OPEN_STATUSES] } },
				_count: { _all: true },
			}),
			this.db.rentalContract.groupBy({
				by: ["status"],
				where: {
					AND: [{ ...owned, status: { in: [...OPEN_STATUSES] } }, counted],
				},
				_sum: { baseAmount: true },
			}),
			this.db.rentalContract.findMany({
				where: {
					...owned,
					OR: [
						{ createdAt: { gte: trendStart } },
						{ actualReturnAt: { gte: trendStart } },
						{ cancelledAt: { gte: trendStart } },
					],
				},
				select: {
					baseAmount: true,
					baseCurrency: true,
					status: true,
					createdAt: true,
					actualReturnAt: true,
					cancelledAt: true,
				},
			}),
			this.db.rentalContract.groupBy({
				by: ["vehicleId"],
				where: {
					...owned,
					status: {
						in: [RentalContractStatus.RESERVED, RentalContractStatus.ACTIVE],
					},
					startDate: { lt: startOfTomorrow },
					endDate: { gte: startOfToday },
				},
			}),
			this.db.rentalContract.count({
				where: {
					...owned,
					status: RentalContractStatus.ACTIVE,
				},
			}),
			this.db.rentalContract.count({
				where: {
					...owned,
					status: {
						in: [RentalContractStatus.RESERVED, RentalContractStatus.ACTIVE],
					},
					endDate: { gte: startOfToday, lt: startOfTomorrow },
				},
			}),
			this.db.rentalContract.aggregate({
				where: {
					AND: [
						{
							...owned,
							status: {
								in: [
									RentalContractStatus.RESERVED,
									RentalContractStatus.ACTIVE,
								],
							},
							startDate: { lt: startOfTomorrow },
							endDate: { gte: startOfToday },
						},
						counted,
					],
				},
				_sum: { baseAmount: true },
			}),
			this.db.payment.aggregate({
				where: {
					AND: [
						{
							status: PaymentStatus.COMPLETED,
							paidAt: { gte: startOfToday, lt: startOfTomorrow },
							...(mine ? { rentalContract: { ownerId: actingUserId } } : {}),
						},
						counted,
					],
				},
				_sum: { baseAmount: true },
			}),
			this.db.vehicle.count({
				where: { status: VehicleStatus.AVAILABLE },
			}),
			this.db.rentalContract.aggregate({
				where: {
					AND: [
						{
							...owned,
							status: {
								in: [
									RentalContractStatus.RESERVED,
									RentalContractStatus.ACTIVE,
								],
							},
							endDate: { gte: startOfMonth, lt: startOfNextMonth },
						},
						counted,
					],
				},
				_count: { _all: true },
				_sum: { baseAmount: true },
			}),
			this.db.rentalContract.findMany({
				where: {
					...owned,
					status: {
						in: [RentalContractStatus.RESERVED, RentalContractStatus.ACTIVE],
					},
				},
				orderBy: [
					{ baseAmount: { sort: "desc", nulls: "last" } },
					{ endDate: "asc" },
				],
				take: 6,
				select: {
					id: true,
					status: true,
					totalAmount: true,
					currency: true,
					baseAmount: true,
					baseCurrency: true,
					startDate: true,
					endDate: true,
					vehicle: {
						select: { id: true, plateNumber: true, make: true, model: true },
					},
					contact: { select: { id: true, firstName: true, lastName: true } },
					owner: { select: OWNER_SELECT },
				},
			}),
			this.db.activity.findMany({
				where: {
					type: ActivityType.TASK,
					completedAt: null,
					dueAt: { lt: now },
					createdById: actingUserId,
				},
				orderBy: [{ dueAt: "asc" }],
				take: 10,
				select: {
					id: true,
					subject: true,
					dueAt: true,
					rentalContract: {
						select: {
							id: true,
							vehicle: { select: { plateNumber: true } },
						},
					},
				},
			}),
			this.db.activity.findMany({
				where: mine ? { createdById: actingUserId } : {},
				orderBy: [{ createdAt: "desc" }],
				take: 12,
				select: {
					id: true,
					type: true,
					subject: true,
					body: true,
					createdAt: true,
					meta: true,
					createdBy: { select: OWNER_SELECT },
					rentalContract: {
						select: {
							id: true,
							vehicle: { select: { plateNumber: true } },
						},
					},
				},
			}),
			this.conversion.unconverted("rentalContract", owned),
		]);

		const statuses = OPEN_STATUSES.map((status) => {
			const group = openByStatus.find((row) => row.status === status);
			const value = openValueByStatus.find((row) => row.status === status);
			return {
				status,
				count: group?._count._all ?? 0,
				valueCents: toCents(value?._sum.baseAmount ?? null) ?? 0,
			};
		});

		const firstBucket = monthKey(trendStart);
		const trend = Array.from({ length: TREND_MONTHS }, (_, index) => ({
			month: MONTH_LABEL.format(monthStart(trendStart, index)),
			completed: 0,
			created: 0,
		}));

		const completedThisMonth = { count: 0, valueCents: 0 };
		const completedPrevMonth = { count: 0, valueCents: 0 };
		let completedCount = 0;
		let cancelledCount = 0;
		let valuedCompletions = 0;
		let completedCents = 0;
		let durationDays = 0;

		for (const contract of recentContracts) {
			const valued =
				contract.baseCurrency === base ? toCents(contract.baseAmount) : null;
			const cents = valued ?? 0;

			const created = trend[monthKey(contract.createdAt) - firstBucket];
			if (created) created.created += cents;

			const closedAt = contract.actualReturnAt ?? contract.cancelledAt;
			if (!closedAt) continue;
			const completed = contract.status === RentalContractStatus.COMPLETED;

			if (completed) {
				const closed = trend[monthKey(closedAt) - firstBucket];
				if (closed) closed.completed += cents;

				if (closedAt >= startOfMonth && closedAt < startOfNextMonth) {
					completedThisMonth.count += 1;
					completedThisMonth.valueCents += cents;
				} else if (closedAt >= startOfPrevMonth && closedAt < startOfMonth) {
					completedPrevMonth.count += 1;
					completedPrevMonth.valueCents += cents;
				}
			}

			if (closedAt < rateStart) continue;
			if (completed) {
				completedCount += 1;
				if (valued !== null) {
					valuedCompletions += 1;
					completedCents += cents;
				}
				durationDays +=
					(closedAt.getTime() - contract.createdAt.getTime()) / DAY_MS;
			} else if (contract.status === RentalContractStatus.CANCELLED) {
				cancelledCount += 1;
			}
		}

		const decided = completedCount + cancelledCount;

		return {
			scope: input.scope,
			reportingCurrency: base,
			unconverted,
			fleet: {
				statuses,
				totalCents: statuses.reduce((total, s) => total + s.valueCents, 0),
				totalContracts: statuses.reduce((total, s) => total + s.count, 0),
			},
			today: {
				vehiclesRented: vehiclesRentedToday.length,
				rentalsInProgress,
				returnsDue: returnsDueToday,
				valueInProgressCents:
					toCents(valueInProgressToday._sum.baseAmount) ?? 0,
				paymentsCents: toCents(paymentsToday._sum.baseAmount) ?? 0,
				availableVehicles,
			},
			completedThisMonth,
			completedPrevMonth,
			performance: {
				windowDays: RATE_WINDOW_DAYS,
				completedCount,
				cancelledCount,
				completionRate: decided === 0 ? null : completedCount / decided,
				avgContractCents:
					valuedCompletions === 0
						? null
						: Math.round(completedCents / valuedCompletions),
				avgDurationDays:
					completedCount === 0
						? null
						: Math.round(durationDays / completedCount),
			},
			trend,
			dueBackThisMonth: {
				count: dueBackThisMonth._count._all,
				valueCents: toCents(dueBackThisMonth._sum.baseAmount) ?? 0,
			},
			topActiveContracts: topActiveContracts
				.map(
					({
						totalAmount,
						baseAmount,
						baseCurrency,
						startDate,
						endDate,
						...contract
					}) => ({
						...contract,
						totalAmountCents: toCents(totalAmount),
						baseAmountCents: baseCurrency === base ? toCents(baseAmount) : null,
						startDate: startDate.toISOString(),
						endDate: endDate.toISOString(),
					}),
				)
				.sort((a, b) => (b.baseAmountCents ?? -1) - (a.baseAmountCents ?? -1)),
			overdueTasks: overdueTasks.map(({ dueAt, ...task }) => ({
				...task,
				dueAt: dueAt?.toISOString() ?? null,
			})),
			recentActivity: recentActivity.map(({ createdAt, meta, ...entry }) => ({
				...entry,
				createdAt: createdAt.toISOString(),
				meta: meta as Record<string, unknown> | null,
			})),
		};
	}
}
