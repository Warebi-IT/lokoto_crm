import { auth } from "@crm/auth";
import {
	BadRequestException,
	Body,
	Controller,
	Param,
	Post,
	UploadedFile,
	UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { incidentDocumentUploadInput } from "./incidents.contracts";
import { IncidentsService } from "./incidents.service";

type CrmSession = UserSession<typeof auth>;

@Controller("api/incidents")
export class IncidentDocumentsController {
	constructor(private readonly incidents: IncidentsService) {}

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
		@Param("id") incidentId: string,
		@UploadedFile() file: UploadedIncidentFile | undefined,
		@Body() body: Record<string, string | undefined>,
		@Session() _session: CrmSession,
	) {
		if (!file) {
			throw new BadRequestException(
				"Attach a JPG, PNG, WEBP or PDF file to the incident.",
			);
		}

		const metadata = incidentDocumentUploadInput.safeParse({
			type: body.type,
			amountCents: optionalNumber(body.amountCents),
			currency: body.currency || undefined,
			insuranceReimbursedAmountCents: optionalNumber(
				body.insuranceReimbursedAmountCents,
			),
		});
		if (!metadata.success) {
			throw new BadRequestException("A document type is required.");
		}

		return this.incidents.uploadDocument(incidentId, file, metadata.data);
	}
}

type UploadedIncidentFile = {
	buffer: Buffer;
	mimetype: string;
	originalname: string;
};

function optionalNumber(value: string | undefined): number | undefined {
	if (!value) return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}
