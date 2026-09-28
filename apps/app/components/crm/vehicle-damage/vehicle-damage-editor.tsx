"use client";

import { Button } from "@crm/ui/components/button";
import { Field, FieldLabel } from "@crm/ui/components/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Textarea } from "@crm/ui/components/textarea";
import { cn } from "@crm/ui/lib/utils";
import { useState } from "react";

export const DAMAGE_VIEWS = [
	{ value: "THREE_QUARTER", label: "3/4 extérieur" },
	{ value: "FRONT", label: "Avant" },
	{ value: "REAR", label: "Arrière" },
	{ value: "LEFT_SIDE", label: "Côté gauche" },
	{ value: "RIGHT_SIDE", label: "Côté droit" },
	{ value: "ROOF", label: "Toit" },
] as const;

export const DAMAGE_TYPES = [
	{ value: "SCRATCH", label: "Rayure" },
	{ value: "DENT", label: "Bosse" },
	{ value: "CRACK", label: "Fissure" },
	{ value: "BROKEN", label: "Cassé" },
	{ value: "MISSING", label: "Manquant" },
	{ value: "STAIN", label: "Tache" },
	{ value: "OTHER", label: "Autre" },
] as const;

export const DAMAGE_SEVERITIES = [
	{ value: "MINOR", label: "Légère" },
	{ value: "MODERATE", label: "Moyenne" },
	{ value: "SEVERE", label: "Importante" },
] as const;

export type DamageView = (typeof DAMAGE_VIEWS)[number]["value"];
export type DamageType = (typeof DAMAGE_TYPES)[number]["value"];
export type DamageSeverity = (typeof DAMAGE_SEVERITIES)[number]["value"];
export type DamagePoint = { x: number; y: number };
export type DamageAnnotationDraft = {
	id?: string;
	view: DamageView;
	type: DamageType;
	severity: DamageSeverity;
	x: number;
	y: number;
	points: DamagePoint[];
	description: string;
};

type EditorMode = "point" | "scratch";

export function VehicleDamageEditor({
	value,
	onChange,
}: {
	value: DamageAnnotationDraft[];
	onChange: (value: DamageAnnotationDraft[]) => void;
}) {
	const [view, setView] = useState<DamageView>("THREE_QUARTER");
	const [mode, setMode] = useState<EditorMode>("point");
	const [selectedId, setSelectedId] = useState<string | null>(
		value[0]?.id ?? null,
	);
	const [drawing, setDrawing] = useState<DamagePoint[]>([]);

	const visible = value.filter((damage) => damage.view === view);
	const selected = value.find((damage) => damage.id === selectedId) ?? null;

	const positionFromEvent = (event: React.PointerEvent<SVGSVGElement>) => {
		const rect = event.currentTarget.getBoundingClientRect();
		return {
			x: Math.max(
				0,
				Math.min(100, ((event.clientX - rect.left) / rect.width) * 100),
			),
			y: Math.max(
				0,
				Math.min(100, ((event.clientY - rect.top) / rect.height) * 100),
			),
		};
	};

	const addPoint = (point: DamagePoint, points = [point]) => {
		const id = crypto.randomUUID();
		const next: DamageAnnotationDraft = {
			id,
			view,
			type: mode === "scratch" ? "SCRATCH" : "DENT",
			severity: "MINOR",
			x: point.x,
			y: point.y,
			points,
			description: "",
		};
		onChange([...value, next]);
		setSelectedId(id);
	};

	const updateSelected = (data: Partial<DamageAnnotationDraft>) => {
		if (!selectedId) return;
		onChange(
			value.map((damage) =>
				damage.id === selectedId ? { ...damage, ...data } : damage,
			),
		);
	};

	const removeSelected = () => {
		if (!selectedId) return;
		onChange(value.filter((damage) => damage.id !== selectedId));
		setSelectedId(null);
	};

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap gap-1 border-b pb-2">
				{DAMAGE_VIEWS.map((item) => (
					<Button
						key={item.value}
						variant={view === item.value ? "secondary" : "ghost"}
						size="sm"
						onClick={() => setView(item.value)}
					>
						{item.label}
					</Button>
				))}
			</div>

			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex gap-1">
					<Button
						variant={mode === "point" ? "secondary" : "outline"}
						size="sm"
						onClick={() => setMode("point")}
					>
						Placer un dommage
					</Button>
					<Button
						variant={mode === "scratch" ? "secondary" : "outline"}
						size="sm"
						onClick={() => setMode("scratch")}
					>
						Dessiner une rayure
					</Button>
				</div>
				<span className="text-muted-foreground text-xs">
					{mode === "point"
						? "Cliquez sur la pièce concernée."
						: "Tracez la rayure avec le doigt ou la souris."}
				</span>
			</div>

			<div className="grid gap-4 lg:grid-cols-[280px_260px] lg:items-start">
				<div className="relative aspect-square w-full max-w-72 overflow-hidden rounded-xl border bg-muted/20 p-2 lg:max-w-none">
					<svg
						viewBox="0 0 100 100"
						role="img"
						aria-label={`Schéma annotable, vue ${DAMAGE_VIEWS.find((item) => item.value === view)?.label}`}
						className={cn(
							"h-full w-full touch-none select-none",
							mode === "scratch" && "cursor-crosshair",
						)}
						onPointerDown={(event) => {
							const point = positionFromEvent(event);
							if (mode === "scratch") {
								event.currentTarget.setPointerCapture(event.pointerId);
								setDrawing([point]);
								return;
							}
							addPoint(point);
						}}
						onPointerMove={(event) => {
							if (mode === "scratch" && drawing.length > 0) {
								setDrawing([...drawing, positionFromEvent(event)]);
							}
						}}
						onPointerUp={(event) => {
							if (mode !== "scratch" || drawing.length === 0) return;
							const points = [...drawing, positionFromEvent(event)];
							addPoint(points[0] ?? { x: 50, y: 50 }, points);
							setDrawing([]);
						}}
					>
						<DiagramArtwork view={view} />
						{visible.map((damage, index) => (
							<g
								key={damage.id}
								onPointerDown={(event) => {
									event.stopPropagation();
									setSelectedId(damage.id ?? null);
								}}
								className="cursor-pointer"
							>
								{damage.points.length > 1 ? (
									<polyline
										points={damage.points
											.map((point) => `${point.x},${point.y}`)
											.join(" ")}
										fill="none"
										stroke="var(--destructive)"
										strokeWidth="1.5"
										strokeLinecap="round"
									/>
								) : null}
								<circle
									cx={damage.x}
									cy={damage.y}
									r={selectedId === damage.id ? 3.5 : 2.8}
									fill="var(--destructive)"
									stroke="white"
									strokeWidth="1"
								/>
								<text
									x={damage.x + 4}
									y={damage.y + 1.5}
									fill="var(--destructive)"
									fontSize="4"
									fontWeight="600"
								>
									{index + 1}
								</text>
							</g>
						))}
						{drawing.length > 1 ? (
							<polyline
								points={drawing
									.map((point) => `${point.x},${point.y}`)
									.join(" ")}
								fill="none"
								stroke="var(--destructive)"
								strokeWidth="1.5"
								strokeDasharray="2 1"
							/>
						) : null}
					</svg>
				</div>

				<div className="space-y-3">
					<div>
						<p className="font-medium text-sm">Dommages sur cette vue</p>
						<p className="text-muted-foreground text-xs">
							{visible.length} annotation{visible.length > 1 ? "s" : ""}
						</p>
					</div>
					<div className="space-y-1">
						{visible.map((damage, index) => (
							<button
								key={damage.id}
								type="button"
								aria-pressed={selectedId === damage.id}
								onClick={() => setSelectedId(damage.id ?? null)}
								className="flex min-h-10 w-full items-center gap-2 rounded-md border px-2 text-left text-sm hover:bg-accent aria-pressed:border-primary aria-pressed:bg-primary/10"
							>
								<span className="text-muted-foreground">{index + 1}.</span>
								{DAMAGE_TYPES.find((item) => item.value === damage.type)?.label}
							</button>
						))}
					</div>
					{selected ? (
						<DamageDetails
							damage={selected}
							onChange={updateSelected}
							onDelete={removeSelected}
						/>
					) : (
						<p className="text-muted-foreground text-xs">
							Cliquez sur le schéma pour ajouter un dommage.
						</p>
					)}
				</div>
			</div>
		</div>
	);
}

function DamageDetails({
	damage,
	onChange,
	onDelete,
}: {
	damage: DamageAnnotationDraft;
	onChange: (data: Partial<DamageAnnotationDraft>) => void;
	onDelete: () => void;
}) {
	return (
		<div className="space-y-3 border-t pt-3">
			<Field>
				<FieldLabel htmlFor="damage-type">Type</FieldLabel>
				<Select
					value={damage.type}
					onValueChange={(value) => onChange({ type: value as DamageType })}
				>
					<SelectTrigger id="damage-type" className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{DAMAGE_TYPES.map((item) => (
							<SelectItem key={item.value} value={item.value}>
								{item.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</Field>
			<Field>
				<FieldLabel htmlFor="damage-severity">Gravité</FieldLabel>
				<Select
					value={damage.severity}
					onValueChange={(value) =>
						onChange({ severity: value as DamageSeverity })
					}
				>
					<SelectTrigger id="damage-severity" className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{DAMAGE_SEVERITIES.map((item) => (
							<SelectItem key={item.value} value={item.value}>
								{item.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</Field>
			<Field>
				<FieldLabel htmlFor="damage-description">Détail</FieldLabel>
				<Textarea
					id="damage-description"
					value={damage.description}
					onChange={(event) => onChange({ description: event.target.value })}
					rows={3}
					placeholder="Rayure profonde sur la portière..."
				/>
			</Field>
			<Button type="button" variant="destructive" size="sm" onClick={onDelete}>
				Supprimer ce dommage
			</Button>
		</div>
	);
}

const BODY_STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.5 };
const GLASS_FILL = { fill: "currentColor", opacity: 0.12 };
const BODY_FILL = { fill: "currentColor", opacity: 0.06 };
const LABEL = { fill: "currentColor", fontSize: 4, fontWeight: 600 } as const;

function FrontOrRearArtwork({ view }: { view: "FRONT" | "REAR" }) {
	const isFront = view === "FRONT";
	const body =
		"M28,32 C28,22 72,22 72,32 L78,48 C85,50 88,55 88,62 L88,74 C88,79 84,82 78,82 L22,82 C16,82 12,79 12,74 L12,62 C12,55 15,50 22,48 Z";

	return (
		<>
			<path d={body} {...BODY_FILL} />
			<path d={body} {...BODY_STROKE} />
			{isFront ? (
				<>
					<path d="M32,33 L68,33 L73,46 L27,46 Z" {...GLASS_FILL} />
					<path d="M32,33 L68,33 L73,46 L27,46 Z" {...BODY_STROKE} />
					<rect x="18" y="50" width="16" height="8" rx="4" {...BODY_STROKE} />
					<rect x="66" y="50" width="16" height="8" rx="4" {...BODY_STROKE} />
					<rect x="41" y="53" width="18" height="13" rx="2" {...BODY_STROKE} />
					<path d="M41,57 L59,57 M41,61 L59,61" {...BODY_STROKE} />
					<rect x="6" y="46" width="7" height="4" rx="2" {...BODY_STROKE} />
					<rect x="87" y="46" width="7" height="4" rx="2" {...BODY_STROKE} />
				</>
			) : (
				<>
					<path d="M30,33 L70,33 L74,45 L26,45 Z" {...GLASS_FILL} />
					<path d="M30,33 L70,33 L74,45 L26,45 Z" {...BODY_STROKE} />
					<rect x="17" y="50" width="15" height="16" rx="3" {...BODY_STROKE} />
					<rect x="68" y="50" width="15" height="16" rx="3" {...BODY_STROKE} />
					<rect x="40" y="58" width="20" height="9" rx="1.5" {...BODY_STROKE} />
					<rect x="42" y="80" width="6" height="3" rx="1.5" {...BODY_STROKE} />
					<rect x="52" y="80" width="6" height="3" rx="1.5" {...BODY_STROKE} />
				</>
			)}
			<path
				d={`M14,${isFront ? 68 : 70} L86,${isFront ? 68 : 70}`}
				{...BODY_STROKE}
			/>
			<ellipse cx="18" cy="82" rx="7" ry="3" {...BODY_STROKE} />
			<ellipse cx="82" cy="82" rx="7" ry="3" {...BODY_STROKE} />
			<text x="50" y="95" textAnchor="middle" {...LABEL}>
				{isFront ? "AVANT" : "ARRIÈRE"}
			</text>
		</>
	);
}

function SideArtwork({
	mirrored,
	label,
}: {
	mirrored: boolean;
	label: string;
}) {
	return (
		<g transform={mirrored ? "translate(100,0) scale(-1,1)" : undefined}>
			<path
				d="M12,60 C12,52 16,49 24,47 L34,40 C38,32 44,26 55,25 C64,24 72,27 78,34 L80,42 C86,43 90,47 90,54 L90,64 L85,64 C85,69 81,73 76,73 C71,73 67,69 67,64 L38,64 C38,69 34,73 29,73 C24,73 20,69 20,64 L12,64 Z"
				{...BODY_FILL}
			/>
			<path
				d="M12,60 C12,52 16,49 24,47 L34,40 C38,32 44,26 55,25 C64,24 72,27 78,34 L80,42 C86,43 90,47 90,54 L90,64 L85,64 C85,69 81,73 76,73 C71,73 67,69 67,64 L38,64 C38,69 34,73 29,73 C24,73 20,69 20,64 L12,64 Z"
				{...BODY_STROKE}
			/>
			<path
				d="M36,40 L52,29 C57,27 63,27 67,29 L76,36 L74,42 L36,42 Z"
				{...GLASS_FILL}
			/>
			<path
				d="M36,40 L52,29 C57,27 63,27 67,29 L76,36 L74,42 L36,42 Z"
				{...BODY_STROKE}
			/>
			<path d="M40,42 L40,63 M62,42 L62,63" {...BODY_STROKE} />
			<rect x="30" y="36" width="5" height="3" rx="1" {...BODY_STROKE} />
			<circle cx="29" cy="64" r="9" {...BODY_STROKE} />
			<circle cx="29" cy="64" r="3.5" {...BODY_STROKE} />
			<circle cx="76" cy="64" r="9" {...BODY_STROKE} />
			<circle cx="76" cy="64" r="3.5" {...BODY_STROKE} />
			<rect x="48" y="55" width="8" height="2.4" rx="1" {...BODY_STROKE} />
			<text
				x="50"
				y="93"
				textAnchor="middle"
				transform={mirrored ? "translate(100,0) scale(-1,1)" : undefined}
				{...LABEL}
			>
				{label}
			</text>
		</g>
	);
}

function RoofArtwork() {
	const body =
		"M34,4 L66,4 C75,4 83,11 83,22 L83,86 C83,91 78,95 71,95 L29,95 C22,95 17,91 17,86 L17,22 C17,11 25,4 34,4 Z";
	return (
		<>
			<path d={body} {...BODY_FILL} />
			<path d={body} {...BODY_STROKE} />
			<path d="M33,16 L67,16 L73,27 L27,27 Z" {...GLASS_FILL} />
			<path d="M33,16 L67,16 L73,27 L27,27 Z" {...BODY_STROKE} />
			<rect x="28" y="29" width="44" height="38" rx="9" {...GLASS_FILL} />
			<rect x="28" y="29" width="44" height="38" rx="9" {...BODY_STROKE} />
			<path d="M27,69 L73,69 L67,80 L33,80 Z" {...GLASS_FILL} />
			<path d="M27,69 L73,69 L67,80 L33,80 Z" {...BODY_STROKE} />
			<rect x="19" y="12" width="10" height="20" rx="3" {...BODY_STROKE} />
			<rect x="71" y="12" width="10" height="20" rx="3" {...BODY_STROKE} />
			<rect x="19" y="68" width="10" height="20" rx="3" {...BODY_STROKE} />
			<rect x="71" y="68" width="10" height="20" rx="3" {...BODY_STROKE} />
			<rect x="8" y="15" width="9" height="4" rx="2" {...BODY_STROKE} />
			<rect x="83" y="15" width="9" height="4" rx="2" {...BODY_STROKE} />
			<text x="50" y="99" textAnchor="middle" {...LABEL}>
				VUE DE DESSUS
			</text>
		</>
	);
}

function ThreeQuarterArtwork() {
	const body =
		"M10,66 C10,58 14,55 22,53 L30,44 C34,35 42,28 54,27 C63,26 70,29 75,35 L80,44 C88,45 93,50 93,58 L93,70 L87,70 C87,76 82,80 76,80 C71,80 65,76 65,70 L34,70 C34,76 29,80 23,80 C17,80 12,76 12,70 L10,70 Z";
	return (
		<>
			<path d={body} {...BODY_FILL} />
			<path d={body} {...BODY_STROKE} />
			<path
				d="M32,44 L50,32 C56,29 63,29 68,32 L78,40 L75,47 L30,47 Z"
				{...GLASS_FILL}
			/>
			<path
				d="M32,44 L50,32 C56,29 63,29 68,32 L78,40 L75,47 L30,47 Z"
				{...BODY_STROKE}
			/>
			<path d="M38,47 L38,69 M62,47 L62,69" {...BODY_STROKE} />
			<rect x="27" y="39" width="6" height="4" rx="1.5" {...BODY_STROKE} />
			<ellipse cx="14" cy="59" rx="3.4" ry="2.4" {...GLASS_FILL} />
			<ellipse cx="14" cy="59" rx="3.4" ry="2.4" {...BODY_STROKE} />
			<rect x="46" y="60" width="9" height="2.6" rx="1" {...BODY_STROKE} />
			<circle cx="23" cy="70" r="10" {...BODY_STROKE} />
			<circle cx="23" cy="70" r="4" {...BODY_STROKE} />
			<circle cx="76" cy="70" r="10" {...BODY_STROKE} />
			<circle cx="76" cy="70" r="4" {...BODY_STROKE} />
			<text x="50" y="93" textAnchor="middle" {...LABEL}>
				VUE 3/4
			</text>
		</>
	);
}

function DiagramArtwork({ view }: { view: DamageView }) {
	if (view === "FRONT" || view === "REAR")
		return <FrontOrRearArtwork view={view} />;
	if (view === "ROOF") return <RoofArtwork />;
	if (view === "LEFT_SIDE")
		return <SideArtwork mirrored={false} label="CÔTÉ GAUCHE" />;
	if (view === "RIGHT_SIDE") return <SideArtwork mirrored label="CÔTÉ DROIT" />;
	return <ThreeQuarterArtwork />;
}
