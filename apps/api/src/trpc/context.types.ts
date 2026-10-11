import type { Session, SessionUser } from "@crm/auth";
import type { Request } from "express";

export type BaseTrpcContext = {
	req?: Request;
	session: Session | null;
};

export type UserTrpcContext = BaseTrpcContext & {
	user: SessionUser;
};

export type AuthedTrpcContext = UserTrpcContext & {
	organizationId: string;
};
