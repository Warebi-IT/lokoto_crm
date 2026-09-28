"use client";

import CheckmarkFilled from "@carbon/icons-react/es/CheckmarkFilled";
import CloseFilled from "@carbon/icons-react/es/CloseFilled";
import {
	DataTable,
	type DataTableColumn,
	type DataTableFacet,
} from "@crm/ui/components/data-table";
import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import { Icon } from "@crm/ui/components/icon";
import { PersonAvatar } from "@crm/ui/components/person-avatar";
import { useTableSelection } from "@crm/ui/hooks/use-table-selection";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { contactName } from "@/components/crm/contact-name";
import { useFieldColumns } from "@/components/crm/fields/field-columns";
import { usePrefetchRecord } from "@/components/crm/record-sheet/record-prefetch";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { ListSearch } from "@/components/data-table/list-search";
import { useTableQuery } from "@/components/data-table/use-table-query";
import { LocalRelativeTime } from "@/components/local-date-time";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { ContactsBulkActions } from "./contacts-bulk-actions";
import { contactsSearchParams } from "./contacts-search-params";

type ContactRow = RouterOutputs["contacts"]["list"]["rows"][number];

const COLUMNS: DataTableColumn<ContactRow>[] = [
	{
		id: "name",
		header: "Nom",
		sortable: true,
		hideable: false,
		width: "w-[28%]",
		cell: (row) => (
			<span className="flex min-w-0 items-center gap-2">
				<PersonAvatar
					src={row.imageUrl}
					name={contactName(row)}
					email={row.email}
					size="sm"
				/>
				<span className="truncate font-medium">{contactName(row)}</span>
			</span>
		),
	},
	{
		id: "gender",
		header: "Sexe",
		width: "w-[10%]",
		hideBelow: "lg",
		cell: (row) => (row.gender === "H" ? "Homme" : "Femme"),
	},
	{
		id: "contact",
		header: "Coordonnées",
		sortable: true,
		width: "w-[25%]",
		hideBelow: "md",
		cell: (row) =>
			row.email || row.phone ? (
				<span className="truncate text-muted-foreground">
					{row.email ?? row.phone}
				</span>
			) : (
				<EmptyCellValue />
			),
	},
	{
		id: "documents",
		header: "Dossiers",
		width: "w-[12%]",
		hideBelow: "lg",
		cell: (row) => {
			const complete = ["DRIVERS_LICENSE", "ID_CARD", "PROOF_OF_ADDRESS"].every(
				(type) => row.documentTypes.includes(type),
			);
			return (
				<span
					className="flex items-center gap-1 text-muted-foreground"
					role="img"
					aria-label={complete ? "Dossier complet" : "Dossier incomplet"}
					title={complete ? "Dossier complet" : "Dossier incomplet"}
				>
					<Icon
						icon={complete ? CheckmarkFilled : CloseFilled}
						className={complete ? "text-success" : "text-destructive"}
					/>
					{
						row.documentTypes.filter((type) =>
							["DRIVERS_LICENSE", "ID_CARD", "PROOF_OF_ADDRESS"].includes(type),
						).length
					}
					/3
				</span>
			);
		},
	},
	{
		id: "createdAt",
		header: "Créé le",
		label: "Date de création",
		sortable: true,
		align: "right",
		width: "w-[10%]",
		defaultHidden: true,
		cell: (row) => (
			<span className="text-muted-foreground">
				<LocalRelativeTime date={row.createdAt} />
			</span>
		),
	},
	{
		id: "lastActivity",
		header: "Dernière activité",
		sortable: true,
		align: "right",
		width: "w-[12%]",
		hideBelow: "sm",
		cell: (row) => (
			<span className="text-muted-foreground">
				{row.lastActivityAt ? (
					<LocalRelativeTime date={row.lastActivityAt} />
				) : (
					<EmptyCellValue />
				)}
			</span>
		),
	},
];

export function ContactsTable() {
	const openRecord = useOpenRecord();
	const trpc = useTRPC();
	const prefetchRecord = usePrefetchRecord();
	const { query, input } = useTableQuery(contactsSearchParams);

	const contacts = useQuery({
		...trpc.contacts.list.queryOptions(input),
		placeholderData: (previous) => previous,
	});
	const rows = contacts.data?.rows ?? [];
	const selection = useTableSelection(
		useMemo(() => rows.map((row) => row.id), [rows]),
	);

	const facetCounts = contacts.data?.facetCounts;

	const facets: DataTableFacet[] = [];

	const fieldColumns = useFieldColumns<ContactRow>("CONTACT");
	const columns = useMemo(() => [...COLUMNS, ...fieldColumns], [fieldColumns]);

	return (
		<DataTable
			query={query}
			search={
				<ListSearch placeholder="Rechercher un client par nom ou e-mail…" />
			}
			columns={columns}
			rows={rows}
			total={contacts.data?.total ?? 0}
			facetCounts={facetCounts}
			facets={facets}
			selection={{
				state: selection,
				actions: (
					<ContactsBulkActions ids={selection.ids} onDone={selection.clear} />
				),
				rowLabel: (row) => contactName(row),
			}}
			getRowId={(row) => row.id}
			loading={contacts.isFetching}
			onRowHover={(row) => prefetchRecord({ kind: "contact", id: row.id })}
			onRowClick={(row) => openRecord({ kind: "contact", id: row.id })}
			empty="No clients match this view."
		/>
	);
}
