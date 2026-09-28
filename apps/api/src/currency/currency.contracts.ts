import { isCurrencyCode } from "@crm/db/currency";
import { z } from "zod";

export const currencyCode = z
	.string()
	.trim()
	.length(3, "A currency code is three letters, like USD.")
	.refine(isCurrencyCode, "That is not a currency this CRM can convert.");

export const MAX_AMOUNT_CENTS = 99_999_999_999_999;

export const amountCents = z
	.number()
	.int()
	.min(0)
	.max(MAX_AMOUNT_CENTS, "That amount is too large to record.");

export const optionalAmountCents = amountCents.nullable().optional();

export const setReportingCurrencyInput = z.object({
	currency: currencyCode,
});

export type SetReportingCurrencyInput = z.infer<
	typeof setReportingCurrencyInput
>;

export const setManualRateInput = z.object({
	currency: currencyCode,
	rate: z
		.number()
		.positive("A rate has to be greater than zero.")
		.finite("That is not a rate."),
});

export type SetManualRateInput = z.infer<typeof setManualRateInput>;

export const removeManualRateInput = z.object({
	currency: currencyCode,
});

export type RemoveManualRateInput = z.infer<typeof removeManualRateInput>;
