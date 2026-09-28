import { Module } from "@nestjs/common";
import { CurrencyModule } from "../currency/currency.module";
import { FieldsModule } from "../fields/fields.module";
import { TrpcModule } from "../trpc/trpc.module";
import { VehiclesRouter } from "./vehicles.router";
import { VehiclesService } from "./vehicles.service";

@Module({
	imports: [FieldsModule, TrpcModule, CurrencyModule],
	providers: [VehiclesService, VehiclesRouter],
	exports: [VehiclesService],
})
export class VehiclesModule {}
