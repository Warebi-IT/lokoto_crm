import { Module } from "@nestjs/common";
import { CurrencyModule } from "../currency/currency.module";
import { FieldsModule } from "../fields/fields.module";
import { TrpcModule } from "../trpc/trpc.module";
import { VehicleImagesController } from "./vehicle-images.controller";
import { VehicleImagesService } from "./vehicle-images.service";
import { VehiclesRouter } from "./vehicles.router";
import { VehiclesService } from "./vehicles.service";

@Module({
	imports: [FieldsModule, TrpcModule, CurrencyModule],
	controllers: [VehicleImagesController],
	providers: [VehiclesService, VehicleImagesService, VehiclesRouter],
	exports: [VehiclesService],
})
export class VehiclesModule {}
