import { getProfile, slugFromProfileUrl } from "./linkdapi";

export type PortraitSource = "linkedin" | "github";

export type PortraitCandidate = {
	source: PortraitSource;
	url: string;
};

export type PortraitSubject = {
	id: string;
	name: string | null;
	linkedinUrl: string | null;
	githubUrl: string | null;
};

export async function findPortrait(
	subject: PortraitSubject,
	spend: (units?: number) => { ok: boolean; reason?: string },
): Promise<
	| { found: true; candidate: PortraitCandidate }
	| { found: false; tried: string[]; reason?: string }
> {
	const tried: string[] = [];

	if (subject.linkedinUrl) {
		const slug = slugFromProfileUrl(subject.linkedinUrl);
		if (slug) {
			const charge = spend();
			if (!charge.ok) return { found: false, tried, reason: charge.reason };

			const result = await getProfile(slug);
			if (result.ok && result.data.photoUrl) {
				return {
					found: true,
					candidate: { source: "linkedin", url: result.data.photoUrl },
				};
			}
			tried.push(
				result.ok
					? "LinkedIn profile has no picture"
					: "LinkedIn profile could not be read",
			);
		}
	}

	const login = githubLogin(subject.githubUrl);
	if (login) {
		return {
			found: true,
			candidate: {
				source: "github",
				url: `https://github.com/${encodeURIComponent(login)}.png?size=460`,
			},
		};
	}

	return { found: false, tried };
}

function githubLogin(raw: string | null): string | null {
	if (!raw) return null;

	try {
		const url = new URL(raw.trim());
		const host = url.hostname.toLowerCase().replace(/^www\./, "");
		if (host !== "github.com") return null;

		const segments = url.pathname.split("/").filter(Boolean);
		if (segments.length !== 1) return null;

		return segments[0] ?? null;
	} catch {
		return null;
	}
}
