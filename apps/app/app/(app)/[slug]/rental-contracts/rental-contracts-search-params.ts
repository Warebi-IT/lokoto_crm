import { createListSearchParams } from "@/components/data-table/list-search-params";

export const rentalContractsSearchParams = createListSearchParams({
	defaultSort: "createdAt",
	defaultDir: "desc",
	facetIds: ["owner", "status", "channel"] as const,
});
