import { formatMoney } from "@crm/ui/lib/format";

type Converted = {
	baseAmountCents: number | null;
	baseCurrency: string | null;
};

export function reportedAmount(
	row: Converted,
	amountCents: number,
	currency: string,
) {
	return row.baseAmountCents !== null && row.baseCurrency
		? { amountCents: row.baseAmountCents, currency: row.baseCurrency }
		: { amountCents, currency };
}

export function formatReported(
	row: Converted,
	amountCents: number,
	currency: string,
) {
	const shown = reportedAmount(row, amountCents, currency);
	return formatMoney(shown.amountCents, shown.currency);
}
