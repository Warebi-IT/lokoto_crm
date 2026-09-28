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
	attachDriverInput,
	detachDriverInput,
	recordPickupInput,
	recordReturnInput,
	rentalContractBulkInput,
	rentalContractBulkOwnerInput,
	rentalContractCreateInput,
	rentalContractDriversInput,
	rentalContractIdInput,
	rentalContractListInput,
	rentalContractPlanningInput,
	rentalContractUpdateArgs,
	setDepositStatusInput,
	setDriverRoleInput,
	setRentalContractStatusInput,
} from "./rental-contracts.contracts";
import { RentalContractsService } from "./rental-contracts.service";

@Router({ alias: "rentalContracts" })
@UseMiddlewares(AuthMiddleware)
export class RentalContractsRouter {
	constructor(
		@Inject(RentalContractsService)
		private readonly rentalContracts: RentalContractsService,
	) {}

	@Query({ input: rentalContractListInput })
	async list(@Input() input: z.infer<typeof rentalContractListInput>) {
		return this.rentalContracts.list(input);
	}

	@Query({ input: rentalContractIdInput })
	async byId(@Input("id") id: string) {
		return this.rentalContracts.byId(id);
	}

	@Query({ input: rentalContractPlanningInput })
	async planning(@Input() input: z.infer<typeof rentalContractPlanningInput>) {
		return this.rentalContracts.planning(input);
	}

	@Mutation({ input: rentalContractCreateInput })
	async create(@Input() input: z.infer<typeof rentalContractCreateInput>) {
		return this.rentalContracts.create(input);
	}

	@Mutation({ input: rentalContractUpdateArgs })
	async update(@Input() input: z.infer<typeof rentalContractUpdateArgs>) {
		return this.rentalContracts.update(input.id, input.data);
	}

	@Mutation({ input: rentalContractIdInput })
	async delete(@Input("id") id: string) {
		return this.rentalContracts.delete(id);
	}

	@Mutation({ input: setRentalContractStatusInput })
	async setStatus(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setRentalContractStatusInput>,
	) {
		return this.rentalContracts.setStatus(input, ctx.user.id);
	}

	@Mutation({ input: recordPickupInput })
	async recordPickup(@Input() input: z.infer<typeof recordPickupInput>) {
		return this.rentalContracts.recordPickup(input);
	}

	@Mutation({ input: recordReturnInput })
	async recordReturn(@Input() input: z.infer<typeof recordReturnInput>) {
		return this.rentalContracts.recordReturn(input);
	}

	@Mutation({ input: setDepositStatusInput })
	async setDepositStatus(
		@Input() input: z.infer<typeof setDepositStatusInput>,
	) {
		return this.rentalContracts.setDepositStatus(input);
	}

	@Query({ input: rentalContractDriversInput })
	async driverOptions(@Input("contractId") contractId: string) {
		return this.rentalContracts.driverOptions(contractId);
	}

	@Mutation({ input: attachDriverInput })
	async attachDriver(@Input() input: z.infer<typeof attachDriverInput>) {
		return this.rentalContracts.attachDriver(input);
	}

	@Mutation({ input: detachDriverInput })
	async detachDriver(@Input() input: z.infer<typeof detachDriverInput>) {
		return this.rentalContracts.detachDriver(input);
	}

	@Mutation({ input: setDriverRoleInput })
	async setDriverRole(@Input() input: z.infer<typeof setDriverRoleInput>) {
		return this.rentalContracts.setDriverRole(input);
	}

	@Mutation({ input: rentalContractBulkOwnerInput })
	async bulkAssignOwner(
		@Input() input: z.infer<typeof rentalContractBulkOwnerInput>,
	) {
		return this.rentalContracts.bulkAssignOwner(input);
	}

	@Mutation({ input: rentalContractBulkInput })
	async bulkDelete(@Input("ids") ids: string[]) {
		return this.rentalContracts.bulkDelete(ids);
	}
}
