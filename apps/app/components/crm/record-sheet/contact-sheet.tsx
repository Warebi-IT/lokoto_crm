"use client";

import CarFront from "@carbon/icons-react/es/CarFront";
import Email from "@carbon/icons-react/es/Email";
import Phone from "@carbon/icons-react/es/Phone";
import type { FieldValueJson } from "@crm/db/fields";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@crm/ui/components/accordion";
import { Button } from "@crm/ui/components/button";
import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import { Icon } from "@crm/ui/components/icon";
import { PersonAvatar } from "@crm/ui/components/person-avatar";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { TableCell } from "@crm/ui/components/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AgentPanel } from "@/components/crm/agent-panel";
import { contactName } from "@/components/crm/contact-name";
import { ContactEnrichmentAction } from "@/components/crm/enrichment-actions";
import { EnrichmentIndicator } from "@/components/crm/enrichment-status";
import { FieldsCog, RecordFields } from "@/components/crm/fields/record-fields";
import {
	InlineField,
	InlineSelectField,
	savingValue,
} from "@/components/crm/inline-field";
import { RentalStatusIndicator } from "@/components/crm/rental-status";
import { Timeline } from "@/components/crm/timeline/timeline";
import {
	DetailSheetBody,
	DetailSheetEmpty,
	DetailSheetProperties,
	DetailSheetProperty,
	DetailSheetProse,
	DetailSheetSection,
	DetailSheetStat,
	DetailSheetStats,
	type DetailSheetTab,
} from "@/components/detail-sheet";
import {
	LocalDateTime,
	LocalDay,
	LocalRelativeDate,
} from "@/components/local-date-time";
import { ENRICHMENT_POLL_MS, isEnriching } from "@/lib/enrichment-status";
import { savingField } from "@/lib/pending-field";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { ContactDocuments } from "./contact-documents";
import { RecordActions } from "./record-actions";
import { MoneyAmount, RecordSheetFrame } from "./record-parts";
import { useOpenRecord, useRecordSheetView } from "./record-stack";

type Contact = RouterOutputs["contacts"]["byId"];

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
	month: "short",
	day: "numeric",
	year: "numeric",
};

const GENDER_OPTIONS = [
	{ value: "H", label: "Homme" },
	{ value: "F", label: "Femme" },
] as const;

const RENTAL_CONTRACT_COLUMNS = [
	{ id: "vehicle", header: "Véhicule", width: "w-[26%]", className: "pl-5" },
	{ id: "role", header: "Rôle", width: "w-[16%]" },
	{ id: "status", header: "Statut", width: "w-[18%]" },
	{
		id: "amount",
		header: "Montant",
		width: "w-[16%]",
		align: "right" as const,
	},
	{ id: "dates", header: "Dates", width: "w-[24%]" },
];

export function ContactSheet({ contactId }: { contactId: string }) {
	const trpc = useTRPC();
	const { tab, setTab } = useRecordSheetView("overview");

	const query = useQuery({
		...trpc.contacts.byId.queryOptions({ id: contactId }),
		refetchInterval: (current) => {
			const record = current.state.data;
			return record && isEnriching(record.enrichmentStatus, record.queued)
				? ENRICHMENT_POLL_MS
				: false;
		},
	});
	const contact = query.data;

	const tabs: DetailSheetTab[] = contact
		? [
				{
					value: "overview",
					label: "Vue d’ensemble",
					content: <ContactOverview contact={contact} />,
				},
				{
					value: "rentalContracts",
					label: "Contrats de location",
					count: contact.rentalContracts.length,
					content: <ContactRentalContracts contact={contact} />,
				},
				{
					value: "documents",
					label: "Documents",
					count: contact.documents.length,
					content: <ContactDocuments contact={contact} />,
				},
				{
					value: "activity",
					label: "Activité",
					content: <Timeline anchor={{ contactId: contact.id }} />,
				},
				{
					value: "agent",
					label: "Assistant",
					content: <AgentPanel record={{ kind: "contact", id: contact.id }} />,
					keepMounted: true,
				},
			]
		: [];

	return (
		<RecordSheetFrame
			loading={query.isPending}
			error={query.error?.message ?? null}
			title={contact ? contactName(contact) : "Client"}
			note={
				contact && contact.enrichmentStatus !== "COMPLETE" ? (
					<EnrichmentIndicator
						status={contact.enrichmentStatus}
						queued={contact.queued}
						title={contact.enrichmentError}
					/>
				) : null
			}
			media={
				<PersonAvatar
					src={contact?.imageUrl}
					name={contact ? contactName(contact) : "?"}
					email={contact?.email}
					size="lg"
				/>
			}
			actions={
				contact ? (
					<>
						<ContactEnrichmentAction contactId={contact.id} />
						{contact.email ? (
							<Button asChild variant="outline" size="sm">
								<a href={`mailto:${contact.email}`}>
									<Icon icon={Email} data-icon="inline-start" />
									<span className="hidden sm:inline">E-mail</span>
								</a>
							</Button>
						) : null}
						<RecordActions
							record={{ kind: "contact", id: contact.id }}
							name={contactName(contact)}
							consequence={`Their notes, agent conversations and everything the agent found go too.${contact.email ? ` The sync will not bring ${contact.email} back — only adding them yourself will.` : ""}`}
						/>
					</>
				) : null
			}
			stats={
				contact ? (
					<DetailSheetStats>
						<DetailSheetStat label="Email" icon={Email}>
							{contact.email ? (
								<a
									href={`mailto:${contact.email}`}
									className="underline-offset-2 hover:underline"
								>
									{contact.email}
								</a>
							) : (
								<EmptyCellValue />
							)}
						</DetailSheetStat>
						<DetailSheetStat label="Phone" icon={Phone}>
							{contact.phone ? (
								<a
									href={`tel:${contact.phone}`}
									className="underline-offset-2 hover:underline"
								>
									{contact.phone}
								</a>
							) : (
								<EmptyCellValue />
							)}
						</DetailSheetStat>
					</DetailSheetStats>
				) : null
			}
			tabs={tabs}
			tab={tab}
			onTabChange={setTab}
		/>
	);
}

function ContactOverview({ contact }: { contact: Contact }) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const update = useMutation(
		trpc.contacts.update.mutationOptions({
			onSuccess: () => cache.contact(contact.id, { settle: "record" }),
			onError: (error) => toast.error(error.message),
		}),
	);

	const saveFields = (fields: Record<string, FieldValueJson>) =>
		update.mutate({ id: contact.id, data: { fields } });

	const isSavingField = savingValue(update);

	const save = (data: Record<string, string | null>) =>
		update.mutate({ id: contact.id, data });

	const isSaving = savingField(update);

	return (
		<DetailSheetBody>
			<DetailSheetSection title="Détails" action={<FieldsCog kind="contact" />}>
				<DetailSheetProperties>
					<InlineField
						label="Prénom"
						value={contact.firstName}
						saving={isSaving("firstName")}
						onSave={(firstName) => firstName && save({ firstName })}
					/>
					<InlineField
						label="Nom"
						value={contact.lastName}
						saving={isSaving("lastName")}
						onSave={(lastName) => save({ lastName })}
					/>
					<InlineSelectField
						label="Sexe"
						value={contact.gender}
						options={[...GENDER_OPTIONS]}
						saving={isSaving("gender")}
						onSave={(gender) => save({ gender })}
					/>
					<InlineField
						label="E-mail"
						value={contact.email}
						type="email"
						saving={isSaving("email")}
						onSave={(email) => save({ email })}
					/>
					<InlineField
						label="Téléphone"
						value={contact.phone}
						type="tel"
						saving={isSaving("phone")}
						onSave={(phone) => save({ phone })}
					/>
					<RecordFields
						fields={contact.fields}
						saving={isSavingField}
						onSave={saveFields}
					/>
				</DetailSheetProperties>
			</DetailSheetSection>

			{contact.brief ? <Background brief={contact.brief} /> : null}

			<WeKnowThem
				relationship={contact.relationship}
				contactName={contactName(contact)}
			/>
		</DetailSheetBody>
	);
}

function Background({ brief }: { brief: NonNullable<Contact["brief"]> }) {
	const sections = brief.sections;
	const previous = sections.previousRoles ?? [];

	const lines = [
		{ label: "Fonction actuelle", value: sections.currentRole },
		{ label: "Ancienneté", value: sections.tenure },
		{ label: "Séniorité", value: sections.seniority },
		{ label: "Fonction", value: sections.function },
		{ label: "Localisation", value: sections.location },
	].filter((line) => Boolean(line.value));

	return (
		<DetailSheetSection
			title="Profil"
			action={
				<span className="text-muted-foreground text-xs">
					{brief.sourceUrl ? (
						<a
							href={brief.sourceUrl}
							target="_blank"
							rel="noreferrer noopener"
							className="underline-offset-2 hover:underline"
						>
							Source
						</a>
					) : null}
					{brief.sourceUrl ? " · " : null}
					<LocalDateTime date={brief.refreshedAt} options={DATE_OPTIONS} />
				</span>
			}
		>
			<DetailSheetProse>{brief.narrative}</DetailSheetProse>

			<DetailSheetProperties>
				{lines.map((line) => (
					<DetailSheetProperty key={line.label} label={line.label}>
						{line.value}
					</DetailSheetProperty>
				))}

				{previous.length > 0 ? (
					<DetailSheetProperty label="Expériences précédentes" wide>
						<PreviousRoles roles={previous} />
					</DetailSheetProperty>
				) : null}
			</DetailSheetProperties>
		</DetailSheetSection>
	);
}

function PreviousRoles({ roles }: { roles: string[] }) {
	return (
		<Accordion type="single" collapsible>
			<AccordionItem value="previous">
				<AccordionTrigger variant="subtle">
					{roles.length === 1 ? "1 poste" : `${roles.length} postes`}
				</AccordionTrigger>
				<AccordionContent>
					<ul className="space-y-1">
						{roles.map((role) => (
							<li key={role}>{role}</li>
						))}
					</ul>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}

function WeKnowThem({
	relationship,
	contactName: name,
}: {
	relationship: Contact["relationship"];
	contactName: string;
}) {
	const { emails, meetings, lastReplyAt, nextMeeting } = relationship;

	if (emails === 0 && meetings === 0) return null;

	const first = name.split(" ")[0] ?? name;

	return (
		<DetailSheetSection title="Historique client">
			<DetailSheetProperties>
				{emails > 0 ? (
					<DetailSheetProperty label="E-mails">
						<span className="tabular-nums">{emails}</span>
						<span className="text-muted-foreground">
							{" · "}
							{lastReplyAt ? (
								<>
									dernière réponse <LocalRelativeDate date={lastReplyAt} />
								</>
							) : (
								`${first} n’a jamais répondu`
							)}
						</span>
					</DetailSheetProperty>
				) : null}

				{meetings > 0 ? (
					<DetailSheetProperty label="Rendez-vous">
						<span className="tabular-nums">{meetings}</span>
					</DetailSheetProperty>
				) : null}

				{nextMeeting ? (
					<DetailSheetProperty label="Prochain rendez-vous" wide>
						{nextMeeting.title ?? "Rendez-vous"}
						<span className="text-muted-foreground">
							{" · "}
							<LocalDateTime
								date={nextMeeting.startsAt}
								options={DATE_OPTIONS}
							/>
						</span>
					</DetailSheetProperty>
				) : null}
			</DetailSheetProperties>
		</DetailSheetSection>
	);
}

function ContactRentalContracts({ contact }: { contact: Contact }) {
	const openRecord = useOpenRecord();

	if (contact.rentalContracts.length === 0) {
		return (
			<DetailSheetEmpty
				icon={CarFront}
				title="Aucun contrat de location"
				description={`${contactName(contact)} n’a encore loué de véhicule et n’est pas enregistré comme conducteur additionnel.`}
			/>
		);
	}

	return (
		<SimpleTable variant="panel" columns={RENTAL_CONTRACT_COLUMNS}>
			{contact.rentalContracts.map((contract) => (
				<SimpleTableRow
					key={contract.id}
					clickable
					onClick={() =>
						openRecord({ kind: "rentalContract", id: contract.id })
					}
				>
					<TableCell className="truncate py-2.5 pr-3 pl-5 font-medium">
						{contract.vehicle.make} {contract.vehicle.model}
						<span className="text-muted-foreground">
							{" "}
							· {contract.vehicle.plateNumber}
						</span>
					</TableCell>
					<TableCell className="truncate px-3 py-2.5 text-muted-foreground">
						{contract.role === "PRIMARY"
							? "Locataire"
							: "Conducteur additionnel"}
					</TableCell>
					<TableCell className="px-3 py-2.5">
						<RentalStatusIndicator status={contract.status} />
					</TableCell>
					<TableCell className="px-3 py-2.5 text-right">
						<MoneyAmount
							amountCents={contract.totalAmountCents}
							currency={contract.currency}
						/>
					</TableCell>
					<TableCell className="truncate px-3 py-2.5 text-muted-foreground">
						<LocalDay date={contract.startDate} /> –{" "}
						<LocalDay date={contract.endDate} />
					</TableCell>
				</SimpleTableRow>
			))}
		</SimpleTable>
	);
}
