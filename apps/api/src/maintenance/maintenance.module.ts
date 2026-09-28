import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { MaintenanceRouter } from "./maintenance.router";
import { MaintenanceService } from "./maintenance.service";

@Module({
	imports: [TrpcModule],
	providers: [MaintenanceService, MaintenanceRouter],
	exports: [MaintenanceService],
})
export class MaintenanceModule {}
