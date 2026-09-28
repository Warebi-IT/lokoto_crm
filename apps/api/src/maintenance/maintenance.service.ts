import {
	type Db,
	type MaintenanceRecordModel,
	Prisma as PrismaNamespace,
} from "@crm/db";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { decimalFromCents, parseDate, toCents } from "../crm/values";
import { InjectDatabase } from "../database/database.constants";
import type {
	MaintenanceCreateInput,
	MaintenanceUpdateInput,
} from "./maintenance.contracts";

function serialize({
	cost,
	scheduledAtDate,
	completedAt,
	createdAt,
	...rest
}: MaintenanceRecordModel) {
	return {
		...rest,
		costCents: toCents(cost),
		scheduledAtDate: scheduledAtDate?.toISOString() ?? null,
		completedAt: completedAt?.toISOString() ?? null,
		createdAt: createdAt.toISOString(),
	};
}

@Injectable()
export class MaintenanceService {
	private readonly logger = new Logger(MaintenanceService.name);

	constructor(@InjectDatabase() private readonly db: Db) {}

	async listByVehicle(vehicleId: string) {
		const rows = await this.db.maintenanceRecord.findMany({
			where: { vehicleId },
			orderBy: [{ completedAt: "desc" }, { scheduledAtDate: "asc" }],
		});
		return rows.map(serialize);
	}

	async create(input: MaintenanceCreateInput) {
		try {
			const record = await this.db.maintenanceRecord.create({
				data: {
					vehicleId: input.vehicleId,
					type: input.type,
					description: input.description.trim(),
					scheduledAtKm: input.scheduledAtKm ?? null,
					scheduledAtDate: parseDate(input.scheduledAtDate),
					odometerAtService: input.odometerAtService ?? null,
					mechanic: input.mechanic ?? null,
					cost: decimalFromCents(input.costCents),
					currency: input.currency ?? null,
					invoiceReference: input.invoiceReference ?? null,
					blocksAvailability: input.blocksAvailability ?? false,
				},
				select: { id: true, vehicleId: true },
			});

			this.logger.log({
				message: "Maintenance record created",
				maintenanceRecordId: record.id,
				vehicleId: record.vehicleId,
			});

			return record;
		} catch (error) {
			throw this.translate(error, input.vehicleId);
		}
	}

	async update(id: string, input: MaintenanceUpdateInput) {
		try {
			return await this.db.maintenanceRecord.update({
				where: { id },
				data: {
					description: input.description,
					scheduledAtKm: input.scheduledAtKm,
					scheduledAtDate:
						input.scheduledAtDate === undefined
							? undefined
							: parseDate(input.scheduledAtDate),
					completedAt:
						input.completedAt === undefined
							? undefined
							: parseDate(input.completedAt),
					odometerAtService: input.odometerAtService,
					mechanic: input.mechanic,
					cost:
						input.costCents === undefined
							? undefined
							: decimalFromCents(input.costCents),
					invoiceReference: input.invoiceReference,
					blocksAvailability: input.blocksAvailability,
				},
				select: { id: true },
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async delete(id: string): Promise<{ id: string }> {
		try {
			await this.db.maintenanceRecord.delete({ where: { id } });
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
			return new NotFoundException(`No maintenance record with id ${id}.`);
		}
		return error;
	}
}
