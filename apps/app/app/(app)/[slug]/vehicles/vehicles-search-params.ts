import { createListSearchParams } from "@/components/data-table/list-search-params";

export const vehiclesSearchParams = createListSearchParams({
	defaultSort: "createdAt",
	defaultDir: "desc",
	facetIds: ["status", "type"] as const,
});
