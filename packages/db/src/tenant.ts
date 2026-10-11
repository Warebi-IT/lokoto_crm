import { AsyncLocalStorage } from "node:async_hooks";
import { Prisma } from "./generated/prisma/client";

export const TENANT_MODELS: ReadonlySet<string> = new Set([
	"Contact",
	"Vehicle",
	"RentalContract",
	"Payment",
	"Incident",
	"MaintenanceRecord",
	"VehicleInspection",
	"VehicleCharge",
	"VehicleFinancing",
	"FieldDefinition",
	"Activity",
	"EmailThread",
	"EmailMessage",
	"CalendarEvent",
	"SuppressedDomain",
	"SuppressedContact",
	"AgentDefinition",
	"AgentConversation",
	"AgentTask",
]);

interface TenantScope {
	organizationId: string | null;
}

const storage = new AsyncLocalStorage<TenantScope>();

export function runInTenant<T>(
	organizationId: string,
	fn: () => T | PromiseLike<T>,
): Promise<T> {
	return storage.run({ organizationId }, async () => await fn());
}

let fallbackTenant: string | null = null;

export function setFallbackTenant(organizationId: string | null): void {
	fallbackTenant = organizationId;
}

export function runUnscoped<T>(fn: () => T | PromiseLike<T>): Promise<T> {
	return storage.run({ organizationId: null }, async () => await fn());
}

export function currentTenant(): string | null {
	const scope = storage.getStore();

	return scope ? scope.organizationId : fallbackTenant;
}

export function requireTenant(): string {
	const organizationId = currentTenant();

	if (!organizationId) {
		throw new Error(
			"No organization is active for this call. Wrap it in runInTenant().",
		);
	}

	return organizationId;
}

const FILTERED = new Set([
	"findFirst",
	"findFirstOrThrow",
	"findMany",
	"findUnique",
	"findUniqueOrThrow",
	"count",
	"aggregate",
	"groupBy",
	"update",
	"updateMany",
	"updateManyAndReturn",
	"delete",
	"deleteMany",
	"upsert",
]);

type Row = Record<string, unknown>;

function stamp(row: Row, organizationId: string): Row {
	const given = row.organizationId;

	if (given !== undefined && given !== "" && given !== organizationId) {
		throw new Error("A record cannot be written into another organization.");
	}

	return { ...row, organizationId };
}

export const tenantScope = Prisma.defineExtension({
	name: "tenantScope",
	query: {
		$allModels: {
			async $allOperations({ model, operation, args, query }) {
				const organizationId = currentTenant();

				if (!organizationId || !TENANT_MODELS.has(model)) {
					return query(args);
				}

				const next = { ...(args as Row) };

				if (FILTERED.has(operation)) {
					next.where = { ...(next.where as Row | undefined), organizationId };
				}

				if (operation === "create") {
					next.data = stamp(next.data as Row, organizationId);
				}

				if (operation === "createMany" || operation === "createManyAndReturn") {
					const data = next.data as Row | Row[];
					next.data = Array.isArray(data)
						? data.map((row) => stamp(row, organizationId))
						: stamp(data, organizationId);
				}

				if (operation === "upsert") {
					next.create = stamp(next.create as Row, organizationId);
				}

				return query(next);
			},
		},
	},
});
