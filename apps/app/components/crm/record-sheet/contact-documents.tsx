"use client";

import DocumentSigned from "@carbon/icons-react/es/DocumentSigned";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import { Button } from "@crm/ui/components/button";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import { useId } from "react";
import { toast } from "sonner";
import { DetailSheetBody, DetailSheetSection } from "@/components/detail-sheet";
import { useCrmCache } from "@/lib/trpc/cache";
import type { RouterOutputs } from "@/lib/trpc/types";

type Contact = RouterOutputs["contacts"]["byId"];
type ContactDocument = Contact["documents"][number];

const DOCUMENT_TYPES = [
	{ value: "DRIVERS_LICENSE", label: "Permis de conduire" },
	{ value: "ID_CARD", label: "Pièce d’identité" },
	{ value: "PROOF_OF_ADDRESS", label: "Justificatif de domicile" },
] as const;

export function ContactDocuments({ contact }: { contact: Contact }) {
	const byType = new Map<string, ContactDocument[]>();
	for (const document of contact.documents) {
		const list = byType.get(document.type) ?? [];
		list.push(document);
		byType.set(document.type, list);
	}

	const other = byType.get("OTHER") ?? [];

	return (
		<DetailSheetBody>
			{DOCUMENT_TYPES.map((type) => (
				<DocumentTypeSection
					key={type.value}
					contactId={contact.id}
					type={type.value}
					label={type.label}
					documents={byType.get(type.value) ?? []}
				/>
			))}
			{other.length > 0 ? (
				<DocumentTypeSection
					contactId={contact.id}
					type="OTHER"
					label="Autre document"
					documents={other}
					allowUpload={false}
				/>
			) : null}
		</DetailSheetBody>
	);
}

function DocumentTypeSection({
	contactId,
	type,
	label,
	documents,
	allowUpload = true,
}: {
	contactId: string;
	type: string;
	label: string;
	documents: ContactDocument[];
	allowUpload?: boolean;
}) {
	const cache = useCrmCache();
	const inputId = useId();

	const upload = useMutation({
		mutationFn: async (file: File) => {
			const body = new FormData();
			body.append("file", file);
			body.append("type", type);
			const response = await fetch(`/api/contacts/${contactId}/documents`, {
				method: "POST",
				body,
			});
			if (!response.ok) throw new Error("L’envoi du document a échoué.");
			const result = (await response.json()) as { stored: boolean };
			if (!result.stored) {
				throw new Error(
					"Le stockage des documents n’est pas encore configuré sur ce serveur.",
				);
			}
		},
		onSuccess: () => cache.contact(contactId, { settle: "record" }),
		onError: (error: Error) => toast.error(error.message),
	});

	const remove = useMutation({
		mutationFn: async (documentId: string) => {
			const response = await fetch(
				`/api/contacts/${contactId}/documents/${documentId}`,
				{ method: "DELETE" },
			);
			if (!response.ok) throw new Error("La suppression a échoué.");
		},
		onSuccess: () => cache.contact(contactId, { settle: "record" }),
		onError: (error: Error) => toast.error(error.message),
	});

	return (
		<DetailSheetSection title={label}>
			{documents.length === 0 ? (
				<p className="text-muted-foreground text-sm">Aucun document.</p>
			) : (
				<ul className="flex flex-col gap-2">
					{documents.map((document) => (
						<li
							key={document.id}
							className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
						>
							<a
								href={document.url}
								target="_blank"
								rel="noreferrer noopener"
								className="flex min-w-0 items-center gap-2 truncate text-sm underline-offset-2 hover:underline"
							>
								<Icon
									icon={DocumentSigned}
									className="shrink-0 text-muted-foreground"
								/>
								<span className="truncate">
									{document.fileName ?? "Document"}
								</span>
							</a>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								aria-label="Supprimer"
								disabled={remove.isPending}
								onClick={() => remove.mutate(document.id)}
							>
								<Icon icon={TrashCan} />
							</Button>
						</li>
					))}
				</ul>
			)}

			{allowUpload ? (
				<Field>
					<FieldLabel htmlFor={inputId}>Ajouter</FieldLabel>
					<Input
						id={inputId}
						type="file"
						accept="image/jpeg,image/png,image/webp,application/pdf"
						disabled={upload.isPending}
						onChange={(event) => {
							const file = event.target.files?.[0];
							event.target.value = "";
							if (file) upload.mutate(file);
						}}
					/>
				</Field>
			) : null}
		</DetailSheetSection>
	);
}
