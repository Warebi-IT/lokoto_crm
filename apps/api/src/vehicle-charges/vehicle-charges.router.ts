import { Inject } from "@nestjs/common";
import { Input, Mutation, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	vehicleChargeCreateInput,
	vehicleChargeIdInput,
	vehicleChargesByVehicleInput,
} from "./vehicle-charges.contracts";
import { VehicleChargesService } from "./vehicle-charges.service";

@Router({ alias: "vehicleCharges" })
@UseMiddlewares(AuthMiddleware)
export class VehicleChargesRouter {
	constructor(
		@Inject(VehicleChargesService)
		private readonly charges: VehicleChargesService,
	) {}

	@Query({ input: vehicleChargesByVehicleInput })
	async listByVehicle(@Input("vehicleId") vehicleId: string) {
		return this.charges.listByVehicle(vehicleId);
	}

	@Mutation({ input: vehicleChargeCreateInput })
	async create(@Input() input: z.infer<typeof vehicleChargeCreateInput>) {
		return this.charges.create(input);
	}

	@Mutation({ input: vehicleChargeIdInput })
	async delete(@Input("id") id: string) {
		return this.charges.delete(id);
	}
}
