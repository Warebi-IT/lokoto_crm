import "@crm/env/load";

import { onTelemetryProblem, syncVersion } from "@crm/telemetry";
import { type AgentDefinition, defineAgent, defineDynamic } from "eve";
import { logCapabilities } from "./lib/capabilities";
import { selectedModel } from "./lib/model";
import { OVH_MODEL_CONTEXT_WINDOW, ovhModel } from "./lib/ovh-model";

void logCapabilities();

onTelemetryProblem((message) => console.debug(`[telemetry] ${message}`));

void syncVersion();

const agentDefinition: AgentDefinition = {
	model: defineDynamic({
		fallback: ovhModel(),
		events: {
			"session.started": async () => {
				const selection = await selectedModel();
				return selection
					? {
							model: ovhModel(),
							modelContextWindowTokens: Math.min(
								selection.modelContextWindowTokens,
								OVH_MODEL_CONTEXT_WINDOW,
							),
						}
					: null;
			},
		},
	}),
	modelContextWindowTokens: OVH_MODEL_CONTEXT_WINDOW,
	limits: {
		maxInputTokensPerSession: 500_000,
		maxOutputTokensPerSession: 50_000,
		sessionTimeoutMs: 30 * 24 * 60 * 60 * 1000,
	},
};

const agent = defineAgent(agentDefinition);

export default agent as AgentDefinition;
