import type { Metadata } from "next";
import { AuthHeading, AuthShell } from "@/components/auth-shell";
import { requireSession } from "@/lib/session";
import { JoinForm } from "./join-form";

export const metadata: Metadata = {
	title: "Rejoindre une entreprise",
};

export const instant = false;

export default async function JoinPage() {
	await requireSession();

	return (
		<AuthShell>
			<AuthHeading
				title="Rejoignez votre entreprise"
				description="Saisissez le code de votre entreprise. Il vous est donné par le propriétaire ou un administrateur de votre agence."
			/>

			<JoinForm />
		</AuthShell>
	);
}
