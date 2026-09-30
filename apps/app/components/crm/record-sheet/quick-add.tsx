"use client";

import { Button } from "@crm/ui/components/button";
import { Spinner } from "@crm/ui/components/spinner";
import { cn } from "@crm/ui/lib/utils";

export function QuickAddForm({
	submitLabel,
	pending,
	ready,
	onSubmit,
	onCancel,
	density = "default",
	columns = 2,
	children,
}: {
	submitLabel: string;
	pending: boolean;
	ready: boolean;
	onSubmit: () => void;
	onCancel: () => void;
	density?: "default" | "compact";
	columns?: 2 | 3;
	children: React.ReactNode;
}) {
	return (
		<form
			className={cn(
				"flex shrink-0 flex-col border-b px-5",
				density === "compact" ? "gap-3 py-3" : "gap-4 py-4",
			)}
			action={onSubmit}
		>
			<div
				className={cn(
					"grid",
					columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
					density === "compact" ? "gap-3" : "gap-4",
				)}
			>
				{children}
			</div>
			<div className="flex items-center justify-end gap-2">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					disabled={pending}
					onClick={onCancel}
				>
					Cancel
				</Button>
				<Button type="submit" size="sm" disabled={pending || !ready}>
					{pending ? <Spinner /> : null}
					{submitLabel}
				</Button>
			</div>
		</form>
	);
}
