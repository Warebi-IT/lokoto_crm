"use client";

import { type QueryKey, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "./client";

type Settle = "all" | "record";

type Options = {
	settle?: Settle;
};

type RecordKind = "contact" | "vehicle" | "rentalContract";

type RemovedRecord = { kind: RecordKind; id: string };

type RemovedRecords = { kind: RecordKind; ids: string[] };

export type CrmCache = {
	contact(id?: string, options?: Options): Promise<void>;
	vehicle(id?: string, options?: Options): Promise<void>;
	rentalContract(id?: string, options?: Options): Promise<void>;
	fields(entity?: RecordKind, options?: Options): Promise<void>;
	fieldCoverage(id?: string, options?: Options): Promise<void>;
	removed(record: RemovedRecord): Promise<void>;
	removedMany(records: RemovedRecords): Promise<void>;
	conversationRemoved(id: string): Promise<void>;
	activity(options?: Options): Promise<void>;
	google(options?: Options): Promise<void>;
	microsoft(options?: Options): Promise<void>;
	settings(options?: Options): Promise<void>;
	currency(options?: Options): Promise<void>;
	workspace(options?: Options): Promise<void>;
	sso(options?: Options): Promise<void>;
	everything(): Promise<void>;
};

export function useCrmCache(): CrmCache {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const run = (
		record: QueryKey[],
		rest: QueryKey[],
		{ settle = "all" }: Options = {},
	): Promise<void> => {
		const awaited = settle === "all" ? [...record, ...rest] : record;
		const behind = settle === "all" ? [] : rest;

		for (const queryKey of behind) {
			void queryClient.invalidateQueries({ queryKey });
		}

		return Promise.all(
			awaited.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
		).then(() => undefined);
	};

	const activityKeys = () => [
		trpc.activities.timeline.pathKey(),
		trpc.activities.timelineCounts.queryKey(),
		trpc.activities.myTasks.queryKey(),
	];

	const listKeys = () => [
		trpc.contacts.list.queryKey(),
		trpc.vehicles.list.queryKey(),
		trpc.rentalContracts.list.queryKey(),
		trpc.search.quick.queryKey(),
	];

	const removeRecords = (kind: RecordKind, ids: string[]): Promise<void> => {
		const byId = {
			contact: trpc.contacts.byId,
			vehicle: trpc.vehicles.byId,
			rentalContract: trpc.rentalContracts.byId,
		}[kind];
		const goneKeys = ids.map((id) => byId.queryKey({ id }));
		const gone = new Set(goneKeys.map((key) => JSON.stringify(key)));

		for (const record of [
			trpc.contacts.byId,
			trpc.vehicles.byId,
			trpc.rentalContracts.byId,
		]) {
			void queryClient.invalidateQueries({
				queryKey: record.queryKey(),
				predicate: (query) => !gone.has(JSON.stringify(query.queryKey)),
			});
		}

		for (const queryKey of goneKeys) {
			void queryClient.invalidateQueries({
				queryKey,
				exact: true,
				refetchType: "none",
			});
		}

		return run(
			[
				...listKeys(),
				...activityKeys(),
				trpc.dashboard.summary.queryKey(),
				trpc.profitability.summary.queryKey(),
			],
			[],
		);
	};

	const RECORD_BY_ID = {
		contact: () => trpc.contacts.byId.queryKey(),
		vehicle: () => trpc.vehicles.byId.queryKey(),
		rentalContract: () => trpc.rentalContracts.byId.queryKey(),
	} as const;

	const RECORD_LIST = {
		contact: () => trpc.contacts.list.queryKey(),
		vehicle: () => trpc.vehicles.list.queryKey(),
		rentalContract: () => trpc.rentalContracts.list.queryKey(),
	} as const;

	return {
		fields: (entity, options) =>
			run(
				[trpc.fields.list.queryKey()],
				entity
					? [RECORD_BY_ID[entity](), RECORD_LIST[entity]()]
					: [...Object.values(RECORD_BY_ID).map((key) => key()), ...listKeys()],
				options,
			),

		fieldCoverage: (id, options) =>
			run(
				[
					id
						? trpc.fields.coverage.queryKey({ id })
						: trpc.fields.coverage.queryKey(),
				],
				[],
				options,
			),

		contact: (id, options) =>
			run(
				[
					id
						? trpc.contacts.byId.queryKey({ id })
						: trpc.contacts.byId.queryKey(),
				],
				[
					...listKeys(),
					trpc.rentalContracts.byId.queryKey(),
					trpc.rentalContracts.driverOptions.queryKey(),
				],
				options,
			),

		vehicle: (id, options) =>
			run(
				[
					id
						? trpc.vehicles.byId.queryKey({ id })
						: trpc.vehicles.byId.queryKey(),
				],
				[
					...listKeys(),
					trpc.rentalContracts.byId.queryKey(),
					trpc.vehicleCharges.listByVehicle.queryKey(),
					trpc.profitability.summary.queryKey(),
					trpc.profitability.byVehicle.queryKey(),
					...activityKeys(),
					trpc.dashboard.summary.queryKey(),
					trpc.currency.settings.queryKey(),
				],
				options,
			),

		rentalContract: (id, options) =>
			run(
				[
					id
						? trpc.rentalContracts.byId.queryKey({ id })
						: trpc.rentalContracts.byId.queryKey(),
				],
				[
					...listKeys(),
					trpc.vehicles.byId.queryKey(),
					trpc.contacts.byId.queryKey(),
					trpc.rentalContracts.driverOptions.queryKey(),
					trpc.payments.listByContract.queryKey(),
					trpc.incidents.listByVehicle.queryKey(),
					trpc.incidents.listByContract.queryKey(),
					trpc.vehicleInspections.listByContract.queryKey(),
					trpc.profitability.summary.queryKey(),
					trpc.profitability.byVehicle.queryKey(),
					...activityKeys(),
					trpc.dashboard.summary.queryKey(),
					trpc.currency.settings.queryKey(),
				],
				options,
			),

		removed: ({ kind, id }) => removeRecords(kind, [id]),

		removedMany: ({ kind, ids }) => removeRecords(kind, ids),

		conversationRemoved: (id) => {
			for (const queryKey of [
				trpc.conversations.builderById.queryKey({ id }),
				trpc.conversations.events.queryKey({ id }),
				trpc.conversations.shareStatus.queryKey({ id }),
			]) {
				void queryClient.invalidateQueries({
					queryKey,
					exact: true,
					refetchType: "none",
				});
			}

			return run([trpc.conversations.builderList.pathKey()], []);
		},

		activity: (options) =>
			run(
				activityKeys(),
				[
					...listKeys(),
					trpc.contacts.byId.queryKey(),
					trpc.vehicles.byId.queryKey(),
					trpc.rentalContracts.byId.queryKey(),
					trpc.dashboard.summary.queryKey(),
				],
				options,
			),

		google: (options) =>
			run(
				[trpc.google.status.queryKey()],
				[
					...activityKeys(),
					...listKeys(),
					trpc.contacts.byId.queryKey(),
					trpc.dashboard.summary.queryKey(),
				],
				options,
			),

		microsoft: (options) =>
			run(
				[trpc.microsoft.status.queryKey()],
				[
					...activityKeys(),
					...listKeys(),
					trpc.contacts.byId.queryKey(),
					trpc.dashboard.summary.queryKey(),
				],
				options,
			),

		settings: (options) =>
			run(
				[
					trpc.settings.agentModel.queryKey(),
					trpc.settings.researchKey.queryKey(),
				],
				[],
				options,
			),

		currency: (options) =>
			run(
				[trpc.currency.settings.queryKey()],
				[
					...listKeys(),
					trpc.vehicles.byId.queryKey(),
					trpc.rentalContracts.byId.queryKey(),
					trpc.dashboard.summary.queryKey(),
					trpc.profitability.summary.queryKey(),
				],
				options,
			),

		workspace: (options) =>
			run(
				[trpc.workspace.get.queryKey(), trpc.workspace.members.queryKey()],
				[],
				options,
			),

		sso: (options) =>
			run(
				[trpc.sso.list.pathKey()],
				[trpc.sso.settings.queryKey(), trpc.sso.signInOptions.queryKey()],
				options,
			),

		everything: () => queryClient.invalidateQueries(),
	};
}
