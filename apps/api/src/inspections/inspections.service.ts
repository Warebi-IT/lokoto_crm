import { type Db, InspectionType, Prisma as PrismaNamespace } from "@crm/db";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { RentalContractsService } from "../rental-contracts/rental-contracts.service";
import type { InspectionCreateInput } from "./inspections.contracts";

const INSPECTED_BY_SELECT = {
	id: true,
	name: true,
	email: true,
	image: true,
} as const;

@Injectable()
export class InspectionsService {
	private readonly logger = new Logger(InspectionsService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly rentalContracts: RentalContractsService,
	) {}

	async listByContract(rentalContractId: string) {
		const rows = await this.db.vehicleInspection.findMany({
			where: { rentalContractId },
			orderBy: { inspectedAt: "asc" },
			select: {
				id: true,
				type: true,
				odometer: true,
				fuelLevel: true,
				damageNotes: true,
				photoUrls: true,
				inspectedBy: { select: INSPECTED_BY_SELECT },
				inspectedAt: true,
				createdAt: true,
			},
		});

		return rows.map(({ inspectedAt, createdAt, ...row }) => ({
			...row,
			inspectedAt: inspectedAt.toISOString(),
			createdAt: createdAt.toISOString(),
		}));
	}

	async create(input: InspectionCreateInput, inspectedById: string) {
		const inspectedAt = input.inspectedAt
			? new Date(input.inspectedAt)
			: new Date();

		let inspection: { id: string; rentalContractId: string };

		try {
			inspection = await this.db.vehicleInspection.create({
				data: {
					rentalContractId: input.rentalContractId,
					type: input.type,
					odometer: input.odometer,
					fuelLevel: input.fuelLevel,
					damageNotes: input.damageNotes ?? null,
					inspectedById,
					inspectedAt,
				},
				select: { id: true, rentalContractId: true },
			});
		} catch (error) {
			throw this.translate(error, input.rentalContractId);
		}

		if (input.type === InspectionType.CHECK_OUT) {
			await this.rentalContracts.recordPickup({
				id: input.rentalContractId,
				mileageAtPickup: input.odometer,
				fuelLevelAtPickup: input.fuelLevel,
				actualPickupAt: input.inspectedAt ?? null,
			});
		} else {
			await this.rentalContracts.recordReturn({
				id: input.rentalContractId,
				mileageAtReturn: input.odometer,
				fuelLevelAtReturn: input.fuelLevel,
				actualReturnAt: input.inspectedAt ?? null,
			});
		}

		this.logger.log({
			message: "Vehicle inspection recorded",
			inspectionId: inspection.id,
			rentalContractId: inspection.rentalContractId,
			type: input.type,
		});

		return inspection;
	}

	async delete(id: string): Promise<{ id: string }> {
		try {
			await this.db.vehicleInspection.delete({ where: { id } });
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
			return new NotFoundException(`No inspection with id ${id}.`);
		}
		return error;
	}
}
