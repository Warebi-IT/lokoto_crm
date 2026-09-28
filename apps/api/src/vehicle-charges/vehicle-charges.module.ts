import { Module } from "@nestjs/common";
import { CurrencyModule } from "../currency/currency.module";
import { TrpcModule } from "../trpc/trpc.module";
import { VehicleChargesRouter } from "./vehicle-charges.router";
import { VehicleChargesService } from "./vehicle-charges.service";

@Module({
	imports: [TrpcModule, CurrencyModule],
	providers: [VehicleChargesService, VehicleChargesRouter],
	exports: [VehicleChargesService],
})
export class VehicleChargesModule {}
