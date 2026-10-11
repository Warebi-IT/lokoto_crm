import { cn } from "@crm/ui/lib/utils";
import * as React from "react";

const Input = React.forwardRef<
	HTMLInputElement,
	React.ComponentProps<"input"> & {
		density?: "default" | "sm";
	}
>(({ className, type, density = "default", ...props }, ref) => {
	return (
		<input
			ref={ref}
			type={type}
			data-slot="input"
			className={cn(
				"w-full min-w-0 rounded-md border border-input bg-background py-1 text-xs transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-foreground placeholder:text-muted-foreground hover:border-ring/40 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/25 md:text-xs dark:bg-muted dark:shadow-[inset_0_1px_1px_rgb(0_0_0/0.30)] dark:disabled:bg-muted",
				density === "sm" ? "h-7 px-2" : "h-8 px-2.5",
				className,
			)}
			{...props}
		/>
	);
});
Input.displayName = "Input";

export { Input };
