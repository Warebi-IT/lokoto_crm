import {
	type Db,
	FuelType,
	type Prisma,
	Prisma as PrismaNamespace,
	RentalContractStatus,
	type VehicleStatus,
	VehicleStatus as VehicleStatusEnum,
} from "@crm/db";
import { normalizeCurrency } from "@crm/db/currency";
import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import {
	ActivityStampService,
	type StampTargets,
} from "../crm/activity-stamp.service";
import { type BulkResult, runBulk } from "../crm/bulk";
import { decimalFromCents, fromCents, parseDate, toCents } from "../crm/values";
import { ConversionService } from "../currency/conversion.service";
import { InjectDatabase } from "../database/database.constants";
import { FieldsService } from "../fields/fields.service";
import {
	countsByKey,
	FACET_ALL,
	type ListResult,
	paginate,
	resolveOrderBy,
} from "../trpc/list-input";
import type {
	VehicleAvailabilityInput,
	VehicleBulkStatusInput,
	VehicleCreateInput,
	VehicleListInput,
	VehicleSetFinancingInput,
	VehicleUpdateInput,
} from "./vehicles.contracts";

const SORTABLE: Record<
	string,
	(dir: Prisma.SortOrder) => Prisma.VehicleOrderByWithRelationInput[]
> = {
	plateNumber: (dir) => [{ plateNumber: dir }],
	make: (dir) => [{ make: dir }, { model: "asc" }],
	status: (dir) => [{ status: dir }],
	type: (dir) => [{ type: dir }],
	dailyRate: (dir) => [{ baseAmount: { sort: dir, nulls: "last" } }],
	mileage: (dir) => [{ mileage: dir }],
	createdAt: (dir) => [{ createdAt: dir }],
	lastActivity: (dir) => [{ lastActivityAt: { sort: dir, nulls: "last" } }],
};

@Injectable()
export class VehiclesService {
	private readonly logger = new Logger(VehiclesService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly stamp: ActivityStampService,
		private readonly conversion: ConversionService,
		private readonly fields: FieldsService,
	) {}

	async list(input: VehicleListInput) {
		const where = this.buildWhere(input);
		const { skip, take } = paginate(input);
		const base = await this.conversion.reportingCurrency();

		const [rows, total, facetCounts, unconverted] = await Promise.all([
			this.db.vehicle.findMany({
				where,
				skip,
				take,
				orderBy: resolveOrderBy(input, SORTABLE, [{ createdAt: "desc" }]),
				select: {
					id: true,
					type: true,
					fuelType: true,
					make: true,
					model: true,
					year: true,
					plateNumber: true,
					status: true,
					dailyRate: true,
					currency: true,
					baseAmount: true,
					mileage: true,
					lastActivityAt: true,
					createdAt: true,
				},
			}),
			this.db.vehicle.count({ where }),
			this.facetCounts(input),
			this.conversion.unconverted("vehicle", where),
		]);

		const tableFields = await this.fields.tableValuesFor(
			"VEHICLE",
			rows.map((row) => row.id),
		);

		return {
			rows: rows.map(
				({ dailyRate, baseAmount, lastActivityAt, createdAt, ...row }) => ({
					...row,
					dailyRateCents: toCents(dailyRate),
					baseAmountCents: toCents(baseAmount),
					lastActivityAt: lastActivityAt?.toISOString() ?? null,
					createdAt: createdAt.toISOString(),
					fields: tableFields.get(row.id) ?? {},
				}),
			),
			total,
			facetCounts,
			reportingCurrency: base,
			unconverted,
		} satisfies ListResult<unknown> & {
			reportingCurrency: string;
			unconverted: { count: number; currencies: string[] };
		};
	}

	async byId(id: string) {
		const vehicle = await this.db.vehicle.findUnique({
			where: { id },
			select: {
				id: true,
				type: true,
				fuelType: true,
				make: true,
				model: true,
				year: true,
				plateNumber: true,
				vin: true,
				color: true,
				status: true,
				dailyRate: true,
				currency: true,
				baseAmount: true,
				fxRate: true,
				fxRateAt: true,
				mileage: true,
				insurancePolicyNumber: true,
				insuranceExpiresAt: true,
				registrationExpiresAt: true,
				nextMaintenanceAtKm: true,
				nextMaintenanceAtDate: true,
				photoUrls: true,
				createdAt: true,
				financing: {
					select: {
						type: true,
						principalAmount: true,
						monthlyPayment: true,
						currency: true,
						baseAmount: true,
						interestRate: true,
						termMonths: true,
						startDate: true,
					},
				},
				mileageHistory: {
					orderBy: { recordedAt: "asc" },
					select: {
						id: true,
						mileage: true,
						recordedAt: true,
						contractId: true,
					},
				},
			},
		});

		if (!vehicle) {
			throw new NotFoundException(`No vehicle with id ${id}.`);
		}

		const {
			dailyRate,
			baseAmount,
			fxRate,
			fxRateAt,
			financing,
			mileageHistory,
			...rest
		} = vehicle;

		return {
			...rest,
			fields: await this.fields.valuesFor("VEHICLE", id),
			dailyRateCents: toCents(dailyRate),
			baseAmountCents: toCents(baseAmount),
			reportingCurrency: await this.conversion.reportingCurrency(),
			fxRate: fxRate?.toNumber() ?? null,
			fxRateAt: fxRateAt?.toISOString() ?? null,
			insuranceExpiresAt: vehicle.insuranceExpiresAt?.toISOString() ?? null,
			registrationExpiresAt:
				vehicle.registrationExpiresAt?.toISOString() ?? null,
			nextMaintenanceAtDate:
				vehicle.nextMaintenanceAtDate?.toISOString() ?? null,
			createdAt: vehicle.createdAt.toISOString(),
			mileageHistory: mileageHistory.map((entry) => ({
				...entry,
				recordedAt: entry.recordedAt.toISOString(),
			})),
			financing: financing
				? {
						type: financing.type,
						principalAmountCents: toCents(financing.principalAmount),
						monthlyPaymentCents: toCents(financing.monthlyPayment),
						currency: financing.currency,
						baseAmountCents: toCents(financing.baseAmount),
						interestRate: financing.interestRate?.toNumber() ?? null,
						termMonths: financing.termMonths,
						startDate: financing.startDate.toISOString(),
					}
				: null,
		};
	}

	async availability(input: VehicleAvailabilityInput) {
		const startDate = parseDate(input.startDate);
		const endDate = parseDate(input.endDate);
		if (!startDate || !endDate || endDate <= startDate) {
			throw new BadRequestException("Return date must be after pickup date.");
		}

		const rows = await this.db.vehicle.findMany({
			where: {
				status: {
					notIn: [
						VehicleStatusEnum.MAINTENANCE,
						VehicleStatusEnum.OUT_OF_SERVICE,
						VehicleStatusEnum.STOLEN,
					],
				},
				rentalContracts: {
					none: {
						status: {
							in: [
								RentalContractStatus.DRAFT,
								RentalContractStatus.RESERVED,
								RentalContractStatus.ACTIVE,
							],
						},
						startDate: { lt: endDate },
						endDate: { gt: startDate },
					},
				},
			},
			orderBy: [{ make: "asc" }, { model: "asc" }, { plateNumber: "asc" }],
			select: {
				id: true,
				make: true,
				model: true,
				fuelType: true,
				year: true,
				plateNumber: true,
				status: true,
				dailyRate: true,
				currency: true,
			},
		});

		return {
			startDate: startDate.toISOString(),
			endDate: endDate.toISOString(),
			rows: rows.map(({ dailyRate, ...vehicle }) => ({
				...vehicle,
				dailyRateCents: toCents(dailyRate),
			})),
		};
	}

	async create(input: VehicleCreateInput) {
		const currency = normalizeCurrency(
			input.currency ?? (await this.conversion.reportingCurrency()),
		);
		const fx = await this.conversion.convertFields(
			decimalFromCents(input.dailyRateCents),
			currency,
		);

		try {
			const vehicle = await this.db.vehicle.create({
				data: {
					type: input.type,
					fuelType: input.fuelType ?? FuelType.GASOLINE,
					make: input.make.trim(),
					model: input.model.trim(),
					year: input.year ?? null,
					plateNumber: input.plateNumber.trim(),
					vin: input.vin ?? null,
					color: input.color ?? null,
					dailyRate: fromCents(input.dailyRateCents),
					currency,
					...fx,
					mileage: input.mileage ?? 0,
					insurancePolicyNumber: input.insurancePolicyNumber ?? null,
					insuranceExpiresAt: parseDate(input.insuranceExpiresAt),
					registrationExpiresAt: parseDate(input.registrationExpiresAt),
					nextMaintenanceAtKm: input.nextMaintenanceAtKm ?? null,
					nextMaintenanceAtDate: parseDate(input.nextMaintenanceAtDate),
				},
				select: { id: true, plateNumber: true, make: true, model: true },
			});

			this.logger.log({
				message: "Vehicle created",
				vehicleId: vehicle.id,
				plateNumber: vehicle.plateNumber,
			});

			return vehicle;
		} catch (error) {
			throw this.translateRelations(error);
		}
	}

	async update(id: string, input: VehicleUpdateInput) {
		const data: Prisma.VehicleUpdateInput = {};

		if (input.type !== undefined) data.type = input.type;
		if (input.fuelType !== undefined) data.fuelType = input.fuelType;
		if (input.make !== undefined) data.make = input.make.trim();
		if (input.model !== undefined) data.model = input.model.trim();
		if (input.year !== undefined) data.year = input.year;
		if (input.plateNumber !== undefined) {
			data.plateNumber = input.plateNumber.trim();
		}
		if (input.vin !== undefined) data.vin = input.vin;
		if (input.color !== undefined) data.color = input.color;
		if (input.status !== undefined) data.status = input.status;
		if (input.mileage !== undefined) data.mileage = input.mileage;
		if (input.insurancePolicyNumber !== undefined) {
			data.insurancePolicyNumber = input.insurancePolicyNumber;
		}
		if (input.insuranceExpiresAt !== undefined) {
			data.insuranceExpiresAt = parseDate(input.insuranceExpiresAt);
		}
		if (input.registrationExpiresAt !== undefined) {
			data.registrationExpiresAt = parseDate(input.registrationExpiresAt);
		}
		if (input.nextMaintenanceAtKm !== undefined) {
			data.nextMaintenanceAtKm = input.nextMaintenanceAtKm;
		}
		if (input.nextMaintenanceAtDate !== undefined) {
			data.nextMaintenanceAtDate = parseDate(input.nextMaintenanceAtDate);
		}
		if (input.dailyRateCents !== undefined) {
			data.dailyRate = fromCents(input.dailyRateCents);
		}
		if (input.currency !== undefined) {
			data.currency = normalizeCurrency(input.currency);
		}

		if (input.dailyRateCents !== undefined || input.currency !== undefined) {
			const current = await this.db.vehicle.findUnique({
				where: { id },
				select: { dailyRate: true, currency: true },
			});

			if (!current) {
				throw new NotFoundException(`No vehicle with id ${id}.`);
			}

			const dailyRate =
				input.dailyRateCents !== undefined
					? decimalFromCents(input.dailyRateCents)
					: current.dailyRate;
			const currency =
				input.currency !== undefined
					? normalizeCurrency(input.currency)
					: normalizeCurrency(current.currency);

			Object.assign(
				data,
				await this.conversion.convertFields(dailyRate, currency),
			);
		}

		try {
			return await this.db.$transaction(async (tx) => {
				if (input.fields) {
					await this.fields.applyValues(tx, "VEHICLE", id, input.fields);
				}

				return tx.vehicle.update({
					where: { id },
					data,
					select: { id: true, plateNumber: true },
				});
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async delete(id: string): Promise<{ id: string; plateNumber: string }> {
		let deleted: { targets: StampTargets; plateNumber: string };

		try {
			deleted = await this.db.$transaction(async (tx) => {
				const targets = await this.stamp.targetsOf({ vehicleId: id }, tx);

				const vehicle = await tx.vehicle.delete({
					where: { id },
					select: { plateNumber: true },
				});

				return { targets, plateNumber: vehicle.plateNumber };
			});
		} catch (error) {
			throw this.translate(error, id);
		}

		await this.stamp.recomputeAfterDelete(deleted.targets, { vehicleId: id });

		this.logger.log({
			message: "Vehicle deleted",
			vehicleId: id,
			plateNumber: deleted.plateNumber,
		});

		return { id, plateNumber: deleted.plateNumber };
	}

	async bulkSetStatus(input: VehicleBulkStatusInput): Promise<BulkResult> {
		return runBulk(input.ids, (id) =>
			this.db.vehicle.update({ where: { id }, data: { status: input.status } }),
		);
	}

	async bulkDelete(ids: string[]): Promise<BulkResult> {
		return runBulk(ids, (id) => this.delete(id));
	}

	async setFinancing(input: VehicleSetFinancingInput) {
		const currency = normalizeCurrency(
			input.currency ?? (await this.conversion.reportingCurrency()),
		);
		const fx = await this.conversion.convertFields(
			decimalFromCents(input.monthlyPaymentCents),
			currency,
		);
		const fields = {
			type: input.type,
			principalAmount: decimalFromCents(input.principalAmountCents),
			monthlyPayment: fromCents(input.monthlyPaymentCents) ?? 0,
			currency,
			...fx,
			interestRate: input.interestRate ?? null,
			termMonths: input.termMonths ?? null,
			startDate: parseDate(input.startDate) ?? new Date(),
		};

		try {
			await this.db.vehicleFinancing.upsert({
				where: { vehicleId: input.vehicleId },
				create: { vehicleId: input.vehicleId, ...fields },
				update: fields,
			});
		} catch (error) {
			throw this.translate(error, input.vehicleId);
		}

		this.logger.log({
			message: "Vehicle financing set",
			vehicleId: input.vehicleId,
			type: input.type,
		});

		return { vehicleId: input.vehicleId };
	}

	async clearFinancing(vehicleId: string): Promise<{ vehicleId: string }> {
		await this.db.vehicleFinancing.deleteMany({ where: { vehicleId } });
		return { vehicleId };
	}

	private searchFilter(q: string): Prisma.VehicleWhereInput {
		const term = q.trim();
		if (!term) return {};

		return {
			OR: [
				{ plateNumber: { contains: term, mode: "insensitive" } },
				{ make: { contains: term, mode: "insensitive" } },
				{ model: { contains: term, mode: "insensitive" } },
			],
		};
	}

	private buildWhere(input: VehicleListInput): Prisma.VehicleWhereInput {
		const where: Prisma.VehicleWhereInput = this.searchFilter(input.q);

		if (input.status !== FACET_ALL) {
			where.status = input.status as VehicleStatus;
		}

		if (input.type !== FACET_ALL) {
			where.type = input.type as Prisma.EnumVehicleTypeFilter["equals"];
		}

		return where;
	}

	private async facetCounts(input: VehicleListInput) {
		const where = this.searchFilter(input.q);

		const [statuses, types] = await Promise.all([
			this.db.vehicle.groupBy({
				by: ["status"],
				where,
				_count: { _all: true },
			}),
			this.db.vehicle.groupBy({ by: ["type"], where, _count: { _all: true } }),
		]);

		return {
			status: countsByKey(statuses, "status"),
			type: countsByKey(types, "type"),
		};
	}

	private translate(error: unknown, id: string): unknown {
		if (
			error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
			error.code === "P2025"
		) {
			return new NotFoundException(`No vehicle with id ${id}.`);
		}
		return this.translateRelations(error);
	}

	private translateRelations(error: unknown): unknown {
		if (
			error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
			error.code === "P2002"
		) {
			return new BadRequestException(
				"A vehicle with that plate number already exists.",
			);
		}
		if (
			error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
			(error.code === "P2003" || error.code === "P2025")
		) {
			return new BadRequestException(
				"That vehicle relation is no longer valid.",
			);
		}
		return error;
	}
}
