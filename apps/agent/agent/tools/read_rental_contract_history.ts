import { defineTool } from "eve/tools";
import { z } from "zod";
import { readRentalContractHistory } from "../lib/accounts";
import { focusOn } from "../lib/focus";

export default defineTool({
	description:
		"Read a rental contract in full: status and how long it has been there, vehicle, dates, amount, deposit, drivers with their contact ids, the correspondence and meetings with those people, and the notes. Free — call it first in a rental contract session.",
	inputSchema: z.object({
		rentalContractId: z.string(),
		threads: z
			.number()
			.int()
			.min(1)
			.max(20)
			.default(5)
			.describe("How many recent threads to read."),
	}),
	async execute({ rentalContractId, threads }) {
		const history = await readRentalContractHistory(rentalContractId, {
			threads,
		});
		if (!history)
			return { found: false as const, reason: "No such rental contract." };

		focusOn({ contactId: history.people[0]?.id ?? null });

		return { found: true as const, ...history };
	},
});
