import type { CarbonIcon } from "@crm/ui/components/icon";

export type AgentRecordKind = "contact" | "vehicle" | "rentalContract";

export type AgentRecord = { kind: AgentRecordKind; id: string };

type RecordCopy = {
	header: string;
	field: "contactId" | "vehicleId" | "rentalContractId";
	title: string;
	blurb: string;
	placeholder: string;
	suggestions: string[];
};

const COPY: Record<AgentRecordKind, RecordCopy> = {
	contact: {
		header: "x-crm-contact",
		field: "contactId",
		title: "Ask about this person",
		blurb:
			"Every step is shown as it happens — including the leads it throws away.",
		placeholder: "Are they still there?",
		suggestions: [
			"Who is this person?",
			"Are they still there?",
			"What should I know before a call?",
		],
	},
	vehicle: {
		header: "x-crm-vehicle",
		field: "vehicleId",
		title: "Ask about this vehicle",
		blurb:
			"It can read its rental history, maintenance record and open incidents.",
		placeholder: "When is this due for service?",
		suggestions: [
			"When is this due for service?",
			"How much has it earned this month?",
			"Any open incidents on it?",
		],
	},
	rentalContract: {
		header: "x-crm-rental-contract",
		field: "rentalContractId",
		title: "Ask about this rental contract",
		blurb: "It can read the vehicle, the renter and the payments on it.",
		placeholder: "Is the deposit settled?",
		suggestions: [
			"Is the deposit settled?",
			"Is this contract overdue?",
			"What has this contract been paid so far?",
		],
	},
};

export function recordCopy(kind: AgentRecordKind): RecordCopy {
	return COPY[kind];
}

export function recordHeader(record: AgentRecord): Record<string, string> {
	return { [COPY[record.kind].header]: record.id };
}

export function recordFilter(record: AgentRecord): {
	contactId?: string;
	vehicleId?: string;
	rentalContractId?: string;
} {
	return { [COPY[record.kind].field]: record.id };
}

export type { CarbonIcon };
