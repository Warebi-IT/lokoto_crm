import { redirect } from "next/navigation";
import { recordHref } from "@/lib/record-href";

export const instant = false;

export default async function RecordRedirect({
	params,
}: {
	params: Promise<{ slug: string; rentalContractId: string }>;
}) {
	const { slug, rentalContractId } = await params;
	redirect(
		recordHref(slug, "/rental-contracts", "rentalContract", rentalContractId),
	);
}
