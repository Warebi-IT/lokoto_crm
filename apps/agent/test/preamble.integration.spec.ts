import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db, RentalContractStatus, VehicleType } from "@crm/db";
import {
	composeClosing,
	contactPreamble,
	noRecordPreamble,
	rentalContractPreamble,
	sessionPreamble,
	vehiclePreamble,
	workspacePreamble,
} from "../agent/lib/preamble";
import { identity } from "../agent/lib/workspace";

const suffix = process.env.TEST_RUN_ID ?? "preamble-spec";
const domain = `fernhill-${suffix}.test`;

let vehicleId: string;
let rentalContractId: string;
let paulaId: string;
let tomiId: string;

const rep = { dispatched: false };

beforeAll(async () => {
	await cleanup();

	const user = await db.user.create({
		data: {
			id: `user-${suffix}`,
			name: "Rep One",
			email: `rep.${suffix}@example.test`,
			emailVerified: true,
		},
		select: { id: true },
	});

	const paula = await db.contact.create({
		data: {
			firstName: "Paula",
			lastName: "Marchetti",
			title: "Growth Specialist",
			email: `paula.marchetti@${domain}`,
			lastActivityAt: new Date(),
		},
		select: { id: true },
	});
	paulaId = paula.id;

	const tomi = await db.contact.create({
		data: {
			firstName: "Tomi",
			lastName: "Okonkwo",
			title: "Head of Security",
			email: `tomi.okonkwo@${domain}`,
		},
		select: { id: true },
	});
	tomiId = tomi.id;

	const vehicle = await db.vehicle.create({
		data: {
			type: VehicleType.MINIBUS,
			make: "Toyota",
			model: "Hiace",
			plateNumber: `FERNHILL-${suffix}`,
			dailyRate: 40_000,
			currency: "XOF",
		},
		select: { id: true },
	});
	vehicleId = vehicle.id;

	const rentalContract = await db.rentalContract.create({
		data: {
			vehicleId,
			contactId: paulaId,
			ownerId: user.id,
			status: RentalContractStatus.ACTIVE,
			startDate: new Date(),
			endDate: new Date(Date.now() + 6 * 86_400_000),
			pricePerDay: 40_000,
			currency: "XOF",
			totalAmount: 48_000,
			depositAmount: 20_000,
			depositCurrency: "XOF",
			drivers: { create: [{ contactId: tomiId, role: "ADDITIONAL" }] },
		},
		select: { id: true },
	});
	rentalContractId = rentalContract.id;
});

afterAll(cleanup);

async function cleanup(): Promise<void> {
	const contacts = await db.contact.findMany({
		where: { email: { endsWith: `@${domain}` } },
		select: { id: true },
	});
	const ids = contacts.map((contact) => contact.id);

	if (ids.length > 0) {
		await db.activity.deleteMany({ where: { contactId: { in: ids } } });
		await db.rentalContract.deleteMany({ where: { contactId: { in: ids } } });
		await db.vehicle.deleteMany({
			where: { plateNumber: `FERNHILL-${suffix}` },
		});
		await db.contact.deleteMany({ where: { id: { in: ids } } });
	}

	await db.user.deleteMany({ where: { email: `rep.${suffix}@example.test` } });
}

describe("contactPreamble", () => {
	it("carries the contact's own id", async () => {
		const { markdown, focus } = await contactPreamble(paulaId, rep);

		expect(markdown).toContain(`\`${paulaId}\``);
		expect(focus).toEqual({ contactId: paulaId });
	});

	it("lists the rental contracts they are on", async () => {
		const { markdown } = await contactPreamble(paulaId, rep);

		expect(markdown).toContain(
			`Toyota Hiace (ACTIVE, renter) \`${rentalContractId}\``,
		);
	});

	it("lists the contracts they drive on as an additional driver", async () => {
		const { markdown } = await contactPreamble(tomiId, rep);

		expect(markdown).toContain(
			`Toyota Hiace (ACTIVE, additional) \`${rentalContractId}\``,
		);
	});
});

describe("vehiclePreamble", () => {
	it("carries the vehicle id and its recent contracts", async () => {
		const { markdown, focus } = await vehiclePreamble(vehicleId, rep);

		expect(markdown).toContain(`vehicle id \`${vehicleId}\``);
		expect(markdown).toContain(
			`Paula Marchetti (ACTIVE) \`${rentalContractId}\``,
		);
		expect(markdown).toContain("A vehicle itself has no research tools");
		expect(focus).toEqual({});
	});
});

describe("rentalContractPreamble", () => {
	it("carries the contract, the vehicle and the people, all with ids", async () => {
		const { markdown, focus } = await rentalContractPreamble(
			rentalContractId,
			rep,
		);

		expect(markdown).toContain(`rental contract id \`${rentalContractId}\``);
		expect(markdown).toContain(`vehicle id \`${vehicleId}\``);
		expect(markdown).toContain(`renter \`${paulaId}\``);
		expect(markdown).toContain(`additional driver \`${tomiId}\``);
		expect(focus).toEqual({ contactId: paulaId });
	});
});

describe("who opened the session", () => {
	it("tells a rep's session to answer the question", async () => {
		const { markdown } = await contactPreamble(paulaId, { dispatched: false });

		expect(markdown).toContain("A rep has this record open");
		expect(markdown).not.toContain("Nobody is waiting on a reply");
	});

	it("tells a dispatched session to do the work and stop", async () => {
		const { markdown } = await contactPreamble(paulaId, {
			dispatched: true,
			kind: "identity",
		});

		expect(markdown).toContain("Nobody is waiting on a reply");
		expect(markdown).not.toContain("A rep has this record open");
	});
});

describe("sessionPreamble", () => {
	it("routes each record kind to its own conversation", async () => {
		const contact = await sessionPreamble({ contactId: paulaId }, rep);
		const vehicle = await sessionPreamble({ vehicleId }, rep);
		const rentalContract = await sessionPreamble({ rentalContractId }, rep);

		expect(contact.markdown).toContain("Start with `read_crm_history`");
		expect(vehicle.markdown).toContain(
			"A vehicle itself has no research tools",
		);
		expect(rentalContract.markdown).toContain(
			"Start with `read_rental_contract_history`",
		);
	});

	it("prefers the contact when a session carries more than one id", async () => {
		const { markdown } = await sessionPreamble(
			{ contactId: paulaId, vehicleId, rentalContractId },
			rep,
		);

		expect(markdown).toContain("Start with `read_crm_history`");
	});

	it("tells a session with no record that the CRM is searchable", async () => {
		const { markdown } = await sessionPreamble({}, rep);

		expect(markdown).toBe((await noRecordPreamble()).markdown);
		expect(markdown).toContain("`search_crm`");
	});
});

describe("every session is told who we are", () => {
	it("ends each preamble with the same account of us", async () => {
		const expected = await composeClosing(await identity());

		for (const { markdown } of [
			await contactPreamble(paulaId, rep),
			await vehiclePreamble(vehicleId, rep),
			await rentalContractPreamble(rentalContractId, rep),
			await noRecordPreamble(),
		]) {
			expect(markdown.endsWith(expected)).toBe(true);
		}
	});
});

describe("the workspace profile session", () => {
	it("is routed by the task kind, with no record of its own", async () => {
		const { markdown, focus } = await sessionPreamble(
			{},
			{ dispatched: true, kind: "workspace-profile" },
		);

		expect(focus).toEqual({});
		expect(markdown).toContain("the company you work for");
		expect(markdown).not.toContain("`search_crm` finds any contact");
	});

	it("sends the session to our own site, and holds it to a size", async () => {
		const { markdown } = await workspacePreamble({
			name: "Comp AI",
			website: "trycomp.ai",
			profile: null,
		});

		expect(markdown).toContain("https://trycomp.ai");
		expect(markdown).toContain("`write_workspace_profile`");
		expect(markdown).toContain("320 characters");
	});

	it("refuses to guess when nobody has said what our website is", async () => {
		const { markdown } = await workspacePreamble(null);

		expect(markdown).toContain("do not guess");
		expect(markdown).not.toContain("`write_workspace_profile`");
	});

	it("stops rather than sending the session at something unfetchable", async () => {
		const { markdown } = await workspacePreamble({
			name: "Comp AI",
			website: "httpx://trycomp.ai",
			profile: null,
		});

		expect(markdown).toContain("do not guess");
		expect(markdown).not.toContain("`web_fetch`");
	});
});
