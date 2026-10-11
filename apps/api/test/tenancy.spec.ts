import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { currentTenant, runInTenant, runUnscoped } from "@crm/db/tenant";
import { TRPCError } from "@trpc/server";
import { AuthMiddleware } from "../src/trpc/middlewares/auth.middleware";

const suffix = process.env.TEST_RUN_ID ?? "tenancy-spec";

const orgA = `${suffix}-a`;
const orgB = `${suffix}-b`;
const userId = `${suffix}-user`;
const plate = `TEN-${suffix}`.slice(0, 20);
const make = `Tenancy${suffix}`.slice(0, 30);

const inA = <T>(fn: () => Promise<T>) => runInTenant(orgA, fn);
const inB = <T>(fn: () => Promise<T>) => runInTenant(orgB, fn);

const clear = async () => {
	await runUnscoped(async () => {
		await db.vehicle.deleteMany({
			where: { organizationId: { in: [orgA, orgB] } },
		});
		await db.contact.deleteMany({
			where: { organizationId: { in: [orgA, orgB] } },
		});
	});
	await db.member.deleteMany({ where: { userId } });
	await db.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
	await db.vehicleCatalog.deleteMany({ where: { make } });
	await db.user.deleteMany({ where: { id: userId } });
};

const newVehicle = () =>
	db.vehicle.create({
		data: { type: "CAR", make: "Toyota", model: "Corolla", plateNumber: plate },
		select: { id: true, organizationId: true },
	});

beforeAll(async () => {
	await clear();

	for (const id of [orgA, orgB]) {
		await db.organization.create({
			data: { id, name: id, slug: id, createdAt: new Date() },
		});
	}

	await db.user.create({
		data: {
			id: userId,
			name: "Tenant",
			email: `tenant.${suffix}@example.test`,
		},
	});
});

afterAll(clear);

describe("tenant scoping", () => {
	it("stamps the active organization on create", async () => {
		const vehicle = await inA(newVehicle);

		expect(vehicle.organizationId).toBe(orgA);
	});

	it("lets two organizations use the same plate and the same email", async () => {
		const b = await inB(newVehicle);

		expect(b.organizationId).toBe(orgB);
		await expect(inA(newVehicle)).rejects.toThrow();

		const email = `same.${suffix}@example.test`;
		const create = () =>
			db.contact.create({ data: { firstName: "Same", email } });

		await inA(create);
		await inB(create);
		await expect(inA(create)).rejects.toThrow();
	});

	it("never lists another organization's rows", async () => {
		const vehicles = await inB(() =>
			db.vehicle.findMany({ where: { plateNumber: plate } }),
		);

		expect(vehicles.length).toBe(1);
		expect(vehicles.every((row) => row.organizationId === orgB)).toBe(true);
		expect(
			await inB(() => db.vehicle.count({ where: { plateNumber: plate } })),
		).toBe(1);
	});

	it("cannot read, change or delete another organization's row by id", async () => {
		const mine = await inA(() =>
			db.vehicle.findFirstOrThrow({ where: { plateNumber: plate } }),
		);

		expect(
			await inB(() => db.vehicle.findUnique({ where: { id: mine.id } })),
		).toBeNull();

		await expect(
			inB(() =>
				db.vehicle.update({ where: { id: mine.id }, data: { color: "red" } }),
			),
		).rejects.toThrow();

		const deleted = await inB(() =>
			db.vehicle.deleteMany({ where: { id: mine.id } }),
		);
		expect(deleted.count).toBe(0);

		const untouched = await inA(() =>
			db.vehicle.findUniqueOrThrow({ where: { id: mine.id } }),
		);
		expect(untouched.color).toBeNull();
	});

	it("refuses to write a row into a different organization", async () => {
		await expect(
			inA(() =>
				db.vehicle.create({
					data: {
						type: "CAR",
						make: "Kia",
						model: "Rio",
						plateNumber: `${plate}-X`,
						organizationId: orgB,
					},
				}),
			),
		).rejects.toThrow("another organization");
	});

	it("overrides a where clause that names another organization", async () => {
		const rows = await inB(() =>
			db.vehicle.findMany({ where: { organizationId: orgA } }),
		);

		expect(rows.every((row) => row.organizationId === orgB)).toBe(true);
	});

	it("leaves the vehicle catalog shared", async () => {
		await db.vehicleCatalog.create({ data: { make, model: "Shared" } });

		const seenByA = await inA(() =>
			db.vehicleCatalog.count({ where: { make } }),
		);
		const seenByB = await inB(() =>
			db.vehicleCatalog.count({ where: { make } }),
		);

		expect(seenByA).toBe(1);
		expect(seenByB).toBe(1);
	});

	it("only steps outside an organization when asked to", async () => {
		const both = await runUnscoped(() =>
			db.vehicle.findMany({ where: { plateNumber: plate } }),
		);

		expect(both.length).toBeGreaterThanOrEqual(2);
		expect(await runUnscoped(async () => currentTenant())).toBeNull();
	});
});

describe("AuthMiddleware", () => {
	const middleware = new AuthMiddleware();

	const call = (activeOrganizationId: string | null) => {
		const seen: { tenant: string | null; ctx?: unknown } = { tenant: "unset" };

		const run = middleware.use({
			ctx: {
				session: {
					user: { id: userId },
					session: { activeOrganizationId },
				},
			},
			next: async (opts?: { ctx?: unknown }) => {
				seen.tenant = currentTenant();
				seen.ctx = opts?.ctx;
				return { ok: true };
			},
		} as never);

		return { run, seen };
	};

	it("turns away a signed-in user who has no organization", async () => {
		const { run } = call(null);

		await expect(run).rejects.toBeInstanceOf(TRPCError);
		await expect(call(null).run).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("runs the request inside the member's organization", async () => {
		await db.member.create({
			data: {
				id: `${suffix}-member`,
				organizationId: orgB,
				userId,
				role: "member",
				createdAt: new Date(),
			},
		});

		const { run, seen } = call(null);
		await run;

		expect(seen.tenant).toBe(orgB);
		expect((seen.ctx as { organizationId: string }).organizationId).toBe(orgB);
	});

	it("ignores an active organization the user does not belong to", async () => {
		const { run, seen } = call(orgA);
		await run;

		expect(seen.tenant).toBe(orgB);
	});
});
