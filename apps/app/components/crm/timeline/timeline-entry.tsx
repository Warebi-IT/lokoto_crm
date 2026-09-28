"use client";

import { Checkbox } from "@crm/ui/components/checkbox";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { cn } from "@crm/ui/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { RecordLink } from "@/components/crm/record-sheet/record-link";
import { LocalDateTime, LocalRelativeTime } from "@/components/local-date-time";
import { activityLabel } from "@/lib/activity-presentation";
import { rentalStatusLabel } from "@/lib/rental-status";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { ActivityIcon } from "./activity-icon";
import { EmailThreadEntry } from "./email-thread-entry";
import { MeetingEntry } from "./meeting-entry";
import type { TimelineAnchor } from "./timeline";

export type TimelineEntryData =
	RouterOutputs["activities"]["timeline"]["entries"][number];

const TIME_OPTIONS: Intl.DateTimeFormatOptions = {
	hour: "numeric",
	minute: "2-digit",
};

function stageChange(meta: Record<string, unknown> | null) {
	const from = typeof meta?.from === "string" ? meta.from : null;
	const to = typeof meta?.to === "string" ? meta.to : null;
	return from && to ? { from, to } : null;
}

function anchorId(anchor: TimelineAnchor): string {
	if ("contactId" in anchor) return anchor.contactId;
	if ("vehicleId" in anchor) return anchor.vehicleId;
	return anchor.rentalContractId;
}

export function TimelineEntry({
	entry,
	anchor,
}: {
	entry: TimelineEntryData;
	anchor: TimelineAnchor;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const complete = useMutation(
		trpc.activities.complete.mutationOptions({
			onSuccess: () => cache.activity(),
			onError: (error) => toast.error(error.message),
		}),
	);

	const isTask = entry.type === "TASK";
	const done = entry.completedAt !== null;
	const overdue =
		isTask &&
		!done &&
		entry.dueAt !== null &&
		new Date(entry.dueAt) < new Date();

	const change = entry.type === "STAGE_CHANGE" ? stageChange(entry.meta) : null;
	const when = entry.occurredAt ?? entry.createdAt;

	const synced = entry.meta?.synced === true;
	const author = synced
		? entry.emailThread
			? "via Gmail"
			: "via Calendar"
		: entry.createdBy.name;

	const headline = change
		? `${rentalStatusLabel(change.from as never)} → ${rentalStatusLabel(change.to as never)}`
		: entry.subject;

	const here = anchorId(anchor);
	const vehicle =
		entry.vehicle && entry.vehicle.id !== here ? entry.vehicle : null;
	const rentalContract =
		entry.rentalContract && entry.rentalContract.id !== here
			? entry.rentalContract
			: null;
	const contact =
		entry.contact && entry.contact.id !== here ? entry.contact : null;

	const footnotes = Boolean(
		vehicle || rentalContract || contact || (isTask && !done && entry.dueAt),
	);

	return (
		<li className="flex gap-2.5 py-2">
			<span className="mt-0.5 shrink-0 text-muted-foreground">
				{isTask ? (
					<Checkbox
						checked={done}
						disabled={complete.isPending}
						aria-label={done ? "Mark as not done" : "Mark as done"}
						onCheckedChange={(checked) =>
							complete.mutate({ id: entry.id, completed: checked === true })
						}
					/>
				) : (
					<span role="img" aria-label={activityLabel(entry.type)}>
						<ActivityIcon type={entry.type} />
					</span>
				)}
			</span>

			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<div className="flex min-w-0 items-baseline gap-3">
					<div className="min-w-0 flex-1 space-y-0.5">
						{headline ? (
							<p
								className={cn(
									"wrap-anywhere font-medium",
									done && "text-muted-foreground line-through",
								)}
							>
								{headline}
							</p>
						) : null}

						{entry.body ? (
							<p
								className={cn(
									"whitespace-pre-wrap text-pretty wrap-anywhere",
									headline && "text-muted-foreground",
								)}
							>
								{entry.body}
							</p>
						) : null}

						{!headline && !entry.body ? (
							<p className="text-muted-foreground">
								{activityLabel(entry.type)}
							</p>
						) : null}
					</div>

					<span className="shrink-0 text-muted-foreground">
						<span className="hidden sm:inline">{author} · </span>
						<span className="tabular-nums">
							<LocalDateTime date={when} options={TIME_OPTIONS} />
						</span>
					</span>
				</div>

				{entry.calendarEvent ? (
					<MeetingEntry
						eventId={entry.calendarEvent.id}
						startsAt={entry.calendarEvent.startsAt}
						endsAt={entry.calendarEvent.endsAt}
						isAllDay={entry.calendarEvent.isAllDay}
						attendeeCount={entry.calendarEvent.attendeeCount}
						conferenceUrl={entry.calendarEvent.conferenceUrl}
					/>
				) : null}

				{entry.emailThread ? (
					<EmailThreadEntry
						threadId={entry.emailThread.id}
						messageCount={entry.emailThread.messageCount}
					/>
				) : null}

				{footnotes ? (
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
						{isTask && !done && entry.dueAt ? (
							<StatusIndicator
								tone={overdue ? "error" : "info"}
								label={
									<>
										{overdue ? "Overdue" : "Due"}{" "}
										<LocalRelativeTime date={entry.dueAt} />
									</>
								}
							/>
						) : null}

						{vehicle ? (
							<RecordLink kind="vehicle" id={vehicle.id}>
								{vehicle.make} {vehicle.model}
							</RecordLink>
						) : null}

						{rentalContract ? (
							<RecordLink kind="rentalContract" id={rentalContract.id}>
								{rentalContract.vehicle.plateNumber}
							</RecordLink>
						) : null}

						{contact ? (
							<RecordLink kind="contact" id={contact.id}>
								{[contact.firstName, contact.lastName]
									.filter(Boolean)
									.join(" ")}
							</RecordLink>
						) : null}
					</div>
				) : null}
			</div>
		</li>
	);
}
