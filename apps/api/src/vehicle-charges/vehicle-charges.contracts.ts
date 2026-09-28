import { ChargeFrequency } from "@crm/db";
import { z } from "zod";
import { amountCents, currencyCode } from "../currency/currency.contracts";

const frequencyEnum = z.enum(
	Object.values(ChargeFrequency) as [ChargeFrequency, ...ChargeFrequency[]],
);

export const vehicleChargesByVehicleInput = z.object({
	vehicleId: z.string(),
});

export const vehicleChargeCreateInput = z.object({
	vehicleId: z.string().min(1, "A charge belongs to a vehicle."),
	label: z.string().trim().min(1, "A charge needs a label."),
	amountCents,
	currency: currencyCode.optional(),
	frequency: frequencyEnum,
	startDate: z.string().min(1, "A charge needs a start date."),
	endDate: z.string().nullable().optional(),
});

export type VehicleChargeCreateInput = z.infer<typeof vehicleChargeCreateInput>;

export const vehicleChargeIdInput = z.object({ id: z.string() });
