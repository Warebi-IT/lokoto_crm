import type { Metadata } from "next";
import { Suspense } from "react";
import {
	PageShell,
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
import { addDays, dateInput, WEEK_DAYS } from "./date-utils";
import { PlanningView } from "./planning-view";

export const metadata: Metadata = {
	title: "Planning",
};

export default function PlanningPage() {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Planning</PageShellTitle>
					<PageShellDescription>
						Départs et retours de la flotte, véhicule par véhicule.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<Planning />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Planning() {
	await requireSession();

	const startDate = dateInput(new Date());
	const endDate = addDays(startDate, WEEK_DAYS);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	await queryClient.prefetchQuery(
		trpc.rentalContracts.planning.queryOptions({ startDate, endDate }),
	);

	return (
		<HydrateClient>
			<PlanningView initialStart={startDate} />
		</HydrateClient>
	);
}
