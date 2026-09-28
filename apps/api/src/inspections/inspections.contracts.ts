import { FuelLevel, InspectionType } from "@crm/db";
import { z } from "zod";

const typeEnum = z.enum(
	Object.values(InspectionType) as [InspectionType, ...InspectionType[]],
);

const fuelLevelEnum = z.enum(
	Object.values(FuelLevel) as [FuelLevel, ...FuelLevel[]],
);

export const inspectionsByContractInput = z.object({
	rentalContractId: z.string(),
});

export const inspectionCreateInput = z.object({
	rentalContractId: z
		.string()
		.min(1, "An inspection belongs to a rental contract."),
	type: typeEnum,
	odometer: z.number().int().min(0),
	fuelLevel: fuelLevelEnum,
	damageNotes: z.string().trim().nullable().optional(),
	inspectedAt: z.string().nullable().optional(),
});

export type InspectionCreateInput = z.infer<typeof inspectionCreateInput>;

export const inspectionIdInput = z.object({ id: z.string() });
