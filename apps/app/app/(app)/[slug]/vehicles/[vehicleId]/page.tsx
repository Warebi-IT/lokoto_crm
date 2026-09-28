import { redirect } from "next/navigation";
import { recordHref } from "@/lib/record-href";

export const instant = false;

export default async function RecordRedirect({
	params,
}: {
	params: Promise<{ slug: string; vehicleId: string }>;
}) {
	const { slug, vehicleId } = await params;
	redirect(recordHref(slug, "/vehicles", "vehicle", vehicleId));
}
