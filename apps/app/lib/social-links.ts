import LogoGithub from "@carbon/icons-react/es/LogoGithub";
import LogoLinkedin from "@carbon/icons-react/es/LogoLinkedin";
import LogoX from "@carbon/icons-react/es/LogoX";
import type { CarbonIcon } from "@crm/ui/components/icon";

type SocialLink<T> = { key: keyof T; label: string; icon: CarbonIcon };

export type ContactLinks = {
	linkedinUrl: string | null;
	twitterUrl: string | null;
	githubUrl: string | null;
};

const CONTACT_LINKS: SocialLink<ContactLinks>[] = [
	{ key: "linkedinUrl", label: "LinkedIn", icon: LogoLinkedin },
	{ key: "twitterUrl", label: "X", icon: LogoX },
	{ key: "githubUrl", label: "GitHub", icon: LogoGithub },
];

function present<T>(record: T, links: SocialLink<T>[]) {
	return links.flatMap((link) => {
		const href = record[link.key];
		return typeof href === "string" && href ? [{ ...link, href }] : [];
	});
}

export function contactSocialLinks(contact: ContactLinks) {
	return present(contact, CONTACT_LINKS);
}

export function hasContactLinks(contact: ContactLinks): boolean {
	return contactSocialLinks(contact).length > 0;
}
