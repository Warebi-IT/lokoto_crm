import { auth } from "@crm/auth";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule as BetterAuthModule } from "@thallesp/nestjs-better-auth";
import { ActivitiesModule } from "./activities/activities.module";
import { AgentModule } from "./agent/agent.module";
import { AuthModule } from "./auth/auth.module";
import { BackfillModule } from "./backfill/backfill.module";
import { AppCacheModule } from "./cache/cache.module";
import { validateEnv } from "./config/env.validation";
import { ContactsModule } from "./contacts/contacts.module";
import { ConversationsModule } from "./conversations/conversations.module";
import { CrmModule } from "./crm/crm.module";
import { CurrencyModule } from "./currency/currency.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { DatabaseModule } from "./database/database.module";
import { FieldsModule } from "./fields/fields.module";
import { GoogleModule } from "./google/google.module";
import { HealthModule } from "./health/health.module";
import { IncidentsModule } from "./incidents/incidents.module";
import { InspectionsModule } from "./inspections/inspections.module";
import { LoggingModule } from "./logging/logging.module";
import { logAuthRoute } from "./logging/request-logger.middleware";
import { MailboxModule } from "./mailbox/mailbox.module";
import { MaintenanceModule } from "./maintenance/maintenance.module";
import { MicrosoftModule } from "./microsoft/microsoft.module";
import { PaymentsModule } from "./payments/payments.module";
import { ProfitabilityModule } from "./profitability/profitability.module";
import { RentalContractsModule } from "./rental-contracts/rental-contracts.module";
import { SearchModule } from "./search/search.module";
import { SettingsModule } from "./settings/settings.module";
import { SsoModule } from "./sso/sso.module";
import { SyncModule } from "./sync/sync.module";
import { TelemetryModule } from "./telemetry/telemetry.module";
import { TrpcModule } from "./trpc/trpc.module";
import { UsersModule } from "./users/users.module";
import { VehicleChargesModule } from "./vehicle-charges/vehicle-charges.module";
import { VehiclesModule } from "./vehicles/vehicles.module";
import { WorkspaceModule } from "./workspace/workspace.module";

@Module({
	imports: [
		LoggingModule,
		ConfigModule.forRoot({
			isGlobal: true,
			cache: true,
			validate: validateEnv,
		}),
		AppCacheModule,
		DatabaseModule,
		CrmModule,
		BetterAuthModule.forRoot({ auth, middleware: logAuthRoute }),
		AuthModule,
		HealthModule,
		TrpcModule,
		UsersModule,
		ContactsModule,
		ConversationsModule,
		CurrencyModule,
		VehiclesModule,
		VehicleChargesModule,
		RentalContractsModule,
		PaymentsModule,
		IncidentsModule,
		MaintenanceModule,
		InspectionsModule,
		ProfitabilityModule,
		FieldsModule,
		ActivitiesModule,
		AgentModule,
		DashboardModule,
		SearchModule,
		MailboxModule,
		GoogleModule,
		MicrosoftModule,
		SyncModule,
		SettingsModule,
		WorkspaceModule,
		SsoModule,
		BackfillModule,
		TelemetryModule,
	],
})
export class AppModule {}
