import { FinancingType, FuelType, VehicleStatus, VehicleType } from "@crm/db";
import { z } from "zod";
import { bulkIdsInput } from "../crm/bulk";
import {
	amountCents,
	currencyCode,
	optionalAmountCents,
} from "../currency/currency.contracts";
import { recordFieldValues } from "../fields/fields.contracts";
import { listInput } from "../trpc/list-input";

const vehicleTypeEnum = z.enum(
	Object.values(VehicleType) as [VehicleType, ...VehicleType[]],
);

const fuelTypeEnum = z.enum(
	Object.values(FuelType) as [FuelType, ...FuelType[]],
);

const vehicleStatusEnum = z.enum(
	Object.values(VehicleStatus) as [VehicleStatus, ...VehicleStatus[]],
);

const financingTypeEnum = z.enum(
	Object.values(FinancingType) as [FinancingType, ...FinancingType[]],
);

export const vehicleListInput = listInput.extend({
	status: z.string().default("all"),
	type: z.string().default("all"),
});

export type VehicleListInput = z.infer<typeof vehicleListInput>;

export const vehicleCreateInput = z.object({
	type: vehicleTypeEnum,
	fuelType: fuelTypeEnum.optional(),
	make: z.string().trim().min(1, "A vehicle needs a make."),
	model: z.string().trim().min(1, "A vehicle needs a model."),
	year: z.number().int().min(1950).max(2100).nullable().optional(),
	plateNumber: z.string().trim().min(1, "A vehicle needs a plate number."),
	vin: z.string().trim().nullable().optional(),
	color: z.string().trim().nullable().optional(),
	dailyRateCents: optionalAmountCents,
	currency: currencyCode.optional(),
	mileage: z.number().int().min(0).optional(),
	insurancePolicyNumber: z.string().trim().nullable().optional(),
	insuranceExpiresAt: z.string().nullable().optional(),
	registrationExpiresAt: z.string().nullable().optional(),
	nextMaintenanceAtKm: z.number().int().min(0).nullable().optional(),
	nextMaintenanceAtDate: z.string().nullable().optional(),
});

export type VehicleCreateInput = z.infer<typeof vehicleCreateInput>;

const vehicleUpdateInput = z.object({
	type: vehicleTypeEnum.optional(),
	fuelType: fuelTypeEnum.optional(),
	make: z.string().trim().min(1).optional(),
	model: z.string().trim().min(1).optional(),
	year: z.number().int().min(1950).max(2100).nullable().optional(),
	plateNumber: z.string().trim().min(1).optional(),
	vin: z.string().nullable().optional(),
	color: z.string().nullable().optional(),
	status: vehicleStatusEnum.optional(),
	dailyRateCents: optionalAmountCents,
	currency: currencyCode.optional(),
	mileage: z.number().int().min(0).optional(),
	insurancePolicyNumber: z.string().nullable().optional(),
	insuranceExpiresAt: z.string().nullable().optional(),
	registrationExpiresAt: z.string().nullable().optional(),
	nextMaintenanceAtKm: z.number().int().min(0).nullable().optional(),
	nextMaintenanceAtDate: z.string().nullable().optional(),
	fields: recordFieldValues.optional(),
});

export type VehicleUpdateInput = z.infer<typeof vehicleUpdateInput>;

export const vehicleUpdateArgs = z.object({
	id: z.string(),
	data: vehicleUpdateInput,
});

export const vehicleIdInput = z.object({ id: z.string() });

export const vehicleAvailabilityInput = z.object({
	startDate: z.string().min(1, "Choose a start date."),
	endDate: z.string().min(1, "Choose an end date."),
});

export type VehicleAvailabilityInput = z.infer<typeof vehicleAvailabilityInput>;

export const vehicleBulkInput = bulkIdsInput;

export const vehicleBulkStatusInput = bulkIdsInput.extend({
	status: vehicleStatusEnum,
});

export type VehicleBulkStatusInput = z.infer<typeof vehicleBulkStatusInput>;

export const vehicleSetFinancingInput = z.object({
	vehicleId: z.string(),
	type: financingTypeEnum,
	principalAmountCents: optionalAmountCents,
	monthlyPaymentCents: amountCents,
	currency: currencyCode.optional(),
	interestRate: z.number().min(0).max(100).nullable().optional(),
	termMonths: z.number().int().min(1).max(600).nullable().optional(),
	startDate: z.string().min(1, "Financing needs a start date."),
});

export type VehicleSetFinancingInput = z.infer<typeof vehicleSetFinancingInput>;

export const vehicleClearFinancingInput = z.object({ vehicleId: z.string() });
