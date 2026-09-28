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
import { CreateVehicleSheet } from "./create-vehicle-sheet";
import { vehiclesSearchParams } from "./vehicles-search-params";
import { VehiclesTable } from "./vehicles-table";

export const metadata: Metadata = {
	title: "Véhicules",
};

export default function VehiclesPage({
	searchParams,
}: PageProps<"/[slug]/vehicles">) {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Véhicules</PageShellTitle>
					<PageShellDescription>
						La flotte — voitures, motos, scooters, camions et minibus.
					</PageShellDescription>
				</PageShellHeading>
				<PageShellActions>
					<CreateVehicleSheet />
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<Vehicles searchParams={searchParams} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Vehicles({
	searchParams,
}: Pick<PageProps<"/[slug]/vehicles">, "searchParams">) {
	const [, values] = await Promise.all([
		requireSession(),
		vehiclesSearchParams.load(searchParams),
	]);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	await Promise.all([
		queryClient.prefetchQuery(
			trpc.vehicles.list.queryOptions(vehiclesSearchParams.toInput(values)),
		),
		queryClient.prefetchQuery(trpc.users.list.queryOptions()),
	]);

	return (
		<HydrateClient>
			<VehiclesTable />
		</HydrateClient>
	);
}
