import type { Db, Prisma as PrismaTypes } from "@crm/db";
import { Prisma } from "@crm/db";
import { minorUnitsOf, normalizeCurrency } from "@crm/db/currency";
import {
	type Conversion,
	convertToBase,
	type ResolvedRate,
	resolveRate,
} from "@crm/db/fx";
import { readReportingCurrency } from "@crm/db/settings";
import { Injectable, Logger } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";

export type ConvertibleEntity =
	| "vehicle"
	| "rentalContract"
	| "payment"
	| "vehicleFinancing"
	| "vehicleCharge";

export const CONVERTIBLE_ENTITIES: readonly ConvertibleEntity[] = [
	"vehicle",
	"rentalContract",
	"payment",
	"vehicleFinancing",
	"vehicleCharge",
];

const TABLE: Record<ConvertibleEntity, string> = {
	vehicle: "vehicle",
	rentalContract: "rentalContract",
	payment: "payment",
	vehicleFinancing: "vehicleFinancing",
	vehicleCharge: "vehicleCharge",
};

const AMOUNT_COLUMN: Record<ConvertibleEntity, string> = {
	vehicle: "dailyRate",
	rentalContract: "totalAmount",
	payment: "amount",
	vehicleFinancing: "monthlyPayment",
	vehicleCharge: "amount",
};

const NULLABLE_AMOUNT: Record<ConvertibleEntity, boolean> = {
	vehicle: true,
	rentalContract: false,
	payment: false,
	vehicleFinancing: false,
	vehicleCharge: false,
};

function amountPresentWhere(entity: ConvertibleEntity): object {
	return NULLABLE_AMOUNT[entity]
		? { [AMOUNT_COLUMN[entity]]: { not: null } }
		: {};
}

interface CurrencyGroupRow {
	currency: string;
	_count: { _all: number };
}

interface ConvertibleDelegate {
	groupBy(args: {
		by: ["currency"];
		where: object;
		_count: { _all: true };
	}): Promise<CurrencyGroupRow[]>;
}

export interface ConversionFields {
	baseAmount: PrismaTypes.Decimal | null;
	baseCurrency: string | null;
	fxRate: PrismaTypes.Decimal | null;
	fxRateAt: Date | null;
}

export interface Unconverted {
	count: number;
	currencies: string[];
}

export interface RerateResult {
	converted: number;
	cleared: number;
	missing: string[];
}

export interface CurrencyUsage {
	currency: string;
	count: number;
}

@Injectable()
export class ConversionService {
	private readonly logger = new Logger(ConversionService.name);

	constructor(@InjectDatabase() private readonly db: Db) {}

	async reportingCurrency(): Promise<string> {
		return readReportingCurrency(this.db);
	}

	async rateFor(currency: string): Promise<ResolvedRate | null> {
		const base = await this.reportingCurrency();
		return resolveRate(this.db, base, currency);
	}

	async convert(
		amount: PrismaTypes.Decimal | null,
		currency: string,
	): Promise<Conversion | null> {
		return convertToBase(
			this.db,
			amount,
			currency,
			await this.reportingCurrency(),
		);
	}

	async convertFields(
		amount: PrismaTypes.Decimal | null,
		currency: string,
	): Promise<ConversionFields> {
		const converted = await this.convert(amount, currency);

		if (!converted) {
			return {
				baseAmount: null,
				baseCurrency: null,
				fxRate: null,
				fxRateAt: null,
			};
		}

		return {
			baseAmount: converted.baseAmount,
			baseCurrency: converted.baseCurrency,
			fxRate: converted.fxRate,
			fxRateAt: converted.fxRateAt,
		};
	}

	countedWhere(base: string): {
		baseAmount: { not: null };
		baseCurrency: string;
	} {
		return { baseAmount: { not: null }, baseCurrency: base };
	}

	pendingWhere(entity: ConvertibleEntity, base: string): object {
		return {
			...amountPresentWhere(entity),
			OR: [
				{ baseAmount: null },
				{ baseCurrency: null },
				{ baseCurrency: { not: base } },
			],
		};
	}

	async unconverted(
		entity: ConvertibleEntity,
		where: object = {},
	): Promise<Unconverted> {
		const base = await this.reportingCurrency();

		const rows = await this.delegate(entity).groupBy({
			by: ["currency"],
			where: { AND: [where, this.pendingWhere(entity, base)] },
			_count: { _all: true },
		});

		return this.summarize(rows);
	}

	async unconvertedEverywhere(): Promise<Unconverted> {
		const results = await Promise.all(
			CONVERTIBLE_ENTITIES.map((entity) => this.unconverted(entity)),
		);

		return {
			count: results.reduce((total, result) => total + result.count, 0),
			currencies: [
				...new Set(results.flatMap((result) => result.currencies)),
			].sort(),
		};
	}

	async currencyUsage(): Promise<CurrencyUsage[]> {
		const totals = new Map<string, number>();

		for (const entity of CONVERTIBLE_ENTITIES) {
			const rows = await this.delegate(entity).groupBy({
				by: ["currency"],
				where: amountPresentWhere(entity),
				_count: { _all: true },
			});

			for (const row of rows) {
				const currency = normalizeCurrency(row.currency);
				totals.set(currency, (totals.get(currency) ?? 0) + row._count._all);
			}
		}

		return [...totals.entries()]
			.map(([currency, count]) => ({ currency, count }))
			.sort(
				(a, b) => b.count - a.count || a.currency.localeCompare(b.currency),
			);
	}

	async rerateAll(entity: ConvertibleEntity): Promise<RerateResult> {
		return this.rerate(entity, false);
	}

	async fillMissing(entity: ConvertibleEntity): Promise<RerateResult> {
		return this.rerate(entity, true);
	}

	async rerateEverything(): Promise<RerateResult> {
		return this.combine(
			CONVERTIBLE_ENTITIES.map((entity) => this.rerateAll(entity)),
		);
	}

	async fillMissingEverywhere(): Promise<RerateResult> {
		return this.combine(
			CONVERTIBLE_ENTITIES.map((entity) => this.fillMissing(entity)),
		);
	}

	private async combine(
		pending: Promise<RerateResult>[],
	): Promise<RerateResult> {
		const results = await Promise.all(pending);

		return {
			converted: results.reduce((total, result) => total + result.converted, 0),
			cleared: results.reduce((total, result) => total + result.cleared, 0),
			missing: [...new Set(results.flatMap((result) => result.missing))].sort(),
		};
	}

	private summarize(rows: CurrencyGroupRow[]): Unconverted {
		return {
			count: rows.reduce((total, row) => total + row._count._all, 0),
			currencies: rows
				.map((row) => normalizeCurrency(row.currency))
				.filter((code, index, all) => all.indexOf(code) === index)
				.sort(),
		};
	}

	private delegate(entity: ConvertibleEntity): ConvertibleDelegate {
		return (
			this.db as unknown as Record<ConvertibleEntity, ConvertibleDelegate>
		)[entity];
	}

	private async rerate(
		entity: ConvertibleEntity,
		onlyMissing: boolean,
	): Promise<RerateResult> {
		const base = await this.reportingCurrency();

		const groups = await this.delegate(entity).groupBy({
			by: ["currency"],
			where: onlyMissing
				? this.pendingWhere(entity, base)
				: amountPresentWhere(entity),
			_count: { _all: true },
		});

		const codes = [
			...new Set(groups.map((group) => normalizeCurrency(group.currency))),
		];

		const places = minorUnitsOf(base);
		let converted = 0;
		let cleared = 0;
		const missing: string[] = [];

		for (const code of codes) {
			const rate = await resolveRate(this.db, base, code);

			if (!rate) {
				missing.push(code);

				if (!onlyMissing) {
					cleared += await this.clear(entity, code);
				}

				continue;
			}

			converted += await this.write(
				entity,
				base,
				code,
				rate,
				places,
				onlyMissing,
			);
		}

		this.logger.log({
			message: onlyMissing
				? `Filled in ${entity} amounts that had no rate`
				: `Re-rated every ${entity} against the reporting currency`,
			entity,
			base,
			converted,
			cleared,
			missing,
		});

		return { converted, cleared, missing: missing.sort() };
	}

	private async write(
		entity: ConvertibleEntity,
		base: string,
		code: string,
		rate: ResolvedRate,
		places: number,
		onlyMissing: boolean,
	): Promise<number> {
		const value = new Prisma.Decimal(rate.rate).toString();
		const table = Prisma.raw(`"${TABLE[entity]}"`);
		const amountColumn = Prisma.raw(`"${AMOUNT_COLUMN[entity]}"`);

		const filter = onlyMissing
			? Prisma.sql`AND ("baseAmount" IS NULL OR "baseCurrency" IS DISTINCT FROM ${base})`
			: Prisma.empty;

		return this.db.$executeRaw`
			UPDATE ${table}
			SET "baseAmount" = ROUND(${amountColumn} * ${value}::numeric, ${places}::int),
			    "baseCurrency" = ${base},
			    "fxRate" = ${value}::numeric,
			    "fxRateAt" = ${rate.asOf}
			WHERE ${amountColumn} IS NOT NULL
			  AND upper(btrim("currency")) = ${code}
			  ${filter}
		`;
	}

	private async clear(
		entity: ConvertibleEntity,
		code: string,
	): Promise<number> {
		const table = Prisma.raw(`"${TABLE[entity]}"`);

		return this.db.$executeRaw`
			UPDATE ${table}
			SET "baseAmount" = NULL,
			    "baseCurrency" = NULL,
			    "fxRate" = NULL,
			    "fxRateAt" = NULL
			WHERE upper(btrim("currency")) = ${code}
			  AND "baseAmount" IS NOT NULL
		`;
	}
}
