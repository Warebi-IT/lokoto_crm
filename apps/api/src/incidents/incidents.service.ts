import {
	type Db,
	DepositStatus,
	InsuranceClaimStatus,
	type Prisma,
	Prisma as PrismaNamespace,
	ResponsibleParty,
} from "@crm/db";
import { blobEnabled } from "@crm/db/blob";
import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { decimalFromCents, parseDate, toCents } from "../crm/values";
import { InjectDatabase } from "../database/database.constants";
import type {
	DamageAnnotationInput,
	IncidentCreateInput,
	IncidentDocumentMetaInput,
	IncidentUpdateInput,
} from "./incidents.contracts";

const REPORTED_BY_SELECT = {
	id: true,
	name: true,
	email: true,
	image: true,
} as const;

const SELECT = {
	id: true,
	vehicleId: true,
	rentalContractId: true,
	type: true,
	reportedAt: true,
	reportedBy: { select: REPORTED_BY_SELECT },
	description: true,
	damageAreas: true,
	damageAnnotations: {
		orderBy: { createdAt: "asc" },
	},
	responsibleParty: true,
	insuranceClaimNumber: true,
	insuranceStatus: true,
	depositOutcome: true,
	depositDeductedAmount: true,
	depositCurrency: true,
	estimatedCost: true,
	actualCost: true,
	currency: true,
	policeReportReference: true,
	photoUrls: true,
	documents: {
		orderBy: { createdAt: "desc" },
	},
	resolvedAt: true,
	notes: true,
	createdAt: true,
} as const;

@Injectable()
export class IncidentsService {
	private readonly logger = new Logger(IncidentsService.name);

	constructor(@InjectDatabase() private readonly db: Db) {}

	async listByVehicle(vehicleId: string) {
		const rows = await this.db.incident.findMany({
			where: { vehicleId },
			orderBy: { reportedAt: "desc" },
			select: SELECT,
		});
		return rows.map(serialize);
	}

	async listByContract(rentalContractId: string) {
		const rows = await this.db.incident.findMany({
			where: { rentalContractId },
			orderBy: { reportedAt: "desc" },
			select: SELECT,
		});
		return rows.map(serialize);
	}

	async create(input: IncidentCreateInput, reportedById: string) {
		let contractForIncident: {
			vehicleId: string;
			depositAmount: Prisma.Decimal;
			depositCurrency: string;
		} | null = null;
		let effectiveDeductedAmountCents: number | null | undefined =
			input.depositDeductedAmountCents;

		if (input.rentalContractId) {
			const contract = await this.db.rentalContract.findUnique({
				where: { id: input.rentalContractId },
				select: {
					vehicleId: true,
					depositAmount: true,
					depositCurrency: true,
				},
			});
			if (!contract) {
				throw new NotFoundException("The rental contract was not found.");
			}
			if (contract.vehicleId !== input.vehicleId) {
				throw new BadRequestException(
					"The incident vehicle must match the rental contract vehicle.",
				);
			}
			const deductedAmountCents =
				input.depositDeductedAmountCents ??
				(input.depositOutcome === "FULL"
					? toCents(contract.depositAmount)
					: null);
			if (input.depositOutcome !== "NONE" && deductedAmountCents === null) {
				throw new BadRequestException(
					"A deposit deduction amount is required for this outcome.",
				);
			}
			if (
				deductedAmountCents !== null &&
				deductedAmountCents !== undefined &&
				deductedAmountCents > (toCents(contract.depositAmount) ?? 0)
			) {
				throw new BadRequestException(
					"The deposit deduction cannot exceed the held deposit.",
				);
			}
			if (
				input.depositCurrency &&
				input.depositCurrency !== contract.depositCurrency
			) {
				throw new BadRequestException(
					"The deposit currency must match the rental contract.",
				);
			}
			contractForIncident = contract;
			effectiveDeductedAmountCents = deductedAmountCents;
		} else if (
			input.depositCurrency ||
			input.depositDeductedAmountCents !== undefined ||
			(input.depositOutcome && input.depositOutcome !== "NONE")
		) {
			throw new BadRequestException(
				"Deposit deductions must be linked to a rental contract.",
			);
		}

		try {
			const incident = await this.db.$transaction(async (tx) => {
				const created = await tx.incident.create({
					data: {
						vehicleId: input.vehicleId,
						rentalContractId: input.rentalContractId ?? null,
						type: input.type,
						reportedAt: parseDate(input.reportedAt) ?? new Date(),
						reportedById,
						description: input.description.trim(),
						damageAreas: input.damageAreas ?? [],
						damageAnnotations: input.damageAnnotations?.length
							? { create: input.damageAnnotations.map(toDamageAnnotationData) }
							: undefined,
						responsibleParty:
							input.responsibleParty ?? ResponsibleParty.UNKNOWN,
						insuranceClaimNumber: input.insuranceClaimNumber ?? null,
						insuranceStatus:
							input.insuranceStatus ?? InsuranceClaimStatus.NOT_FILED,
						depositOutcome: input.depositOutcome ?? "NONE",
						depositDeductedAmount: decimalFromCents(
							effectiveDeductedAmountCents,
						),
						depositCurrency:
							input.depositCurrency ??
							contractForIncident?.depositCurrency ??
							null,
						estimatedCost: decimalFromCents(input.estimatedCostCents),
						currency: input.currency ?? null,
						policeReportReference: input.policeReportReference ?? null,
						notes: input.notes ?? null,
					},
					select: { id: true, vehicleId: true, type: true },
				});

				if (contractForIncident && effectiveDeductedAmountCents) {
					const depositCents = toCents(contractForIncident.depositAmount) ?? 0;
					await tx.rentalContract.update({
						where: { id: input.rentalContractId as string },
						data: {
							depositStatus:
								input.depositOutcome === "FULL"
									? DepositStatus.FORFEITED
									: DepositStatus.PARTIALLY_RETURNED,
							depositReturnedAmount: decimalFromCents(
								depositCents - effectiveDeductedAmountCents,
							),
						},
					});
				}

				return created;
			});

			this.logger.log({
				message: "Incident reported",
				incidentId: incident.id,
				vehicleId: incident.vehicleId,
				type: incident.type,
			});

			return incident;
		} catch (error) {
			throw this.translate(error, input.vehicleId);
		}
	}

	async update(id: string, input: IncidentUpdateInput) {
		try {
			return await this.db.incident.update({
				where: { id },
				data: {
					description: input.description,
					damageAreas: input.damageAreas,
					responsibleParty: input.responsibleParty,
					insuranceClaimNumber: input.insuranceClaimNumber,
					insuranceStatus: input.insuranceStatus,
					depositOutcome: input.depositOutcome,
					depositDeductedAmount:
						input.depositDeductedAmountCents === undefined
							? undefined
							: decimalFromCents(input.depositDeductedAmountCents),
					depositCurrency: input.depositCurrency,
					estimatedCost:
						input.estimatedCostCents === undefined
							? undefined
							: decimalFromCents(input.estimatedCostCents),
					actualCost:
						input.actualCostCents === undefined
							? undefined
							: decimalFromCents(input.actualCostCents),
					policeReportReference: input.policeReportReference,
					resolvedAt:
						input.resolvedAt === undefined
							? undefined
							: parseDate(input.resolvedAt),
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
			await this.db.incident.delete({ where: { id } });
		} catch (error) {
			throw this.translate(error, id);
		}

		return { id };
	}

	async createDamageAnnotation(
		input: DamageAnnotationInput & { incidentId: string },
	) {
		try {
			return await this.db.incidentDamageAnnotation.create({
				data: {
					incidentId: input.incidentId,
					...toDamageAnnotationData(input),
				},
				select: { id: true },
			});
		} catch (error) {
			throw this.translate(error, input.incidentId);
		}
	}

	async updateDamageAnnotation(id: string, input: DamageAnnotationInput) {
		try {
			return await this.db.incidentDamageAnnotation.update({
				where: { id },
				data: toDamageAnnotationData(input),
				select: { id: true },
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async deleteDamageAnnotation(id: string): Promise<{ id: string }> {
		try {
			await this.db.incidentDamageAnnotation.delete({ where: { id } });
		} catch (error) {
			throw this.translate(error, id);
		}
		return { id };
	}

	async uploadDocument(
		incidentId: string,
		file: {
			buffer: Buffer;
			mimetype: string;
			originalname: string;
		},
		input: IncidentDocumentMetaInput,
	) {
		const incident = await this.db.incident.findUnique({
			where: { id: incidentId },
			select: { vehicleId: true, reportedAt: true },
		});
		if (!incident) throw new NotFoundException("The incident was not found.");
		if (!blobEnabled())
			return { stored: false as const, reason: "storage_unavailable" };

		const safeName =
			file.originalname.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) ||
			"document";
		const day = incident.reportedAt.toISOString().slice(0, 10);
		const path = `incidents/${incident.vehicleId}/${day}/${incidentId}/${safeName}`;
		const { put } = await import("@vercel/blob");
		const blob = await put(path, file.buffer, {
			access: "public",
			contentType: file.mimetype,
			addRandomSuffix: true,
		});

		const document = await this.db.incidentDocument.create({
			data: {
				incidentId,
				type: input.type,
				url: blob.url,
				fileName: file.originalname,
				contentType: file.mimetype,
				amount: decimalFromCents(input.amountCents),
				currency: input.currency ?? null,
				insuranceReimbursedAmount: decimalFromCents(
					input.insuranceReimbursedAmountCents,
				),
			},
			select: { id: true, url: true, type: true },
		});

		return { stored: true as const, document };
	}

	private translate(error: unknown, id: string): unknown {
		if (
			error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
			error.code === "P2025"
		) {
			return new NotFoundException(`No incident with id ${id}.`);
		}
		return error;
	}
}

function toDamageAnnotationData(input: DamageAnnotationInput) {
	return {
		view: input.view,
		type: input.type,
		severity: input.severity,
		x: input.x,
		y: input.y,
		points: input.points ?? [],
		description: input.description ?? null,
	};
}

type IncidentRow = Prisma.IncidentGetPayload<{ select: typeof SELECT }>;

function serialize({
	estimatedCost,
	actualCost,
	depositDeductedAmount,
	documents,
	reportedAt,
	resolvedAt,
	createdAt,
	...rest
}: IncidentRow) {
	return {
		...rest,
		documents: documents.map(
			({ amount, insuranceReimbursedAmount, ...document }) => ({
				...document,
				createdAt: document.createdAt.toISOString(),
				amountCents: toCents(amount),
				insuranceReimbursedAmountCents: toCents(insuranceReimbursedAmount),
			}),
		),
		depositDeductedAmountCents: toCents(depositDeductedAmount),
		estimatedCostCents: toCents(estimatedCost),
		actualCostCents: toCents(actualCost),
		reportedAt: reportedAt.toISOString(),
		resolvedAt: resolvedAt?.toISOString() ?? null,
		createdAt: createdAt.toISOString(),
	};
}
