"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardPanelEmpty,
	CardTitle,
} from "@crm/ui/components/card";
import { DatePicker } from "@crm/ui/components/date-picker";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

const FUEL_LABEL: Record<string, string> = {
	DIESEL: "Diesel",
	GASOLINE: "Gasoline",
	ELECTRIC: "Electric",
};

export function AvailabilityView() {
	const workspaceUrl = useWorkspaceUrl();
	const trpc = useTRPC();
	const [startDate, setStartDate] = useState(() => dateInput(new Date()));
	const [endDate, setEndDate] = useState(() => {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		return dateInput(tomorrow);
	});
	const validRange = startDate !== "" && endDate !== "" && endDate > startDate;
	const vehicles = useQuery(
		trpc.vehicles.list.queryOptions({
			q: "",
			sort: "make",
			dir: "asc",
			page: 1,
			pageSize: 100,
			status: "all",
			type: "all",
		}),
	);
	const availability = useQuery({
		...trpc.vehicles.availability.queryOptions({ startDate, endDate }),
		enabled: validRange,
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>Disponibilité de la flotte</CardTitle>
				<CardDescription>
					La disponibilité se met à jour lorsque vous changez une date.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid gap-4 sm:grid-cols-2">
					<DatePicker
						value={startDate}
						onChange={setStartDate}
						placeholder="Date de départ"
					/>
					<DatePicker
						value={endDate}
						onChange={setEndDate}
						placeholder="Date de retour"
					/>
				</div>
				{vehicles.isPending ? (
					<CardPanelEmpty>Chargement des véhicules…</CardPanelEmpty>
				) : vehicles.data?.rows.length === 0 ? (
					<CardPanelEmpty>Aucun véhicule trouvé.</CardPanelEmpty>
				) : (
					<ul className="grid gap-x-6 divide-y border-y sm:grid-cols-2 sm:divide-y-0">
						{vehicles.data?.rows.map((vehicle) => {
							const isAvailable = availability.data?.rows.some(
								(row) => row.id === vehicle.id,
							);

							return (
								<li key={vehicle.id} className="border-b py-3 last:border-b-0">
									<Link
										href={workspaceUrl(`/vehicles/${vehicle.id}`)}
										className="flex items-baseline justify-between gap-3 hover:underline"
									>
										<span className="min-w-0 truncate">
											<span className="font-medium">
												{vehicle.make} {vehicle.model}
											</span>
											<span className="text-muted-foreground">
												· {vehicle.plateNumber}
											</span>
											<span className="text-muted-foreground text-xs">
												· {FUEL_LABEL[vehicle.fuelType] ?? vehicle.fuelType}
											</span>
										</span>
										<span className="shrink-0 text-muted-foreground text-xs">
											{!validRange
												? "Choisissez les dates"
												: availability.isPending
													? "Vérification…"
													: isAvailable
														? "Disponible"
														: "Indisponible"}
										</span>
									</Link>
								</li>
							);
						})}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

function dateInput(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}
