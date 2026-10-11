import { db } from "@crm/db";
import { currentTenant } from "@crm/db/tenant";

export type RecordRef = {
	contactId?: string | null;
	vehicleId?: string | null;
	rentalContractId?: string | null;
};

export async function soleOrganizationId(): Promise<string> {
	const active = currentTenant();

	if (active) return active;

	const organizations = await db.organization.findMany({
		select: { id: true },
		take: 2,
	});

	const [only, other] = organizations;

	if (!only || other) {
		throw new Error(
			"The agent cannot tell which organization this belongs to: there is more than one, and nothing here names a record from it.",
		);
	}

	return only.id;
}

export async function organizationOfRecord(ref: RecordRef): Promise<string> {
	if (ref.contactId) {
		const row = await db.contact.findFirst({
			where: { id: ref.contactId },
			select: { organizationId: true },
		});
		if (row) return row.organizationId;
	}

	if (ref.vehicleId) {
		const row = await db.vehicle.findFirst({
			where: { id: ref.vehicleId },
			select: { organizationId: true },
		});
		if (row) return row.organizationId;
	}

	if (ref.rentalContractId) {
		const row = await db.rentalContract.findFirst({
			where: { id: ref.rentalContractId },
			select: { organizationId: true },
		});
		if (row) return row.organizationId;
	}

	return soleOrganizationId();
}
