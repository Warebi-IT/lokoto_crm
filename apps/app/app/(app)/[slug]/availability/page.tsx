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
import { AvailabilityView } from "./availability-view";

export const metadata: Metadata = {
	title: "Disponibilité des véhicules",
};

export default function AvailabilityPage() {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Disponibilité des véhicules</PageShellTitle>
					<PageShellDescription>
						Vérifiez quels véhicules sont disponibles entre deux dates.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<AvailabilityView />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}
