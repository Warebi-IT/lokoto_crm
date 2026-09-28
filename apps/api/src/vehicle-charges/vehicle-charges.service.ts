import { type Db, Prisma as PrismaNamespace } from "@crm/db";
import { normalizeCurrency } from "@crm/db/currency";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { decimalFromCents, fromCents, parseDate, toCents } from "../crm/values";
import { ConversionService } from "../currency/conversion.service";
import { InjectDatabase } from "../database/database.constants";
import type { VehicleChargeCreateInput } from "./vehicle-charges.contracts";

@Injectable()
export class VehicleChargesService {
	private readonly logger = new Logger(VehicleChargesService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly conversion: ConversionService,
	) {}

	async listByVehicle(vehicleId: string) {
		const rows = await this.db.vehicleCharge.findMany({
			where: { vehicleId },
			orderBy: { startDate: "desc" },
			select: {
				id: true,
				label: true,
				amount: true,
				currency: true,
				baseAmount: true,
				frequency: true,
				startDate: true,
				endDate: true,
				createdAt: true,
			},
		});

		return rows.map(
			({ amount, baseAmount, startDate, endDate, createdAt, ...row }) => ({
				...row,
				amountCents: toCents(amount),
				baseAmountCents: toCents(baseAmount),
				startDate: startDate.toISOString(),
				endDate: endDate?.toISOString() ?? null,
				createdAt: createdAt.toISOString(),
			}),
		);
	}

	async create(input: VehicleChargeCreateInput) {
		const currency = normalizeCurrency(
			input.currency ?? (await this.conversion.reportingCurrency()),
		);
		const fx = await this.conversion.convertFields(
			decimalFromCents(input.amountCents),
			currency,
		);

		const charge = await this.db.vehicleCharge.create({
			data: {
				vehicleId: input.vehicleId,
				label: input.label.trim(),
				amount: fromCents(input.amountCents) ?? 0,
				currency,
				...fx,
				frequency: input.frequency,
				startDate: parseDate(input.startDate) ?? new Date(),
				endDate: parseDate(input.endDate),
			},
			select: { id: true, vehicleId: true, label: true },
		});

		this.logger.log({
			message: "Vehicle charge recorded",
			chargeId: charge.id,
			vehicleId: charge.vehicleId,
		});

		return charge;
	}

	async delete(id: string): Promise<{ id: string }> {
		try {
			await this.db.vehicleCharge.delete({ where: { id } });
		} catch (error) {
			throw this.translate(error, id);
		}

		return { id };
	}

	private translate(error: unknown, id: string): unknown {
		if (
			error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
			error.code === "P2025"
		) {
			return new NotFoundException(`No vehicle charge with id ${id}.`);
		}
		return error;
	}
}
