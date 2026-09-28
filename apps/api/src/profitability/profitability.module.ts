import { Module } from "@nestjs/common";
import { CurrencyModule } from "../currency/currency.module";
import { TrpcModule } from "../trpc/trpc.module";
import { ProfitabilityRouter } from "./profitability.router";
import { ProfitabilityService } from "./profitability.service";

@Module({
	imports: [TrpcModule, CurrencyModule],
	providers: [ProfitabilityService, ProfitabilityRouter],
	exports: [ProfitabilityService],
})
export class ProfitabilityModule {}
