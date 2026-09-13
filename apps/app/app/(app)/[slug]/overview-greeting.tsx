"use client";

import { useQueryState } from "nuqs";
import { PageShellDescription, PageShellTitle } from "@/components/page-shell";
import { overviewParsers } from "./overview-search-params";

export function OverviewGreetingFallback() {
	return (
		<>
			<PageShellTitle>Bon retour</PageShellTitle>
			<PageShellDescription>
				Ce que vous avez clôturé, ce qui est encore en cours, et ce qui
				nécessite votre attention aujourd’hui.
			</PageShellDescription>
		</>
	);
}

export function OverviewGreeting() {
	const [scope] = useQueryState("scope", overviewParsers.scope);

	return (
		<>
			<PageShellTitle>Bon retour</PageShellTitle>
			<PageShellDescription>
				{scope === "me"
					? "Ce que vous avez clôturé, ce qui est encore en cours, et ce qui nécessite votre attention aujourd’hui."
					: "Ce que l’équipe a clôturé, ce qui est encore en cours, et ce qui nécessite votre attention aujourd’hui."}
			</PageShellDescription>
		</>
	);
}
