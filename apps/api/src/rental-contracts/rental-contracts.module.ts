import { Module } from "@nestjs/common";
import { CurrencyModule } from "../currency/currency.module";
import { FieldsModule } from "../fields/fields.module";
import { TrpcModule } from "../trpc/trpc.module";
import { RentalContractsRouter } from "./rental-contracts.router";
import { RentalContractsService } from "./rental-contracts.service";

@Module({
	imports: [FieldsModule, TrpcModule, CurrencyModule],
	providers: [RentalContractsService, RentalContractsRouter],
	exports: [RentalContractsService],
})
export class RentalContractsModule {}
