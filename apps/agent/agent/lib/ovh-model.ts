import { createOpenAI } from "@ai-sdk/openai";

const DEFAULT_OVH_BASE_URL = "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1";
const DEFAULT_OVH_MODEL = "gpt-oss-20b";

const ovh = createOpenAI({
	apiKey: process.env.OVH_AI_ENDPOINTS_ACCESS_TOKEN,
	baseURL: process.env.OVH_AI_ENDPOINTS_BASE_URL ?? DEFAULT_OVH_BASE_URL,
	name: "ovh-ai-endpoints",
});

export const OVH_MODEL_CONTEXT_WINDOW = 131_072;

export function ovhModel(): ReturnType<typeof ovh.chat> {
	return ovh.chat(process.env.OVH_AI_MODEL?.trim() || DEFAULT_OVH_MODEL);
}
