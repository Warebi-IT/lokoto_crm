const PHOTO_YEAR = /\/(\d{4})\/[^/]+$/;

export function closestYearPhoto(
	photoUrls: string[],
	targetYear: number | null,
): string | null {
	const year = targetYear ?? new Date().getFullYear();

	let best: string | null = null;
	let bestDistance = Number.POSITIVE_INFINITY;

	for (const url of photoUrls) {
		const match = url.match(PHOTO_YEAR);
		if (!match?.[1]) continue;
		const distance = Math.abs(Number(match[1]) - year);
		if (distance < bestDistance) {
			best = url;
			bestDistance = distance;
		}
	}

	return best;
}
