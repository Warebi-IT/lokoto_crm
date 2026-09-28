import {
	DepositMethod,
	DepositStatus,
	DriverRole,
	FuelLevel,
	RentalChannel,
	RentalContractStatus,
} from "@crm/db";
import { z } from "zod";
import { bulkIdsInput } from "../crm/bulk";
import {
	amountCents,
	currencyCode,
	optionalAmountCents,
} from "../currency/currency.contracts";
import { recordFieldValues } from "../fields/fields.contracts";
import { listInput } from "../trpc/list-input";

const statusEnum = z.enum(
	Object.values(RentalContractStatus) as [
		RentalContractStatus,
		...RentalContractStatus[],
	],
);

const channelEnum = z.enum(
	Object.values(RentalChannel) as [RentalChannel, ...RentalChannel[]],
);

const fuelLevelEnum = z.enum(
	Object.values(FuelLevel) as [FuelLevel, ...FuelLevel[]],
);

const depositMethodEnum = z.enum(
	Object.values(DepositMethod) as [DepositMethod, ...DepositMethod[]],
);

const driverRoleEnum = z.enum(
	Object.values(DriverRole) as [DriverRole, ...DriverRole[]],
);

const timeValue = z
	.string()
	.regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid time in HH:mm format.");

const mileagePricingRule = z.object({
	kilometers: z.number().int().positive().nullable(),
	pricePerKmCents: amountCents,
});

const mileagePricingRules = z
	.array(mileagePricingRule)
	.max(20)
	.superRefine((rules, context) => {
		if (rules.length > 0 && rules[rules.length - 1]?.kilometers !== null) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "The last mileage tier must be open-ended.",
			});
		}
	});

export const rentalContractListInput = listInput.extend({
	status: z.string().default("all"),
	owner: z.string().default("all"),
	vehicle: z.string().default("all"),
	channel: z.string().default("all"),
});

export type RentalContractListInput = z.infer<typeof rentalContractListInput>;

export const rentalContractPlanningInput = z.object({
	startDate: z.string().min(1, "Choose a start date."),
	endDate: z.string().min(1, "Choose an end date."),
});

export type RentalContractPlanningInput = z.infer<
	typeof rentalContractPlanningInput
>;

export const rentalContractCreateInput = z.object({
	vehicleId: z.string().min(1, "A rental contract needs a vehicle."),
	contactId: z.string().min(1, "A rental contract needs a renter."),
	ownerId: z.string().min(1, "A rental contract needs an agent."),
	channel: channelEnum.optional(),
	startDate: z.string().min(1, "Choose a start date."),
	endDate: z.string().min(1, "Choose an end date."),
	pickupTime: timeValue.optional(),
	returnTime: timeValue.optional(),
	pricePerDayCents: amountCents,
	currency: currencyCode.optional(),
	mileageIncludedPerDay: z.number().int().min(0).nullable().optional(),
	extraMileageFeePerKmCents: optionalAmountCents,
	mileagePricingRules: mileagePricingRules.optional(),
	depositAmountCents: amountCents,
	depositCurrency: currencyCode.optional(),
	depositMethod: depositMethodEnum.optional(),
	notes: z.string().trim().nullable().optional(),
});

export type RentalContractCreateInput = z.infer<
	typeof rentalContractCreateInput
>;

const rentalContractUpdateInput = z.object({
	startDate: z.string().min(1).optional(),
	endDate: z.string().min(1).optional(),
	pickupTime: timeValue.nullable().optional(),
	returnTime: timeValue.nullable().optional(),
	pricePerDayCents: amountCents.optional(),
	currency: currencyCode.optional(),
	mileageIncludedPerDay: z.number().int().min(0).nullable().optional(),
	extraMileageFeePerKmCents: optionalAmountCents,
	mileagePricingRules: mileagePricingRules.optional(),
	contractDocumentUrl: z.string().trim().nullable().optional(),
	notes: z.string().trim().nullable().optional(),
	fields: recordFieldValues.optional(),
});

export type RentalContractUpdateInput = z.infer<
	typeof rentalContractUpdateInput
>;

export const rentalContractUpdateArgs = z.object({
	id: z.string(),
	data: rentalContractUpdateInput,
});

export const rentalContractIdInput = z.object({ id: z.string() });

export const setRentalContractStatusInput = z.object({
	id: z.string(),
	status: statusEnum,
	cancelledReason: z.string().trim().optional(),
});

export type SetRentalContractStatusInput = z.infer<
	typeof setRentalContractStatusInput
>;

export const recordPickupInput = z.object({
	id: z.string(),
	mileageAtPickup: z.number().int().min(0),
	fuelLevelAtPickup: fuelLevelEnum,
	actualPickupAt: z.string().nullable().optional(),
});

export type RecordPickupInput = z.infer<typeof recordPickupInput>;

export const recordReturnInput = z.object({
	id: z.string(),
	mileageAtReturn: z.number().int().min(0),
	fuelLevelAtReturn: fuelLevelEnum,
	actualReturnAt: z.string().nullable().optional(),
});

export type RecordReturnInput = z.infer<typeof recordReturnInput>;

export const setDepositStatusInput = z.object({
	id: z.string(),
	depositStatus: z.enum([
		DepositStatus.PARTIALLY_RETURNED,
		DepositStatus.RETURNED,
		DepositStatus.FORFEITED,
	]),
	depositReturnedAmountCents: optionalAmountCents,
});

export type SetDepositStatusInput = z.infer<typeof setDepositStatusInput>;

export const rentalContractDriversInput = z.object({ contractId: z.string() });

export const attachDriverInput = z.object({
	contractId: z.string(),
	contactId: z.string().min(1, "Choose a driver to add."),
	role: driverRoleEnum.optional(),
});

export type AttachDriverInput = z.infer<typeof attachDriverInput>;

export const detachDriverInput = z.object({
	contractId: z.string(),
	contactId: z.string(),
});

export type DetachDriverInput = z.infer<typeof detachDriverInput>;

export const setDriverRoleInput = z.object({
	contractId: z.string(),
	contactId: z.string(),
	role: driverRoleEnum,
});

export type SetDriverRoleInput = z.infer<typeof setDriverRoleInput>;

export const rentalContractBulkInput = bulkIdsInput;

export const rentalContractBulkOwnerInput = bulkIdsInput.extend({
	ownerId: z.string().min(1, "A rental contract needs an agent."),
});

export type RentalContractBulkOwnerInput = z.infer<
	typeof rentalContractBulkOwnerInput
>;
