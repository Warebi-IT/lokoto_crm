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
	inspectionCreateInput,
	inspectionIdInput,
	inspectionsByContractInput,
} from "./inspections.contracts";
import { InspectionsService } from "./inspections.service";

@Router({ alias: "vehicleInspections" })
@UseMiddlewares(AuthMiddleware)
export class InspectionsRouter {
	constructor(
		@Inject(InspectionsService)
		private readonly inspections: InspectionsService,
	) {}

	@Query({ input: inspectionsByContractInput })
	async listByContract(@Input("rentalContractId") rentalContractId: string) {
		return this.inspections.listByContract(rentalContractId);
	}

	@Mutation({ input: inspectionCreateInput })
	async create(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof inspectionCreateInput>,
	) {
		return this.inspections.create(input, ctx.user.id);
	}

	@Mutation({ input: inspectionIdInput })
	async delete(@Input("id") id: string) {
		return this.inspections.delete(id);
	}
}
