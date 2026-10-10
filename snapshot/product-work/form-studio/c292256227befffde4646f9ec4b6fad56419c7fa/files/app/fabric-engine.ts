import { validateStoredDrapeValidation } from "./fabric-validation.ts";
import { validateStoredSwatchEvidence } from "./fabric-swatch-evidence.ts";
import { parseSewnSampleComparison } from "./fabric-sample-validation.ts";
import { measuredStockPieces, STOCK_GARMENTS } from "./fabric-stock.ts";
import { validateGarmentGraphics, type GarmentGraphic } from "./fabric-graphics.ts";
import { patternEdgeLength, patternOutline, validatePatternAuthoring, type PatternCurve, type PatternNotch, type PointGradeRule } from "./fabric-pattern-geometry.ts";

export type FabricPoint = { x: number; y: number };
export type GarmentKind = "tshirt" | "hoodie" | "shorts" | "dress" | "skirt" | "trousers" | "custom";
export type PatternRole = "front" | "back" | "left" | "right" | "free";
export type SeamType = "plain" | "flat-felled" | "overlock" | "bound" | "zipper" | "elastic";
export type PatternDetailType = "dart" | "pleat";

export type BodyMeasurements = {
  height: number;
  bust: number;
  waist: number;
  hip: number;
  neck: number;
  shoulder: number;
  armLength: number;
  inseam: number;
};

export type AvatarSex = "female" | "male";
export type AvatarPose = "neutral" | "walk" | "reach";
export type AvatarProfile = {
  sex: AvatarSex;
  /** Continuous fitting-body build from 0 (slim) to 100 (full). */
  build: number;
  pose: AvatarPose;
};

export const DEFAULT_AVATAR_PROFILE: AvatarProfile = { sex: "female", build: 50, pose: "neutral" };

/**
 * Generates a coherent anthropometric fitting profile from the two controls
 * designers change most often. The measurements remain editable afterwards.
 */
export function bodyMeasurementsForProfile(profile: AvatarProfile, heightMm: number): BodyMeasurements {
  const height = Math.round(Math.max(1300, Math.min(2200, heightMm)));
  const female = profile.sex === "female";
  const referenceHeight = female ? 1700 : 1780;
  const scale = height / referenceHeight;
  const build = (Math.max(0, Math.min(100, profile.build)) - 50) / 50;
  const base = female
    ? { bust: 900, waist: 720, hip: 970, neck: 345, shoulder: 395, armLength: 585, inseam: 790 }
    : { bust: 1000, waist: 850, hip: 980, neck: 390, shoulder: 460, armLength: 620, inseam: 830 };
  const change = female
    ? { bust: 0.15, waist: 0.2, hip: 0.17, neck: 0.08, shoulder: 0.08 }
    : { bust: 0.16, waist: 0.2, hip: 0.13, neck: 0.1, shoulder: 0.09 };
  const measure = (value: number, buildChange = 0) => Math.round(value * scale * (1 + build * buildChange));
  return {
    height,
    bust: measure(base.bust, change.bust),
    waist: measure(base.waist, change.waist),
    hip: measure(base.hip, change.hip),
    neck: measure(base.neck, change.neck),
    shoulder: measure(base.shoulder, change.shoulder),
    armLength: measure(base.armLength),
    inseam: measure(base.inseam),
  };
}

export type AvatarPreset = { id: string; name: string; size: string; measurements: BodyMeasurements };
export type PatternDetail = {
  id: string;
  type: PatternDetailType;
  pieceId: string;
  position: FabricPoint;
  intake: number;
  length: number;
  direction: number;
  enabled: boolean;
};

export type FabricMaterial = {
  id: string;
  name: string;
  color: string;
  weight: number;
  thickness: number;
  stretchWarp: number;
  stretchWeft: number;
  stretchBias: number;
  bend: number;
  friction: number;
  shrinkage: number;
  calibration?: import("./fabric-calibration.ts").FabricCalibrationRecord;
};

export type PatternPiece = {
  id: string;
  name: string;
  role: PatternRole;
  points: FabricPoint[];
  edgeNames: string[];
  grainAngle: number;
  seamAllowance: number;
  cutQuantity: number;
  mirror: boolean;
  position: FabricPoint;
  rotation: number;
  curves?: PatternCurve[];
  notches?: PatternNotch[];
  gradeRules?: PointGradeRule[];
  /** Anatomical placement for authored stock blocks; absent on legacy/custom pieces. */
  stockPlacement?: { region: "torso" | "sleeve" | "leg" | "hood"; side?: -1 | 1 };
};

export type PatternEdgeRef = { pieceId: string; edgeIndex: number };
export type SeamBinding = {
  id: string;
  name: string;
  a: PatternEdgeRef;
  b: PatternEdgeRef;
  type: SeamType;
  easeRatio: number;
  enabled: boolean;
};

export type FitBodyEvidence = {
  kind: "procedural-reference" | "imported-surface";
  name: string;
  format?: "GLB" | "GLTF" | "OBJ" | "STL" | "FBX";
  triangles?: number;
  sdfCells?: number;
  importedAt?: string;
  /** True only while the imported mesh and collision field are resident. */
  surfaceReady: boolean;
  /** Explicit user attestation; Form Studio never assumes asset rights. */
  rightsConfirmed: boolean;
};

export type GarmentProject = {
  version: 1;
  id: string;
  name: string;
  kind: GarmentKind;
  size: string;
  fabric: FabricMaterial;
  avatar: BodyMeasurements;
  avatarProfile: AvatarProfile;
  fitBody: FitBodyEvidence;
  pieces: PatternPiece[];
  seams: SeamBinding[];
  details: PatternDetail[];
  graphics?: GarmentGraphic[];
  /** Scan-derived drafts remain inferred until measurement and sample review. */
  scanEvidence?: {
    version: 1;
    status: "inferred-draft";
    measuredLengthMm: number;
    views: { front: { sourceId: string; sha256: string }; back: { sourceId: string; sha256: string } };
    pieceSources: { pieceId: string; view: "front" | "back"; status: "inferred" }[];
    assumptions: string[];
  };
  drapeValidation?: import("./fabric-validation.ts").DrapeValidationRecord;
  sampleComparison?: import("./fabric-sample-validation.ts").SewnSampleComparison;
  createdAt: string;
  updatedAt: string;
};

export type FitZone = { id: "chest" | "waist" | "hip" | "thigh"; label: string; garment: number; body: number; ease: number; strain: number; status: "loose" | "good" | "tight" | "critical" };
export type GarmentFitAnalysis = {
  score: number;
  status: "excellent" | "review" | "blocked";
  zones: FitZone[];
  maxStrain: number;
  collisionCount: number;
  movementAllowance: number;
};

export type GarmentFinding = { severity: "pass" | "warning" | "error"; message: string };
export type GarmentAudit = {
  score: number;
  ready: boolean;
  areaCm2: number;
  seamLengthMm: number;
  estimatedMassGrams: number;
  findings: GarmentFinding[];
};

export const FABRIC_PRESETS: FabricMaterial[] = [
  { id: "cotton-poplin", name: "Cotton poplin", color: "#d6c9b7", weight: 120, thickness: 0.28, stretchWarp: 2, stretchWeft: 3, stretchBias: 8, bend: 0.64, friction: 0.55, shrinkage: 3 },
  { id: "silk-charmeuse", name: "Silk charmeuse", color: "#b8a3c9", weight: 70, thickness: 0.16, stretchWarp: 1, stretchWeft: 2, stretchBias: 7, bend: 0.18, friction: 0.24, shrinkage: 2 },
  { id: "denim-12oz", name: "12 oz denim", color: "#415b79", weight: 407, thickness: 0.82, stretchWarp: 1, stretchWeft: 2, stretchBias: 4, bend: 0.9, friction: 0.7, shrinkage: 4 },
  { id: "jersey", name: "Cotton jersey", color: "#759083", weight: 180, thickness: 0.48, stretchWarp: 18, stretchWeft: 42, stretchBias: 35, bend: 0.35, friction: 0.48, shrinkage: 5 },
  { id: "wool-suiting", name: "Wool suiting", color: "#6d6966", weight: 260, thickness: 0.62, stretchWarp: 2, stretchWeft: 4, stretchBias: 10, bend: 0.58, friction: 0.62, shrinkage: 3 },
  { id: "soft-leather", name: "Soft leather", color: "#76513e", weight: 620, thickness: 1.1, stretchWarp: 4, stretchWeft: 7, stretchBias: 8, bend: 0.84, friction: 0.76, shrinkage: 0 },
];

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "avatar-xs", name: "Petite", size: "XS", measurements: { height: 1580, bust: 800, waist: 620, hip: 860, neck: 330, shoulder: 370, armLength: 570, inseam: 730 } },
  { id: "avatar-s", name: "Small", size: "S", measurements: { height: 1640, bust: 860, waist: 680, hip: 920, neck: 350, shoulder: 390, armLength: 590, inseam: 760 } },
  { id: "avatar-m", name: "Medium", size: "M", measurements: { height: 1700, bust: 920, waist: 760, hip: 990, neck: 370, shoulder: 410, armLength: 610, inseam: 790 } },
  { id: "avatar-l", name: "Large", size: "L", measurements: { height: 1750, bust: 1010, waist: 860, hip: 1070, neck: 390, shoulder: 435, armLength: 625, inseam: 810 } },
  { id: "avatar-xl", name: "Extended", size: "XL", measurements: { height: 1780, bust: 1120, waist: 980, hip: 1180, neck: 420, shoulder: 465, armLength: 640, inseam: 825 } },
];

export type SeamPhysicsProfile = {
  gapMm: number;
  crossStiffness: number;
  lengthScale: number;
  longitudinalStiffness: number;
  description: string;
};

const SEAM_PHYSICS: Record<SeamType, SeamPhysicsProfile> = {
  // Sewn edge separation is fabric thickness, not the seam allowance on the
  // cutting pattern. An extra 8 mm pried compatible shoulder stitches apart.
  plain: { gapMm: 0, crossStiffness: 0.92, lengthScale: 1, longitudinalStiffness: 0, description: "balanced lockstitch" },
  "flat-felled": { gapMm: 5, crossStiffness: 0.985, lengthScale: 0.98, longitudinalStiffness: 0.72, description: "reinforced double fold" },
  overlock: { gapMm: 10, crossStiffness: 0.82, lengthScale: 1, longitudinalStiffness: 0.18, description: "flexible edge finish" },
  bound: { gapMm: 5, crossStiffness: 0.96, lengthScale: 0.97, longitudinalStiffness: 0.62, description: "stabilized bound edge" },
  zipper: { gapMm: 2.5, crossStiffness: 0.998, lengthScale: 1, longitudinalStiffness: 0.96, description: "locked zipper tape" },
  elastic: { gapMm: 5, crossStiffness: 0.9, lengthScale: 0.78, longitudinalStiffness: 0.84, description: "22% gathered elastic" },
};

export function seamPhysicsProfile(type: SeamType): SeamPhysicsProfile {
  return { ...SEAM_PHYSICS[type] };
}

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
const now = () => new Date().toISOString();

export function avatarForSize(size: string) {
  return structuredClone(AVATAR_PRESETS.find((preset) => preset.size === size)?.measurements ?? AVATAR_PRESETS[2].measurements);
}

export function polygonArea(points: FabricPoint[]) {
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
}

export function edgeLength(piece: PatternPiece, edgeIndex: number) {
  return patternEdgeLength(piece, edgeIndex);
}

export function piecePerimeter(piece: PatternPiece) {
  return piece.points.reduce((sum, _, index) => sum + edgeLength(piece, index), 0);
}

const isFinishedOpening = (name: string) => name === "hem" || name === "waist" || name === "opening" || name.startsWith("neck");

/** Detect old stock hoods whose face opening was incorrectly auto-sewn.
 * Loading must preserve authored seams; offer an explicit, undoable repair. */
export function closedHoodOpeningSeams(project: GarmentProject) {
  return project.seams.filter(seam => seam.enabled && seam.a.pieceId !== seam.b.pieceId && [seam.a, seam.b].every(ref => {
    const piece = project.pieces.find(p => p.id === ref.pieceId);
    return piece?.stockPlacement?.region === "hood" && piece.edgeNames[ref.edgeIndex] === "opening";
  }));
}

export function openHoodFace(project: GarmentProject): GarmentProject {
  const closed = new Set(closedHoodOpeningSeams(project).map(seam => seam.id));
  if (!closed.size) return project;
  return { ...project, seams: project.seams.map(seam => closed.has(seam.id) ? { ...seam, enabled: false } : seam), updatedAt: now() };
}

function bindMatchingEdges(pieces: PatternPiece[], type: SeamType = "plain") {
  const candidates = new Map<string, PatternEdgeRef[]>();
  pieces.forEach((patternPiece) => patternPiece.edgeNames.forEach((name, edgeIndex) => {
    // Shared labels are not always stitches: the left/right hood openings
    // are finished, free boundaries. Joining them closes cloth across the
    // face and puts sewing in direct conflict with head collision.
    if (!name || isFinishedOpening(name) || name.startsWith("sleeve") || name.startsWith("armhole")) return;
    const list = candidates.get(name) ?? [];
    list.push({ pieceId: patternPiece.id, edgeIndex });
    candidates.set(name, list);
  }));
  const seams: SeamBinding[] = [];
  candidates.forEach((refs, name) => {
    if (refs.length !== 2) return;
    const aPiece = pieces.find((item) => item.id === refs[0].pieceId)!;
    const bPiece = pieces.find((item) => item.id === refs[1].pieceId)!;
    const aLength = edgeLength(aPiece, refs[0].edgeIndex);
    const bLength = edgeLength(bPiece, refs[1].edgeIndex);
    seams.push({ id: uid("seam"), name: name.replaceAll("-", " "), a: refs[0], b: refs[1], type, easeRatio: bLength / Math.max(aLength, 0.001), enabled: true });
  });
  return seams;
}

export function createGarmentTemplate(kind: Exclude<GarmentKind, "custom">, size = "M", fitting?: Pick<GarmentProject, "avatar" | "avatarProfile" | "fitBody">): GarmentProject {
  const avatar = structuredClone(fitting?.avatar ?? avatarForSize(size));
  const pieces = measuredStockPieces(kind, avatar, () => uid("piece"));
  const material = kind === "tshirt" || kind === "hoodie" || kind === "dress" ? FABRIC_PRESETS[3] : FABRIC_PRESETS[0];
  const timestamp = now();
  return {
    version: 1, id: uid("garment"), name: `${STOCK_GARMENTS.find((item) => item.kind === kind)!.label} ${size}`,
    kind, size, fabric: structuredClone(material), avatar, avatarProfile: structuredClone(fitting?.avatarProfile ?? DEFAULT_AVATAR_PROFILE), fitBody: structuredClone(fitting?.fitBody ?? { kind: "procedural-reference", name: "Form anatomical fitting reference", surfaceReady: false, rightsConfirmed: true }), pieces,
    seams: bindMatchingEdges(pieces), details: [], createdAt: timestamp, updatedAt: timestamp,
  };
}

export function emptyGarmentProject(): GarmentProject {
  const timestamp = now();
  return { version: 1, id: uid("garment"), name: "Custom garment", kind: "custom", size: "Custom", fabric: structuredClone(FABRIC_PRESETS[0]), avatar: avatarForSize("M"), avatarProfile: structuredClone(DEFAULT_AVATAR_PROFILE), fitBody: { kind: "procedural-reference", name: "Form procedural fitting reference", surfaceReady: false, rightsConfirmed: true }, pieces: [], seams: [], details: [], createdAt: timestamp, updatedAt: timestamp };
}

export function recalculateSeamEase(project: GarmentProject) {
  return project.seams.map((seam) => {
    const aPiece = project.pieces.find((item) => item.id === seam.a.pieceId);
    const bPiece = project.pieces.find((item) => item.id === seam.b.pieceId);
    return { ...seam, easeRatio: aPiece && bPiece ? edgeLength(bPiece, seam.b.edgeIndex) / Math.max(edgeLength(aPiece, seam.a.edgeIndex), 0.001) : seam.easeRatio };
  });
}

export function gradeGarment(project: GarmentProject, target: BodyMeasurements, targetSize = "Custom"): GarmentProject {
  const base = project.avatar;
  const widthMeasurement = project.kind === "skirt" || project.kind === "trousers" || project.kind === "shorts" ? "hip" : "bust";
  const scaleX = Math.max(0.7, Math.min(1.45, target[widthMeasurement] / Math.max(1, base[widthMeasurement])));
  const scaleY = Math.max(0.78, Math.min(1.3, target.height / Math.max(1, base.height)));
  const pieces = project.pieces.map((patternPiece) => ({
    ...patternPiece,
    points: patternPiece.points.map((point) => ({ x: point.x * scaleX, y: point.y * scaleY })),
    curves: patternPiece.curves?.map((c) => ({ ...c, c1: { x: c.c1.x * scaleX, y: c.c1.y * scaleY }, c2: { x: c.c2.x * scaleX, y: c.c2.y * scaleY } })),
    position: { x: patternPiece.position.x * scaleX, y: patternPiece.position.y * scaleY },
  }));
  const details = project.details.map((detail) => ({ ...detail, position: { x: detail.position.x * scaleX, y: detail.position.y * scaleY }, intake: detail.intake * scaleX, length: detail.length * scaleY }));
  const graphics = project.graphics?.map((g) => ({ ...g, x: g.x * scaleX, y: g.y * scaleY }));
  const next = { ...project, size: targetSize, avatar: structuredClone(target), pieces, details, ...(graphics ? { graphics } : {}), updatedAt: now() };
  return { ...next, seams: recalculateSeamEase(next) };
}

export function addPatternDetail(project: GarmentProject, pieceId: string, type: PatternDetailType): GarmentProject {
  const patternPiece = project.pieces.find((item) => item.id === pieceId);
  if (!patternPiece) throw new Error("Select a pattern piece first");
  const center = patternPiece.points.reduce((sum, point) => ({ x: sum.x + point.x / patternPiece.points.length, y: sum.y + point.y / patternPiece.points.length }), { x: 0, y: 0 });
  const detail: PatternDetail = { id: uid(type), type, pieceId, position: center, intake: type === "dart" ? 24 : 18, length: type === "dart" ? 110 : 160, direction: 0, enabled: true };
  return { ...project, details: [...project.details, detail], updatedAt: now() };
}

function crossSectionWidth(patternPiece: PatternPiece, fraction: number) {
  const outline = patternOutline(patternPiece).points;
  const ys = outline.map((point) => point.y);
  const y = Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) * fraction;
  const intersections: number[] = [];
  outline.forEach((a, index) => {
    const b = outline[(index + 1) % outline.length];
    if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) intersections.push(a.x + (y - a.y) / (b.y - a.y) * (b.x - a.x));
  });
  return intersections.length >= 2 ? Math.max(...intersections) - Math.min(...intersections) : 0;
}

export function analyzeGarmentFit(project: GarmentProject): GarmentFitAnalysis {
  const panels = project.pieces.filter((piece) => piece.role === "front" || piece.role === "back");
  const width = (fraction: number) => panels.reduce((sum, patternPiece) => sum + crossSectionWidth(patternPiece, fraction), 0);
  const measuredWidth = (height: number) => panels.reduce((sum, panel) => {
    const ys = panel.points.map((point) => point.y), min = Math.min(...ys), max = Math.max(...ys);
    return sum + crossSectionWidth(panel, (height - min) / Math.max(1, max - min));
  }, 0);
  const stock = panels.length > 0 && panels.every((panel) => panel.stockPlacement);
  const pants = project.kind === "trousers" || project.kind === "shorts";
  const lowerBody = pants || project.kind === "skirt";
  const fractions = project.kind === "skirt" ? { chest: 1, waist: 0.96, hip: 0.76, thigh: 0.52 }
    : pants ? { chest: 1, waist: 0.92, hip: 0.78, thigh: 0.48 }
      : { chest: 0.78, waist: 0.58, hip: 0.38, thigh: 0.18 };
  const body = project.avatar;
  const dartIntake = project.details.filter((detail) => detail.enabled && detail.type === "dart").reduce((sum, detail) => sum + detail.intake, 0);
  const data: Array<[FitZone["id"], string, number, number]> = [
    ["chest", "Chest", lowerBody ? body.bust : stock ? measuredWidth(body.height * .195) : width(fractions.chest), body.bust],
    ["waist", "Waist", Math.max(0, (stock ? measuredWidth(body.height * .115 - .01) : width(fractions.waist)) - dartIntake), body.waist],
    ["hip", "Hip", stock ? measuredWidth(lowerBody ? body.height * .015 : 0) : width(fractions.hip), body.hip],
    ["thigh", "Thigh / stride", stock && pants ? measuredWidth(-body.height / 2 + body.inseam - 60) / 2 : width(fractions.thigh), body.hip * 0.5],
  ];
  const stretch = Math.max(0, project.fabric.stretchWeft) / 100;
  const zones = data.map(([id, label, garment, bodyValue]): FitZone => {
    const ease = garment - bodyValue;
    const strain = garment > 0 && ease < 0 ? Math.abs(ease) / Math.max(1, garment) * 100 : 0;
    const capacity = garment * stretch;
    const status: FitZone["status"] = ease > bodyValue * 0.18 ? "loose" : ease >= -capacity * 0.45 ? "good" : strain <= stretch * 100 ? "tight" : "critical";
    return { id, label, garment, body: bodyValue, ease, strain, status };
  });
  const relevant = project.kind === "skirt" ? zones.filter((zone) => zone.id === "waist" || zone.id === "hip") : pants ? zones.filter((zone) => zone.id !== "chest") : zones.filter((zone) => zone.id !== "thigh");
  const collisionCount = relevant.filter((zone) => zone.status === "critical").length;
  const maxStrain = Math.max(0, ...relevant.map((zone) => zone.strain));
  const movementAllowance = Math.max(0, Math.min(100, 100 - maxStrain * 5 + stretch * 80));
  const score = Math.max(0, Math.round(100 - collisionCount * 28 - relevant.filter((zone) => zone.status === "tight").length * 10 - Math.max(0, maxStrain - stretch * 100) * 2));
  return { score, status: collisionCount ? "blocked" : score < 82 ? "review" : "excellent", zones, maxStrain, collisionCount, movementAllowance };
}

export function bindPatternEdges(project: GarmentProject, a: PatternEdgeRef, b: PatternEdgeRef, type: SeamType = "plain"): GarmentProject {
  if (a.pieceId === b.pieceId && a.edgeIndex === b.edgeIndex) throw new Error("Choose two different pattern edges");
  const aPiece = project.pieces.find((item) => item.id === a.pieceId);
  const bPiece = project.pieces.find((item) => item.id === b.pieceId);
  if (!aPiece || !bPiece || edgeLength(aPiece, a.edgeIndex) === 0 || edgeLength(bPiece, b.edgeIndex) === 0) throw new Error("A seam references an invalid pattern edge");
  const duplicate = project.seams.some((seam) => seam.enabled && [seam.a, seam.b].some(edge => [a, b].some(ref => edge.pieceId === ref.pieceId && edge.edgeIndex === ref.edgeIndex)));
  if (duplicate) throw new Error("That edge is already sewn");
  const aLength = edgeLength(aPiece, a.edgeIndex);
  const bLength = edgeLength(bPiece, b.edgeIndex);
  const seam: SeamBinding = {
    id: uid("seam"), name: `${aPiece.name} ↔ ${bPiece.name}`, a, b, type,
    easeRatio: bLength / Math.max(aLength, 0.001), enabled: true,
  };
  return { ...project, seams: [...project.seams, seam], updatedAt: now() };
}

function pieceEdgeMidpointWorld(piece: PatternPiece, edgeIndex: number): FabricPoint {
  const a = piece.points[edgeIndex];
  const b = piece.points[(edgeIndex + 1) % piece.points.length];
  const midLocal = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const rot = ((piece.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return {
    x: piece.position.x + midLocal.x * cos - midLocal.y * sin,
    y: piece.position.y + midLocal.x * sin + midLocal.y * cos,
  };
}

function pieceEdgeDirWorld(piece: PatternPiece, edgeIndex: number): FabricPoint {
  const a = piece.points[edgeIndex];
  const b = piece.points[(edgeIndex + 1) % piece.points.length];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { x: 0, y: 0 };
  const rot = ((piece.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return { x: (dx * cos - dy * sin) / len, y: (dx * sin + dy * cos) / len };
}

export type AutoSeamOptions = {
  type?: SeamType;
  maxDistance?: number;
  maxLengthDelta?: number;
};

export function autoMatchSeamsByProximity(project: GarmentProject, options: AutoSeamOptions = {}): GarmentProject {
  const type = options.type ?? "plain";
  const maxDistance = options.maxDistance ?? 260;
  const maxLengthDelta = options.maxLengthDelta ?? 0.18;
  const used = new Set(project.seams.filter((seam) => seam.enabled).flatMap((seam) => [`${seam.a.pieceId}:${seam.a.edgeIndex}`, `${seam.b.pieceId}:${seam.b.edgeIndex}`]));
  type Candidate = { ref: PatternEdgeRef; length: number; mid: FabricPoint; dir: FabricPoint };
  const candidates: Candidate[] = [];
  project.pieces.forEach((piece) => piece.points.forEach((_, edgeIndex) => {
    const key = `${piece.id}:${edgeIndex}`;
    if (used.has(key) || isFinishedOpening(piece.edgeNames[edgeIndex] ?? "")) return;
    const length = edgeLength(piece, edgeIndex);
    if (length === 0) return;
    candidates.push({
      ref: { pieceId: piece.id, edgeIndex },
      length,
      mid: pieceEdgeMidpointWorld(piece, edgeIndex),
      dir: pieceEdgeDirWorld(piece, edgeIndex),
    });
  }));
  const pairs: { a: Candidate; b: Candidate; score: number }[] = [];
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const a = candidates[i];
      const b = candidates[j];
      if (a.ref.pieceId === b.ref.pieceId) continue;
      const lenMax = Math.max(a.length, b.length, 1);
      const lenDelta = Math.abs(a.length - b.length) / lenMax;
      if (lenDelta > maxLengthDelta) continue;
      const distance = Math.hypot(a.mid.x - b.mid.x, a.mid.y - b.mid.y);
      if (distance > maxDistance) continue;
      const dirDot = a.dir.x * b.dir.x + a.dir.y * b.dir.y;
      const reversedBonus = Math.max(0, -dirDot);
      const score = (distance / maxDistance) * 0.6 + lenDelta / maxLengthDelta * 0.3 - reversedBonus * 0.15;
      pairs.push({ a, b, score });
    }
  }
  pairs.sort((first, second) => first.score - second.score);
  let next = { ...project, seams: [...project.seams] };
  const paired = new Set(used);
  for (const { a, b } of pairs) {
    const aKey = `${a.ref.pieceId}:${a.ref.edgeIndex}`;
    const bKey = `${b.ref.pieceId}:${b.ref.edgeIndex}`;
    if (paired.has(aKey) || paired.has(bKey)) continue;
    try {
      next = bindPatternEdges(next, a.ref, b.ref, type);
      paired.add(aKey);
      paired.add(bKey);
    } catch { /* already bound */ }
  }
  return { ...next, updatedAt: now() };
}

export function autoBindPatternEdges(project: GarmentProject, type: SeamType = "plain"): GarmentProject {
  let next = { ...project, seams: [...project.seams] };
  const used = new Set(next.seams.filter((seam) => seam.enabled).flatMap((seam) => [`${seam.a.pieceId}:${seam.a.edgeIndex}`, `${seam.b.pieceId}:${seam.b.edgeIndex}`]));
  const edges = next.pieces.flatMap((patternPiece) => patternPiece.points.map((_, edgeIndex) => ({
    ref: { pieceId: patternPiece.id, edgeIndex },
    name: patternPiece.edgeNames[edgeIndex] ?? "",
    length: edgeLength(patternPiece, edgeIndex),
  }))).filter((edge) => !used.has(`${edge.ref.pieceId}:${edge.ref.edgeIndex}`) && !isFinishedOpening(edge.name));
  const named = new Map<string, typeof edges>();
  edges.forEach((edge) => { if (edge.name) named.set(edge.name, [...(named.get(edge.name) ?? []), edge]); });
  named.forEach((matches) => {
    if (matches.length !== 2 || matches[0].ref.pieceId === matches[1].ref.pieceId) return;
    try { next = bindPatternEdges(next, matches[0].ref, matches[1].ref, type); } catch { /* already paired */ }
  });
  return autoMatchSeamsByProximity(next, { type });
}

export function auditGarment(project: GarmentProject): GarmentAudit {
  const findings: GarmentFinding[] = [];
  let score = 100;
  if (closedHoodOpeningSeams(project).length) {
    findings.push({ severity: "error", message: "The hood face opening is sewn closed. Use Open hood face, then refit and update Animation." });
    score -= 25;
  }
  project.pieces.forEach((patternPiece) => {
    if (patternPiece.points.length < 3 || polygonArea(patternOutline(patternPiece).points) < 100) {
      findings.push({ severity: "error", message: `${patternPiece.name} is not a usable closed pattern.` }); score -= 30;
    }
    if (patternPiece.edgeNames.length !== patternPiece.points.length) {
      findings.push({ severity: "warning", message: `${patternPiece.name} has unnamed edges.` }); score -= 8;
    }
    if (patternPiece.seamAllowance < 3) {
      findings.push({ severity: "warning", message: `${patternPiece.name} has very little seam allowance.` }); score -= 5;
    }
  });
  project.seams.forEach((seam) => {
    const mismatch = Math.abs(1 - seam.easeRatio);
    if (mismatch > 0.15) { findings.push({ severity: "warning", message: `${seam.name} differs by ${Math.round(mismatch * 100)}%; add ease marks or reshape.` }); score -= 7; }
    const aPiece = project.pieces.find((item) => item.id === seam.a.pieceId);
    const bPiece = project.pieces.find((item) => item.id === seam.b.pieceId);
    if (!aPiece || !bPiece || !edgeLength(aPiece, seam.a.edgeIndex) || !edgeLength(bPiece, seam.b.edgeIndex)) {
      findings.push({ severity: "error", message: `${seam.name} has a broken edge reference.` }); score -= 25;
    }
  });
  if (project.pieces.length === 0) { findings.push({ severity: "error", message: "Add or import at least one pattern piece." }); score = 0; }
  else if (project.seams.length === 0 && project.pieces.length > 1) { findings.push({ severity: "warning", message: "The pattern pieces are not bound by seams yet." }); score -= 20; }
  if (!findings.some((finding) => finding.severity === "error") && findings.length === 0) findings.push({ severity: "pass", message: "Pattern topology, seam references, allowances, and fabric data are ready." });
  const areaMm2 = project.pieces.reduce((sum, patternPiece) => sum + polygonArea(patternOutline(patternPiece).points) * patternPiece.cutQuantity, 0);
  const seamLengthMm = project.seams.filter((seam) => seam.enabled).reduce((sum, seam) => {
    const aPiece = project.pieces.find((item) => item.id === seam.a.pieceId);
    return sum + (aPiece ? edgeLength(aPiece, seam.a.edgeIndex) : 0);
  }, 0);
  return {
    score: Math.max(0, Math.round(score)), ready: !findings.some((finding) => finding.severity === "error"),
    areaCm2: areaMm2 / 100, seamLengthMm,
    estimatedMassGrams: areaMm2 / 1_000_000 * project.fabric.weight,
    findings,
  };
}

function simplify(points: FabricPoint[], tolerance: number) {
  if (points.length <= 3) return points;
  const output: FabricPoint[] = [];
  points.forEach((point, index) => {
    const before = points[(index - 1 + points.length) % points.length];
    const after = points[(index + 1) % points.length];
    const cross = Math.abs((point.x - before.x) * (after.y - before.y) - (point.y - before.y) * (after.x - before.x));
    const span = Math.hypot(after.x - before.x, after.y - before.y);
    if (cross / Math.max(span, 0.001) >= tolerance) output.push(point);
  });
  return output.length >= 3 ? output : points;
}

export function tracePatternImage(data: Uint8ClampedArray, width: number, height: number, targetWidthMm = 500): FabricPoint[] {
  if (data.length !== width * height * 4 || width < 2 || height < 2) throw new Error("Image pixels are invalid");
  const corner = [data[0], data[1], data[2], data[3]];
  const candidates: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const offset = (y * width + x) * 4;
    const alpha = data[offset + 3];
    const colorDelta = Math.abs(data[offset] - corner[0]) + Math.abs(data[offset + 1] - corner[1]) + Math.abs(data[offset + 2] - corner[2]);
    const foreground = corner[3] < 20 ? alpha > 40 : alpha > 40 && colorDelta > 65;
    if (foreground) candidates.push({ x, y });
  }
  if (candidates.length < 16) throw new Error("No clear garment outline was found in that image");
  const center = candidates.reduce((sum, point) => ({ x: sum.x + point.x / candidates.length, y: sum.y + point.y / candidates.length }), { x: 0, y: 0 });
  const bins = Array.from({ length: 180 }, () => ({ radius: -1, point: { x: 0, y: 0 } }));
  candidates.forEach((point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const angle = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
    const bin = Math.min(bins.length - 1, Math.floor(angle / (Math.PI * 2) * bins.length));
    const radius = Math.hypot(dx, dy);
    if (radius > bins[bin].radius) bins[bin] = { radius, point };
  });
  const outline = bins.filter((bin) => bin.radius >= 0).map((bin) => bin.point);
  const minX = Math.min(...outline.map((point) => point.x));
  const maxX = Math.max(...outline.map((point) => point.x));
  const minY = Math.min(...outline.map((point) => point.y));
  const maxY = Math.max(...outline.map((point) => point.y));
  const scale = targetWidthMm / Math.max(1, maxX - minX);
  const normalized = outline.map((point) => ({ x: (point.x - (minX + maxX) / 2) * scale, y: ((minY + maxY) / 2 - point.y) * scale }));
  return simplify(normalized, Math.max(1, targetWidthMm * 0.004));
}

export function markerEfficiency(project: GarmentProject, fabricWidthMm = 1500) {
  if (project.pieces.length === 0) return { fabricWidthMm, usedLengthMm: 0, efficiency: 0, wasteAreaMm2: 0 };
  const totalArea = project.pieces.reduce((sum, patternPiece) => sum + polygonArea(patternOutline(patternPiece).points) * patternPiece.cutQuantity, 0);
  const usedLength = project.pieces.reduce((sum, patternPiece) => {
    const ys = patternPiece.points.map((point) => point.y);
    return sum + Math.max(...ys) - Math.min(...ys) + patternPiece.seamAllowance * 2;
  }, 0);
  const markerArea = Math.max(totalArea, fabricWidthMm * usedLength);
  return { fabricWidthMm, usedLengthMm: usedLength, efficiency: totalArea / markerArea, wasteAreaMm2: markerArea - totalArea };
}

export function serializeGarment(project: GarmentProject) {
  // Imported geometry is intentionally not embedded in a garment document.
  // Reopening therefore requires the source body to be reattached before the
  // production-fit gate can pass.
  const fitBody = project.fitBody.kind === "imported-surface" ? { ...project.fitBody, surfaceReady: false } : project.fitBody;
  return JSON.stringify({ ...project, fitBody, updatedAt: now() }, null, 2);
}

export function parseGarment(source: string): GarmentProject {
  const value = JSON.parse(source) as GarmentProject;
  if (value.version !== 1 || !Array.isArray(value.pieces) || !Array.isArray(value.seams) || !value.fabric || typeof value.name !== "string") throw new Error("This is not a supported Form garment file");
  value.avatar ??= avatarForSize(value.size);
  value.avatarProfile ??= structuredClone(DEFAULT_AVATAR_PROFILE);
  value.fitBody ??= { kind: "procedural-reference", name: "Form procedural fitting reference", surfaceReady: false, rightsConfirmed: true };
  value.details ??= [];
  if (value.pieces.length > 256 || value.seams.length > 4096 || value.details.length > 4096) throw new Error("The garment exceeds safe project limits");
  const ids = new Set<string>();
  value.pieces.forEach((patternPiece) => {
    if (!patternPiece || typeof patternPiece.id !== "string" || ids.has(patternPiece.id) || typeof patternPiece.name !== "string") throw new Error("The garment contains invalid or duplicate pattern pieces");
    ids.add(patternPiece.id);
    if (!Array.isArray(patternPiece.points) || patternPiece.points.length < 3 || patternPiece.points.length > 4096 || patternPiece.points.some((point) => !Number.isFinite(point?.x) || !Number.isFinite(point?.y))) throw new Error("The garment contains invalid pattern geometry");
    if (!Array.isArray(patternPiece.edgeNames) || patternPiece.edgeNames.length !== patternPiece.points.length) throw new Error("The garment contains invalid edge labels");
    if (![patternPiece.grainAngle, patternPiece.seamAllowance, patternPiece.cutQuantity, patternPiece.position?.x, patternPiece.position?.y, patternPiece.rotation].every(Number.isFinite)) throw new Error("The garment contains invalid pattern measurements");
    if (patternPiece.stockPlacement) {
      const { region, side } = patternPiece.stockPlacement;
      if (!["torso", "sleeve", "leg", "hood"].includes(region) || (region !== "torso" && side !== -1 && side !== 1)) throw new Error("The garment contains invalid stock placement");
    }
  });
  if (value.scanEvidence) {
    const evidence = value.scanEvidence;
    if (evidence.version !== 1 || evidence.status !== "inferred-draft" || !Number.isFinite(evidence.measuredLengthMm) || evidence.measuredLengthMm < 200 || evidence.measuredLengthMm > 1200) throw new Error("The garment contains invalid scan evidence");
    for (const view of [evidence.views?.front, evidence.views?.back]) {
      if (!view || typeof view.sourceId !== "string" || !view.sourceId.trim() || !/^[a-f0-9]{64}$/i.test(view.sha256)) throw new Error("The garment contains invalid scan source evidence");
    }
    if (!Array.isArray(evidence.pieceSources) || evidence.pieceSources.length !== value.pieces.length || evidence.pieceSources.some((item) => !ids.has(item?.pieceId) || !["front", "back"].includes(item.view) || item.status !== "inferred") || new Set(evidence.pieceSources.map((item) => item.pieceId)).size !== value.pieces.length) throw new Error("The garment contains invalid scan piece evidence");
    if (!Array.isArray(evidence.assumptions) || evidence.assumptions.length === 0 || evidence.assumptions.some((item) => typeof item !== "string" || !item.trim() || item.length > 300)) throw new Error("The garment contains invalid scan assumptions");
  }
  const fabricNumbers = [value.fabric.weight, value.fabric.thickness, value.fabric.stretchWarp, value.fabric.stretchWeft, value.fabric.stretchBias, value.fabric.bend, value.fabric.friction, value.fabric.shrinkage];
  if (typeof value.fabric.name !== "string" || typeof value.fabric.color !== "string" || fabricNumbers.some((number) => !Number.isFinite(number))) throw new Error("The garment contains invalid fabric data");
  if (value.fabric.calibration) {
    const calibration = value.fabric.calibration;
    const observations = [calibration.loadNewton, calibration.warpExtensionPercent, calibration.weftExtensionPercent, calibration.biasExtensionPercent, calibration.bendingLengthMm, calibration.slideAngleDegrees];
    if (calibration.source !== "measured-swatch" || calibration.method !== "strip-extension-cantilever-incline" || typeof calibration.testedAt !== "string" || observations.some((number) => !Number.isFinite(number))) throw new Error("The garment contains invalid fabric calibration data");
    validateStoredSwatchEvidence(value.fabric);
  }
  if (value.drapeValidation) {
    // Dynamic import would make project loading asynchronous; the validator is
    // pure, so require it at module scope through this generated-safe branch.
    value.drapeValidation = validateStoredDrapeValidation(value.drapeValidation);
  }
  if (value.sampleComparison) value.sampleComparison = parseSewnSampleComparison(JSON.stringify(value.sampleComparison));
  if (Object.values(value.avatar).some((number) => !Number.isFinite(number) || number <= 0)) throw new Error("The garment contains invalid avatar measurements");
  value.avatarProfile.pose ??= "neutral";
  if (!(["female", "male"] as string[]).includes(value.avatarProfile.sex) || !(["neutral", "walk", "reach"] as string[]).includes(value.avatarProfile.pose) || !Number.isFinite(value.avatarProfile.build) || value.avatarProfile.build < 0 || value.avatarProfile.build > 100) throw new Error("The garment contains an invalid fitting avatar profile");
  if (!(["procedural-reference", "imported-surface"] as string[]).includes(value.fitBody.kind) || typeof value.fitBody.name !== "string" || typeof value.fitBody.surfaceReady !== "boolean" || typeof value.fitBody.rightsConfirmed !== "boolean") throw new Error("The garment contains invalid fitting-body evidence");
  if (value.fitBody.kind === "imported-surface") {
    if (value.fitBody.format && !(["GLB", "GLTF", "OBJ", "STL", "FBX"] as string[]).includes(value.fitBody.format)) throw new Error("The garment contains an invalid fitting-body format");
    if (value.fitBody.triangles !== undefined && (!Number.isFinite(value.fitBody.triangles) || value.fitBody.triangles <= 0)) throw new Error("The garment contains invalid fitting-body geometry evidence");
    if (value.fitBody.sdfCells !== undefined && (!Number.isFinite(value.fitBody.sdfCells) || value.fitBody.sdfCells <= 0)) throw new Error("The garment contains invalid fitting-body collision evidence");
    // The mesh/SDF is session memory, not embedded in the JSON document.
    value.fitBody.surfaceReady = false;
  }
  value.details.forEach((detail) => {
    if (!ids.has(detail.pieceId) || ![detail.position?.x, detail.position?.y, detail.intake, detail.length, detail.direction].every(Number.isFinite)) throw new Error("The garment contains invalid pattern details");
  });
  value.pieces.forEach(validatePatternAuthoring);
  validateGarmentGraphics(value.graphics ?? [], ids);
  const audit = auditGarment(value);
  if (audit.findings.some((finding) => finding.message.includes("broken edge reference"))) throw new Error("The garment contains broken seam references");
  return value;
}
