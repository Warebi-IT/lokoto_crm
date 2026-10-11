"use client";

import { Button } from "@crm/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { signOutAndRedirect } from "@/lib/sign-out";
import { useTRPC } from "@/lib/trpc/client";

export function JoinForm() {
	const trpc = useTRPC();
	const router = useRouter();
	const codeId = useId();
	const [code, setCode] = useState("");

	const join = useMutation(
		trpc.workspace.join.mutationOptions({
			onSuccess: () => {
				router.refresh();
				router.replace("/");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				join.mutate({ code });
			}}
			className="flex flex-col gap-6"
		>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor={codeId}>Code de l'entreprise</FieldLabel>
					<Input
						id={codeId}
						name="code"
						value={code}
						onChange={(event) => setCode(event.target.value.toUpperCase())}
						placeholder="A1B2C3D4E5"
						autoComplete="off"
						autoCapitalize="characters"
						autoCorrect="off"
						spellCheck={false}
						autoFocus
						required
					/>
					<FieldDescription>
						Vous n'avez pas de code ? Demandez-le à l'administrateur de votre
						agence.
					</FieldDescription>
				</Field>
			</FieldGroup>

			<Button type="submit" disabled={join.isPending || code.trim() === ""}>
				{join.isPending ? <Spinner data-icon="inline-start" /> : null}
				Rejoindre
			</Button>

			<Button type="button" variant="ghost" onClick={signOutAndRedirect}>
				Changer de compte
			</Button>
		</form>
	);
}
