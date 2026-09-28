import type { RecordKind } from "@/components/crm/record-sheet/record-stack";

export type FieldEntity = "CONTACT" | "VEHICLE" | "RENTAL_CONTRACT";

const TO_ENTITY: Record<RecordKind, FieldEntity> = {
	contact: "CONTACT",
	vehicle: "VEHICLE",
	rentalContract: "RENTAL_CONTRACT",
};

const TO_KIND: Record<FieldEntity, RecordKind> = {
	CONTACT: "contact",
	VEHICLE: "vehicle",
	RENTAL_CONTRACT: "rentalContract",
};

export function entityOf(kind: RecordKind): FieldEntity {
	return TO_ENTITY[kind];
}

export function kindOf(entity: FieldEntity): RecordKind {
	return TO_KIND[entity];
}
