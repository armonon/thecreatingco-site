import { validateRenderQueue, type RenderShot } from "./render-shot.ts";

export const FORM_PROJECT_KIND = "form-studio-project";
export const FORM_PROJECT_VERSION = 2;
export const FORM_SCENE_WORKSPACE_SCHEMA = "form-studio/scene@1";
export const FORM_CAD_WORKSPACE_SCHEMA = "form-studio/cad@14";
export const FORM_FABRIC_WORKSPACE_SCHEMA = "form-studio/fabric@1";

export const FORM_PROJECT_LIMITS = {
  bytes: 64 * 1024 * 1024,
  nestingDepth: 64,
  collectionItems: 750_000,
  workspaces: 32,
  objectIdsPerWorkspace: 500_000,
  relationships: 500_000,
  assets: 100_000,
  stringLength: 16 * 1024 * 1024,
} as const;

export type FormCameraShot = { name: string; position: number[]; target: number[] };

export type FormSceneWorkspace<TSceneItem = unknown> = {
  scene: TSceneItem[];
  workspace: {
    environment: string;
    gridVisible: boolean;
    snap: boolean;
    avoidCollisions: boolean;
    bloom: boolean;
    depthOfField: boolean;
    qualityMode: "Fast" | "Studio" | "Final";
    timeline: number;
  };
  camera: { position: number[]; target: number[] };
  cameraShots: FormCameraShot[];
  groups: { id: string; name: string }[];
  renderQueue?: RenderShot[];
};

export type FormWorkspaceCoordinateSystem = {
  units: "mm";
  upAxis: "Y" | "Z";
  handedness: "right";
  /** Source X/Y/Z axes expressed in the common right-handed Y-up frame. */
  toCommonAxes: ["+X" | "-X" | "+Y" | "-Y" | "+Z" | "-Z", "+X" | "-X" | "+Y" | "-Y" | "+Z" | "-Z", "+X" | "-X" | "+Y" | "-Y" | "+Z" | "-Z"];
};

export const FORM_Y_UP_COORDINATES: FormWorkspaceCoordinateSystem = {
  units: "mm", upAxis: "Y", handedness: "right", toCommonAxes: ["+X", "+Y", "+Z"],
};
export const FORM_CAD_COORDINATES: FormWorkspaceCoordinateSystem = {
  units: "mm", upAxis: "Z", handedness: "right", toCommonAxes: ["+X", "-Z", "+Y"],
};

export type FormWorkspaceRecord<TData = unknown> = {
  schema: string;
  updatedAt: number;
  coordinateSystem: FormWorkspaceCoordinateSystem;
  /** Stable object ids scoped to this workspace. Cross-workspace links use endpoint pairs. */
  objectIds: string[];
  data: TData;
};

export type FormWorkspaceEndpoint = { workspace: string; objectId: string };
export type FormProjectRelationship = {
  id: string;
  kind: "derived-from" | "drives" | "attached-to" | "simulates-on" | "renders-in" | string;
  source: FormWorkspaceEndpoint;
  target: FormWorkspaceEndpoint;
  metadata?: Record<string, unknown>;
};

export type FormProjectAsset = {
  id: string;
  name: string;
  mediaType: string;
  uri?: string;
  checksum?: string;
  bytes?: number;
  metadata?: Record<string, unknown>;
};

export type FormProject<TSceneItem = unknown> = {
  kind: typeof FORM_PROJECT_KIND;
  version: typeof FORM_PROJECT_VERSION;
  projectId: string;
  revisionId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  common: {
    canonicalUnits: "mm";
    displayUnits: "mm" | "cm" | "m" | "in" | "ft";
    upAxis: "Y";
    handedness: "right";
  };
  workspaces: {
    scene?: FormWorkspaceRecord<FormSceneWorkspace<TSceneItem>>;
    cad?: FormWorkspaceRecord<unknown>;
    fabric?: FormWorkspaceRecord<unknown>;
    [workspace: string]: FormWorkspaceRecord<unknown> | undefined;
  };
  relationships: FormProjectRelationship[];
  assets: FormProjectAsset[];
  /** Integrity seal over the complete container; omitted only in in-memory drafts and migrated v1 input. */
  checksum?: string;
  /** Namespaced third-party and migrated fields that the core preserves losslessly. */
  extensions?: Record<string, unknown>;
};

export type ProjectMigrationBackup = {
  source: string;
  sourceVersion: number;
  targetVersion: typeof FORM_PROJECT_VERSION;
  reason: "schema-migration";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const validVector = (value: unknown) =>
  Array.isArray(value) && value.length === 3 && value.every((entry) => typeof entry === "number" && Number.isFinite(entry));

const dangerousKeys = new Set(["__proto__", "prototype", "constructor"]);

function assertSafeTree(value: unknown, path = "project", depth = 0, counter = { value: 0 }): void {
  if (depth > FORM_PROJECT_LIMITS.nestingDepth) throw new Error(`${path} exceeds the supported nesting depth.`);
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error(`${path} contains a non-finite number.`);
  if (typeof value === "string" && value.length > FORM_PROJECT_LIMITS.stringLength) throw new Error(`${path} contains an oversized string.`);
  if (Array.isArray(value)) {
    counter.value += value.length;
    if (counter.value > FORM_PROJECT_LIMITS.collectionItems) throw new Error("The project contains too many collection items.");
    value.forEach((item, index) => assertSafeTree(item, `${path}[${index}]`, depth + 1, counter));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (dangerousKeys.has(key)) throw new Error(`${path} contains an unsafe key.`);
    assertSafeTree(item, `${path}.${key}`, depth + 1, counter);
  }
}

function hashText(source: string) {
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

function stableId(prefix: string, value: unknown) {
  return `${prefix}-${hashText(JSON.stringify(value))}`;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value)
    .sort((first, second) => first.localeCompare(second))
    .map((key) => [key, stableValue(value[key])]));
}

function rotateLeft(value: number, bits: number) {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0;
}

function avalanche(value: number) {
  let mixed = value >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 2246822507);
  mixed ^= mixed >>> 13;
  mixed = Math.imul(mixed, 3266489909);
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
}

export function formProjectChecksum(value: unknown) {
  // Only the container's integrity field is self-referential. Workspace-level
  // checksums are payload and must remain covered by the outer seal.
  const root = isRecord(value)
    ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== "checksum"))
    : value;
  const source = JSON.stringify(stableValue(root));
  let lane0 = 2166136261;
  let lane1 = 2654435761;
  let lane2 = 3266489917;
  let lane3 = 1103515245;
  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    lane0 = rotateLeft(Math.imul((lane0 ^ code) >>> 0, 16777619) >>> 0, 5);
    lane1 = rotateLeft(Math.imul((lane1 ^ code) >>> 0, 2246822519) >>> 0, 11);
    lane2 = rotateLeft(Math.imul((lane2 ^ code) >>> 0, 374761393) >>> 0, 17);
    lane3 = rotateLeft(Math.imul((lane3 ^ code) >>> 0, 668265263) >>> 0, 23);
  }
  const lanes = [lane0, lane1, lane2, lane3];
  const mixed = lanes.map((lane, index) => avalanche((lane ^ source.length ^ rotateLeft(lanes[(index + 1) % lanes.length], 7)) >>> 0));
  return `fnv1a128-${mixed.map((lane) => lane.toString(16).padStart(8, "0")).join("")}`;
}

function uniqueObjectIds(value: unknown[], workspace: string) {
  const ids: string[] = [];
  const seen = new Set<string>();
  value.forEach((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || item.id.length === 0 || seen.has(item.id)) return;
    seen.add(item.id);
    ids.push(item.id);
  });
  if (ids.length > FORM_PROJECT_LIMITS.objectIdsPerWorkspace) throw new Error(`${workspace} contains too many object ids.`);
  return ids;
}

function validateSceneWorkspace(value: unknown): asserts value is FormSceneWorkspace<unknown> {
  if (!isRecord(value) || !Array.isArray(value.scene)) throw new Error("The project has no readable scene workspace.");
  if (!isRecord(value.workspace) || !isRecord(value.camera)) throw new Error("The scene workspace data is incomplete.");
  if (!validVector(value.camera.position) || !validVector(value.camera.target)) throw new Error("The project camera data is invalid.");
  const qualityMode = value.workspace.qualityMode;
  if (qualityMode !== "Fast" && qualityMode !== "Studio" && qualityMode !== "Final") throw new Error("The project renderer setting is invalid.");
  if (!Array.isArray(value.cameraShots) || !Array.isArray(value.groups)) throw new Error("The scene collections are invalid.");
  if (value.renderQueue !== undefined) validateRenderQueue(value.renderQueue, "storage");
}

function validateWorkspaceRecord(name: string, value: unknown): asserts value is FormWorkspaceRecord<unknown> {
  if (!isRecord(value) || typeof value.schema !== "string" || value.schema.length === 0 || value.schema.length > 160) throw new Error(`The ${name} workspace schema is invalid.`);
  if (typeof value.updatedAt !== "number" || !Number.isFinite(value.updatedAt) || value.updatedAt < 0) throw new Error(`The ${name} workspace timestamp is invalid.`);
  if (!Array.isArray(value.objectIds) || value.objectIds.length > FORM_PROJECT_LIMITS.objectIdsPerWorkspace) throw new Error(`The ${name} object index is invalid.`);
  if (!isRecord(value.coordinateSystem)
    || value.coordinateSystem.units !== "mm"
    || !["Y", "Z"].includes(String(value.coordinateSystem.upAxis))
    || value.coordinateSystem.handedness !== "right"
    || !Array.isArray(value.coordinateSystem.toCommonAxes)
    || value.coordinateSystem.toCommonAxes.length !== 3
    || value.coordinateSystem.toCommonAxes.some((axis) => !/^[+-][XYZ]$/.test(String(axis)))
    || new Set(value.coordinateSystem.toCommonAxes.map((axis) => String(axis).slice(1))).size !== 3) throw new Error(`The ${name} coordinate system is invalid.`);
  const seen = new Set<string>();
  for (const id of value.objectIds) {
    if (typeof id !== "string" || id.length === 0 || id.length > 256 || seen.has(id)) throw new Error(`The ${name} object index contains invalid or duplicate ids.`);
    seen.add(id);
  }
  if (!("data" in value)) throw new Error(`The ${name} workspace has no data.`);
  if (name === "scene") validateSceneWorkspace(value.data);
}

function validateProject(value: unknown): asserts value is FormProject<unknown> {
  if (!isRecord(value) || value.kind !== FORM_PROJECT_KIND) throw new Error("This is not a Form Studio project.");
  if (value.version !== FORM_PROJECT_VERSION) throw new Error(`Project version ${String(value.version)} is not supported.`);
  if (typeof value.projectId !== "string" || value.projectId.length === 0 || value.projectId.length > 160) throw new Error("The project identity is invalid.");
  if (typeof value.revisionId !== "string" || value.revisionId.length === 0 || value.revisionId.length > 200) throw new Error("The project revision identity is invalid.");
  if (typeof value.name !== "string" || typeof value.createdAt !== "number" || typeof value.updatedAt !== "number" || !Number.isFinite(value.createdAt) || !Number.isFinite(value.updatedAt)) throw new Error("The project metadata is invalid.");
  if (!isRecord(value.common) || value.common.canonicalUnits !== "mm" || value.common.upAxis !== "Y" || value.common.handedness !== "right" || !["mm", "cm", "m", "in", "ft"].includes(String(value.common.displayUnits))) throw new Error("The common project coordinate system is invalid.");
  if (!isRecord(value.workspaces)) throw new Error("The project workspace index is missing.");
  const workspaceIndex = value.workspaces;
  const workspaceEntries = Object.entries(workspaceIndex);
  if (workspaceEntries.length > FORM_PROJECT_LIMITS.workspaces) throw new Error("The project contains too many workspaces.");
  workspaceEntries.forEach(([name, workspace]) => validateWorkspaceRecord(name, workspace));
  if (!Array.isArray(value.relationships) || value.relationships.length > FORM_PROJECT_LIMITS.relationships) throw new Error("The project relationship graph is invalid.");
  const relationshipIds = new Set<string>();
  value.relationships.forEach((relationship, index) => {
    if (!isRecord(relationship) || typeof relationship.id !== "string" || typeof relationship.kind !== "string" || !isRecord(relationship.source) || !isRecord(relationship.target)) throw new Error(`Project relationship ${index + 1} is invalid.`);
    if (relationship.id.length === 0 || relationship.id.length > 256 || relationshipIds.has(relationship.id)) throw new Error(`Project relationship ${index + 1} has an invalid or duplicate id.`);
    relationshipIds.add(relationship.id);
    for (const endpoint of [relationship.source, relationship.target]) {
      const workspace = typeof endpoint.workspace === "string" ? workspaceIndex[endpoint.workspace] : undefined;
      if (!isRecord(workspace) || !Array.isArray(workspace.objectIds) || typeof endpoint.objectId !== "string" || !workspace.objectIds.includes(endpoint.objectId)) throw new Error(`Project relationship ${relationship.id} has an invalid endpoint.`);
    }
  });
  if (!Array.isArray(value.assets) || value.assets.length > FORM_PROJECT_LIMITS.assets) throw new Error("The project asset index is invalid.");
  const assetIds = new Set<string>();
  value.assets.forEach((asset, index) => {
    if (!isRecord(asset) || typeof asset.id !== "string" || typeof asset.name !== "string" || typeof asset.mediaType !== "string") throw new Error(`Project asset ${index + 1} is invalid.`);
    if (asset.id.length === 0 || asset.id.length > 256 || assetIds.has(asset.id)) throw new Error(`Project asset ${index + 1} has an invalid or duplicate id.`);
    assetIds.add(asset.id);
  });
  if (value.checksum !== undefined && (typeof value.checksum !== "string" || !/^fnv1a128-[0-9a-f]{32}$/.test(value.checksum))) throw new Error("The project integrity seal is invalid.");
}

export function cleanProjectName(value: string) {
  const cleaned = value.replace(/\.form$/i, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 80) || "Untitled scene";
}

export function projectFilename(name: string) {
  return `${cleanProjectName(name).replace(/\s+/g, "-").toLowerCase()}.form`;
}

export function createFormProject(name = "Untitled scene", at = Date.now()): FormProject<unknown> {
  const cleanName = cleanProjectName(name);
  const projectId = stableId("project", { cleanName, at });
  return {
    kind: FORM_PROJECT_KIND,
    version: FORM_PROJECT_VERSION,
    projectId,
    revisionId: stableId("revision", { projectId, at, initial: true }),
    name: cleanName,
    createdAt: at,
    updatedAt: at,
    common: { canonicalUnits: "mm", displayUnits: "mm", upAxis: "Y", handedness: "right" },
    workspaces: {},
    relationships: [],
    assets: [],
  };
}

export function updateFormWorkspace<TData>(
  project: FormProject<unknown>,
  workspace: string,
  record: Omit<FormWorkspaceRecord<TData>, "updatedAt" | "coordinateSystem"> & { updatedAt?: number; coordinateSystem?: FormWorkspaceCoordinateSystem },
  at = Date.now(),
): FormProject<unknown> {
  const objectIds = [...new Set(record.objectIds)];
  if (objectIds.length !== record.objectIds.length) throw new Error(`The ${workspace} object index contains duplicate ids.`);
  const nextWorkspace: FormWorkspaceRecord<TData> = {
    ...record,
    coordinateSystem: record.coordinateSystem ?? (workspace === "cad" ? FORM_CAD_COORDINATES : FORM_Y_UP_COORDINATES),
    objectIds,
    updatedAt: record.updatedAt ?? at,
  };
  validateWorkspaceRecord(workspace, nextWorkspace);
  const projectWithoutChecksum: FormProject<unknown> = { ...project };
  delete projectWithoutChecksum.checksum;
  const next = {
    ...projectWithoutChecksum,
    version: FORM_PROJECT_VERSION,
    updatedAt: at,
    revisionId: stableId("revision", { previous: project.revisionId, workspace, at, data: nextWorkspace }),
    workspaces: { ...project.workspaces, [workspace]: nextWorkspace },
  } as FormProject<unknown>;
  validateProject(next);
  return next;
}

/** Adds immutable project assets while advancing the shared document revision. */
export function addFormProjectAssets(
  project: FormProject<unknown>,
  additions: FormProjectAsset[],
  at = Date.now(),
) {
  if (!Number.isFinite(at)) throw new Error("The project update time is invalid.");
  if (project.assets.length + additions.length > FORM_PROJECT_LIMITS.assets) throw new Error("The project contains too many assets.");
  const seen = new Set(project.assets.map((asset) => asset.id));
  for (const asset of additions) {
    if (seen.has(asset.id)) throw new Error(`Project asset ${asset.id} already exists.`);
    seen.add(asset.id);
  }
  const next = {
    ...project,
    updatedAt: at,
    revisionId: stableId("revision", {
      previous: project.revisionId,
      at,
      assets: additions.map(({ uri, ...asset }) => ({
        ...asset,
        uriDigest: uri === undefined ? undefined : stableId("asset-uri", uri),
      })),
    }),
    assets: [...project.assets, ...additions],
  } as FormProject<unknown>;
  delete next.checksum;
  assertSafeTree(next);
  validateProject(next);
  return next;
}

export function formWorkspace<TData = unknown>(project: FormProject<unknown>, workspace: string) {
  return project.workspaces[workspace] as FormWorkspaceRecord<TData> | undefined;
}

export function serializeProject<TSceneItem>(project: FormProject<TSceneItem>) {
  assertSafeTree(project);
  validateProject(project);
  return `${JSON.stringify({ ...project, checksum: formProjectChecksum(project) }, null, 2)}\n`;
}

export function projectFingerprint<TSceneItem>(project: FormProject<TSceneItem>) {
  const workspaces = Object.fromEntries(Object.entries(project.workspaces).map(([name, record]) => {
    if (!record) return [name, record];
    const data = name === "scene" && isRecord(record.data) && isRecord(record.data.workspace)
      ? { ...record.data, workspace: { ...record.data.workspace, timeline: 0 } }
      : record.data;
    return [name, { ...record, updatedAt: 0, data }];
  }));
  return JSON.stringify({
    ...project,
    checksum: "",
    revisionId: "",
    updatedAt: 0,
    workspaces,
  });
}

const LEGACY_PROJECT_KEYS = new Set(["kind", "version", "name", "createdAt", "updatedAt", "scene", "workspace", "camera", "cameraShots", "groups"]);

function migrateLegacyProject(value: Record<string, unknown>): FormProject<unknown> {
  const sceneData = { scene: value.scene, workspace: value.workspace, camera: value.camera, cameraShots: value.cameraShots ?? [], groups: value.groups ?? [] };
  validateSceneWorkspace(sceneData);
  const createdAt = typeof value.createdAt === "number" && Number.isFinite(value.createdAt) ? value.createdAt : 0;
  const updatedAt = typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt) ? value.updatedAt : createdAt;
  const name = cleanProjectName(typeof value.name === "string" ? value.name : "Untitled scene");
  const projectId = stableId("project", { name, createdAt });
  const unknownEntries = Object.entries(value).filter(([key]) => !LEGACY_PROJECT_KEYS.has(key));
  return {
    kind: FORM_PROJECT_KIND,
    version: FORM_PROJECT_VERSION,
    projectId,
    revisionId: stableId("revision", value),
    name,
    createdAt,
    updatedAt,
    common: { canonicalUnits: "mm", displayUnits: "mm", upAxis: "Y", handedness: "right" },
    workspaces: { scene: { schema: FORM_SCENE_WORKSPACE_SCHEMA, updatedAt, coordinateSystem: FORM_Y_UP_COORDINATES, objectIds: uniqueObjectIds(sceneData.scene, "scene"), data: sceneData } },
    relationships: [],
    assets: [],
    ...(unknownEntries.length ? { extensions: { legacyRoot: Object.fromEntries(unknownEntries) } } : {}),
  };
}

export function parseProjectWithMigration(input: string): { project: FormProject<unknown>; backup: ProjectMigrationBackup | null } {
  if (new TextEncoder().encode(input).byteLength > FORM_PROJECT_LIMITS.bytes) throw new Error("The project exceeds the supported file size.");
  let value: unknown;
  try { value = JSON.parse(input); } catch { throw new Error("This file is not valid JSON."); }
  assertSafeTree(value);
  if (!isRecord(value) || value.kind !== FORM_PROJECT_KIND) throw new Error("This is not a Form Studio project.");
  if (value.version === 1) {
    const project = migrateLegacyProject(value);
    validateProject(project);
    return { project, backup: { source: input, sourceVersion: 1, targetVersion: FORM_PROJECT_VERSION, reason: "schema-migration" } };
  }
  if (value.version !== FORM_PROJECT_VERSION) throw new Error(`Project version ${String(value.version)} is not supported.`);
  validateProject(value);
  if (typeof value.checksum === "string" && value.checksum !== formProjectChecksum(value)) throw new Error("Project integrity check failed.");
  return { project: value, backup: null };
}

export function parseProject(input: string): FormProject<unknown> {
  return parseProjectWithMigration(input).project;
}

/** Returns null only for a non-container file; malformed .FORM containers still fail loudly. */
export function parseProjectIfContainer(input: string): FormProject<unknown> | null {
  let value: unknown;
  try { value = JSON.parse(input); } catch { return null; }
  if (!isRecord(value) || value.kind !== FORM_PROJECT_KIND) return null;
  return parseProject(input);
}
