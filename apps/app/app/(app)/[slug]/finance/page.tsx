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
import { FinanceView } from "./finance-view";

export const metadata: Metadata = {
	title: "Finance",
};

export default function FinancePage() {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Finance</PageShellTitle>
					<PageShellDescription>
						Chiffre d’affaires, charges et rentabilité de la flotte.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<Finance />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Finance() {
	await requireSession();

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	await Promise.all([
		queryClient.prefetchQuery(trpc.profitability.summary.queryOptions({})),
		queryClient.prefetchQuery(trpc.profitability.topVehicles.queryOptions({})),
		queryClient.prefetchQuery(trpc.profitability.topClients.queryOptions({})),
		queryClient.prefetchQuery(trpc.profitability.bySegment.queryOptions({})),
	]);

	return (
		<HydrateClient>
			<FinanceView />
		</HydrateClient>
	);
}
