import type { ReactNode } from "react";
import type { TranscriptItem } from "@/lib/agent-transcript";

type ResultEntry = {
	anchor: (items: readonly TranscriptItem[]) => Map<string, ReactNode[]>;
	skeleton: ReactNode;
};

const REGISTRY: Record<string, ResultEntry> = {};

export function hasAgentResult(tool: string): boolean {
	return tool in REGISTRY;
}

export function agentResultSkeleton(tool: string): ReactNode {
	return REGISTRY[tool]?.skeleton ?? null;
}

export function agentResultsByItem(
	items: readonly TranscriptItem[],
): Map<string, ReactNode[]> {
	const rendered = new Map<string, ReactNode[]>();

	for (const entry of Object.values(REGISTRY)) {
		for (const [itemId, nodes] of entry.anchor(items)) {
			const bucket = rendered.get(itemId);
			if (bucket) bucket.push(...nodes);
			else rendered.set(itemId, nodes);
		}
	}

	return rendered;
}
