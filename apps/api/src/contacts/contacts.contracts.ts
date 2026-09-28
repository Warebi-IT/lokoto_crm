import { ContactDocumentType, ContactGender } from "@crm/db";
import { z } from "zod";
import { bulkIdsInput } from "../crm/bulk";
import { recordFieldValues } from "../fields/fields.contracts";
import { listInput } from "../trpc/list-input";

export const contactListInput = listInput.extend({
	source: z.string().default("all"),
});

export type ContactListInput = z.infer<typeof contactListInput>;

const genderEnum = z.enum(
	Object.values(ContactGender) as [ContactGender, ...ContactGender[]],
);

export const contactOptionsInput = z.object({
	q: z.string().default(""),
});

export const contactCreateInput = z.object({
	firstName: z.string().trim().min(1, "A contact needs a first name."),
	lastName: z.string().trim().optional(),
	gender: genderEnum.optional(),
	email: z.email("That is not an email address.").optional().or(z.literal("")),
	phone: z.string().trim().optional(),
	title: z.string().trim().optional(),
});

export type ContactCreateInput = z.infer<typeof contactCreateInput>;

const contactUpdateInput = z.object({
	firstName: z.string().trim().min(1).optional(),
	lastName: z.string().optional(),
	gender: genderEnum.optional(),
	email: z.string().optional(),
	phone: z.string().optional(),
	title: z.string().optional(),
	linkedinUrl: z.string().optional(),
	twitterUrl: z.string().optional(),
	githubUrl: z.string().optional(),
	fields: recordFieldValues.optional(),
});

export type ContactUpdateInput = z.infer<typeof contactUpdateInput>;

export const contactUpdateArgs = z.object({
	id: z.string(),
	data: contactUpdateInput,
});

export const contactIdInput = z.object({ id: z.string() });

export const contactBulkInput = bulkIdsInput;

export const factDecisionInput = z.object({
	factId: z.string(),
	decision: z.enum(["accept", "dismiss"]),
});

export type FactDecisionInput = z.infer<typeof factDecisionInput>;

const contactDocumentTypeEnum = z.enum(
	Object.values(ContactDocumentType) as [
		ContactDocumentType,
		...ContactDocumentType[],
	],
);

export const contactDocumentUploadInput = z.object({
	type: contactDocumentTypeEnum,
});

export type ContactDocumentUploadInput = z.infer<
	typeof contactDocumentUploadInput
>;

export const contactDocumentIdInput = z.object({
	contactId: z.string(),
	documentId: z.string(),
});

export type ContactDocumentIdInput = z.infer<typeof contactDocumentIdInput>;
