import { PaymentMethod, PaymentStatus, PaymentType } from "@crm/db";
import { z } from "zod";
import { amountCents, currencyCode } from "../currency/currency.contracts";

const typeEnum = z.enum(
	Object.values(PaymentType) as [PaymentType, ...PaymentType[]],
);

const methodEnum = z.enum(
	Object.values(PaymentMethod) as [PaymentMethod, ...PaymentMethod[]],
);

const statusEnum = z.enum(
	Object.values(PaymentStatus) as [PaymentStatus, ...PaymentStatus[]],
);

export const paymentsByContractInput = z.object({
	rentalContractId: z.string(),
});

export const paymentCreateInput = z.object({
	rentalContractId: z
		.string()
		.min(1, "A payment belongs to a rental contract."),
	type: typeEnum,
	amountCents,
	currency: currencyCode.optional(),
	method: methodEnum,
	status: statusEnum.optional(),
	reference: z.string().trim().nullable().optional(),
	paidAt: z.string().nullable().optional(),
	notes: z.string().trim().nullable().optional(),
});

export type PaymentCreateInput = z.infer<typeof paymentCreateInput>;

const paymentUpdateInput = z.object({
	status: statusEnum.optional(),
	reference: z.string().trim().nullable().optional(),
	paidAt: z.string().nullable().optional(),
	notes: z.string().trim().nullable().optional(),
});

export type PaymentUpdateInput = z.infer<typeof paymentUpdateInput>;

export const paymentUpdateArgs = z.object({
	id: z.string(),
	data: paymentUpdateInput,
});

export const paymentIdInput = z.object({ id: z.string() });
