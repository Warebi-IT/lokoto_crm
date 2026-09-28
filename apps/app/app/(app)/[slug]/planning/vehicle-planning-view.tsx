"use client";

import ChevronLeft from "@carbon/icons-react/es/ChevronLeft";
import ChevronRight from "@carbon/icons-react/es/ChevronRight";
import { Button } from "@crm/ui/components/button";
import { Spinner } from "@crm/ui/components/spinner";
import { cn } from "@crm/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { rentalStatusPresentation } from "@/lib/rental-status";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import {
	addDays,
	addMonths,
	dateInput,
	dayIndexOf,
	daysInMonth,
	startOfMonth,
	WEEK_DAYS,
} from "./date-utils";

type Planning = RouterOutputs["rentalContracts"]["planning"];
type Vehicle = Planning["vehicles"][number];
type Contract = Planning["contracts"][number];

type Scale = "week" | "month";

const TONE_CLASS: Record<string, string> = {
	neutral: "border-muted-foreground/40 bg-muted-foreground/15",
	info: "border-info bg-info/15",
	warning: "border-warning bg-warning/15",
	success: "border-success bg-success/15",
	error: "border-destructive bg-destructive/15",
};

const DAY_LABEL = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
const DAY_NUMBER = new Intl.DateTimeFormat("fr-FR", {
	day: "numeric",
	month: "short",
});
const MONTH_TITLE = new Intl.DateTimeFormat("fr-FR", {
	month: "long",
	year: "numeric",
});
const WEEK_TITLE = new Intl.DateTimeFormat("fr-FR", {
	day: "numeric",
	month: "long",
});

function dayDate(value: string): Date {
	return new Date(`${value}T12:00:00`);
}

export function VehiclePlanningView({
	initialStart,
}: {
	initialStart: string;
}) {
	const trpc = useTRPC();
	const openRecord = useOpenRecord();
	const [scale, setScale] = useState<Scale>("week");
	const [anchor, setAnchor] = useState(initialStart);
	const today = useMemo(() => dateInput(new Date()), []);

	const rangeStart = scale === "month" ? startOfMonth(anchor) : anchor;
	const dayCount = scale === "month" ? daysInMonth(rangeStart) : WEEK_DAYS;
	const days = useMemo(
		() =>
			Array.from({ length: dayCount }, (_, index) =>
				addDays(rangeStart, index),
			),
		[rangeStart, dayCount],
	);
	const rangeEnd = addDays(rangeStart, dayCount);

	const planning = useQuery({
		...trpc.rentalContracts.planning.queryOptions({
			startDate: rangeStart,
			endDate: rangeEnd,
		}),
		placeholderData: (previous) => previous,
	});

	function goPrev() {
		setAnchor((prev) =>
			scale === "month"
				? addMonths(startOfMonth(prev), -1)
				: addDays(prev, -WEEK_DAYS),
		);
	}
	function goNext() {
		setAnchor((prev) =>
			scale === "month"
				? addMonths(startOfMonth(prev), 1)
				: addDays(prev, WEEK_DAYS),
		);
	}

	const vehicles = planning.data?.vehicles ?? [];
	const contracts = planning.data?.contracts ?? [];

	const contractsByVehicle = useMemo(() => {
		const map = new Map<string, Contract[]>();
		for (const contract of contracts) {
			const list = map.get(contract.vehicleId) ?? [];
			list.push(contract);
			map.set(contract.vehicleId, list);
		}
		return map;
	}, [contracts]);

	const columnWidth = scale === "month" ? "2.5rem" : "9rem";
	const gridTemplateColumns = `14rem repeat(${days.length}, minmax(${columnWidth}, 1fr))`;

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="icon-sm"
						aria-label="Précédent"
						onClick={goPrev}
					>
						<ChevronLeft />
					</Button>
					<Button variant="outline" size="sm" onClick={() => setAnchor(today)}>
						Aujourd’hui
					</Button>
					<Button
						variant="outline"
						size="icon-sm"
						aria-label="Suivant"
						onClick={goNext}
					>
						<ChevronRight />
					</Button>
					<span className="ml-1 truncate font-medium text-sm capitalize">
						{scale === "month"
							? MONTH_TITLE.format(dayDate(rangeStart))
							: `${WEEK_TITLE.format(dayDate(rangeStart))} – ${WEEK_TITLE.format(dayDate(addDays(rangeStart, dayCount - 1)))}`}
					</span>
				</div>
				<div className="flex items-center gap-2">
					{planning.isFetching && (
						<Spinner className="size-4 text-muted-foreground" />
					)}
					<div className="inline-flex rounded-md border p-0.5">
						<Button
							variant={scale === "week" ? "secondary" : "ghost"}
							size="sm"
							onClick={() => setScale("week")}
						>
							Semaine
						</Button>
						<Button
							variant={scale === "month" ? "secondary" : "ghost"}
							size="sm"
							onClick={() => setScale("month")}
						>
							Mois
						</Button>
					</div>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-card">
				<div className="grid min-w-max" style={{ gridTemplateColumns }}>
					<div
						className="sticky top-0 left-0 z-20 border-b bg-muted px-3 py-2 text-muted-foreground text-xs"
						style={{ gridColumn: 1, gridRow: 1 }}
					>
						Véhicule
					</div>
					{days.map((day, index) => (
						<div
							key={day}
							className={cn(
								"sticky top-0 z-10 border-b border-l bg-muted px-1 py-2 text-center text-[10px]",
								day === today
									? "font-semibold text-foreground"
									: "text-muted-foreground",
							)}
							style={{ gridColumn: index + 2, gridRow: 1 }}
						>
							{scale === "week" ? (
								<>
									<div className="capitalize">
										{DAY_LABEL.format(dayDate(day))}
									</div>
									<div className="tabular-nums">
										{DAY_NUMBER.format(dayDate(day))}
									</div>
								</>
							) : (
								<div className="tabular-nums">{Number(day.slice(-2))}</div>
							)}
						</div>
					))}

					{planning.isPending ? (
						<div
							className="col-span-full flex items-center justify-center p-8"
							style={{ gridRow: 2 }}
						>
							<Spinner />
						</div>
					) : vehicles.length === 0 ? (
						<div
							className="col-span-full p-8 text-center text-muted-foreground text-sm"
							style={{ gridRow: 2 }}
						>
							Aucun véhicule dans la flotte.
						</div>
					) : (
						vehicles.map((vehicle, rowIndex) => (
							<VehicleRow
								key={vehicle.id}
								vehicle={vehicle}
								row={rowIndex + 2}
								days={days}
								today={today}
								onOpen={() => openRecord({ kind: "vehicle", id: vehicle.id })}
							/>
						))
					)}

					{vehicles.flatMap((vehicle, rowIndex) => {
						const row = rowIndex + 2;
						const list = contractsByVehicle.get(vehicle.id) ?? [];

						return list.flatMap((contract) => {
							const startIndex = Math.max(
								0,
								dayIndexOf(contract.startDate, rangeStart),
							);
							const endIndex = Math.min(
								days.length - 1,
								dayIndexOf(contract.endDate, rangeStart),
							);
							if (endIndex < 0 || startIndex >= days.length) return [];

							const presentation = rentalStatusPresentation(contract.status);
							const renterName =
								`${contract.contact.firstName} ${contract.contact.lastName}`.trim();

							return (
								<button
									key={contract.id}
									type="button"
									title={`${presentation.label} · ${renterName || "Sans nom"}`}
									onClick={() =>
										openRecord({ kind: "rentalContract", id: contract.id })
									}
									className={cn(
										"m-1 flex items-center truncate rounded-sm border px-2 py-1 text-left text-xs hover:brightness-95",
										TONE_CLASS[presentation.tone],
									)}
									style={{
										gridColumn: `${startIndex + 2} / ${endIndex + 3}`,
										gridRow: row,
									}}
								>
									{scale === "week" && (
										<span className="truncate font-medium">
											{renterName || "Sans nom"}
										</span>
									)}
								</button>
							);
						});
					})}
				</div>
			</div>
		</div>
	);
}

function VehicleRow({
	vehicle,
	row,
	days,
	today,
	onOpen,
}: {
	vehicle: Vehicle;
	row: number;
	days: string[];
	today: string;
	onOpen: () => void;
}) {
	return (
		<>
			<button
				type="button"
				onClick={onOpen}
				className="sticky left-0 z-10 flex min-w-0 flex-col items-start justify-center border-b bg-card px-3 py-2 text-left hover:bg-muted"
				style={{ gridColumn: 1, gridRow: row }}
			>
				<span className="truncate font-medium text-sm">
					{vehicle.make} {vehicle.model}
				</span>
				<span className="truncate text-muted-foreground text-xs">
					{vehicle.plateNumber}
				</span>
			</button>
			{days.map((day, index) => (
				<div
					key={day}
					className={cn(
						"h-12 border-b border-l",
						day === today && "bg-muted/40",
					)}
					style={{ gridColumn: index + 2, gridRow: row }}
				/>
			))}
		</>
	);
}
