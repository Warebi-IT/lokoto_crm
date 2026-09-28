import { workspaceUrl } from "@/lib/workspace-url";

export function recordHref(
	slug: string,
	list: "/contacts" | "/vehicles" | "/rental-contracts",
	kind: "contact" | "vehicle" | "rentalContract",
	id: string,
): string {
	const query = new URLSearchParams({ record: `${kind}:${id}` });

	return `${workspaceUrl(slug, list)}?${query}`;
}
