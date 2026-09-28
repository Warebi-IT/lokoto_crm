import { MaintenanceType } from "@crm/db";
import { z } from "zod";
import { optionalAmountCents } from "../currency/currency.contracts";

const typeEnum = z.enum(
	Object.values(MaintenanceType) as [MaintenanceType, ...MaintenanceType[]],
);

export const maintenanceByVehicleInput = z.object({ vehicleId: z.string() });

export const maintenanceCreateInput = z.object({
	vehicleId: z.string().min(1, "A maintenance record belongs to a vehicle."),
	type: typeEnum,
	description: z.string().trim().min(1, "Describe the work."),
	scheduledAtKm: z.number().int().min(0).nullable().optional(),
	scheduledAtDate: z.string().nullable().optional(),
	odometerAtService: z.number().int().min(0).nullable().optional(),
	mechanic: z.string().trim().nullable().optional(),
	costCents: optionalAmountCents,
	currency: z.string().trim().length(3).nullable().optional(),
	invoiceReference: z.string().trim().nullable().optional(),
	blocksAvailability: z.boolean().optional(),
});

export type MaintenanceCreateInput = z.infer<typeof maintenanceCreateInput>;

const maintenanceUpdateInput = z.object({
	description: z.string().trim().min(1).optional(),
	scheduledAtKm: z.number().int().min(0).nullable().optional(),
	scheduledAtDate: z.string().nullable().optional(),
	completedAt: z.string().nullable().optional(),
	odometerAtService: z.number().int().min(0).nullable().optional(),
	mechanic: z.string().trim().nullable().optional(),
	costCents: optionalAmountCents,
	invoiceReference: z.string().trim().nullable().optional(),
	blocksAvailability: z.boolean().optional(),
});

export type MaintenanceUpdateInput = z.infer<typeof maintenanceUpdateInput>;

export const maintenanceUpdateArgs = z.object({
	id: z.string(),
	data: maintenanceUpdateInput,
});

export const maintenanceIdInput = z.object({ id: z.string() });
