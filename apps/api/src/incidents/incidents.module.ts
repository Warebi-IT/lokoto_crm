import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { IncidentDocumentsController } from "./incident-documents.controller";
import { IncidentsRouter } from "./incidents.router";
import { IncidentsService } from "./incidents.service";

@Module({
	imports: [TrpcModule],
	controllers: [IncidentDocumentsController],
	providers: [IncidentsService, IncidentsRouter],
	exports: [IncidentsService],
})
export class IncidentsModule {}
