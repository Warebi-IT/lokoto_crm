import { type Db, type Prisma, Prisma as PrismaNamespace } from "@crm/db";
import { Injectable, Logger } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";

export type ActivityTarget = {
	contactId?: string | null;
	vehicleId?: string | null;
	rentalContractId?: string | null;
};

export type StampTargets = {
	contactIds: string[];
	vehicleIds: string[];
	rentalContractIds: string[];
};

function present(ids: (string | null)[]): string[] {
	return ids.filter((id): id is string => id !== null);
}

@Injectable()
export class ActivityStampService {
	private readonly logger = new Logger(ActivityStampService.name);

	constructor(@InjectDatabase() private readonly db: Db) {}

	async touch(target: ActivityTarget, at: Date): Promise<void> {
		const stale = {
			OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: at } }],
		};

		await Promise.all([
			target.contactId
				? this.db.contact.updateMany({
						where: { id: target.contactId, ...stale },
						data: { lastActivityAt: at },
					})
				: null,
			target.vehicleId
				? this.db.vehicle.updateMany({
						where: { id: target.vehicleId, ...stale },
						data: { lastActivityAt: at },
					})
				: null,
			target.rentalContractId
				? this.db.rentalContract.updateMany({
						where: { id: target.rentalContractId, ...stale },
						data: { lastActivityAt: at },
					})
				: null,
		]);
	}

	async recompute(target: ActivityTarget): Promise<void> {
		if (target.contactId) {
			const { _max } = await this.db.activity.aggregate({
				where: { contactId: target.contactId },
				_max: { createdAt: true },
			});
			await this.db.contact.update({
				where: { id: target.contactId },
				data: { lastActivityAt: _max.createdAt },
			});
		}

		if (target.vehicleId) {
			const { _max } = await this.db.activity.aggregate({
				where: { vehicleId: target.vehicleId },
				_max: { createdAt: true },
			});
			await this.db.vehicle.update({
				where: { id: target.vehicleId },
				data: { lastActivityAt: _max.createdAt },
			});
		}

		if (target.rentalContractId) {
			const { _max } = await this.db.activity.aggregate({
				where: { rentalContractId: target.rentalContractId },
				_max: { createdAt: true },
			});
			await this.db.rentalContract.update({
				where: { id: target.rentalContractId },
				data: { lastActivityAt: _max.createdAt },
			});
		}
	}

	async targetsOf(
		where: Prisma.ActivityWhereInput,
		client: Prisma.TransactionClient = this.db,
	): Promise<StampTargets> {
		const [contacts, vehicles, rentalContracts] = await Promise.all([
			client.activity.groupBy({ by: ["contactId"], where }),
			client.activity.groupBy({ by: ["vehicleId"], where }),
			client.activity.groupBy({ by: ["rentalContractId"], where }),
		]);

		return {
			contactIds: present(contacts.map((row) => row.contactId)),
			vehicleIds: present(vehicles.map((row) => row.vehicleId)),
			rentalContractIds: present(
				rentalContracts.map((row) => row.rentalContractId),
			),
		};
	}

	async recomputeMany(targets: StampTargets): Promise<void> {
		const statements = [
			this.restamp("contact", "contactId", targets.contactIds),
			this.restamp("vehicle", "vehicleId", targets.vehicleIds),
			this.restamp(
				"rentalContract",
				"rentalContractId",
				targets.rentalContractIds,
			),
		].filter((statement) => statement !== null);

		if (statements.length === 0) return;

		await this.db.$transaction(statements);
	}

	async recomputeAfterDelete(
		targets: StampTargets,
		deleted: ActivityTarget,
	): Promise<void> {
		try {
			await this.recomputeMany(targets);
		} catch (error) {
			this.logger.error(
				{
					message:
						"A record was deleted but its activity stamps were not recomputed",
					...deleted,
				},
				error instanceof Error ? error.stack : String(error),
			);
		}
	}

	private restamp(table: string, column: string, ids: string[]) {
		if (ids.length === 0) return null;

		const record = PrismaNamespace.raw(`"${table}"`);
		const key = PrismaNamespace.raw(`"${column}"`);

		return this.db.$executeRaw`
			UPDATE ${record} r
			SET "lastActivityAt" = (
				SELECT MAX(a."createdAt") FROM "activity" a WHERE a.${key} = r.id
			)
			WHERE r.id IN (${PrismaNamespace.join(ids)})`;
	}

	async recomputeAll(): Promise<void> {
		await this.db.$transaction([
			this.db.$executeRaw`
				UPDATE "contact" c
				SET "lastActivityAt" = a.max
				FROM (
					SELECT "contactId" AS id, MAX("createdAt") AS max
					FROM "activity" WHERE "contactId" IS NOT NULL GROUP BY "contactId"
				) a
				WHERE c.id = a.id AND c."lastActivityAt" IS DISTINCT FROM a.max`,
			this.db.$executeRaw`
				UPDATE "contact" SET "lastActivityAt" = NULL
				WHERE "lastActivityAt" IS NOT NULL
				AND id NOT IN (SELECT "contactId" FROM "activity" WHERE "contactId" IS NOT NULL)`,
			this.db.$executeRaw`
				UPDATE "vehicle" v
				SET "lastActivityAt" = a.max
				FROM (
					SELECT "vehicleId" AS id, MAX("createdAt") AS max
					FROM "activity" WHERE "vehicleId" IS NOT NULL GROUP BY "vehicleId"
				) a
				WHERE v.id = a.id AND v."lastActivityAt" IS DISTINCT FROM a.max`,
			this.db.$executeRaw`
				UPDATE "vehicle" SET "lastActivityAt" = NULL
				WHERE "lastActivityAt" IS NOT NULL
				AND id NOT IN (SELECT "vehicleId" FROM "activity" WHERE "vehicleId" IS NOT NULL)`,
			this.db.$executeRaw`
				UPDATE "rentalContract" rc
				SET "lastActivityAt" = a.max
				FROM (
					SELECT "rentalContractId" AS id, MAX("createdAt") AS max
					FROM "activity" WHERE "rentalContractId" IS NOT NULL GROUP BY "rentalContractId"
				) a
				WHERE rc.id = a.id AND rc."lastActivityAt" IS DISTINCT FROM a.max`,
			this.db.$executeRaw`
				UPDATE "rentalContract" SET "lastActivityAt" = NULL
				WHERE "lastActivityAt" IS NOT NULL
				AND id NOT IN (SELECT "rentalContractId" FROM "activity" WHERE "rentalContractId" IS NOT NULL)`,
		]);
	}
}
