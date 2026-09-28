export const TASK_KINDS = [
	"portrait",
	"meeting-prep",
	"identify",
	"profile",
	"recheck",
	"workspace-profile",
	"field-backfill",
] as const;

export type TaskKind = (typeof TASK_KINDS)[number];

export const DIRECT_KINDS = ["portrait"] as const;

export type DirectKind = (typeof DIRECT_KINDS)[number];

export function isDirectKind(kind: string): kind is DirectKind {
	return (DIRECT_KINDS as readonly string[]).includes(kind);
}

export const MAX_ATTEMPTS = 3;

export const RETIRED_OUTCOME = `Gave up after ${MAX_ATTEMPTS} attempts: the session never reported back.`;

export const PRIORITY = {
	portrait: 800,
	workspace: 500,
	requested: 300,
	meeting: 200,
	identify: 100,
	sweep: 50,
	fieldBackfill: 20,
	recheck: 0,
} as const;
