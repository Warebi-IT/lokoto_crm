import {
	Controller,
	ForbiddenException,
	Headers,
	Logger,
	Post,
	Query,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import type { EnvironmentVariables } from "../config/env.validation";
import { VehicleImagesService } from "./vehicle-images.service";

const DEFAULT_BATCH = 5;
const MAX_BATCH = 20;

@Controller("internal/vehicles")
export class VehicleImagesController {
	private readonly logger = new Logger(VehicleImagesController.name);
	private readonly secret: string | undefined;

	constructor(
		private readonly images: VehicleImagesService,
		config: ConfigService<EnvironmentVariables, true>,
	) {
		this.secret = config.get("CRON_SECRET", { infer: true });
	}

	@Post("images")
	@AllowAnonymous()
	async backfill(
		@Headers("authorization") authorization?: string,
		@Query("limit") limit?: string,
	) {
		if (!this.secret) {
			this.logger.error({
				message: "CRON_SECRET is not set — refusing to run the images route.",
			});
			throw new ServiceUnavailableException("Images are not configured.");
		}

		if (!timingSafeEquals(authorization ?? "", `Bearer ${this.secret}`)) {
			throw new ForbiddenException();
		}

		const parsed = Number.parseInt(limit ?? "", 10);
		const batch = Number.isFinite(parsed)
			? Math.min(Math.max(parsed, 1), MAX_BATCH)
			: DEFAULT_BATCH;

		return this.images.backfill(batch);
	}
}

function timingSafeEquals(a: string, b: string): boolean {
	if (a.length !== b.length) return false;

	let mismatch = 0;
	for (let index = 0; index < a.length; index += 1) {
		mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
	}

	return mismatch === 0;
}
