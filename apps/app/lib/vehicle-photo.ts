export const VEHICLE_PHOTO_POLL_MS = 3_000;

const VEHICLE_PHOTO_WAIT_MS = 10 * 60 * 1000;

export function isAwaitingPhoto(
	photoUrls: string[],
	createdAt: Date | string,
): boolean {
	if (photoUrls.length > 0) return false;
	return Date.now() - new Date(createdAt).getTime() < VEHICLE_PHOTO_WAIT_MS;
}
