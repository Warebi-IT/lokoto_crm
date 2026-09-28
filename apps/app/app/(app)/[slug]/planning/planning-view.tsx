"use client";

import { Button } from "@crm/ui/components/button";
import { useState } from "react";
import { CalendarPlanningView } from "./calendar-planning-view";
import { VehiclePlanningView } from "./vehicle-planning-view";

type Mode = "calendar" | "vehicles";

export function PlanningView({ initialStart }: { initialStart: string }) {
	const [mode, setMode] = useState<Mode>("calendar");

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			<div className="inline-flex w-fit rounded-md border p-0.5">
				<Button
					variant={mode === "calendar" ? "secondary" : "ghost"}
					size="sm"
					onClick={() => setMode("calendar")}
				>
					Calendrier
				</Button>
				<Button
					variant={mode === "vehicles" ? "secondary" : "ghost"}
					size="sm"
					onClick={() => setMode("vehicles")}
				>
					Planning véhicules
				</Button>
			</div>

			{mode === "calendar" ? (
				<CalendarPlanningView initialStart={initialStart} />
			) : (
				<VehiclePlanningView initialStart={initialStart} />
			)}
		</div>
	);
}
