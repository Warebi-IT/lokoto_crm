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
	paymentCreateInput,
	paymentIdInput,
	paymentsByContractInput,
	paymentUpdateArgs,
} from "./payments.contracts";
import { PaymentsService } from "./payments.service";

@Router({ alias: "payments" })
@UseMiddlewares(AuthMiddleware)
export class PaymentsRouter {
	constructor(
		@Inject(PaymentsService) private readonly payments: PaymentsService,
	) {}

	@Query({ input: paymentsByContractInput })
	async listByContract(@Input("rentalContractId") rentalContractId: string) {
		return this.payments.listByContract(rentalContractId);
	}

	@Mutation({ input: paymentCreateInput })
	async create(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof paymentCreateInput>,
	) {
		return this.payments.create(input, ctx.user.id);
	}

	@Mutation({ input: paymentUpdateArgs })
	async update(@Input() input: z.infer<typeof paymentUpdateArgs>) {
		return this.payments.update(input.id, input.data);
	}

	@Mutation({ input: paymentIdInput })
	async delete(@Input("id") id: string) {
		return this.payments.delete(id);
	}
}
