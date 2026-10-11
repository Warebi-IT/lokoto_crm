import { db } from "@crm/db";
import {
	newJoinCode,
	normalizeJoinCode,
	WORKSPACE_ID,
	workspaceSlug,
} from "@crm/db/workspace";

export { WORKSPACE_ID };

export const DEFAULT_WORKSPACE_NAME = "CRM";

export const WORKSPACE_ROLES = ["owner", "admin", "member"] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export function isWorkspaceRole(value: string): value is WorkspaceRole {
	return (WORKSPACE_ROLES as readonly string[]).includes(value);
}

export function isWorkspaceAdmin(role: WorkspaceRole | null): boolean {
	return role === "owner" || role === "admin";
}

export function canRenameWorkspace(role: WorkspaceRole | null): boolean {
	return isWorkspaceAdmin(role);
}

export function canChangeRole(role: WorkspaceRole | null): boolean {
	return isWorkspaceAdmin(role);
}

export function canManageCurrency(role: WorkspaceRole | null): boolean {
	return isWorkspaceAdmin(role);
}

export async function activeOrganizationOf(
	userId: string,
): Promise<string | undefined> {
	const member = await db.member.findFirst({
		where: { userId },
		orderBy: [{ createdAt: "asc" }, { id: "asc" }],
		select: { organizationId: true },
	});

	return member?.organizationId;
}

export async function resolveRequestOrganization(
	userId: string,
	activeOrganizationId: string | null | undefined,
): Promise<string | undefined> {
	if (activeOrganizationId) {
		const member = await db.member.findUnique({
			where: {
				organizationId_userId: { organizationId: activeOrganizationId, userId },
			},
			select: { organizationId: true },
		});

		if (member) return member.organizationId;
	}

	return activeOrganizationOf(userId);
}

export async function resolveActiveOrganization(
	userId: string,
): Promise<string | undefined> {
	try {
		const existing = await activeOrganizationOf(userId);

		if (existing) return existing;

		return await db.$transaction(async (tx) => {
			if ((await tx.organization.count()) > 0) return undefined;

			const workspace = await tx.organization.create({
				data: {
					id: WORKSPACE_ID,
					name: DEFAULT_WORKSPACE_NAME,
					slug: workspaceSlug(DEFAULT_WORKSPACE_NAME),
					joinCode: newJoinCode(),
					createdAt: new Date(),
				},
				select: { id: true },
			});

			await tx.member.create({
				data: {
					id: crypto.randomUUID(),
					organizationId: workspace.id,
					userId,
					role: "owner",
					createdAt: new Date(),
				},
			});

			return workspace.id;
		});
	} catch (error) {
		console.error(
			`[auth] could not resolve the organization of user ${userId}; the next sign-in will retry`,
			error,
		);
		return undefined;
	}
}

export const JOIN_ATTEMPTS = 5;

export const JOIN_WINDOW_MS = 10 * 60 * 1000;

async function consumeJoinAttempt(userId: string): Promise<boolean> {
	const key = `join:${userId}`;
	const now = Date.now();

	return db.$transaction(async (tx) => {
		const row = await tx.rateLimit.findUnique({ where: { key } });

		if (!row || now - Number(row.lastRequest) > JOIN_WINDOW_MS) {
			await tx.rateLimit.upsert({
				where: { key },
				create: { id: crypto.randomUUID(), key, count: 1, lastRequest: now },
				update: { count: 1, lastRequest: now },
			});
			return true;
		}

		if (row.count >= JOIN_ATTEMPTS) return false;

		await tx.rateLimit.update({
			where: { key },
			data: { count: { increment: 1 }, lastRequest: now },
		});
		return true;
	});
}

export type JoinResult =
	| { ok: true; organizationId: string }
	| { ok: false; reason: "invalid" | "throttled" };

export async function joinOrganizationByCode(
	userId: string,
	code: string,
): Promise<JoinResult> {
	const joinCode = normalizeJoinCode(code);

	if (!joinCode) return { ok: false, reason: "invalid" };

	if (!(await consumeJoinAttempt(userId))) {
		return { ok: false, reason: "throttled" };
	}

	const organization = await db.organization.findUnique({
		where: { joinCode },
		select: { id: true },
	});

	if (!organization) return { ok: false, reason: "invalid" };

	await db.$transaction(async (tx) => {
		await tx.member.upsert({
			where: {
				organizationId_userId: { organizationId: organization.id, userId },
			},
			create: {
				id: crypto.randomUUID(),
				organizationId: organization.id,
				userId,
				role: "member",
				createdAt: new Date(),
			},
			update: {},
		});

		await tx.session.updateMany({
			where: { userId },
			data: { activeOrganizationId: organization.id },
		});
	});

	await db.rateLimit.deleteMany({ where: { key: `join:${userId}` } });

	return { ok: true, organizationId: organization.id };
}
