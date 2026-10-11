import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import {
	activeOrganizationOf,
	JOIN_ATTEMPTS,
	joinOrganizationByCode,
} from "../src/organization";

const suffix = process.env.TEST_RUN_ID ?? "organization-spec";

const organizationId = `${suffix}-org`;
const userId = `${suffix}-user`;
const joinCode = `TEST${suffix.replace(/[^a-z0-9]/gi, "").toUpperCase()}`.slice(
	0,
	16,
);

const clear = async () => {
	await db.rateLimit.deleteMany({ where: { key: `join:${userId}` } });
	await db.session.deleteMany({ where: { userId } });
	await db.member.deleteMany({ where: { organizationId } });
	await db.organization.deleteMany({ where: { id: organizationId } });
	await db.user.deleteMany({ where: { id: userId } });
};

beforeEach(async () => {
	await clear();

	await db.organization.create({
		data: {
			id: organizationId,
			name: "Spec agency",
			slug: organizationId,
			joinCode,
			createdAt: new Date(),
		},
	});

	await db.user.create({
		data: {
			id: userId,
			name: "Newcomer",
			email: `newcomer.${suffix}@example.test`,
		},
	});

	await db.session.create({
		data: {
			id: `${suffix}-session`,
			token: `${suffix}-token`,
			userId,
			expiresAt: new Date(Date.now() + 60_000),
		},
	});
});

afterAll(clear);

describe("joinOrganizationByCode", () => {
	it("starts with no organization", async () => {
		expect(await activeOrganizationOf(userId)).toBeUndefined();
	});

	it("enrols the user and activates the organization on their sessions", async () => {
		const result = await joinOrganizationByCode(userId, joinCode);

		expect(result).toEqual({ ok: true, organizationId });
		expect(await activeOrganizationOf(userId)).toBe(organizationId);

		const session = await db.session.findFirstOrThrow({ where: { userId } });
		expect(session.activeOrganizationId).toBe(organizationId);

		const member = await db.member.findFirstOrThrow({
			where: { organizationId, userId },
		});
		expect(member.role).toBe("member");
	});

	it("ignores case and spaces in the code", async () => {
		const result = await joinOrganizationByCode(
			userId,
			` ${joinCode.toLowerCase()} `,
		);

		expect(result.ok).toBe(true);
	});

	it("refuses an unknown code without enrolling anyone", async () => {
		const result = await joinOrganizationByCode(userId, "NOT-A-CODE");

		expect(result).toEqual({ ok: false, reason: "invalid" });
		expect(await activeOrganizationOf(userId)).toBeUndefined();
	});

	it("is idempotent for a user who is already a member", async () => {
		await joinOrganizationByCode(userId, joinCode);
		await joinOrganizationByCode(userId, joinCode);

		expect(await db.member.count({ where: { organizationId, userId } })).toBe(
			1,
		);
	});

	it("throttles repeated wrong codes", async () => {
		for (let attempt = 0; attempt < JOIN_ATTEMPTS; attempt++) {
			await joinOrganizationByCode(userId, "WRONG");
		}

		expect(await joinOrganizationByCode(userId, joinCode)).toEqual({
			ok: false,
			reason: "throttled",
		});
		expect(await activeOrganizationOf(userId)).toBeUndefined();
	});
});
