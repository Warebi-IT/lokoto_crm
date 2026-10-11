export type SessionPurpose = "builder" | "team-agent" | "research";

type PurposeContext = {
	readonly session: {
		readonly auth: {
			readonly current: {
				readonly attributes: Readonly<Record<string, unknown>>;
				readonly principalId?: string;
				readonly principalType?: string;
			} | null;
			readonly initiator: {
				readonly attributes: Readonly<Record<string, unknown>>;
				readonly principalId?: string;
				readonly principalType?: string;
			} | null;
		};
	};
};

export function userOf(ctx: PurposeContext): string | null {
	for (const auth of [ctx.session.auth.initiator, ctx.session.auth.current]) {
		if (auth?.principalType === "user" && auth.principalId) {
			return auth.principalId;
		}
	}
	return null;
}

export function purposeOf(ctx: PurposeContext): SessionPurpose {
	const purpose = attribute(ctx, "purpose");
	if (purpose === "builder" || purpose === "team-agent") return purpose;
	return "research";
}

export function attribute(ctx: PurposeContext, key: string): string | null {
	const current = ctx.session.auth.current?.attributes[key];
	if (typeof current === "string" && current.trim()) return current.trim();

	const initiator = ctx.session.auth.initiator?.attributes[key];
	return typeof initiator === "string" && initiator.trim()
		? initiator.trim()
		: null;
}

export function requireAttribute(ctx: PurposeContext, key: string): string {
	const value = attribute(ctx, key);
	if (!value) throw new Error(`This session is missing ${key}.`);
	return value;
}

export function requireBuilderAttribute(
	ctx: PurposeContext,
	key: string,
): string {
	if (
		purposeOf(ctx) !== "builder" ||
		attribute(ctx, "commandType") !== "CREATE_AGENT"
	) {
		throw new Error(
			"Agent creation requires an explicit request to create or build an agent.",
		);
	}
	return requireAttribute(ctx, key);
}

export function requireTeamAgentAttribute(
	ctx: PurposeContext,
	key: string,
): string {
	if (purposeOf(ctx) !== "team-agent") {
		throw new Error(
			"This deployed-agent tool is unavailable for this session.",
		);
	}
	return requireAttribute(ctx, key);
}

export function assertResearchPurpose(ctx: PurposeContext): void {
	if (purposeOf(ctx) !== "research") {
		throw new Error("This CRM research tool is unavailable for this session.");
	}
}
