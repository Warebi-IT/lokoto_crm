import { Inject } from "@nestjs/common";
import { Input, Mutation, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	maintenanceByVehicleInput,
	maintenanceCreateInput,
	maintenanceIdInput,
	maintenanceUpdateArgs,
} from "./maintenance.contracts";
import { MaintenanceService } from "./maintenance.service";

@Router({ alias: "maintenanceRecords" })
@UseMiddlewares(AuthMiddleware)
export class MaintenanceRouter {
	constructor(
		@Inject(MaintenanceService)
		private readonly maintenance: MaintenanceService,
	) {}

	@Query({ input: maintenanceByVehicleInput })
	async listByVehicle(@Input("vehicleId") vehicleId: string) {
		return this.maintenance.listByVehicle(vehicleId);
	}

	@Mutation({ input: maintenanceCreateInput })
	async create(@Input() input: z.infer<typeof maintenanceCreateInput>) {
		return this.maintenance.create(input);
	}

	@Mutation({ input: maintenanceUpdateArgs })
	async update(@Input() input: z.infer<typeof maintenanceUpdateArgs>) {
		return this.maintenance.update(input.id, input.data);
	}

	@Mutation({ input: maintenanceIdInput })
	async delete(@Input("id") id: string) {
		return this.maintenance.delete(id);
	}
}
