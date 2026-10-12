import "@crm/env/load";

type AllowList = {
	domains: readonly string[];
	addresses: readonly string[];
	open: boolean;
};

const EMPTY: AllowList = { domains: [], addresses: [], open: false };

let cachedSource: string | undefined;
let cached: AllowList = EMPTY;

function allowList(): AllowList {
	const source = process.env.ALLOWED_SIGN_IN ?? "";
	if (source === cachedSource) return cached;

	const domains: string[] = [];
	const addresses: string[] = [];
	let open = false;

	for (const raw of source.split(",")) {
		const entry = raw.trim().toLowerCase().replace(/^@/, "");
		if (!entry) continue;
		if (entry === "*") {
			open = true;
			continue;
		}
		(entry.includes("@") ? addresses : domains).push(entry);
	}

	cachedSource = source;
	cached = { domains, addresses, open };
	return cached;
}

export function workspaceDomains(): readonly string[] {
	return allowList().domains;
}

export function primaryWorkspaceDomain(): string | undefined {
	return allowList().domains[0];
}

export function hasSignInAllowList(): boolean {
	const { domains, addresses, open } = allowList();
	return open || domains.length > 0 || addresses.length > 0;
}

export function isWorkspaceEmail(email: string | null | undefined): boolean {
	const value = email?.trim().toLowerCase();
	if (!value) return false;

	const parts = value.split("@");
	if (parts.length !== 2) return false;

	const [local, host] = parts;
	if (!local || !host) return false;

	const { domains, addresses, open } = allowList();

	if (open) return true;

	if (addresses.includes(value)) return true;

	return domains.some(
		(domain) => host === domain || host.endsWith(`.${domain}`),
	);
}
