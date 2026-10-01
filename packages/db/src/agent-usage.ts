import type { Db } from "./client";
import { SETTINGS_ID } from "./settings";
import { WORKSPACE_ID } from "./workspace";

export interface AgentPricing {
	inputPerMillion: number;
	outputPerMillion: number;
}

export interface AgentUsageStep {
	eventId: string;
	sessionId: string;
	userId: string | null;
	model: string | null;
	inputTokens: number;
	outputTokens: number;
}

export async function isAgentEnabled(db: Db, userId: string): Promise<boolean> {
	const member = await db.member.findUnique({
		where: {
			organizationId_userId: { organizationId: WORKSPACE_ID, userId },
		},
		select: { agentEnabled: true },
	});

	return member?.agentEnabled === true;
}

export async function readAgentPricing(db: Db): Promise<AgentPricing> {
	const row = await db.appSetting.findUnique({
		where: { id: SETTINGS_ID },
		select: {
			agentInputPricePerMillion: true,
			agentOutputPricePerMillion: true,
		},
	});

	return {
		inputPerMillion: Number(row?.agentInputPricePerMillion ?? 0),
		outputPerMillion: Number(row?.agentOutputPricePerMillion ?? 0),
	};
}

export function costOf(
	pricing: AgentPricing,
	inputTokens: number,
	outputTokens: number,
): number {
	return (
		(inputTokens * pricing.inputPerMillion +
			outputTokens * pricing.outputPerMillion) /
		1_000_000
	);
}

function monthOf(at: Date): Date {
	return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
}

export async function recordAgentUsage(
	db: Db,
	step: AgentUsageStep,
	at: Date = new Date(),
): Promise<void> {
	const totalTokens = step.inputTokens + step.outputTokens;
	if (totalTokens <= 0) return;

	const pricing = await readAgentPricing(db);
	const costUsd = costOf(pricing, step.inputTokens, step.outputTokens);

	await db.$transaction(async (tx) => {
		const created = await tx.agentUsage.createMany({
			data: [
				{
					eventId: step.eventId,
					sessionId: step.sessionId,
					userId: step.userId,
					model: step.model,
					inputTokens: step.inputTokens,
					outputTokens: step.outputTokens,
					totalTokens,
					inputPricePerMillion: pricing.inputPerMillion,
					outputPricePerMillion: pricing.outputPerMillion,
					costUsd,
					createdAt: at,
				},
			],
			skipDuplicates: true,
		});

		if (created.count === 0) return;

		const month = monthOf(at);
		const userId = step.userId ?? "";

		await tx.agentUsageMonthly.upsert({
			where: { month_userId: { month, userId } },
			create: {
				month,
				userId,
				requests: 1,
				inputTokens: step.inputTokens,
				outputTokens: step.outputTokens,
				totalTokens,
				costUsd,
			},
			update: {
				requests: { increment: 1 },
				inputTokens: { increment: step.inputTokens },
				outputTokens: { increment: step.outputTokens },
				totalTokens: { increment: totalTokens },
				costUsd: { increment: costUsd },
			},
		});
	});
}
