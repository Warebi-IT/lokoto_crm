import { onSignedIn } from "@crm/auth";
import { type Db, EnrichmentStatus, type Prisma } from "@crm/db";
import { PRIORITY } from "@crm/db/agent-tasks";
import { readWorkspaceIdentity } from "@crm/db/workspace";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { Cache } from "cache-manager";
import { AgentTriggerService } from "../agent/agent-trigger.service";
import { InjectDatabase } from "../database/database.constants";
import { ImageMirrorService } from "./image-mirror.service";

export type BackfillResult = {
	queued: number;
	alreadyQueued: number;
	remaining: number;
};

const MAX_PER_RUN = 500;

const NEVER_SUCCEEDED: Prisma.EnumEnrichmentStatusFilter = {
	in: [EnrichmentStatus.PENDING, EnrichmentStatus.FAILED],
};

const AUTO_KEY = "backfill:auto";

const AUTO_EVERY_MS = 5 * 60_000;

/**
 * How long a fruitless photo search stands the contact down for.
 *
 * Long, because the answer rarely changes: somebody with no LinkedIn account
 * and no headshot anywhere else is unlikely to acquire either this week, and
 * the team-page read costs credits every time it is asked.
 */
const RECHECK_PHOTO_AFTER_MS = 30 * 24 * 60 * 60_000;

const RECHECK_WORKSPACE_AFTER_MS = 7 * 24 * 60 * 60_000;

@Injectable()
export class BackfillService implements OnModuleInit {
	private readonly logger = new Logger(BackfillService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly agent: AgentTriggerService,
		private readonly images: ImageMirrorService,
		@Inject(CACHE_MANAGER) private readonly cache: Cache,
	) {}

	onModuleInit(): void {
		onSignedIn(() => {
			void this.auto();
		});
	}

	async auto(): Promise<{ started: boolean }> {
		if (await this.cache.get(AUTO_KEY)) return { started: false };
		await this.cache.set(AUTO_KEY, true, AUTO_EVERY_MS);

		void (async () => {
			try {
				await this.sweepWorkspace();

				const contacts = await this.runContacts();

				const mirrored = await this.images.sweep();

				this.logger.log({
					message: "Automatic backfill swept",
					queued: contacts.queued,
					remaining: contacts.remaining,
					imagesMirrored: mirrored.copied,
				});
			} catch (error) {
				this.logger.error(
					{ message: "Automatic backfill failed" },
					error instanceof Error ? error.stack : String(error),
				);
			}
		})();

		return { started: true };
	}

	private async sweepWorkspace(): Promise<void> {
		const us = await readWorkspaceIdentity(this.db);

		if (!us?.website || us.profile) return;

		const attempted = await this.db.agentTask.findFirst({
			where: {
				kind: "workspace-profile",
				finishedAt: { gte: new Date(Date.now() - RECHECK_WORKSPACE_AFTER_MS) },
			},
			select: { id: true },
		});

		if (attempted) return;

		await this.agent.workspaceChanged(
			us.website,
			"We still have no profile of the company using this CRM",
		);
	}

	async run(): Promise<BackfillResult> {
		return this.runContacts();
	}

	private async runContacts(): Promise<BackfillResult> {
		const needsPhoto = await this.contactsNeedingPhoto();

		const [photoTotal, photoRows] = await Promise.all([
			this.db.contact.count({ where: needsPhoto }),
			this.db.contact.findMany({
				where: needsPhoto,
				orderBy: { createdAt: "asc" },
				take: MAX_PER_RUN,
				select: { id: true },
			}),
		]);

		const photos = await this.agent.backfill({
			kind: "portrait",
			reason: "Backfill — somewhere to look for a picture, and no picture",
			contactIds: photoRows.map((row) => row.id),
			budget: 1,
			priority: PRIORITY.portrait,
		});

		const headroom = MAX_PER_RUN - photoRows.length;

		const [researchTotal, researchRows] = await Promise.all([
			this.db.contact.count({ where: this.contactsNeverResearched() }),
			headroom > 0
				? this.db.contact.findMany({
						where: this.contactsNeverResearched(),
						orderBy: { createdAt: "asc" },
						take: headroom,
						select: { id: true },
					})
				: Promise.resolve([]),
		]);

		const research = await this.agent.backfill({
			kind: "identify",
			reason: "Backfill — this contact was never researched",
			contactIds: researchRows.map((row) => row.id),
		});

		return {
			queued: photos.queued + research.queued,
			alreadyQueued: photos.alreadyQueued + research.alreadyQueued,
			remaining:
				Math.max(0, photoTotal - photoRows.length) +
				Math.max(0, researchTotal - researchRows.length),
		};
	}

	/**
	 * Contacts with a face to fetch and nowhere it has been put yet.
	 *
	 * Two doors qualify, matching the agent's chain: a LinkedIn URL or a GitHub
	 * URL. A finished `portrait` task is the record that we looked; a month is
	 * long enough that a new LinkedIn account is still picked up eventually.
	 */
	private async contactsNeedingPhoto(): Promise<Prisma.ContactWhereInput> {
		const since = new Date(Date.now() - RECHECK_PHOTO_AFTER_MS);

		// `AgentTask.contactId` is a bare column with no Prisma relation, so this
		// cannot be a nested `some`. Two queries, and the id list is bounded by
		// the number of contacts we have already looked for.
		const checked = await this.db.agentTask.findMany({
			where: { kind: "portrait", finishedAt: { gte: since } },
			select: { contactId: true },
		});

		const recentlyChecked = checked
			.map((row) => row.contactId)
			.filter((id): id is string => id !== null);

		return {
			imageUrl: null,
			...(recentlyChecked.length > 0 ? { id: { notIn: recentlyChecked } } : {}),
			OR: [{ linkedinUrl: { not: null } }, { githubUrl: { not: null } }],
		};
	}

	private contactsNeverResearched(): Prisma.ContactWhereInput {
		return { enrichmentStatus: NEVER_SUCCEEDED };
	}
}
