import { describe, expect, it } from "bun:test";
import { anchorResults } from "../lib/agent-results";
import type { TranscriptItem } from "../lib/agent-transcript";

type ContractListResult = {
	asOf: string;
	criteria: { status: string; inactiveForDays: number | null };
	contracts: { id: string }[];
	hasMore: boolean;
};

function validate(value: unknown): ContractListResult | null {
	if (!value || typeof value !== "object") return null;
	const record = value as Record<string, unknown>;
	if (typeof record.asOf !== "string" || !Array.isArray(record.contracts)) {
		return null;
	}
	return record as unknown as ContractListResult;
}

function group(
	results: readonly { itemId: string; value: ContractListResult }[],
): readonly { itemId: string; value: ContractListResult }[] {
	const groups = new Map<
		string,
		{ itemId: string; value: ContractListResult; order: number }
	>();

	for (const [index, page] of results.entries()) {
		const key = JSON.stringify(page.value.criteria);
		const previous = groups.get(key);
		const contracts = new Map(
			previous?.value.contracts.map((row) => [row.id, row] as const),
		);
		for (const row of page.value.contracts) contracts.set(row.id, row);

		groups.set(key, {
			itemId: page.itemId,
			value: { ...page.value, contracts: [...contracts.values()] },
			order: previous?.order ?? index,
		});
	}

	return [...groups.values()]
		.sort((left, right) => left.order - right.order)
		.map(({ itemId, value }) => ({ itemId, value }));
}

const page = (status: string, ids: string[]) => ({
	asOf: "2026-08-07T00:00:00.000Z",
	criteria: { status, inactiveForDays: null },
	contracts: ids.map((id) => ({ id })),
	hasMore: false,
});

const did = (
	id: string,
	output: unknown,
	extra: Partial<Extract<TranscriptItem, { kind: "did" }>> = {},
): TranscriptItem => ({
	kind: "did",
	id,
	label: "Reviewed the rental contracts",
	input: null,
	output,
	errorText: null,
	tone: "neutral",
	pending: false,
	sources: [],
	tool: "list_rental_contracts",
	...extra,
});

const said = (id: string, text: string): TranscriptItem => ({
	kind: "said",
	id,
	mine: false,
	text,
});

const anchorContracts = (items: readonly TranscriptItem[]) =>
	anchorResults<ContractListResult>({
		items,
		tool: "list_rental_contracts",
		validate,
		group,
	});

describe("anchorResults", () => {
	it("leaves a finished result under its own call when a pending one follows", () => {
		const anchored = anchorContracts([
			did("a", page("OPEN", ["c1"])),
			did("b", null, { pending: true, output: null }),
		]);

		expect([...anchored.keys()]).toEqual(["a"]);
	});

	it("never anchors to a failed call", () => {
		const anchored = anchorContracts([
			did("a", page("OPEN", ["c1"])),
			did("b", { broken: true }, { tone: "warning", errorText: "Nope." }),
		]);

		expect([...anchored.keys()]).toEqual(["a"]);
	});

	it("keeps two different criteria under their own calls", () => {
		const anchored = anchorContracts([
			did("a", page("OPEN", ["c1"])),
			said("t", "And the completed ones:"),
			did("b", page("COMPLETED", ["c2"])),
		]);

		expect([...anchored.keys()]).toEqual(["a", "b"]);
		expect(anchored.get("a")?.[0]?.criteria.status).toBe("OPEN");
		expect(anchored.get("b")?.[0]?.criteria.status).toBe("COMPLETED");
	});

	it("anchors paginated pages of one criteria to the final page", () => {
		const anchored = anchorContracts([
			did("a", page("OPEN", ["c1"])),
			did("b", page("OPEN", ["c2"])),
		]);

		expect([...anchored.keys()]).toEqual(["b"]);
		expect(anchored.get("b")?.[0]?.contracts.map((row) => row.id)).toEqual([
			"c1",
			"c2",
		]);
	});

	it("anchors pagination to the last valid page, not a later failure", () => {
		const anchored = anchorContracts([
			did("a", page("OPEN", ["c1"])),
			did("b", page("OPEN", ["c2"])),
			did("c", { broken: true }),
		]);

		expect([...anchored.keys()]).toEqual(["b"]);
	});

	it("ignores calls belonging to another tool", () => {
		const anchored = anchorContracts([
			did("a", page("OPEN", ["c1"]), { tool: "search_crm" }),
		]);

		expect(anchored.size).toBe(0);
	});
});
