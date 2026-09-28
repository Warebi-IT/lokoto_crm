import { type Db, PaymentStatus, Prisma as PrismaNamespace } from "@crm/db";
import { normalizeCurrency } from "@crm/db/currency";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { decimalFromCents, fromCents, parseDate, toCents } from "../crm/values";
import { ConversionService } from "../currency/conversion.service";
import { InjectDatabase } from "../database/database.constants";
import type {
	PaymentCreateInput,
	PaymentUpdateInput,
} from "./payments.contracts";

const RECORDED_BY_SELECT = {
	id: true,
	name: true,
	email: true,
	image: true,
} as const;

@Injectable()
export class PaymentsService {
	private readonly logger = new Logger(PaymentsService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly conversion: ConversionService,
	) {}

	async listByContract(rentalContractId: string) {
		const rows = await this.db.payment.findMany({
			where: { rentalContractId },
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				type: true,
				amount: true,
				currency: true,
				baseAmount: true,
				method: true,
				status: true,
				reference: true,
				paidAt: true,
				notes: true,
				recordedBy: { select: RECORDED_BY_SELECT },
				createdAt: true,
			},
		});

		return rows.map(({ amount, baseAmount, paidAt, createdAt, ...row }) => ({
			...row,
			amountCents: toCents(amount),
			baseAmountCents: toCents(baseAmount),
			paidAt: paidAt?.toISOString() ?? null,
			createdAt: createdAt.toISOString(),
		}));
	}

	async create(input: PaymentCreateInput, recordedById: string) {
		const currency = normalizeCurrency(
			input.currency ?? (await this.conversion.reportingCurrency()),
		);
		const fx = await this.conversion.convertFields(
			decimalFromCents(input.amountCents),
			currency,
		);

		try {
			const payment = await this.db.payment.create({
				data: {
					rentalContractId: input.rentalContractId,
					type: input.type,
					amount: fromCents(input.amountCents) ?? 0,
					currency,
					...fx,
					method: input.method,
					status: input.status ?? PaymentStatus.COMPLETED,
					reference: input.reference ?? null,
					paidAt: parseDate(input.paidAt) ?? new Date(),
					notes: input.notes ?? null,
					recordedById,
				},
				select: { id: true, rentalContractId: true, type: true },
			});

			this.logger.log({
				message: "Payment recorded",
				paymentId: payment.id,
				rentalContractId: payment.rentalContractId,
				type: payment.type,
			});

			return payment;
		} catch (error) {
			throw this.translate(error, input.rentalContractId);
		}
	}

	async update(id: string, input: PaymentUpdateInput) {
		try {
			return await this.db.payment.update({
				where: { id },
				data: {
					status: input.status,
					reference: input.reference,
					paidAt:
						input.paidAt === undefined ? undefined : parseDate(input.paidAt),
					notes: input.notes,
				},
				select: { id: true },
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async delete(id: string): Promise<{ id: string }> {
		try {
			await this.db.payment.delete({ where: { id } });
		} catch (error) {
			throw this.translate(error, id);
		}

		return { id };
	}

	private translate(error: unknown, id: string): unknown {
		if (
			error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
			error.code === "P2025"
		) {
			return new NotFoundException(`No payment with id ${id}.`);
		}
		return error;
	}
}
