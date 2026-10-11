import { resolveRequestOrganization } from "@crm/auth";
import { runInTenant } from "@crm/db/tenant";
import { Injectable } from "@nestjs/common";
import { TRPCError } from "@trpc/server";
import type {
	MiddlewareOptions,
	MiddlewareResponse,
	TRPCMiddleware,
} from "nestjs-trpc";
import { setRequestUserId } from "../../logging/request-context";
import type {
	AuthedTrpcContext,
	BaseTrpcContext,
	UserTrpcContext,
} from "../context.types";

export const ORGANIZATION_REQUIRED_MESSAGE =
	"Enter your company code to continue.";

@Injectable()
export class UserMiddleware implements TRPCMiddleware {
	async use(opts: MiddlewareOptions): Promise<MiddlewareResponse> {
		const ctx = opts.ctx as BaseTrpcContext;
		const user = ctx.session?.user;

		if (!user) {
			throw new TRPCError({ code: "UNAUTHORIZED" });
		}

		setRequestUserId(user.id);

		const nextCtx: UserTrpcContext = { ...ctx, user };
		return opts.next({ ctx: nextCtx });
	}
}

@Injectable()
export class AuthMiddleware implements TRPCMiddleware {
	async use(opts: MiddlewareOptions): Promise<MiddlewareResponse> {
		const ctx = opts.ctx as BaseTrpcContext;
		const user = ctx.session?.user;

		if (!user) {
			throw new TRPCError({ code: "UNAUTHORIZED" });
		}

		const organizationId = await resolveRequestOrganization(
			user.id,
			ctx.session?.session.activeOrganizationId,
		);

		if (!organizationId) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: ORGANIZATION_REQUIRED_MESSAGE,
			});
		}

		setRequestUserId(user.id);

		const nextCtx: AuthedTrpcContext = { ...ctx, user, organizationId };
		return runInTenant(organizationId, () => opts.next({ ctx: nextCtx }));
	}
}
