import { Module } from "@nestjs/common";
import { RentalContractsModule } from "../rental-contracts/rental-contracts.module";
import { TrpcModule } from "../trpc/trpc.module";
import { InspectionsRouter } from "./inspections.router";
import { InspectionsService } from "./inspections.service";

@Module({
	imports: [TrpcModule, RentalContractsModule],
	providers: [InspectionsService, InspectionsRouter],
	exports: [InspectionsService],
})
export class InspectionsModule {}
