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
	DAY_PX,
	type DayEvent,
	dateInput,
	dayIndexOf,
	HOUR_PX,
	layoutDayEvents,
	minutesLabel,
	timeToMinutes,
	WEEK_DAYS,
} from "./date-utils";

type Planning = RouterOutputs["rentalContracts"]["planning"];
type Contract = Planning["contracts"][number];
type Vehicle = Planning["vehicles"][number];

type BookingKind = "pickup" | "return";

interface Booking extends DayEvent {
	kind: BookingKind;
	contract: Contract;
	vehicle: Vehicle | null;
}

const SLOT_MINUTES = 15;

const KIND_LABEL: Record<BookingKind, string> = {
	pickup: "Départ",
	return: "Retour",
};

const TONE_CLASS: Record<string, string> = {
	neutral: "border-muted-foreground/40 bg-muted-foreground/15",
	info: "border-info bg-info/15",
	warning: "border-warning bg-warning/15",
	success: "border-success bg-success/15",
	error: "border-destructive bg-destructive/15",
};

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const WEEKDAY_LABEL = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
const DAY_NUMBER_LABEL = new Intl.DateTimeFormat("fr-FR", {
	day: "numeric",
	month: "short",
});
const WEEK_TITLE = new Intl.DateTimeFormat("fr-FR", {
	day: "numeric",
	month: "long",
});

function dayDate(value: string): Date {
	return new Date(`${value}T12:00:00`);
}

export function CalendarPlanningView({
	initialStart,
}: {
	initialStart: string;
}) {
	const trpc = useTRPC();
	const openRecord = useOpenRecord();
	const [weekStart, setWeekStart] = useState(initialStart);
	const today = useMemo(() => dateInput(new Date()), []);
	const weekEnd = useMemo(() => addDays(weekStart, WEEK_DAYS), [weekStart]);

	const planning = useQuery({
		...trpc.rentalContracts.planning.queryOptions({
			startDate: weekStart,
			endDate: weekEnd,
		}),
		placeholderData: (previous) => previous,
	});

	const days = useMemo(
		() =>
			Array.from({ length: WEEK_DAYS }, (_, index) =>
				addDays(weekStart, index),
			),
		[weekStart],
	);

	const contracts = planning.data?.contracts ?? [];
	const vehicleById = useMemo(() => {
		const map = new Map<string, Vehicle>();
		for (const vehicle of planning.data?.vehicles ?? []) {
			map.set(vehicle.id, vehicle);
		}
		return map;
	}, [planning.data?.vehicles]);

	const bookingsByDay = useMemo(() => {
		const map = new Map<string, Booking[]>();
		for (const day of days) map.set(day, []);

		for (const contract of contracts) {
			const vehicle = vehicleById.get(contract.vehicleId) ?? null;

			const pickupDay = dayIndexOf(contract.startDate, weekStart);
			if (pickupDay >= 0 && pickupDay < WEEK_DAYS) {
				const day = addDays(weekStart, pickupDay);
				const start = timeToMinutes(contract.pickupTime);
				map.get(day)?.push({
					id: `${contract.id}-pickup`,
					kind: "pickup",
					startMinutes: start,
					endMinutes: start + SLOT_MINUTES,
					contract,
					vehicle,
				});
			}

			const returnDay = dayIndexOf(contract.endDate, weekStart);
			if (returnDay >= 0 && returnDay < WEEK_DAYS) {
				const day = addDays(weekStart, returnDay);
				const start = timeToMinutes(contract.returnTime);
				map.get(day)?.push({
					id: `${contract.id}-return`,
					kind: "return",
					startMinutes: start,
					endMinutes: start + SLOT_MINUTES,
					contract,
					vehicle,
				});
			}
		}

		return map;
	}, [days, weekStart, contracts, vehicleById]);

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="icon-sm"
						aria-label="Semaine précédente"
						onClick={() => setWeekStart((prev) => addDays(prev, -WEEK_DAYS))}
					>
						<ChevronLeft />
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setWeekStart(today)}
					>
						Aujourd’hui
					</Button>
					<Button
						variant="outline"
						size="icon-sm"
						aria-label="Semaine suivante"
						onClick={() => setWeekStart((prev) => addDays(prev, WEEK_DAYS))}
					>
						<ChevronRight />
					</Button>
					<span className="ml-1 truncate font-medium text-sm">
						{WEEK_TITLE.format(dayDate(weekStart))} –{" "}
						{WEEK_TITLE.format(dayDate(addDays(weekStart, WEEK_DAYS - 1)))}
					</span>
				</div>
				{planning.isFetching && (
					<Spinner className="size-4 text-muted-foreground" />
				)}
			</div>

			<div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-card">
				<div className="flex">
					<div className="sticky left-0 z-20 w-14 shrink-0 border-r bg-card">
						<div className="sticky top-0 z-10 h-14 border-b bg-muted" />
						<div className="relative" style={{ height: DAY_PX }}>
							{HOURS.map((hour) => (
								<div
									key={hour}
									className="absolute right-1.5 translate-y-[-50%] text-[10px] text-muted-foreground"
									style={{ top: hour * HOUR_PX }}
								>
									{minutesLabel(hour * 60)}
								</div>
							))}
						</div>
					</div>

					{days.map((day) => {
						const isToday = day === today;
						const bookings = bookingsByDay.get(day) ?? [];
						const laidOut = layoutDayEvents(bookings);

						return (
							<div key={day} className="w-40 shrink-0 border-r last:border-r-0">
								<div
									className={cn(
										"sticky top-0 z-10 flex h-14 flex-col items-center justify-center border-b bg-muted text-xs",
										isToday
											? "font-semibold text-foreground"
											: "text-muted-foreground",
									)}
								>
									<div className="capitalize">
										{WEEKDAY_LABEL.format(dayDate(day))}
									</div>
									<div className="tabular-nums">
										{DAY_NUMBER_LABEL.format(dayDate(day))}
									</div>
								</div>

								<div className="relative" style={{ height: DAY_PX }}>
									{HOURS.map((hour) => (
										<div
											key={hour}
											className="absolute inset-x-0 border-t"
											style={{ top: hour * HOUR_PX }}
										/>
									))}

									{planning.isPending ? (
										<div className="absolute inset-0 flex items-center justify-center">
											<Spinner />
										</div>
									) : (
										laidOut.map(({ event, lane, columns }) => {
											const presentation = rentalStatusPresentation(
												event.contract.status,
											);
											const renterName =
												`${event.contract.contact.firstName} ${event.contract.contact.lastName}`.trim();
											const vehicleLabel = event.vehicle
												? `${event.vehicle.make} ${event.vehicle.model}`
												: "";

											return (
												<button
													key={event.id}
													type="button"
													title={`${KIND_LABEL[event.kind]} · ${renterName || "Sans nom"} · ${vehicleLabel} · ${minutesLabel(event.startMinutes)}`}
													onClick={() =>
														openRecord({
															kind: "rentalContract",
															id: event.contract.id,
														})
													}
													className={cn(
														"absolute overflow-hidden rounded-sm border px-1.5 py-1 text-left hover:brightness-95",
														TONE_CLASS[presentation.tone],
													)}
													style={{
														top: (event.startMinutes / 60) * HOUR_PX + 1,
														height: Math.max(
															20,
															((event.endMinutes - event.startMinutes) / 60) *
																HOUR_PX -
																2,
														),
														left: `calc(${(lane * 100) / columns}% + 2px)`,
														width: `calc(${100 / columns}% - 4px)`,
													}}
												>
													<div className="truncate font-medium text-[11px]">
														{KIND_LABEL[event.kind]} ·{" "}
														{renterName || "Sans nom"}
													</div>
													<div className="truncate text-[10px] text-muted-foreground">
														{vehicleLabel}
													</div>
												</button>
											);
										})
									)}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
