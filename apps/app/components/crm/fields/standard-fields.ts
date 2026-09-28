import type { FieldEntity } from "./fields-entity";

export const STANDARD_FIELDS: Record<FieldEntity, readonly string[]> = {
	CONTACT: ["First name", "Last name", "Email", "Phone", "Owner"],
	VEHICLE: [
		"Type",
		"Make",
		"Model",
		"Year",
		"Plate number",
		"Status",
		"Daily rate",
		"Mileage",
		"Owner",
	],
	RENTAL_CONTRACT: [
		"Vehicle",
		"Renter",
		"Status",
		"Start date",
		"End date",
		"Price per day",
		"Deposit",
		"Owner",
	],
};
