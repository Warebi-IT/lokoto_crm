import { defineTool } from "eve/tools";
import { z } from "zod";
import { listRentalContracts } from "../lib/lookup";
import { assertResearchPurpose } from "../lib/session-purpose";

export default defineTool({
	description:
		"List rental contracts across the CRM with status and inactivity filters. Use this for broad requests such as all active contracts, stale contracts, contracts untouched for a number of days, or a fleet-wide sweep. Results are oldest-touch first and paginated; continue with nextCursor while hasMore is true. Free.",
	inputSchema: z.object({
		status: z.enum(["open", "completed", "cancelled", "all"]).default("open"),
		inactiveForDays: z
			.number()
			.int()
			.min(0)
			.max(3650)
			.optional()
			.describe(
				"Return contracts whose last activity was at least this many days ago. Contracts with no activity qualify once they are this old.",
			),
		vehicleId: z.string().optional(),
		ownerId: z.string().optional(),
		limit: z.number().int().min(1).max(100).default(50),
		cursor: z.string().optional(),
	}),
	async execute(input, ctx) {
		assertResearchPurpose(ctx);
		return listRentalContracts(input);
	},
	toModelOutput(output) {
		return {
			type: "json",
			value: output,
		};
	},
});
