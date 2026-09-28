import type { Metadata } from "next";
import { Suspense } from "react";
import {
	PageShell,
	PageShellActions,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellLoading,
	PageShellTitle,
} from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { CreateRentalContractSheet } from "./create-rental-contract-sheet";
import { rentalContractsSearchParams } from "./rental-contracts-search-params";
import { RentalContractsTable } from "./rental-contracts-table";

export const metadata: Metadata = {
	title: "Contrats de location",
};

export default function RentalContractsPage({
	searchParams,
}: PageProps<"/[slug]/rental-contracts">) {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Contrats de location</PageShellTitle>
					<PageShellDescription>
						Réservations, locations en cours et retours de véhicules.
					</PageShellDescription>
				</PageShellHeading>
				<PageShellActions>
					<CreateRentalContractSheet />
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<RentalContracts searchParams={searchParams} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function RentalContracts({
	searchParams,
}: Pick<PageProps<"/[slug]/rental-contracts">, "searchParams">) {
	const [, values] = await Promise.all([
		requireSession(),
		rentalContractsSearchParams.load(searchParams),
	]);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	await Promise.all([
		queryClient.prefetchQuery(
			trpc.rentalContracts.list.queryOptions(
				rentalContractsSearchParams.toInput(values),
			),
		),
		queryClient.prefetchQuery(trpc.users.list.queryOptions()),
		queryClient.prefetchQuery(
			trpc.vehicles.list.queryOptions({
				q: "",
				sort: "",
				dir: "asc",
				page: 1,
				pageSize: 100,
				status: "AVAILABLE",
				type: "all",
			}),
		),
	]);

	return (
		<HydrateClient>
			<RentalContractsTable />
		</HydrateClient>
	);
}
