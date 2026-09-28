"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { contactsSearchParams } from "@/app/(app)/[slug]/contacts/contacts-search-params";
import { rentalContractsSearchParams } from "@/app/(app)/[slug]/rental-contracts/rental-contracts-search-params";
import { vehiclesSearchParams } from "@/app/(app)/[slug]/vehicles/vehicles-search-params";
import { useTRPC } from "@/lib/trpc/client";

export type Section =
	| "/"
	| "/contacts"
	| "/vehicles"
	| "/rental-contracts"
	| "/settings";

export function usePrefetchSection(): (section: string) => void {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	return useCallback(
		(section: string) => {
			switch (section) {
				case "/":
					void queryClient.prefetchQuery(
						trpc.dashboard.summary.queryOptions({ scope: "me" }),
					);
					return;
				case "/contacts":
					void queryClient.prefetchQuery(
						trpc.contacts.list.queryOptions(
							contactsSearchParams.defaultInput(),
						),
					);
					return;
				case "/vehicles":
					void queryClient.prefetchQuery(
						trpc.vehicles.list.queryOptions(
							vehiclesSearchParams.defaultInput(),
						),
					);
					return;
				case "/rental-contracts":
					void queryClient.prefetchQuery(
						trpc.rentalContracts.list.queryOptions(
							rentalContractsSearchParams.defaultInput(),
						),
					);
					return;
				default:
					return;
			}
		},
		[trpc, queryClient],
	);
}
