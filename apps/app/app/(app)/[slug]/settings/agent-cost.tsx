"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import type { ChartConfig } from "@crm/ui/components/chart";
import { BarTrend } from "@crm/ui/components/dashboard-chart";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";

const tokens = new Intl.NumberFormat("en-US");

const CONFIG: ChartConfig = {
	tokens: { label: "Tokens", color: "var(--primary)" },
};

export function AgentCost() {
	const trpc = useTRPC();
	const usage = useQuery(trpc.workspace.agentUsage.queryOptions());

	if (!usage.data) return null;

	const { pricing, month, totalTokens, days } = usage.data;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Agent de recherche</CardTitle>
				<CardDescription>
					Tokens brûlés ce mois-ci. Les prix sont fixés en base de données.
				</CardDescription>
			</CardHeader>

			<CardContent className="flex flex-col gap-4">
				<p className="text-sm">
					<span className="font-medium">{tokens.format(totalTokens)}</span>{" "}
					<span className="text-muted-foreground">
						tokens brûlés en {month}
					</span>
				</p>

				<BarTrend
					data={days}
					config={CONFIG}
					xKey="day"
					height={160}
					formatX={(value) => value.slice(8)}
					formatValue={(value) => tokens.format(Number(value))}
				/>

				<p className="text-muted-foreground text-xs">
					${pricing.inputPerMillion} entrée · ${pricing.outputPerMillion} sortie
					par million de tokens
				</p>
			</CardContent>
		</Card>
	);
}
