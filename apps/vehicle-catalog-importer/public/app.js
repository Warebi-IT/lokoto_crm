const state = {
	models: [],
	makes: [],
	years: [],
	decisions: new Map(),
	uploaded: new Set(),
	reset: new Set(),
};
const view = document.querySelector("#view");
const search = document.querySelector("#search");
const makeInput = document.querySelector("#make");
const makesList = document.querySelector("#makes");
const models = new Map();
const brands = document.querySelector("#brands");
const message = document.querySelector("#message");

function visible() {
	const query = search.value.trim().toLowerCase();
	return state.models.filter(
		(item) => !query || item.model.toLowerCase().includes(query),
	);
}

function isDownloaded(item) {
	return (
		item.downloadedYears?.length === item.years.length &&
		!state.reset.has(`${item.make}|${item.model}`)
	);
}

function render() {
	const rows = visible();
	const grouped = Object.groupBy(rows, (item) => item.make);
	brands.innerHTML = Object.entries(grouped)
		.map(
			([make, models]) =>
				`<section class="brand"><div class="brand-heading"><div><span class="brand-kicker">Marque</span><h2>${make}</h2></div><div class="brand-actions"><span>${models.length} modèles</span><button type="button" class="decision-button brand-approve" data-make="${make}">Valider la marque</button></div></div><div class="models">${models
					.map((item) => {
						const id = `${item.make}|${item.model}`;
						const decision = state.decisions.get(id);
						const downloaded = isDownloaded(item) || state.uploaded.has(id);
						return `<article class="model ${downloaded ? "downloaded" : decision === true ? "approved" : decision === false ? "rejected" : ""}"><div><h3>${item.model}</h3><p>${item.years.join(" · ")} · ${downloaded ? "Image déjà stockée" : "En attente"}</p></div><div class="decision">${downloaded ? `<button type="button" class="decision-button reset" data-id="${id}" data-value="reset">Réinitialiser</button>` : `<button type="button" class="decision-button yes" data-id="${id}" data-value="yes">Valider</button><button type="button" class="decision-button no" data-id="${id}" data-value="no">Refuser</button>`}</div></article>`;
					})
					.join("")}</div></section>`,
		)
		.join("");
	document.querySelector("#modelCount").textContent = rows.length;
	document.querySelector("#approvedCount").textContent = rows.filter(
		(item) => state.decisions.get(`${item.make}|${item.model}`) === true,
	).length;
}

async function loadMakes() {
	const response = await fetch("/api/makes");
	const data = await response.json();
	if (!response.ok)
		throw new Error(data.error ?? "Impossible de charger les marques.");
	state.makes = data.makes;
	makesList.innerHTML = data.makes
		.map((make) => `<option value="${make}"></option>`)
		.join("");
}

async function loadYears() {
	const response = await fetch("/api/years");
	const data = await response.json();
	state.years = data.years;
	document.querySelector("#years").textContent = data.years.join(" · ");
	await loadMakes();
}

async function loadModels() {
	const make = state.makes.find(
		(entry) => entry.toLowerCase() === makeInput.value.trim().toLowerCase(),
	);
	if (!make) {
		state.models = [];
		message.textContent = "Choisissez une marque de la liste.";
		render();
		return;
	}
	if (!models.has(make)) {
		message.textContent = `Chargement des modèles ${make}...`;
		const response = await fetch(
			`/api/models?make=${encodeURIComponent(make)}&view=${encodeURIComponent(view.value)}`,
		);
		const data = await response.json();
		if (!response.ok || !Array.isArray(data))
			throw new Error(
				data.error ?? "Impossible de charger les modèles depuis Car Image.",
			);
		models.set(make, data);
	}
	state.models = models.get(make);
	state.decisions.clear();
	message.textContent = `${state.models.length} modèles ${make} sur ${state.years.length} années.`;
	render();
}

brands.addEventListener("click", (event) => {
	const button = event.target.closest("button[data-id]");
	const brandButton = event.target.closest("button[data-make]");
	if (brandButton) {
		for (const item of state.models.filter(
			(model) => model.make === brandButton.dataset.make,
		)) {
			if (!isDownloaded(item))
				state.decisions.set(`${item.make}|${item.model}`, true);
		}
		render();
		return;
	}
	if (!button) return;
	if (button.dataset.value === "reset") {
		state.reset.add(button.dataset.id);
		state.decisions.delete(button.dataset.id);
	} else state.decisions.set(button.dataset.id, button.dataset.value === "yes");
	render();
});
search.addEventListener("input", render);
view.addEventListener("change", () => {
	models.clear();
	loadModels().catch((error) => {
		message.textContent = error.message;
	});
});
makeInput.addEventListener("change", () => {
	loadModels().catch((error) => {
		message.textContent = error.message;
	});
});
document.querySelector("#selectAll").addEventListener("click", () => {
	for (const item of visible())
		if (!isDownloaded(item))
			state.decisions.set(`${item.make}|${item.model}`, true);
	render();
});
document.querySelector("#clearAll").addEventListener("click", () => {
	for (const item of visible())
		state.decisions.set(`${item.make}|${item.model}`, false);
	render();
});
document.querySelector("#upload").addEventListener("click", async () => {
	const selected = state.models.filter(
		(item) => state.decisions.get(`${item.make}|${item.model}`) === true,
	);
	if (!selected.length) {
		message.textContent =
			"Validez au moins un modèle avant de lancer l’import.";
		return;
	}
	const button = document.querySelector("#upload");
	button.disabled = true;
	let done = 0;
	let photos = 0;
	const progress = document.querySelector("#progress");
	const totalPhotos = selected.reduce(
		(total, item) => total + item.years.length,
		0,
	);
	progress.max = totalPhotos;
	progress.value = 0;
	document.querySelector("#progressCount").textContent =
		`0 photo / ${totalPhotos}`;
	for (const item of selected) {
		const id = `${item.make}|${item.model}`;
		if (state.uploaded.has(id)) continue;
		message.textContent = `Upload ${done + 1}/${selected.length} : ${item.make} ${item.model}`;
		const response = await fetch("/api/upload", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...item, view: view.value }),
		});
		if (response.ok) {
			state.uploaded.add(id);
			state.reset.delete(id);
			done += 1;
			photos += (await response.clone().json()).uploaded ?? item.years.length;
			progress.value = photos;
			document.querySelector("#progressCount").textContent =
				`${photos} photo(s) / ${totalPhotos}`;
		}
	}
	button.disabled = false;
	message.textContent = `${done} image(s) stockée(s) sur OVH S3.`;
	render();
});
loadYears()
	.then(() => {
		document.querySelector("#connection").classList.add("online");
		document.querySelector("#statusText").textContent = "Car Image connecté";
		message.textContent = "Choisissez une marque de la liste.";
	})
	.catch((error) => {
		document.querySelector("#statusText").textContent = error.message;
		message.textContent = "Impossible de charger les marques.";
	});
