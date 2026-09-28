import { auth } from "@crm/auth";
import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Param,
	Post,
	UploadedFile,
	UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { contactDocumentUploadInput } from "./contacts.contracts";
import { ContactsService } from "./contacts.service";

type CrmSession = UserSession<typeof auth>;

@Controller("api/contacts")
export class ContactDocumentsController {
	constructor(private readonly contacts: ContactsService) {}

	@Post(":id/documents")
	@UseInterceptors(
		FileInterceptor("file", {
			limits: { fileSize: 10 * 1024 * 1024 },
			fileFilter: (_request, file, callback) => {
				callback(
					null,
					["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
						file.mimetype,
					),
				);
			},
		}),
	)
	async upload(
		@Param("id") contactId: string,
		@UploadedFile() file: UploadedContactFile | undefined,
		@Body() body: Record<string, string | undefined>,
		@Session() _session: CrmSession,
	) {
		if (!file) {
			throw new BadRequestException(
				"Attach a JPG, PNG, WEBP or PDF file to the contact.",
			);
		}

		const metadata = contactDocumentUploadInput.safeParse({
			type: body.type,
		});
		if (!metadata.success) {
			throw new BadRequestException(
				"A document type is required (permis, pièce d'identité or justificatif de domicile).",
			);
		}

		return this.contacts.uploadDocument(contactId, file, metadata.data);
	}

	@Delete(":id/documents/:documentId")
	async remove(
		@Param("id") contactId: string,
		@Param("documentId") documentId: string,
		@Session() _session: CrmSession,
	) {
		return this.contacts.deleteDocument(contactId, documentId);
	}
}

type UploadedContactFile = {
	buffer: Buffer;
	mimetype: string;
	originalname: string;
};
