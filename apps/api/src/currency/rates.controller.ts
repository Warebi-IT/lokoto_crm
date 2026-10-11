import type { Db } from "@crm/db";
import { runInTenant } from "@crm/db/tenant";
import {
	Controller,
	ForbiddenException,
	Get,
	Headers,
	Logger,
	Post,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import type { EnvironmentVariables } from "../config/env.validation";
import { InjectDatabase } from "../database/database.constants";
import { ConversionService } from "./conversion.service";
import { RatesService } from "./rates.service";

@Controller("internal/sync")
export class RatesController {
	private readonly logger = new Logger(RatesController.name);
	private readonly secret: string | undefined;

	constructor(
		private readonly rates: RatesService,
		private readonly conversion: ConversionService,
		@InjectDatabase() private readonly db: Db,
		config: ConfigService<EnvironmentVariables, true>,
	) {
		this.secret = config.get("CRON_SECRET", { infer: true });
	}

	@Get("rates")
	@AllowAnonymous()
	async ratesViaGet(@Headers("authorization") authorization?: string) {
		return this.run(authorization);
	}

	@Post("rates")
	@AllowAnonymous()
	async ratesViaPost(@Headers("authorization") authorization?: string) {
		return this.run(authorization);
	}

	private async run(authorization?: string) {
		if (!this.secret) {
			this.logger.error({
				message: "CRON_SECRET is not set — refusing to run the rates route.",
			});
			throw new ServiceUnavailableException("Rate refresh is not configured.");
		}

		if (!timingSafeEquals(authorization ?? "", `Bearer ${this.secret}`)) {
			throw new ForbiddenException();
		}

		const refresh = await this.rates.refresh();

		if (!refresh.ok) return refresh;

		const organizations = await this.db.organization.findMany({
			select: { id: true },
		});

		let converted = 0;
		const missing = new Set<string>();

		for (const { id } of organizations) {
			const filled = await runInTenant(id, () =>
				this.conversion.fillMissingEverywhere(),
			);

			converted += filled.converted;
			for (const code of filled.missing) missing.add(code);
		}

		return { ...refresh, converted, missing: [...missing].sort() };
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
