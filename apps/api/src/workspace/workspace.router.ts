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
import type { AuthedTrpcContext, UserTrpcContext } from "../trpc/context.types";
import {
	AuthMiddleware,
	UserMiddleware,
} from "../trpc/middlewares/auth.middleware";
import {
	joinWorkspaceInput,
	memberListInput,
	setMemberAgentInput,
	setMemberRoleInput,
	updateWorkspaceInput,
} from "./workspace.contracts";
import { WorkspaceService } from "./workspace.service";

@Router({ alias: "workspace" })
export class WorkspaceRouter {
	constructor(
		@Inject(WorkspaceService) private readonly workspace: WorkspaceService,
	) {}

	@Query()
	@UseMiddlewares(AuthMiddleware)
	async get(@Ctx() ctx: AuthedTrpcContext) {
		return this.workspace.get(ctx.user.id);
	}

	@Query({ input: memberListInput })
	@UseMiddlewares(AuthMiddleware)
	async members(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof memberListInput>,
	) {
		return this.workspace.members(ctx.user.id, input);
	}

	@Query()
	@UseMiddlewares(AuthMiddleware)
	async agentUsage(@Ctx() ctx: AuthedTrpcContext) {
		return this.workspace.agentUsage(ctx.user.id);
	}

	@Mutation({ input: setMemberAgentInput })
	@UseMiddlewares(AuthMiddleware)
	async setMemberAgent(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setMemberAgentInput>,
	) {
		return this.workspace.setMemberAgent(ctx.user.id, input);
	}

	@Mutation({ input: updateWorkspaceInput })
	@UseMiddlewares(AuthMiddleware)
	async update(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateWorkspaceInput>,
	) {
		return this.workspace.update(ctx.user.id, input);
	}

	@Mutation({ input: setMemberRoleInput })
	@UseMiddlewares(AuthMiddleware)
	async setMemberRole(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setMemberRoleInput>,
	) {
		return this.workspace.setMemberRole(ctx.user.id, input);
	}

	@Query()
	@UseMiddlewares(UserMiddleware)
	async membership(@Ctx() ctx: UserTrpcContext) {
		return this.workspace.membership(ctx.user.id);
	}

	@Mutation({ input: joinWorkspaceInput })
	@UseMiddlewares(UserMiddleware)
	async join(
		@Ctx() ctx: UserTrpcContext,
		@Input() input: z.infer<typeof joinWorkspaceInput>,
	) {
		return this.workspace.join(ctx.user.id, input.code);
	}

	@Mutation()
	@UseMiddlewares(AuthMiddleware)
	async regenerateJoinCode(@Ctx() ctx: AuthedTrpcContext) {
		return this.workspace.regenerateJoinCode(ctx.user.id);
	}
}
