"use client";

import { useState } from "react";
import { FieldsSheetHost } from "@/components/crm/fields/fields-sheet";
import { CancelReasonDialog } from "@/components/crm/status-change";
import { DetailSheet } from "@/components/detail-sheet";
import { ContactSheet } from "./contact-sheet";
import { type RecordRef, recordKey, useRecordStack } from "./record-stack";
import { RentalContractSheet } from "./rental-contract-sheet";
import { VehicleSheet } from "./vehicle-sheet";

export function RecordSheetHost() {
	const { stack, top, closeAll } = useRecordStack();

	const [shown, setShown] = useState<RecordRef | null>(top);
	if (top && (!shown || recordKey(shown) !== recordKey(top))) {
		setShown(top);
	}

	return (
		<>
			<DetailSheet
				open={stack.length > 0}
				onOpenChange={(next) => {
					if (!next) closeAll();
				}}
			>
				{shown?.kind === "contact" ? (
					<ContactSheet key={recordKey(shown)} contactId={shown.id} />
				) : null}

				{shown?.kind === "vehicle" ? (
					<VehicleSheet key={recordKey(shown)} vehicleId={shown.id} />
				) : null}

				{shown?.kind === "rentalContract" ? (
					<RentalContractSheet key={recordKey(shown)} contractId={shown.id} />
				) : null}
			</DetailSheet>

			<FieldsSheetHost />

			<CancelReasonDialog />
		</>
	);
}
