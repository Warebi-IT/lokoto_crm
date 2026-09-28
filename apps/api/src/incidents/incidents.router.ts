import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import type { z } from "zod";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	damageAnnotationCreateInput,
	damageAnnotationUpdateArgs,
	incidentCreateInput,
	incidentIdInput,
	incidentsByContractInput,
	incidentsByVehicleInput,
	incidentUpdateArgs,
} from "./incidents.contracts";
import { IncidentsService } from "./incidents.service";

@Router({ alias: "incidents" })
@UseMiddlewares(AuthMiddleware)
export class IncidentsRouter {
	constructor(
		@Inject(IncidentsService) private readonly incidents: IncidentsService,
	) {}

	@Query({ input: incidentsByVehicleInput })
	async listByVehicle(@Input("vehicleId") vehicleId: string) {
		return this.incidents.listByVehicle(vehicleId);
	}

	@Query({ input: incidentsByContractInput })
	async listByContract(@Input("rentalContractId") rentalContractId: string) {
		return this.incidents.listByContract(rentalContractId);
	}

	@Mutation({ input: incidentCreateInput })
	async create(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof incidentCreateInput>,
	) {
		return this.incidents.create(input, ctx.user.id);
	}

	@Mutation({ input: incidentUpdateArgs })
	async update(@Input() input: z.infer<typeof incidentUpdateArgs>) {
		return this.incidents.update(input.id, input.data);
	}

	@Mutation({ input: incidentIdInput })
	async delete(@Input("id") id: string) {
		return this.incidents.delete(id);
	}

	@Mutation({ input: damageAnnotationCreateInput })
	async createDamageAnnotation(
		@Input() input: z.infer<typeof damageAnnotationCreateInput>,
	) {
		return this.incidents.createDamageAnnotation(input);
	}

	@Mutation({ input: damageAnnotationUpdateArgs })
	async updateDamageAnnotation(
		@Input() input: z.infer<typeof damageAnnotationUpdateArgs>,
	) {
		return this.incidents.updateDamageAnnotation(input.id, input.data);
	}

	@Mutation({ input: incidentIdInput })
	async deleteDamageAnnotation(@Input("id") id: string) {
		return this.incidents.deleteDamageAnnotation(id);
	}
}
