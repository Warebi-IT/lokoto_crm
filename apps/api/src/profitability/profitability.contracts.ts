import { z } from "zod";

export const profitabilitySummaryInput = z.object({});

export const profitabilityByVehicleInput = z.object({
	vehicleId: z.string(),
});

export const profitabilityTopVehiclesInput = z.object({});

export const profitabilityTopClientsInput = z.object({});

export const profitabilityBySegmentInput = z.object({});
