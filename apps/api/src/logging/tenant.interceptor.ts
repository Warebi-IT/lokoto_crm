import { resolveRequestOrganization } from "@crm/auth";
import { runInTenant } from "@crm/db/tenant";
import {
	type CallHandler,
	type ExecutionContext,
	ForbiddenException,
	Injectable,
	type NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import { from, mergeMap, Observable } from "rxjs";

type SessionRequest = Request & {
	session?: {
		user?: { id?: string };
		session?: { activeOrganizationId?: string | null };
	};
};

@Injectable()
export class TenantInterceptor implements NestInterceptor {
	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		if (context.getType() !== "http") {
			return next.handle();
		}

		const request = context.switchToHttp().getRequest<SessionRequest>();
		const userId = request.session?.user?.id;

		if (!userId) {
			return next.handle();
		}

		return from(
			resolveRequestOrganization(
				userId,
				request.session?.session?.activeOrganizationId,
			),
		).pipe(
			mergeMap((organizationId) => {
				if (!organizationId) {
					throw new ForbiddenException("Enter your company code to continue.");
				}

				return new Observable<unknown>((subscriber) => {
					runInTenant(organizationId, () => {
						next.handle().subscribe(subscriber);
					});
				});
			}),
		);
	}
}
