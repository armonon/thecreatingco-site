"use client";
import { openCollaboration, previewImage } from "@momentium/live-review";
import { formSharedFields, applyFormSharedFields } from "./cad-collaboration";


import React, { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ProjectSaveSession } from "./project-save-session";
import { WORKSPACE_CANVAS, canvasLayerInk } from "./workspace-canvas-theme";
import { confirmDocumentAction } from "./confirm-document-action";
import { historyJson, retainHistory } from "./history-budget";
import { useDocumentSafety } from "./use-document-safety";
import { archivePaintTexture, restorePaintTexture, type PaintTextureArchive } from "./paint-texture-project";
import * as THREE from "three";
import {
  formatCadLength,
  fromMillimeters,
  parseCadCommand,
  parseCadLength,
  type CadUnit,
} from "./cad-precision";
import {
  evaluateCadExpression,
  solveAssemblyMates,
  solveGeometricConstraints,
  solveGeometricEdit,
  type AssemblyInstance,
  type AssemblyMate,
  type AssemblyMateKind,
  type ConstraintKind,
  type GeometricConstraint,
} from "./cad-professional";
import { parseIntentModelCommand, type IntentModelPlan } from "./cad-intent";
import { assessDesignCopilotRequest, DESIGN_COPILOT_CAPABILITIES } from "./design-copilot";
import {
  hardwareDefaults,
  HARDWARE_RECIPES,
  parseHardwareCommand,
  type HardwareKind,
  type HardwareParameters,
} from "./cad-hardware";
import {
  DEFAULT_LINK_SYSTEM_SPEC,
  cloneLinkTemplate,
  parseLinkSystemCommand,
  planLinkSystem,
  type LinkAnchor,
  type LinkedGroup,
  type LinkSystemSpec,
} from "./cad-links";
import {
  DESIGN_PACKS,
  DOMAIN_RECIPES,
  domainDefaults,
  parseDomainCommand,
  type DesignDiscipline,
  type DomainMetadata,
  type DomainParameters,
  type DomainRecipeKind,
} from "./cad-domains";
import {
  DEFAULT_JEWELRY_SPEC,
  GEM_MATERIALS,
  JEWELRY_METALS,
  SETTING_STYLES,
  STONE_SHAPES,
  jewelryMetrics,
  parseJewelryCommand,
  type JewelryMetadata,
  type JewelrySpec,
} from "./cad-jewelry";
import {
  DEFAULT_ENGINEERING_SPEC,
  DEFAULT_MARKETPLACE,
  PRO_CAPABILITIES,
  STARTER_RECIPE_GRAPH,
  addBimStorey,
  analyzeEngineering,
  buildBimObjectGraph,
  createRevision,
  evaluateRecipeGraph,
  generateArchitectureDocuments,
  migrateBimObjectGraph,
  planLargeProjectStreaming,
  rebuildBimObjectGraph,
  selectStreamingWorkingSet,
  solveAdvancedMate,
  updateBimNode,
  updateRevisionReview,
  type BimNode,
  type EngineeringProSpec,
  type MarketplaceItem,
  type ProjectRevision,
  type ProPlan,
  type RecipeGraph,
} from "./cad-pro-systems";
import { importIfc4 } from "./bim-ifc";
import {
  cadProjectChecksum,
  parseCadProject,
  readBrowserCadRecovery,
  readBrowserCadRecoveryHistory,
  saveBrowserCadRecovery,
  sealCadProject,
  validCadRecoverySnapshot,
  type CadRecoverySnapshot,
} from "./cad-project";
import {
  featureSourceIds,
  rebuildParametricModel,
  type CadEntity as Entity,
  type CadFeature as Feature,
  type CadPoint as Point,
} from "./cad-model";
import {
  freehandStrokeToCadEntities,
  importSvgPolylines,
  polylinesToCadEntities,
  sketchPolylinesToSvg,
  traceRasterPolylines,
  type SketchPolyline,
  type SketchSample,
} from "./sketch-vector";
import { buildClosedLineProfiles } from "./cad-wire";
import { sketchObjects, sketchBounds, sketchEntityPoints, hitSketchObject, transformSketchEntities, type SketchObject } from "./sketch-objects";
import SketchWorkbench from "./sketch-workbench";
import { distanceToCadEntity, inferSketchPoint, offsetCadProfile, type SketchInference } from "./cad-direct-modeling";
import { guardExactOperation, type GuardedExactOperation } from "./cad-operation-guard";
import { exportCadDxf, importCadDxf } from "./cad-dxf";
import { validateGdtAnnotations, type GdtAnnotation, type GdtMaterialCondition, type GdtSymbol } from "./cad-gdt";
import { buildProductionDrawingSheet, validateProductionDrawingSheet } from "./cad-drawing";
import { createFabricationReviewPackage } from "./cad-fabrication-validation";
import { createArtistReviewPackage } from "./artist-review";
import { createCadDraftingDocument, mergeCadDraftingDocuments, draftDimensionGeometry, type CadDraftingDocument } from "./cad-drafting";
import CadDraftingPanel from "./cad-drafting-panel";
import CadDocumentWorkspace, { DocumentInspector, type DocumentPanel, type DocumentSheet, type DocumentSelection } from "./cad-document-workspace";
import { createDrawingBook, drawingViewGeometry, effectiveSheetScale, isBimSheet, sheetSourceViews, sheetDimensionDirection, sheetSize, type DrawingBook, type SheetLayout, type SheetView, type SheetSource, type SheetPlacement } from "./cad-sheet-layout";
import { buildLinkedSheet, createLinkedSheet, linkedSheetContent, type LinkedSheetInputs } from "./cad-linked-sheet";
import { defaultBimSheets, buildBimSheet } from "./cad-bim-sheet";
import { exportSheetDxf } from "./cad-sheet-dxf";
import { saveDrawingExport, type DrawingExportFormat } from "./document-export";
import { prepareExactDrawing, verifyDrawingProjection } from "./cad-drawing-bridge";
import CadSheetEditor from "./cad-sheet-editor";
import CadInspectorNav from "./cad-inspector-nav";
import { parseExtensionManifest, resolveExtensionCommand } from "./extension-api";
import {
  EXTENSION_PACKAGE_SCHEMA,
  FORM_EXTENSION_API_VERSION,
  createExtensionRegistry,
  inspectExtensionPackage,
  installDeveloperExtension,
  installInspectedExtension,
  restoreExtensionRegistry,
  serializeExtensionRegistry,
  setExtensionEnabled,
  uninstallExtension,
  type ExtensionRegistry,
} from "./extension-registry";
import { inferGarmentFromSilhouettes, silhouettesFromCadEntities } from "./garment-inference";
import { parseGarmentIntent, type GarmentIntentPlan } from "./unified-intent";
import {
  describeSmartModifierCommand,
  parseSmartCommand,
  recommendSmartActions,
  type SmartActionId,
  type SmartActionContext,
  type SmartLockCommand,
  type SmartModifierCommand,
} from "./smart-actions";
import { buildModuleApplication, type IndustryModule, type ModulePlan } from "./module-registry";
import { jewelryModule } from "./modules/jewelry";
import { hardwareDefaultSpec, hardwareModule, type HardwareMode, type HardwareSpec } from "./modules/hardware";
import { domainDefaultSpec, domainsModule } from "./modules/domains";
import { engineeringModule } from "./modules/engineering";
import { useCloudSync } from "./use-cloud-sync";
import { describeSync, roomIdForProject, sharedRoomIdFromSearch } from "./cloud-sync";
import CadViewport3D, { type CadViewportHandle, type ExactDirectEdit } from "./cad-viewport-3d";
import { DrawingScaleInput, ExactLengthInput } from "./cad-controls";
import { useCompactWorkspace } from "./use-compact-workspace";
import { moveSketchView } from "./touch-sketch-view";
import { ContextTapGesture } from "./context-tap";
import { ObjectContextMenu, type ObjectMenuAnchor } from "./object-context-menu";
import { applyDirectFaceEdit } from "./cad-direct-edit";
import {
  UiIcon,
  UiResizeHandle,
  WorkspaceUiControls,
  useWorkspaceLayout,
  workspaceLayoutClasses,
  workspaceLayoutStyle,
  type UiIconName,
} from "./workspace-ui";
import { AppearancePanel, FeatureTreePanel, LayersPanel, SculptPanel } from "./cad-panels";
import { SculptToolbox } from "./sculpt-toolbox";
import { PaintToolbox } from "./paint-toolbox";
import { ImageModelStudio, type ImageModelResult } from "./image-model-studio";
import { CastStudio, type CastSource } from "./cast-studio";
import { castMeshFromBuffers, castMeshFromEditable, combineCastMeshes, weldCastMesh } from "./cast-mesh";
import { restoredPhotoTexture } from "./photo-texture";
import { FormLogo } from "./form-logo";
import { cadDocumentReadiness } from "./product-readiness";
import { designValidationLifecycle } from "./readiness-lifecycle";
import {
  appendMeshEdit,
  appendSculptLayerStroke,
  addSculptLayer,
  cageFacesForSurfaceFaces,
  creaseEdgesForFaces,
  defaultMeshFeature,
  prepareMeshHandoff,
  rebuildMeshFeature,
  moveMeshEdit,
  removeMeshEdit,
  removeSculptLayer,
  setMeshModifiers,
  setMeshPrimitive,
  setMeshRollback,
  toggleMeshEdit,
  updateMeshEdit,
  updateSculptLayer,
  setMeshShadingAngle,
  setMeshSmoothing,
  type MeshEdit,
  type MeshFeature,
  type MeshPrimitive,
} from "./mesh-feature";
import { booleanMeshes, isEmptyResult, type BooleanOperation } from "./mesh-boolean";
import { exportMesh, importMesh, type MeshExportFormat, type MeshImportUnit } from "./mesh-interchange";
import { BLENDER_IMPORT_STEPS, CAD_FRAME, bakeForBlender, blenderGlb, blenderObjZip, editableMeshFromGlb } from "./blender-export";
import { offerLocker, onLockerOpen, useSuiteKit, type LockerEntry } from "./suite-kit";
import { weldVertices } from "./mesh-kernel";
import { unwrapMesh, type UvUnwrap } from "./mesh-uv";
import { meshBounds, type EditableMesh } from "./mesh-kernel";
import { animationModelSnapshot, type AnimationModelSnapshot } from "./animation-handoff";
import { mergeRegionItems, type RegionMode } from "./region-select";
import { DEFAULT_SELECTION_BRUSH, selectionTopology, type SelectionBrush, type MaskDeform } from "./selection-mask";
import { SelectionHud } from "./selection-hud";
import { parseSelectionIntent } from "./selection-intent";
import { GeometryNodePanel, MaterialNodePanel, RenderPanel, TimelinePanel } from "./node-panels";
import { GraphEditorPanel } from "./graph-editor-panel";
import { useAnimation } from "./use-animation";
import {
  DEFAULT_RENDER,
  EMPTY_QUEUE,
  enqueue,
  nextJob,
  prepareScene,
  removeJob,
  renderPass,
  startRender,
  toDenoisedImage,
  toImage,
  updateJob,
  type Aov,
  type RenderProgress,
  type RenderQueue,
  type RenderScene,
  type RenderSettings,
  type RenderVolume,
} from "./path-tracer";
import { importOpenVdbInWorker, importOpenVdbNative, prepareSparseDensityGrid, type OpenVdbImportResult } from "./sparse-volume";
import {
  DEFAULT_PAINT,
  addMaterialNode,
  bakeMaterial,
  blankTexture,
  connectMaterial,
  describeMaterial,
  normalizeMaterialGraph,
  paintDab,
  removeMaterialNode,
  setMaterialOption,
  setMaterialParam,
  starterMaterial,
  type MaterialGraph,
  type MaterialLink,
  type MaterialNodeKind,
  type Rgb,
} from "./material-nodes";
import {
  addNode as addGraphNode,
  connect as connectGraph,
  describeGraph,
  disconnect as disconnectGraph,
  evaluateGeometryGraph,
  normalizeGeometryGraph,
  removeNode as removeGraphNode,
  setNodeOption,
  setNodeParam,
  starterGraph,
  type GeometryGraph,
  type NodeKind,
  type NodeLink,
} from "./geometry-nodes";
import {
  applyStroke,
  DEFAULT_BRUSH,
  describeBrush,
  type BrushSettings,
  type StrokeSample,
} from "./sculpt-brush";
import { medianPoint, transformMatrix, type TransformValue, type Vec3 as TransformVec3 } from "./modal-transform";
import {
  ancestorsOf,
  compose as composeMatrix,
  createNode,
  decompose as decomposeMatrix,
  isVisible,
  multiply as multiplyMatrices,
  normalizeSceneGraph,
  removeNode,
  setParent,
  updateTransform,
  worldMatrix,
  transformPoint,
  type NodeTransform,
  type SceneNode,
} from "./scene-graph";
import { normalizeAnimation, type AnimationState } from "./animation-clip";
import {
  MODIFIER_LABELS,
  defaultModifier,
  moveModifier,
  removeModifier,
  toggleModifier,
  updateModifier,
  type CreativeMeshModifier,
  type MeshModifier,
  type ModifierKind,
} from "./mesh-modifiers";
import {
  EMPTY_SELECTION,
  applySelectionCommand,
  describeSelection,
  selectNone,
  selectLinkedFlat,
  selectionCount,
  selectionWith,
  setSelectionMode,
  type MeshSelection,
  type SelectionCommand,
  type SelectionMode,
} from "./mesh-selection";
import { sceneToStep, sculptToStep, type StepMetadata } from "./mesh-to-brep";
import {
  DEFAULT_PLANES,
  WORLD_PLANE_ID,
  planeById,
  type SketchPlane,
  type Triple,
} from "./sketch-planes";
import {
  normalizeViewportState,
  type ViewportState,
} from "./viewport-modes";

/**
 * The browser's room id, minted once per session. Kept at module scope so every
 * render observes the same value without regenerating it.
 */
let clientRoomIdCache: string | null = null;
function readClientRoomId(): string {
  if (clientRoomIdCache === null) {
    clientRoomIdCache = sharedRoomIdFromSearch(window.location.search)
      ?? roomIdForProject(loadLocalProject()?.roomId);
  }
  return clientRoomIdCache;
}
/** The server has no storage and no randomness it can share, so it has no room. */
function readServerRoomId(): string {
  return "";
}
/**
 * Sculpts are read from local storage, which the server cannot see. Letting the
 * useState initializer read them would make the server render the empty state
 * while the client renders a list — a different element, which is a hard
 * hydration failure rather than a tolerated text mismatch.
 */
let clientMeshFeaturesCache: MeshFeature[] | null = null;
function readClientMeshFeatures(): MeshFeature[] {
  if (clientMeshFeaturesCache === null) clientMeshFeaturesCache = loadLocalProject()?.meshFeatures ?? [];
  return clientMeshFeaturesCache;
}
const EMPTY_MESH_FEATURES: MeshFeature[] = [];
function readServerMeshFeatures(): MeshFeature[] {
  return EMPTY_MESH_FEATURES;
}

/** The value never changes after it is minted, so there is nothing to subscribe to. */
function subscribeToClientRoomId(): () => void {
  return () => {};
}

import { deleteProjectAsset, formatProjectAssetBytes, listProjectAssets, projectAssetUrl, uploadProjectAsset, type ProjectAsset } from "./project-assets";
import { createGarmentTemplate, parseGarment, serializeGarment, type GarmentProject } from "./fabric-engine";
import {
  createFormProject,
  FORM_CAD_WORKSPACE_SCHEMA,
  FORM_FABRIC_WORKSPACE_SCHEMA,
  formWorkspace,
  parseProjectIfContainer,
  serializeProject,
  updateFormWorkspace,
  type FormProject,
} from "./project-format";
import { garmentAnimationLink } from "./garment-update";
import { linkedDocumentImpact, reviewLinkedAnimation } from "./linked-update-review";
import { garmentSourceRevision } from "./garment-source-revision";
import { previewMeshCommand, meshPreviewCurrent, type MeshCommandPreview } from "./mesh-command-preview";
import CadProductCenter, { type ProductCenterTab } from "./cad-product-center";
import {
  DEFAULT_SHORTCUTS,
  shortcutMatches,
  validateShortcutMap,
  type ShortcutMap,
  type StarterTemplate,
} from "./product-polish";
import { checkDesktopUpdate, desktopUpdaterEnabled, installDesktopUpdate, type DesktopUpdateInfo } from "./app-updater";
import { analyzeCadDesign, createManufacturingReport } from "./cad-analysis";
import { INTERCHANGE_CAPABILITIES, createInterchangeManifest, interchangeSupport } from "./interchange-contract";
import {
  DEFAULT_CAD_APPEARANCE,
  CAD_ENVIRONMENTS,
  normalizeCadAppearance,
  renderMaterialFromAppearance,
  type CadAppearance,
} from "./cad-appearance";
import { NATIVE_SOFT_BODY_PRESETS, applyNativeSimulationToImportedBodies, cancelNativeJob, canUseNativeCad, clearNativeCache, detectNativeEngine, detectNativeGpu, exportNativeDiagnostics, listNativeJobs, nativeBodiesFromMetrics, nativeSoftBodyFromMetrics, prepareNativeAssemblySimulation, recordNativeFrontendError, runNativeCadExport, runNativeCadRebuild, runNativeGpuPreview, runNativeSceneSimulation, runNativeSoftBodySimulation, WEB_ENGINE_INFO, type NativeEngineInfo, type NativeGpuInfo, type NativeGpuPathTraceResult, type NativeGpuPreviewResult, type NativeJobRecord, type NativeSimulationResult, type NativeSoftBodyPreset, type NativeSoftBodyResult } from "./native-engine";
import { renderNativeAuthoredScene } from "./native-render-scene";
import { applyCadConfiguration, captureCadConfiguration, type CadConfiguration } from "./cad-configurations";
import { runProductionCadBenchmark, type ProductionCadBenchmarkReport } from "./cad-production-corpus";
import {
  createBomRows,
  describeExactBounds,
  importExactBody,
  runExactScene,
  type ExactExportFormat,
  type ExactAssemblyCheck,
  type ExactBodyMetric,
  type ExactImportedBody,
  type ExactSceneMesh,
  type ExactScenePath,
  type ExactSceneProfile,
  type ExactSolidAudit,
  type ExactTopologyRef,
} from "./cad-kernel";

import { exactResultFailure } from "./cad-result-acceptance";
import { requestDocumentPrint, withDocumentPrintSheet } from "./document-print";

const FabricStudio = React.lazy(() => import("./fabric-studio"));

type Tool = "select" | "pen" | "pencil" | "line" | "rectangle" | "circle" | "polygon" | "offset" | "measure";
type View = "sketch" | "model" | "drawing";
type ModelToolCategory = "select" | "create" | "sketch" | "modify" | "measure" | "sculpt" | "paint";
type EmbeddedSketchSession = {
  planeId: string;
  planeName: string;
  sourceEntityId?: string;
  entityIdsBefore: string[];
  entitiesBefore: Entity[];
  constraintsBefore: GeometricConstraint[];
};
type CompletedSketchRegion = {
  profileId: string;
  sourceEntityId?: string;
  planeName: string;
};
type ExactRebuildFailure = {
  message: string;
  featureId?: string;
};
type ToolShelfState = { open: boolean; pinned: boolean };
type Layer = { id: string; name: string; color: string; visible: boolean; locked: boolean };
type DesignCopilotPreview = {
  command: string;
  summary: string;
  actions: string[];
  plan:
    | { kind: "exact"; value: IntentModelPlan }
    | { kind: "garment"; value: GarmentIntentPlan }
    | { kind: "linked"; value: LinkSystemSpec }
    | { kind: "jewelry"; value: JewelrySpec }
    | { kind: "domain"; value: { kind: DomainRecipeKind; parameters: Partial<DomainParameters> } }
    | { kind: "hardware"; value: { kind: HardwareKind; parameters: Partial<HardwareParameters> } }
    | { kind: "modifier"; value: SmartModifierCommand }
    | { kind: "lock"; value: SmartLockCommand }
    | { kind: "smart-action"; value: { actionId: "exact.creative-copy" } };
};
type CadParameter = { id: string; name: string; expression: string; value: number };
type CadComponent = {
  id: string;
  name: string;
  entities: Entity[];
  features?: Feature[];
  hardware?: {
    kind: HardwareKind;
    mode: HardwareMode;
    matePoints: Array<{ name: string; position: Triple; axis: Triple }>;
    physics: { collider: "box" | "cylinder" | "compound"; joint: "fixed" | "hinge" | "chain" };
  };
  domain?: DomainMetadata;
  jewelry?: JewelryMetadata;
  engineering?: ProPlan["engineering"];
  linked?: { groupId: string; role: "master" };
};
type CadProjectData = {
  drawingBook: DrawingBook;
  paintTexture?: PaintTextureArchive;
  version: number;
  roomId: string;
  meshFeatures: MeshFeature[];
  sceneNodes: SceneNode[];
  animation: AnimationState;
  geometryGraph: GeometryGraph;
  materialGraph: MaterialGraph;
  viewport: ViewportState;
  canonicalUnits: "mm";
  displayUnits: CadUnit;
  entities: Entity[];
  features: Feature[];
  layers: Layer[];
  geometricConstraints: GeometricConstraint[];
  parameters: CadParameter[];
  gdt: GdtAnnotation[];
  components: CadComponent[];
  assemblyInstances: AssemblyInstance[];
  assemblyMates: AssemblyMate[];
  linkedGroups: LinkedGroup[];
  importedBodies: ExactImportedBody[];
  volumes: RenderVolume[];
  drafting: CadDraftingDocument;
  sketchPlanes: SketchPlane[];
  rollbackIndex: number;
  material: string;
  density: number;
  drawingScale: string;
  drawingRevision: string;
  configurations: CadConfiguration[];
  activeConfigurationId: string | null;
  bimNodes: BimNode[];
  recipeGraphs: RecipeGraph[];
  revisions: ProjectRevision[];
  marketplace: MarketplaceItem[];
  appearance: CadAppearance;
  kernel: "Open CASCADE B-Rep";
};
type CadSnapshot = {
  embeddedGarment?: GarmentProject;
  drawingBook: DrawingBook;
  drawingScale: string;
  drawingRevision: string;
  units: CadUnit;
  geometryGraph: GeometryGraph;
  materialGraph: MaterialGraph;
  animation: AnimationState;
  texture: { pixels: Uint8ClampedArray; size: number; revision: number } | null;
  sculptUnwrap: { meshId: string; unwrap: UvUnwrap } | null;
  meshFeatures: MeshFeature[];
  sceneNodes: SceneNode[];
  entities: Entity[];
  features: Feature[];
  geometricConstraints: GeometricConstraint[];
  parameters: CadParameter[];
  gdt: GdtAnnotation[];
  components: CadComponent[];
  assemblyInstances: AssemblyInstance[];
  assemblyMates: AssemblyMate[];
  linkedGroups: LinkedGroup[];
  importedBodies: ExactImportedBody[];
  drafting: CadDraftingDocument;
  configurations: CadConfiguration[];
  activeConfigurationId: string | null;
  rollbackIndex: number;
  appearance: CadAppearance;
};

const snapshotPayloads = new WeakMap<CadSnapshot, string>();
const sheetIndependentPayloads = new WeakMap<CadSnapshot, string>();
function sheetIndependentPayload(snapshot: CadSnapshot): string {
  let payload = sheetIndependentPayloads.get(snapshot);
  if (payload === undefined) {
    payload = historyJson({ ...snapshot, texture: null, drawingBook: undefined, drawingScale: undefined, drawingRevision: undefined });
    sheetIndependentPayloads.set(snapshot, payload);
  }
  return payload;
}
function snapshotPayload(snapshot: CadSnapshot): string {
  let payload = snapshotPayloads.get(snapshot);
  if (payload === undefined) {
    payload = historyJson({ ...snapshot, texture: null });
    snapshotPayloads.set(snapshot, payload);
  }
  return payload;
}
const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function modifierFromSmartCommand(command: SmartModifierCommand, modifierId: string): CreativeMeshModifier {
  const locks = { preserveVolume: command.preserveVolume, anchorStart: command.anchorStart };
  switch (command.modifier) {
    case "bend": {
      const base = defaultModifier("bend", modifierId) as Extract<CreativeMeshModifier, { kind: "bend" }>;
      return { ...base, axis: command.axis, locks, angle: command.value ?? base.angle };
    }
    case "twist": {
      const base = defaultModifier("twist", modifierId) as Extract<CreativeMeshModifier, { kind: "twist" }>;
      return { ...base, axis: command.axis, locks, angle: command.value ?? base.angle };
    }
    case "taper": {
      const base = defaultModifier("taper", modifierId) as Extract<CreativeMeshModifier, { kind: "taper" }>;
      return { ...base, axis: command.axis, locks, amount: command.value ?? base.amount };
    }
    case "bulge": {
      const base = defaultModifier("bulge", modifierId) as Extract<CreativeMeshModifier, { kind: "bulge" }>;
      return { ...base, axis: command.axis, locks, amount: command.value ?? base.amount };
    }
    case "displace": {
      const base = defaultModifier("displace", modifierId) as Extract<CreativeMeshModifier, { kind: "displace" }>;
      return { ...base, axis: command.axis, locks, amount: command.value ?? base.amount };
    }
  }
}
const length = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const fmt = (value: number, precision: number) => value.toFixed(precision);
const starterEntities: Entity[] = [
  { id: "base-profile", type: "rectangle", a: { x: -40, y: -25 }, b: { x: 40, y: 25 }, rotation: 0, layer: "model", constraints: ["Horizontal", "Vertical", "80.00 mm", "50.00 mm"] },
  { id: "mount-hole", type: "circle", a: { x: 0, y: 0 }, b: { x: 8, y: 0 }, rotation: 0, layer: "holes", constraints: ["Concentric", "Ø16.00 mm"] },
];

function rotatePoint(point: Point, origin: Point, degrees: number) {
  const radians = degrees * Math.PI / 180;
  const x = point.x - origin.x;
  const y = point.y - origin.y;
  return {
    x: origin.x + x * Math.cos(radians) - y * Math.sin(radians),
    y: origin.y + x * Math.sin(radians) + y * Math.cos(radians),
  };
}

function rectangleCorners(entity: Entity) {
  const corners = [
    entity.a,
    { x: entity.b.x, y: entity.a.y },
    entity.b,
    { x: entity.a.x, y: entity.b.y },
  ];
  return corners.map((point) => rotatePoint(point, entity.a, entity.rotation ?? 0));
}

function entityAngle(entity: Entity) {
  if (entity.type === "line") {
    return Math.atan2(entity.b.y - entity.a.y, entity.b.x - entity.a.x) * 180 / Math.PI;
  }
  return entity.rotation ?? 0;
}

type HandleKind =
  | { type: "move" }
  | { type: "endpoint"; which: "a" | "b" }
  | { type: "corner"; which: "a" | "b" | "ab" | "ba" }
  | { type: "radius" };

type HandleSpec = { kind: HandleKind; world: Point };

function handlesFor(entity: Entity): HandleSpec[] {
  if (entity.type === "line") {
    return [
      { kind: { type: "endpoint", which: "a" }, world: entity.a },
      { kind: { type: "endpoint", which: "b" }, world: entity.b },
      { kind: { type: "move" }, world: { x: (entity.a.x + entity.b.x) / 2, y: (entity.a.y + entity.b.y) / 2 } },
    ];
  }
  if (entity.type === "rectangle") {
    const move = { x: (entity.a.x + entity.b.x) / 2, y: (entity.a.y + entity.b.y) / 2 };
    if ((entity.rotation ?? 0) !== 0) return [{ kind: { type: "move" }, world: move }];
    return [
      { kind: { type: "corner", which: "a" }, world: entity.a },
      { kind: { type: "corner", which: "ab" }, world: { x: entity.b.x, y: entity.a.y } },
      { kind: { type: "corner", which: "b" }, world: entity.b },
      { kind: { type: "corner", which: "ba" }, world: { x: entity.a.x, y: entity.b.y } },
      { kind: { type: "move" }, world: move },
    ];
  }
  return [
    { kind: { type: "radius" }, world: entity.b },
    { kind: { type: "move" }, world: entity.a },
  ];
}

function applyHandleDrag(snapshot: Entity, handle: HandleKind, grabWorld: Point, currentWorld: Point): Entity {
  if (handle.type === "move") {
    const dx = currentWorld.x - grabWorld.x;
    const dy = currentWorld.y - grabWorld.y;
    return { ...snapshot, a: { x: snapshot.a.x + dx, y: snapshot.a.y + dy }, b: { x: snapshot.b.x + dx, y: snapshot.b.y + dy } };
  }
  if (snapshot.type === "line" && handle.type === "endpoint") {
    return handle.which === "a" ? { ...snapshot, a: currentWorld } : { ...snapshot, b: currentWorld };
  }
  if (snapshot.type === "rectangle" && handle.type === "corner") {
    if (handle.which === "a") return { ...snapshot, a: currentWorld };
    if (handle.which === "b") return { ...snapshot, b: currentWorld };
    if (handle.which === "ab") return { ...snapshot, a: { x: snapshot.a.x, y: currentWorld.y }, b: { x: currentWorld.x, y: snapshot.b.y } };
    return { ...snapshot, a: { x: currentWorld.x, y: snapshot.a.y }, b: { x: snapshot.b.x, y: currentWorld.y } };
  }
  if (snapshot.type === "circle" && handle.type === "radius") {
    return { ...snapshot, b: currentWorld };
  }
  return snapshot;
}

function handleReadout(entity: Entity, handle: HandleKind, units: CadUnit, precision: number): string {
  if (handle.type === "move") {
    return `X ${fmt(fromMillimeters(entity.a.x, units), precision)} · Y ${fmt(fromMillimeters(entity.a.y, units), precision)} ${units}`;
  }
  if (entity.type === "line") return `${formatCadLength(length(entity.a, entity.b), units, precision)} · ${fmt(entityAngle(entity), precision)}°`;
  if (entity.type === "circle") return `Ø${formatCadLength(length(entity.a, entity.b) * 2, units, precision)}`;
  return `${formatCadLength(Math.abs(entity.b.x - entity.a.x), units, precision)} × ${formatCadLength(Math.abs(entity.b.y - entity.a.y), units, precision)}`;
}

function handlePrimary(entity: Entity, handle: HandleKind, units: CadUnit, precision: number): string {
  if (handle.type === "move") {
    return `${fmt(fromMillimeters(entity.a.x, units), precision)}, ${fmt(fromMillimeters(entity.a.y, units), precision)}`;
  }
  if (entity.type === "line") return fmt(fromMillimeters(length(entity.a, entity.b), units), precision);
  if (entity.type === "circle") return fmt(fromMillimeters(length(entity.a, entity.b) * 2, units), precision);
  return `${fmt(fromMillimeters(Math.abs(entity.b.x - entity.a.x), units), precision)} x ${fmt(fromMillimeters(Math.abs(entity.b.y - entity.a.y), units), precision)}`;
}

type ActiveEdit = {
  entityId: string;
  handle: HandleKind;
  originalSnapshot: Entity;
  grabWorld: Point;
  screenX: number;
  screenY: number;
  phase: "dragging" | "editing";
  buffer: string;
};


function pathRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, Math.min(Math.abs(w), Math.abs(h)) / 2));
  const sw = w < 0 ? -1 : 1;
  const sh = h < 0 ? -1 : 1;
  const aw = Math.abs(w);
  const ah = Math.abs(h);
  const left = w < 0 ? x + w : x;
  const top = h < 0 ? y + h : y;
  const right = left + aw;
  const bottom = top + ah;
  ctx.moveTo(left + radius, top);
  ctx.lineTo(right - radius, top);
  ctx.quadraticCurveTo(right, top, right, top + radius);
  ctx.lineTo(right, bottom - radius);
  ctx.quadraticCurveTo(right, bottom, right - radius, bottom);
  ctx.lineTo(left + radius, bottom);
  ctx.quadraticCurveTo(left, bottom, left, bottom - radius);
  ctx.lineTo(left, top + radius);
  ctx.quadraticCurveTo(left, top, left + radius, top);
  void sw; void sh;
}


/**
 * What to write into a STEP header.
 *
 * The author is deliberately the tool rather than a person: we have an account
 * email, but a file handed to a supplier is not the place to leak it without
 * being asked.
 */
function stepMetadataFor(name: string): StepMetadata {
  return {
    name,
    author: "Form Studio",
    organisation: "Form Studio",
    description: `${name} — exact B-Rep from a subdivision cage`,
  };
}

function download(data: BlobPart, name: string, type: string) {
  offerLocker(data, name, type);
  const url = URL.createObjectURL(new Blob([data], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 800);
}

function loadLocalProject() {
  if (typeof window === "undefined") return null;
  try {
    const contents = localStorage.getItem("form-cad-project");
    if (!contents) return null;
    return parseCadProject<Partial<CadProjectData> & { units?: CadUnit }>(contents);
  } catch {
    localStorage.removeItem("form-cad-project");
    return null;
  }
}

function validateProjectVolumes(value: unknown): RenderVolume[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 32) throw new Error("Project sparse-volume collection is invalid");
  return value.map((candidate, index) => {
    if (!candidate || typeof candidate !== "object") throw new Error(`Sparse volume ${index + 1} is invalid`);
    const volume = candidate as RenderVolume;
    if (!Number.isFinite(volume.densityScale) || volume.densityScale < 0 || volume.densityScale > 100) {
      throw new Error(`Sparse volume ${index + 1} has an invalid density scale`);
    }
    if (!Array.isArray(volume.scatteringColor) || volume.scatteringColor.length !== 3
      || volume.scatteringColor.some((channel) => !Number.isFinite(channel) || channel < 0 || channel > 1)) {
      throw new Error(`Sparse volume ${index + 1} has an invalid scattering color`);
    }
    if (volume.emissionStrength !== undefined && (!Number.isFinite(volume.emissionStrength) || volume.emissionStrength < 0 || volume.emissionStrength > 100)) {
      throw new Error(`Sparse volume ${index + 1} has invalid emission strength`);
    }
    if (volume.maxTemperature !== undefined && (!Number.isFinite(volume.maxTemperature) || volume.maxTemperature < 800 || volume.maxTemperature > 12_000)) {
      throw new Error(`Sparse volume ${index + 1} has invalid display temperature`);
    }
    prepareSparseDensityGrid(volume.grid);
    return volume;
  });
}

function safeLocalVolumes(value: unknown) {
  try { return validateProjectVolumes(value); } catch { return []; }
}

export default function CadWorkspace({
  onClose,
  onOpenRigLab,
  initialView = "sketch",
  initialProjectContents,
  initialProjectPath = null,
  initialProjectDirty = false,
  saveSession,
}: {
  onClose?: () => void;
  onOpenRigLab?: (project: { contents: string; path: string | null; dirty: boolean; models?: AnimationModelSnapshot[] }) => void;
  initialView?: View;
  initialProjectContents?: string;
  initialProjectPath?: string | null;
  initialProjectDirty?: boolean;
  saveSession?: ProjectSaveSession;
}) {
  const workspaceUi = useWorkspaceLayout("cad", {
    toolsCollapsed: false,
    inspectorCollapsed: false,
    timelineCollapsed: true,
    inspectorSize: 370,
    timelineSize: 176,
  });
  const documentUi = useWorkspaceLayout("document", { toolsCollapsed: false, inspectorCollapsed: false, timelineCollapsed: true, inspectorSize: 320, timelineSize: 176 }, false);
  const { compact, viewport: compactViewport } = useCompactWorkspace();
  const [phoneInspectorOpen, setPhoneInspectorOpen] = useState(false);
  const inspectorCollapsed = compact ? !phoneInspectorOpen : workspaceUi.layout.inspectorCollapsed;
  const setInspectorCollapsed = (collapsed: boolean) => compact
    ? setPhoneInspectorOpen(!collapsed)
    : workspaceUi.update("inspectorCollapsed", collapsed);
  const visibleLayout = { ...workspaceUi.layout, inspectorCollapsed, toolsCollapsed: compact ? false : workspaceUi.layout.toolsCollapsed };
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [objectMenu, setObjectMenu] = useState<ObjectMenuAnchor | null>(null);
  const contextTap = useRef(new ContextTapGesture());
  const [sketchCanvasExtent, setSketchCanvasExtent] = useState("");
  const viewportHandleRef = useRef<CadViewportHandle | null>(null);
  const exactImportRef = useRef<HTMLInputElement>(null);
  const projectImportRef = useRef<HTMLInputElement>(null);
  const assetImportRef = useRef<HTMLInputElement>(null);
  const svgImportRef = useRef<HTMLInputElement>(null);
  const dxfImportRef = useRef<HTMLInputElement>(null);
  const ifcImportRef = useRef<HTMLInputElement>(null);
  const rasterImportRef = useRef<HTMLInputElement>(null);
  const [imageModelImport, setImageModelImport] = useState<{ file?: File } | null>(null);
  const [castSources, setCastSources] = useState<CastSource[] | null>(null);
  const extensionImportRef = useRef<HTMLInputElement>(null);
  const volumeImportRef = useRef<HTMLInputElement>(null);
  const exactBuildTokenRef = useRef(0);
  const exactWorkerRef = useRef<Worker | null>(null);
  const nativeDrawingRef = useRef<{ token: number; result: Awaited<ReturnType<typeof runNativeCadRebuild>> } | null>(null);
  const currentExactSignatureRef = useRef("");
  const [tool, setTool] = useState<Tool>("select");
  const [toolShelf, setToolShelf] = useState<ToolShelfState>({ open: false, pinned: false });
  const toolShelfRef = useRef<ToolShelfState>({ open: false, pinned: false });
  const spaceGestureRef = useRef<{ closing: boolean; held: boolean } | null>(null);
  const [toolShelfAmount, setToolShelfAmount] = useState(10);
  const [directEditAmount, setDirectEditAmount] = useState(3);
  const [directFinishKind, setDirectFinishKind] = useState<"Fillet" | "Chamfer">("Fillet");
  const [directEditLive, setDirectEditLive] = useState<ExactDirectEdit | null>(null);
  const [view, setView] = useState<View>(initialView);
  const [documentPanel, setDocumentPanel] = useState<DocumentPanel>("sheet");
  const [documentLinkOpen, setDocumentLinkOpen] = useState(false);
  const [entities, setEntities] = useState<Entity[]>(() => loadLocalProject()?.entities?.length ? loadLocalProject()!.entities! : starterEntities);
  const [selectedId, setSelectedId] = useState("base-profile");
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>(["base-profile"]);
  const [draft, setDraft] = useState<{ start: Point; current: Point } | null>(null);
  const [freehandDraft, setFreehandDraft] = useState<SketchSample[] | null>(null);
  const [vectorWidthMm, setVectorWidthMm] = useState(200);
  const [traceContrast, setTraceContrast] = useState(42);
  const [quickExtrudeDepth, setQuickExtrudeDepth] = useState(24);
  const [lastTracedSvg, setLastTracedSvg] = useState<{ name: string; contents: string } | null>(null);
  const [cursor, setCursor] = useState<Point>({ x: 0, y: 0 });
  const [sketchInference, setSketchInference] = useState<SketchInference | null>(null);
  const [snap, setSnap] = useState(true);
  const [ortho, setOrtho] = useState(true);
  const [grid, setGrid] = useState(5);
  const [zoom, setZoom] = useState(4.2);
  const [sketchCenter, setSketchCenter] = useState<Point>({ x: 0, y: 0 });
  const [touchPan, setTouchPan] = useState(false);
  const touchPanPoints = useRef(new Map<number, Point>());
  const touchPanView = useRef({ zoom: 4.2, center: { x: 0, y: 0 } });
  const [sketchSelectionMode, setSketchSelectionMode] = useState<"object" | "segment">("object");
  const [sketchAdvanced, setSketchAdvanced] = useState(false);
  const [sketchDrag, setSketchDrag] = useState<{ ids: string[]; start: Point; dx: number; dy: number } | null>(null);
  const [precision, setPrecision] = useState(2);
  const [units, setUnits] = useState<CadUnit>(() => loadLocalProject()?.displayUnits ?? "mm");
  const [command, setCommand] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [copilotPreview, setCopilotPreview] = useState<DesignCopilotPreview | null>(null);
  const [hardwareKind, setHardwareKind] = useState<HardwareKind>("screw");
  const [hardwareParameters, setHardwareParameters] = useState<HardwareParameters>(() => hardwareDefaults("screw"));
  const [hardwareMode, setHardwareMode] = useState<HardwareMode>("manufacturing");
  const [hardwareMountCut, setHardwareMountCut] = useState(true);
  const [designDiscipline, setDesignDiscipline] = useState<DesignDiscipline>("engineering");
  const [domainRecipeKind, setDomainRecipeKind] = useState<DomainRecipeKind>("bracket");
  const [domainParameters, setDomainParameters] = useState<DomainParameters>(() => domainDefaults("bracket"));
  const [jewelrySpec, setJewelrySpec] = useState<JewelrySpec>(() => structuredClone(DEFAULT_JEWELRY_SPEC));
  const [proTab, setProTab] = useState<"engineering" | "architecture" | "recipe" | "collaboration" | "performance">("engineering");
  const [engineeringSpec, setEngineeringSpec] = useState<EngineeringProSpec>(() => structuredClone(DEFAULT_ENGINEERING_SPEC));
  const [advancedMateKind, setAdvancedMateKind] = useState<"gear" | "rack-pinion" | "screw" | "cam" | "path">("gear");
  const [motionDriver, setMotionDriver] = useState(90);
  const [recipeGraphs, setRecipeGraphs] = useState<RecipeGraph[]>(() => loadLocalProject()?.recipeGraphs ?? [structuredClone(STARTER_RECIPE_GRAPH)]);
  const [activeRecipeId, setActiveRecipeId] = useState(() => loadLocalProject()?.recipeGraphs?.[0]?.id ?? STARTER_RECIPE_GRAPH.id);
  const [revisions, setRevisions] = useState<ProjectRevision[]>(() => loadLocalProject()?.revisions ?? []);
  const [activeBranch, setActiveBranch] = useState("main");
  const [revisionMessage, setRevisionMessage] = useState("Update intelligent model");
  const [marketplace, setMarketplace] = useState<MarketplaceItem[]>(() => loadLocalProject()?.marketplace ?? structuredClone(DEFAULT_MARKETPLACE));
  const [geometricConstraints, setGeometricConstraints] = useState<GeometricConstraint[]>(() => loadLocalProject()?.geometricConstraints ?? []);
  const [constraintReference, setConstraintReference] = useState<string | null>(null);
  const [parameters, setParameters] = useState<CadParameter[]>(() => loadLocalProject()?.parameters ?? [
    { id: "parameter-width", name: "width", expression: "24 in", value: 609.6 },
    { id: "parameter-wall", name: "wall", expression: "0.125 in", value: 3.175 },
  ]);
  const [configurations, setConfigurations] = useState<CadConfiguration[]>(() => loadLocalProject()?.configurations ?? []);
  const [activeConfigurationId, setActiveConfigurationId] = useState<string | null>(() => loadLocalProject()?.activeConfigurationId ?? null);
  const [parameterName, setParameterName] = useState("clearance");
  const [parameterExpression, setParameterExpression] = useState("wall * 2");
  const [gdt, setGdt] = useState<GdtAnnotation[]>(() => loadLocalProject()?.gdt ?? []);
  const [gdtSymbol, setGdtSymbol] = useState("Position");
  const [gdtTolerance, setGdtTolerance] = useState("0.05 mm");
  const [gdtDatum, setGdtDatum] = useState("A");
  const [gdtMaterialCondition, setGdtMaterialCondition] = useState<GdtMaterialCondition>("RFS");
  const [components, setComponents] = useState<CadComponent[]>(() => loadLocalProject()?.components ?? []);
  const [bimNodes, setBimNodes] = useState<BimNode[]>(() => loadLocalProject()?.bimNodes ?? []);
  const [selectedBimNodeId, setSelectedBimNodeId] = useState<string | null>(null);
  const [selectedBimDocumentId, setSelectedBimDocumentId] = useState<string | null>(null);
  const [assemblyInstances, setAssemblyInstances] = useState<AssemblyInstance[]>(() => loadLocalProject()?.assemblyInstances ?? []);
  const [assemblyMates, setAssemblyMates] = useState<AssemblyMate[]>(() => loadLocalProject()?.assemblyMates ?? []);
  const [linkedGroups, setLinkedGroups] = useState<LinkedGroup[]>(() => loadLocalProject()?.linkedGroups ?? []);
  const [linkSpec, setLinkSpec] = useState<LinkSystemSpec>(() => structuredClone(loadLocalProject()?.linkedGroups?.[0]?.spec ?? DEFAULT_LINK_SYSTEM_SPEC));
  const [activeLinkedGroupId, setActiveLinkedGroupId] = useState<string | null>(() => loadLocalProject()?.linkedGroups?.[0]?.id ?? null);
  const [assemblyMateKind, setAssemblyMateKind] = useState<AssemblyMateKind>("coincident");
  const [assemblyMateValue, setAssemblyMateValue] = useState(0);
  const [assemblyMateAxis, setAssemblyMateAxis] = useState<"x" | "y" | "z">("z");
  const [assemblyMateFirstId, setAssemblyMateFirstId] = useState("");
  const [assemblyMateSecondId, setAssemblyMateSecondId] = useState("");
  const [importedBodies, setImportedBodies] = useState<ExactImportedBody[]>(() => loadLocalProject()?.importedBodies ?? []);
  const [volumes, setVolumes] = useState<RenderVolume[]>(() => safeLocalVolumes(loadLocalProject()?.volumes));
  const [drafting, setDrafting] = useState<CadDraftingDocument>(() => loadLocalProject()?.drafting ?? createCadDraftingDocument());
  const [volumeImportBusy, setVolumeImportBusy] = useState(false);
  const [kernelStatus, setKernelStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [kernelAudit, setKernelAudit] = useState<ExactSolidAudit | null>(null);
  const [validatedExactSignature, setValidatedExactSignature] = useState<string | null>(null);
  const [exactMeshes, setExactMeshes] = useState<ExactSceneMesh[]>([]);
  const [exactTopology, setExactTopology] = useState<ExactTopologyRef[]>([]);
  const [exactBodyMetrics, setExactBodyMetrics] = useState<ExactBodyMetric[]>([]);
  const [exactAssemblyChecks, setExactAssemblyChecks] = useState<ExactAssemblyCheck[]>([]);
  const [exactDrawingSvg, setExactDrawingSvg] = useState("");
  const [exactSectionSvg, setExactSectionSvg] = useState("");
  const [exactDrawingBounds, setExactDrawingBounds] = useState<Parameters<typeof buildProductionDrawingSheet>[0]["bounds"] | null>(null);
  const [exactDrawingSignature, setExactDrawingSignature] = useState("");
  const [exactBuildState, setExactBuildState] = useState<"idle" | "building" | "ready" | "error">("idle");
  const [exactRebuildFailure, setExactRebuildFailure] = useState<ExactRebuildFailure | null>(null);
  const [nativeEngine, setNativeEngine] = useState<NativeEngineInfo>(WEB_ENGINE_INFO);
  const [nativeGpu, setNativeGpu] = useState<NativeGpuInfo | null>(null);
  const [nativeJobs, setNativeJobs] = useState<NativeJobRecord[]>([]);
  const [nativeSimulation, setNativeSimulation] = useState<NativeSimulationResult | null>(null);
  const [nativeSimulationApplied, setNativeSimulationApplied] = useState(false);
  const [nativeSoftBodyResult, setNativeSoftBodyResult] = useState<NativeSoftBodyResult | null>(null);
  const [nativeSoftBodyPreset, setNativeSoftBodyPreset] = useState<NativeSoftBodyPreset>("rubber");
  const [nativeSoftBodyResolution, setNativeSoftBodyResolution] = useState(3);
  const [productionCadReport, setProductionCadReport] = useState<ProductionCadBenchmarkReport | null>(null);
  const [productionCadBusy, setProductionCadBusy] = useState(false);
  const [nativeComputeBusy, setNativeComputeBusy] = useState(false);
  const [nativePreviewBusy, setNativePreviewBusy] = useState(false);
  const [nativePreviewUrl, setNativePreviewUrl] = useState<string | null>(null);
  const [nativePreview, setNativePreview] = useState<NativeGpuPreviewResult | NativeGpuPathTraceResult | null>(null);
  const [explodedAssembly, setExplodedAssembly] = useState(false);
  const [drawingScale, setDrawingScale] = useState(() => loadLocalProject()?.drawingScale ?? "1:1");
  const [drawingRevision, setDrawingRevision] = useState(() => loadLocalProject()?.drawingRevision ?? "A");
  const [drawingBook, setDrawingBook] = useState<DrawingBook>(() => loadLocalProject()?.drawingBook ?? createDrawingBook());
  const [selectedSheetView, setSelectedSheetView] = useState<SheetView>("Front");
  const [sheetPlacement, setSheetPlacement] = useState<SheetPlacement>("select");
  const [documentSelection, setDocumentSelection] = useState<{ sheet: string; value: DocumentSelection }>({ sheet: "production", value: null });
  const [documentEdges, setDocumentEdges] = useState<{ sheet: string; view: SheetView; ids: string[] }>({ sheet: "production", view: "Front", ids: [] });
  const [material, setMaterial] = useState(() => loadLocalProject()?.material ?? "Aluminum 6061");
  const [density, setDensity] = useState(() => loadLocalProject()?.density ?? 2.7);
  const [appearance, setAppearance] = useState<CadAppearance>(() => normalizeCadAppearance(loadLocalProject()?.appearance ?? DEFAULT_CAD_APPEARANCE));
  const [projectPath, setProjectPath] = useState<string | null>(null);
  /** What the project is called on screen and in anything it writes out. */
  const [projectTitle, setProjectTitle] = useState("Form Project");
  // Generated once per project and persisted; never derived from the title.
  // Room ids are random capabilities, so minting one during server rendering would
  // produce a different value than the client and trip React's hydration check.
  // useSyncExternalStore renders the server's empty value first, then swaps in the
  // client id, which is exactly the client-only-value case it exists for.
  const clientRoomId = useSyncExternalStore(subscribeToClientRoomId, readClientRoomId, readServerRoomId);
  const [adoptedRoomId, setAdoptedRoomId] = useState<string | null>(null);
  const roomId = adoptedRoomId ?? clientRoomId;
  const reviewSession = useRef<(() => void) | null>(null);
  const reviewDocument = useRef(`${roomId}:${view}`);
  useEffect(() => { reviewDocument.current = `${roomId}:${view}`; }, [roomId, view]);
  useEffect(() => () => { reviewSession.current?.(); }, []);

  const storedMeshFeatures = useSyncExternalStore(subscribeToClientRoomId, readClientMeshFeatures, readServerMeshFeatures);
  const [editedMeshFeatures, setEditedMeshFeatures] = useState<MeshFeature[] | null>(null);
  const meshFeatures = editedMeshFeatures ?? storedMeshFeatures;
  const setMeshFeatures = useCallback((update: MeshFeature[] | ((current: MeshFeature[]) => MeshFeature[])) => {
    setEditedMeshFeatures((current) => {
      const base = current ?? readClientMeshFeatures();
      return typeof update === "function" ? update(base) : update;
    });
  }, []);
  const [selectedMeshId, setSelectedMeshId] = useState<string | null>(null);
  const [animationReview, setAnimationReview] = useState<(AnimationModelSnapshot & { review: ReturnType<typeof reviewLinkedAnimation> })[] | null>(null);
  const [animationReviewMode, setAnimationReviewMode] = useState<"linked" | "independent" | "update">("linked");
  /**
   * What is picked on the selected sculpt. Modal, like a poly modeller's edit
   * mode: the same choice read as vertices, edges or faces. The faces are what
   * the viewport highlights and what an operation consumes, so they are pulled
   * out below rather than tracked separately.
   */
  const [meshSelection, setMeshSelection] = useState<MeshSelection>(EMPTY_SELECTION);
  const [selectionBrushEnabled, setSelectionBrushEnabled] = useState(false);
  const [selectionBrushSettings, setSelectionBrushSettings] = useState<SelectionBrush>(DEFAULT_SELECTION_BRUSH);
  const [paintedSelection, setPaintedSelection] = useState<{ meshId: string; topology: string; weights: number[] } | null>(null);
  const [selectionHudEnabled, setSelectionHudEnabled] = useState(true);
  const [regionRequest, setRegionRequest] = useState<{
    kind: "box" | "ellipse" | "lasso" | "polygon";
    combine: RegionMode;
    token: number;
    scope?: "mesh" | "body";
  } | null>(null);
  const selectedMeshFaces = meshSelection.faces;
  const clearMeshSelection = useCallback(() => {
    setMeshSelection((current) => selectNone(current.mode));
    setPaintedSelection(null);
  }, []);
  const [sculptExporting, setSculptExporting] = useState(false);
  /**
   * How far to subdivide before converting to exact patches. Three is a sound
   * default; the levels either side are the difference between a quick look and
   * a part someone will cut, so the choice is the user's.
   */
  const [sculptRefinements, setSculptRefinements] = useState(3);
  /**
   * The last unwrap, and which sculpt it belongs to. Derived rather than stored:
   * UVs follow from the surface and the seam angle, so keeping them in the
   * document would only create something to fall out of date.
   */
  const [sculptUnwrap, setSculptUnwrap] = useState<{ meshId: string; unwrap: UvUnwrap } | null>(() => {
    try { return restorePaintTexture(loadLocalProject()?.paintTexture)?.mapping ?? null; } catch { return null; }
  });
  /**
   * Where each sculpt sits, and what it belongs to. A transform is inherited, so
   * moving an assembly moves its parts without touching their own placement.
   */
  /**
   * The transform being dragged right now, before it is confirmed.
   *
   * Kept out of the document deliberately: a preview that wrote an edit per
   * pointer move would fill the undo stack with a hundred half-finished moves,
   * and Escape would have nothing to go back to.
   */
  const [modalPreview, setModalPreview] = useState<
    { value: TransformValue; pivot: Triple; vertices?: number[] } | null>(null);
  const [meshCommandPreview, setMeshCommandPreview] = useState<MeshCommandPreview | null>(null);
  useEffect(() => { if (view !== "model") { const timer = setTimeout(() => setMeshCommandPreview(null), 0); return () => clearTimeout(timer); } }, [view]);
  useEffect(() => {
    if (!meshCommandPreview) return;
    const cancel = (event: KeyboardEvent) => { if (event.key === "Escape") { setMeshCommandPreview(null); event.preventDefault(); } };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [meshCommandPreview]);
  /** The brush, when sculpt mode is on. Null means dragging orbits as usual. */
  const [sculptBrush, setSculptBrush] = useState<BrushSettings | null>(null);
  const [sculptSettings, setSculptSettings] = useState<BrushSettings>(DEFAULT_BRUSH);
  const [activeSculptLayerId, setActiveSculptLayerId] = useState<string | null>(null);
  const sculptLayerId = meshFeatures.find((feature) => feature.id === selectedMeshId)?.sculptLayers?.find((layer) => layer.id === activeSculptLayerId)?.id ?? null;
  /**
   * The stroke being drawn. Like the modal preview it stays out of the document
   * until the pointer lifts, so one stroke is one undo step rather than fifty.
   */
  const [strokePreview, setStrokePreview] = useState<StrokeSample[] | null>(null);

  /**
   * The geometry graph, and what it last evaluated to.
   *
   * Evaluation is asynchronous because booleans are, so the result is state
   * rather than a memo — a graph cannot be read synchronously during render.
   */
  const [geometryGraph, setGeometryGraph] = useState<GeometryGraph>(() => {
    // Normalizing something absent gives an *empty graph*, not null, so a
    // nullish fallback here would never fire and every new document would open
    // to a blank editor.
    const stored = normalizeGeometryGraph(loadLocalProject()?.geometryGraph);
    return stored.nodes.length > 0 ? stored : starterGraph();
  });
  const [graphResult, setGraphResult] = useState<{
    mesh: EditableMesh | null; problem: string | null; notes: string[];
  }>({ mesh: null, problem: null, notes: [] });

  const [materialGraph, setMaterialGraph] = useState<MaterialGraph>(() => {
    const stored = normalizeMaterialGraph(loadLocalProject()?.materialGraph);
    return stored.nodes.length > 0 ? stored : starterMaterial();
  });
  const [bakeSize, setBakeSize] = useState(256);
  /**
   * The texture, and a counter that changes whenever its pixels do.
   *
   * Painting writes into the buffer in place — copying megabytes per dab would
   * stutter — so the buffer's identity never changes and React would never see
   * an update. The revision is what tells it something happened.
   */
  const [texture, setTexture] = useState<
    { pixels: Uint8ClampedArray; size: number; revision: number } | null>(() => {
      try { return restorePaintTexture(loadLocalProject()?.paintTexture)?.texture ?? null; } catch { return null; }
    });
  const [painting, setPainting] = useState(false);
  const [paintContext, setPaintContext] = useState({ view, selectedMeshId });
  if (paintContext.view !== view || paintContext.selectedMeshId !== selectedMeshId) {
    // Pause before rendering a newly selected target, not a frame later in an effect.
    setPaintContext({ view, selectedMeshId });
    setPainting(false);
  }
  const paintTransaction = useRef<{ before: typeof texture; working: typeof texture; changed: boolean } | null>(null);
  const [paintCommit, setPaintCommit] = useState(0);
  const [paintColor, setPaintColor] = useState<Rgb>(DEFAULT_PAINT.color);
  const [paintRadius, setPaintRadius] = useState(DEFAULT_PAINT.radius);
  const [paintStrength, setPaintStrength] = useState(DEFAULT_PAINT.strength);
  const [paintSoften, setPaintSoften] = useState(false);

  const [renderSettings, setRenderSettings] = useState<RenderSettings>(DEFAULT_RENDER);
  const [renderAov, setRenderAov] = useState<Aov>("beauty");
  const [renderExposure, setRenderExposure] = useState(1);
  const [renderDenoise, setRenderDenoise] = useState(true);
  const [renderQueue, setRenderQueue] = useState<RenderQueue>(EMPTY_QUEUE);
  /**
   * The render in flight. Kept in a ref rather than state: it is written once
   * per pass and re-rendering the whole workspace at that rate would cost more
   * than the tracing.
   */
  const renderRef = useRef<{ jobId: string; scene: RenderScene; prepared: ReturnType<typeof prepareScene>; progress: RenderProgress } | null>(null);
  const [renderPreview, setRenderPreview] = useState<string | null>(null);
  const [storedSceneNodes, setSceneNodes] = useState<SceneNode[]>(
    () => normalizeSceneGraph(loadLocalProject()?.sceneNodes));

  /**
   * Every sculpt needs a node to be placed by. A document written before the
   * graph existed has none, and so would a sculpt added by any path that forgot
   * to make one, so the gap is filled here rather than defended against
   * everywhere downstream.
   */
  const sceneNodes = useMemo(() => {
    const known = new Set(storedSceneNodes.map((node) => node.id));
    const missing = meshFeatures
      .filter((feature) => !known.has(feature.id))
      .map((feature) => createNode(feature.id, feature.name, { kind: "sculpt", id: feature.id }));
    return missing.length === 0 ? storedSceneNodes : [...storedSceneNodes, ...missing];
  }, [meshFeatures, storedSceneNodes]);



  const [viewport, setViewport] = useState<ViewportState>(() => normalizeViewportState(loadLocalProject()?.viewport));
  const [sharedProjectPending, setSharedProjectPending] = useState(() => typeof window !== "undefined" && sharedRoomIdFromSearch(window.location.search) !== null);
  const sharedJoinAttemptedRef = useRef(false);
  const [recoveryContents, setRecoveryContents] = useState<string | null>(null);
  const [recoverySnapshots, setRecoverySnapshots] = useState<CadRecoverySnapshot[]>([]);
  const historyRef = useRef<{ entries: CadSnapshot[]; cursor: number; skip: boolean }>({
    entries: [],
    cursor: -1,
    skip: false,
  });
  const [historyControls, setHistoryControls] = useState({ canUndo: false, canRedo: false });
  const [activeLayer, setActiveLayer] = useState("model");
  const [layers, setLayers] = useState<Layer[]>(() => loadLocalProject()?.layers?.length ? loadLocalProject()!.layers! : [
      { id: "model", name: "Model", color: "#7f9165", visible: true, locked: false },
      { id: "holes", name: "Holes", color: "#67a8ff", visible: true, locked: false },
      { id: "construction", name: "Construction", color: "#e5a95d", visible: true, locked: false },
    ]);
  const [features, setFeatures] = useState<Feature[]>(() => loadLocalProject()?.features?.length ? loadLocalProject()!.features! : [
      { id: "extrude-1", type: "Extrude", value: 24, unit: "mm", enabled: true },
      {
        id: "fillet-1",
        type: "Fillet",
        value: 3,
        unit: "mm",
        enabled: true,
        sourceEntityIds: ["base-profile"],
        topologyIds: ["base-profile:edge:line-z-xmin-ymin-zmid"],
      },
      { id: "cut-1", type: "Cut", value: 0, unit: "mm", enabled: true, sourceEntityIds: ["base-profile", "mount-hole"] },
    ]);
  const [status, setStatus] = useState("Constraint solve pending");
  const [blenderOpen, setBlenderOpen] = useState(false);
  const [blenderBusy, setBlenderBusy] = useState(false);
  const suiteMenu = useSuiteKit("form");
  const sharedFeatures = useRef(features);
  useEffect(() => { sharedFeatures.current = features; }, [features]);

  const {
    animation,
    setAnimation,
    animationDocument,
    posedNodes,
    selectedActionCurves,
    editSelectedCurves,
    keySelectedTransform,
    assignSelectedAction,
    duplicateSelectedAction,
  } = useAnimation({
    sceneNodes,
    selectedMeshId,
    loadStored: () => loadLocalProject()?.animation,
    setStatus,
    id,
  });
  const [inspectorMode, setInspectorMode] = useState<"core" | "specialist">("core");
  const [inspectorExpanded, setInspectorExpanded] = useState(false);
  const [productCenterOpen, setProductCenterOpen] = useState(false);
  const projectMenuRef = useRef<HTMLDetailsElement>(null);
  const [productCenterTab, setProductCenterTab] = useState<ProductCenterTab>("start");
  const [shortcuts, setShortcuts] = useState<ShortcutMap>(() => {
    if (typeof window === "undefined") return { ...DEFAULT_SHORTCUTS };
    try { return validateShortcutMap(JSON.parse(localStorage.getItem("form-shortcuts-v1") ?? "null")); }
    catch { return { ...DEFAULT_SHORTCUTS }; }
  });
  const [desktopUpdate, setDesktopUpdate] = useState<{
    phase: "idle" | "checking" | "current" | "available" | "installing" | "error";
    info?: DesktopUpdateInfo;
    message?: string;
    downloaded?: number;
    total?: number;
  }>({ phase: "idle" });
  const initialSolverStatusRef = useRef(false);
  const [extensionRegistry, setExtensionRegistry] = useState<ExtensionRegistry>(() => createExtensionRegistry());
  const extensionRegistryHydrated = useRef(false);
  const [fabricOpen, setFabricOpen] = useState(false);
  const [fabricInitialProject, setFabricInitialProject] = useState<GarmentProject | undefined>(undefined);
  const [initialContainer] = useState(() => {
    try {
      const contents = initialProjectContents ?? (typeof window !== "undefined" ? localStorage.getItem("form-cad-project") : null);
      return contents ? parseProjectIfContainer(contents) : null;
    } catch { return null; }
  });
  const [embeddedGarment, setEmbeddedGarment] = useState<GarmentProject | undefined>(() => {
    try {
      const fabric = initialContainer ? formWorkspace<GarmentProject>(initialContainer, "fabric") : undefined;
      return fabric ? parseGarment(JSON.stringify(fabric.data)) : undefined;
    } catch { return undefined; }
  });
  const projectContainerRef = useRef<FormProject<unknown> | null>(initialContainer);

  useEffect(() => {
    try {
      if (localStorage.getItem("form-onboarding-v1") !== "complete") {
        const frame = requestAnimationFrame(() => {
          setProductCenterTab("start");
          setProductCenterOpen(true);
        });
        return () => cancelAnimationFrame(frame);
      }
    } catch {
      // Private browsing can disable persistent storage; onboarding still remains available from Start.
    }
  }, []);

  const closeProductCenter = useCallback(() => {
    setProductCenterOpen(false);
    try { localStorage.setItem("form-onboarding-v1", "complete"); } catch { /* local-only preference */ }
  }, []);

  const updateShortcuts = useCallback((next: ShortcutMap) => {
    const validated = validateShortcutMap(next);
    setShortcuts(validated);
    try { localStorage.setItem("form-shortcuts-v1", JSON.stringify(validated)); } catch { /* local-only preference */ }
  }, []);

  const checkForDesktopUpdate = useCallback(async (quiet = false) => {
    if (!desktopUpdaterEnabled()) return;
    if (!quiet) setDesktopUpdate({ phase: "checking" });
    try {
      const info = await checkDesktopUpdate();
      if (info) setDesktopUpdate({ phase: "available", info });
      else if (!quiet) setDesktopUpdate({ phase: "current", message: "Form Studio is up to date" });
    } catch (error) {
      if (!quiet) setDesktopUpdate({ phase: "error", message: error instanceof Error ? error.message : "Update check failed" });
    }
  }, []);

  useEffect(() => {
    if (!desktopUpdaterEnabled()) return;
    const timer = window.setTimeout(() => { void checkForDesktopUpdate(true); }, 12_000);
    return () => window.clearTimeout(timer);
  }, [checkForDesktopUpdate]);
  const [activeEdit, setActiveEdit] = useState<ActiveEdit | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [rollbackIndex, setRollbackIndex] = useState<number>(() => (loadLocalProject()?.features?.length ?? 3));
  const [sketchPlanes, setSketchPlanes] = useState<SketchPlane[]>(() => {
    const stored = (loadLocalProject() as { sketchPlanes?: SketchPlane[] } | null)?.sketchPlanes;
    return stored && stored.length ? stored : DEFAULT_PLANES;
  });
  const [activeSketchPlaneId, setActiveSketchPlaneId] = useState<string>(WORLD_PLANE_ID);
  const [pickMode, setPickMode] = useState<"entity" | "face" | "edge" | "finish-face" | "edit-face">("entity");
  const [selectedTopologyIds, setSelectedTopologyIds] = useState<string[]>([]);
  const [modelToolCategory, setModelToolCategory] = useState<ModelToolCategory>("select");
  const [sketchSession, setSketchSession] = useState<EmbeddedSketchSession | null>(null);
  const [completedSketchRegion, setCompletedSketchRegion] = useState<CompletedSketchRegion | null>(null);

  /**
   * Space is a contextual tool shelf, not a second command palette.
   * Holding it gives a temporary glance; tapping it pins the shelf so its
   * controls can be clicked. A second tap, Escape, or the close button hides it.
   */
  useEffect(() => {
    if (fabricOpen) return;
    const editableTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      return Boolean(element && (/^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName) || element.isContentEditable));
    };
    const commitShelf = (next: ToolShelfState) => {
      toolShelfRef.current = next;
      setToolShelf(next);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      // A live paint stroke owns Escape; keep its toolbox available after cancelling.
      if (event.key === "Escape" && (event.defaultPrevented || paintTransaction.current)) return;
      if (event.key === "Escape" && toolShelfRef.current.open) {
        event.preventDefault();
        spaceGestureRef.current = null;
        commitShelf({ open: false, pinned: false });
        return;
      }
      if (event.code !== "Space" || editableTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      if (event.repeat) {
        if (spaceGestureRef.current) spaceGestureRef.current.held = true;
        return;
      }
      const closing = toolShelfRef.current.open && toolShelfRef.current.pinned;
      spaceGestureRef.current = { closing, held: false };
      commitShelf(closing ? { open: false, pinned: false } : { open: true, pinned: false });
      if (!closing) setStatus("Tool features · release after holding to dismiss, tap Space to pin");
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space" || !spaceGestureRef.current) return;
      event.preventDefault();
      const gesture = spaceGestureRef.current;
      spaceGestureRef.current = null;
      if (gesture.closing) return;
      // Native key repeat is a better hold signal than wall time: opening a
      // complex exact model can delay React work without turning a user's tap
      // into a hold after the fact.
      const tapped = !gesture.held;
      commitShelf(tapped ? { open: true, pinned: true } : { open: false, pinned: false });
      setStatus(tapped ? "Tool features pinned · press Space or Escape to close" : "Tool features dismissed");
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
  }, [fabricOpen]);

  useEffect(() => {
    if (fabricOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement | null;
      if (element instanceof Element && element.closest("#cad-properties")) return;
      if (event.defaultPrevented || (element && (/^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName) || element.isContentEditable))) return;
      if (event.key === "Escape" && view !== "drawing") {
        if (sketchDrag) { event.preventDefault(); setSketchDrag(null); setStatus("Move cancelled · sketch unchanged"); return; }
        if (sketchSession) {
          event.preventDefault();
          setEntities(sketchSession.entitiesBefore);
          setGeometricConstraints(sketchSession.constraintsBefore);
          setSelectedId(sketchSession.sourceEntityId ?? "");
          setSelectedEntityIds(sketchSession.sourceEntityId ? [sketchSession.sourceEntityId] : []);
          setSketchSession(null);
          setCompletedSketchRegion(null);
          setView("model");
          setTool("select");
          setStatus("Sketch cancelled · existing model unchanged");
        } else if (completedSketchRegion) {
          event.preventDefault();
          setCompletedSketchRegion(null);
          setStatus("Closed-region actions dismissed");
        } else if (pickMode !== "entity") {
          event.preventDefault();
          setPickMode("entity");
          setSelectedTopologyIds([]);
          setModelToolCategory("select");
          setStatus("Selection tool restored");
        } else if (selectedId) {
          event.preventDefault();
          setSelectedId("");
          setSelectedEntityIds([]);
          setSelectedTopologyIds([]);
          clearMeshSelection();
          setStatus("Selection cleared");
        }
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId && !sketchSession && view === "model") {
        const entityExists = entities.some((entity) => entity.id === selectedId);
        const importedExists = importedBodies.some((body) => body.id === selectedId);
        if (!entityExists && !importedExists) return;
        event.preventDefault();
        const deleting = new Set(selectedEntityIds.length ? selectedEntityIds : [selectedId]);
        setEntities((current) => current.filter((entity) => !deleting.has(entity.id)));
        setImportedBodies((current) => current.filter((body) => !deleting.has(body.id)));
        setFeatures((current) => current.filter((feature) => !featureSourceIds(feature)?.some((sourceId) => deleting.has(sourceId))));
        setSelectedId("");
        setSelectedEntityIds([]);
        setSelectedTopologyIds([]);
        setStatus(`${deleting.size} selected source${deleting.size === 1 ? "" : "s"} deleted · dependent features removed`);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [clearMeshSelection, completedSketchRegion, entities, fabricOpen, importedBodies, pickMode, selectedEntityIds, selectedId, sketchSession, view, sketchDrag]);

  const selected = entities.find((entity) => entity.id === selectedId) ?? null;
  const activeDomainRecipes = DOMAIN_RECIPES.filter((recipe) => recipe.discipline === designDiscipline);
  const domainLabels = {
    architecture: { width: "Width", height: "Length", depth: "Height", wall: "Wall" },
    jewelry: { width: "Stone / inner", height: "Form height", depth: "Depth", wall: "Metal wall" },
    engineering: { width: "Width / OD", height: "Height / PCD", depth: "Depth", wall: "Wall / bore" },
  }[designDiscipline];
  const activeDomainChecks = components.slice().reverse().find((component) => component.domain?.recipe === domainRecipeKind)?.domain?.checks ?? [];
  const jewelryPreview = useMemo(() => jewelryMetrics(jewelrySpec), [jewelrySpec]);
  const engineeringPreview = useMemo(() => analyzeEngineering(engineeringSpec), [engineeringSpec]);
  const advancedMatePreview = useMemo(() => solveAdvancedMate(advancedMateKind, motionDriver, engineeringSpec.teeth / Math.max(1, Math.round(engineeringSpec.teeth * 0.6)), engineeringSpec.pitch), [advancedMateKind, engineeringSpec.pitch, engineeringSpec.teeth, motionDriver]);
  const activeRecipe = recipeGraphs.find((graph) => graph.id === activeRecipeId) ?? recipeGraphs[0] ?? STARTER_RECIPE_GRAPH;
  const recipePreview = useMemo(() => evaluateRecipeGraph(activeRecipe, cursor, `recipe-preview`), [activeRecipe, cursor]);
  const effectiveBimNodes = useMemo(() => bimNodes.length ? migrateBimObjectGraph(bimNodes, entities) : buildBimObjectGraph(entities), [bimNodes, entities]);
  const architectureDocuments = useMemo(() => generateArchitectureDocuments(effectiveBimNodes), [effectiveBimNodes]);
  const selectedBimNode = useMemo(() => effectiveBimNodes.find((node) => node.id === selectedBimNodeId) ?? null, [effectiveBimNodes, selectedBimNodeId]);
  const activeLinkedGroup = useMemo(() => linkedGroups.find((group) => group.id === activeLinkedGroupId) ?? null, [activeLinkedGroupId, linkedGroups]);
  const selectedLinkedGroup = useMemo(() => selected ? linkedGroups.find((group) => group.entityIds.includes(selected.id)) ?? null : null, [linkedGroups, selected]);
  const clampedRollback = Math.max(0, Math.min(rollbackIndex, features.length));
  const modelState = useMemo(
    () => rebuildParametricModel(entities, features.slice(0, clampedRollback)),
    [entities, features, clampedRollback],
  );
  const streamChunks = useMemo(() => planLargeProjectStreaming(entities, cursor), [cursor, entities]);
  const streamingWorkingSet = useMemo(() => selectStreamingWorkingSet(streamChunks, entities.length), [entities.length, streamChunks]);
  const streamedEntityIds = useMemo(() => new Set(streamingWorkingSet.entityIds), [streamingWorkingSet.entityIds]);
  const streamedEntities = entities.length > streamingWorkingSet.entityIds.length
    ? entities.filter((entity) => streamedEntityIds.has(entity.id) || entity.id === selectedId)
    : entities;
  const streamedModelState = entities.length > streamingWorkingSet.entityIds.length
    ? { ...modelState, instances: modelState.instances.filter((instance) => streamedEntityIds.has(instance.sourceEntityId) || instance.sourceEntityId === selectedId) }
    : modelState;
  const activeFeatures = useMemo(() => features.slice(0, clampedRollback), [features, clampedRollback]);
  const extrusion = modelState.extrusionDepth;
  const activePlane = planeById(sketchPlanes, activeSketchPlaneId);
  const assemblyByEntity = useMemo(() => {
    const map = new Map<string, AssemblyInstance>();
    assemblyInstances.forEach((instance) => instance.entityIds.forEach((entityId) => map.set(entityId, instance)));
    return map;
  }, [assemblyInstances]);
  const selectedBodyPosition = useMemo<Triple>(() => {
    const placement = assemblyByEntity.get(selectedId)?.position;
    if (placement) return placement;
    const imported = importedBodies.find((body) => body.id === selectedId);
    const transform = imported?.transform;
    return transform?.length === 12 ? [transform[3], transform[7], transform[11]] : [0, 0, 0];
  }, [assemblyByEntity, importedBodies, selectedId]);
  const closedWireProfiles = useMemo(() => buildClosedLineProfiles(entities), [entities]);
  const wireSourceMap = useMemo(() => new Map(closedWireProfiles.flatMap((wire) =>
    wire.sourceEntityIds.map((entityId) => [entityId, wire.id] as const))), [closedWireProfiles]);
  const visibleSketchEntities = useMemo(() => entities.filter((e) => (e.sketchPlaneId ?? WORLD_PLANE_ID) === activeSketchPlaneId && layers.some((l) => l.id === e.layer && l.visible)), [entities, activeSketchPlaneId, layers]);
  const sketchItems = useMemo(() => sketchObjects(visibleSketchEntities), [visibleSketchEntities]);
  const sketchTargets = useMemo(() => {
    const ids = selectedEntityIds.includes(selectedId) ? selectedEntityIds : selectedId ? [selectedId] : [];
    return sketchSelectionMode === "object" ? sketchItems.filter((o) => o.ids.some((entityId) => ids.includes(entityId))).flatMap((o) => o.ids) : ids.filter((entityId) => visibleSketchEntities.some((e) => e.id === entityId));
  }, [selectedId, selectedEntityIds, sketchSelectionMode, sketchItems, visibleSketchEntities]);
  const sketchSelectionBounds = useMemo(() => sketchBounds(visibleSketchEntities.filter((e) => sketchTargets.includes(e.id)).flatMap(sketchEntityPoints)), [visibleSketchEntities, sketchTargets]);
  const sketchSelectionLocked = visibleSketchEntities.some((e) => sketchTargets.includes(e.id) && layers.some((l) => l.id === e.layer && l.locked));
  const exactProfiles = useMemo<ExactSceneProfile[]>(() => [...entities
    .filter((entity) => entity.type !== "line")
    .map((entity) => {
      const plane = planeById(sketchPlanes, entity.sketchPlaneId);
      const placement = assemblyByEntity.get(entity.id);
      const px = placement?.position[0] ?? 0;
      const py = placement?.position[1] ?? 0;
      const pz = placement?.position[2] ?? 0;
      const rotation = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
        (placement?.rotation[0] ?? 0) * Math.PI / 180,
        (placement?.rotation[1] ?? 0) * Math.PI / 180,
        (placement?.rotation[2] ?? 0) * Math.PI / 180,
        "XYZ",
      ));
      const basis = new THREE.Matrix4().makeBasis(
        new THREE.Vector3(...plane.u),
        new THREE.Vector3(...plane.v),
        new THREE.Vector3(...plane.normal),
      );
      const placedBasis = rotation.clone().multiply(basis);
      placedBasis.setPosition(plane.origin[0] + px, plane.origin[1] + py, plane.origin[2] + pz);
      const matrix = placedBasis.elements;
      const transform = [
        matrix[0], matrix[4], matrix[8], matrix[12],
        matrix[1], matrix[5], matrix[9], matrix[13],
        matrix[2], matrix[6], matrix[10], matrix[14],
      ];
      const transformedU = new THREE.Vector3(...plane.u).transformDirection(rotation);
      const transformedV = new THREE.Vector3(...plane.v).transformDirection(rotation);
      const transformedNormal = new THREE.Vector3(...plane.normal).transformDirection(rotation);
      const shared = {
        id: entity.id,
        origin: entity.a,
        rotation: entity.rotation,
        transform,
        planeOrigin: { x: plane.origin[0] + px, y: plane.origin[1] + py, z: plane.origin[2] + pz },
        planeNormal: { x: transformedNormal.x, y: transformedNormal.y, z: transformedNormal.z },
        planeU: { x: transformedU.x, y: transformedU.y, z: transformedU.z },
        planeV: { x: transformedV.x, y: transformedV.y, z: transformedV.z },
      };
      return entity.type === "rectangle"
        ? { ...shared, kind: "rectangle" as const, width: Math.abs(entity.b.x - entity.a.x), height: Math.abs(entity.b.y - entity.a.y) }
        : { ...shared, kind: "circle" as const, radius: length(entity.a, entity.b) };
    }), ...closedWireProfiles.map((wire) => {
      const plane = planeById(sketchPlanes, wire.sketchPlaneId);
      return {
        id: wire.id,
        kind: "polygon" as const,
        origin: { x: 0, y: 0 },
        points: wire.points,
        rotation: 0,
        transform: [
          plane.u[0], plane.v[0], plane.normal[0], plane.origin[0],
          plane.u[1], plane.v[1], plane.normal[1], plane.origin[1],
          plane.u[2], plane.v[2], plane.normal[2], plane.origin[2],
        ],
        planeOrigin: { x: plane.origin[0], y: plane.origin[1], z: plane.origin[2] },
        planeNormal: { x: plane.normal[0], y: plane.normal[1], z: plane.normal[2] },
        planeU: { x: plane.u[0], y: plane.u[1], z: plane.u[2] },
        planeV: { x: plane.v[0], y: plane.v[1], z: plane.v[2] },
      };
    })], [assemblyByEntity, closedWireProfiles, entities, sketchPlanes]);
  const exactFeatures = useMemo(() => activeFeatures.map((feature) => ({
    id: feature.id,
    type: feature.type,
    value: feature.value,
    enabled: feature.enabled,
    sourceIds: featureSourceIds(feature)?.map((sourceId) => wireSourceMap.get(sourceId) ?? sourceId)
      .filter((sourceId, index, values) => values.indexOf(sourceId) === index) ?? undefined,
    topologyIds: feature.topologyIds,
  })), [activeFeatures, wireSourceMap]);
  const exactPaths = useMemo<ExactScenePath[]>(() => entities.filter((entity) => entity.type === "line").map((entity) => {
    const plane = planeById(sketchPlanes, entity.sketchPlaneId);
    const placement = assemblyByEntity.get(entity.id);
    const toWorld = (point: Point) => ({
      x: plane.origin[0] + plane.u[0] * point.x + plane.v[0] * point.y + (placement?.position[0] ?? 0),
      y: plane.origin[1] + plane.u[1] * point.x + plane.v[1] * point.y + (placement?.position[1] ?? 0),
      z: plane.origin[2] + plane.u[2] * point.x + plane.v[2] * point.y + (placement?.position[2] ?? 0),
    });
    return { id: entity.id, points: [toWorld(entity.a), toWorld(entity.b)] };
  }), [assemblyByEntity, entities, sketchPlanes]);
  const exactInputSignature = useMemo(() => cadProjectChecksum({
    profiles: exactProfiles,
    features: exactFeatures,
    paths: exactPaths,
    importedBodies,
  }), [exactFeatures, exactPaths, exactProfiles, importedBodies]);
  useEffect(() => {
    currentExactSignatureRef.current = exactInputSignature;
  }, [exactInputSignature]);
  const bomRows = useMemo(() => createBomRows(entities, components, material, assemblyInstances), [assemblyInstances, components, entities, material]);
  const kernelDimensions = kernelAudit ? describeExactBounds(kernelAudit.bounds) : null;
  const estimatedMassKg = kernelAudit ? kernelAudit.volume * density / 1_000_000 : 0;
  const sketchSolverStatus = useMemo(() => solveGeometricConstraints(entities, geometricConstraints), [entities, geometricConstraints]);
  const gdtValidation = useMemo(() => validateGdtAnnotations(gdt, entities), [entities, gdt]);
  const documentLayouts = useMemo(() => [...drawingBook.sheets, ...defaultBimSheets(architectureDocuments).filter((sheet) => !drawingBook.sheets.some((s) => s.id === sheet.id))], [drawingBook, architectureDocuments]);
  const exactSheetGeometry = useMemo(() => {
    if (!exactDrawingBounds) return [];
    try { return drawingViewGeometry(exactDrawingSvg, exactSectionSvg, exactDrawingBounds); } catch { return []; }
  }, [exactDrawingSvg, exactSectionSvg, exactDrawingBounds]);
  const bimDrawingSheets = useMemo(() => new Map(documentLayouts.filter(isBimSheet).map((s) => [s.id, buildBimSheet(s, architectureDocuments, drawingRevision, units)])), [documentLayouts, architectureDocuments, drawingRevision, units]);
  const productionDrawingSheets = useMemo(() => drawingBook.sheets.map((layout) => {
    if (layout.source || !exactDrawingSvg || !exactSectionSvg || !exactDrawingBounds) return null;
    try {
      const sheet = buildProductionDrawingSheet({
        orthographicSvg: exactDrawingSvg,
        sectionSvg: exactSectionSvg,
        bounds: exactDrawingBounds,
        metadata: {
          title: layout.id === "production" ? projectTitle : layout.title,
          revision: drawingRevision,
          scale: effectiveSheetScale(layout, drawingScale),
          units,
          material,
          projectionStandard: "third-angle",
          author: layout.author,
          drawingNumber: layout.drawingNumber || undefined,
        },
        controls: gdt,
        drafting,
        layout,
      });
      return { ...sheet, validation: validateProductionDrawingSheet(sheet) };
    } catch {
      return null;
    }
  }), [drawingBook, drafting, drawingRevision, drawingScale, exactDrawingSvg, exactSectionSvg, exactDrawingBounds, gdt, material, projectTitle, units]);
  const activeSheetLayout = documentLayouts.find((sheet) => sheet.id === selectedBimDocumentId) ?? drawingBook.sheets[0];
  const activeDrawingScale = effectiveSheetScale(activeSheetLayout, drawingScale);
  const productionDrawingSheet = productionDrawingSheets[drawingBook.sheets.indexOf(activeSheetLayout)] ?? null;
  const drawingOutputBlocked = exactDrawingSignature !== exactInputSignature || exactBuildState === "building" || exactBuildState === "error";
  const drawingReadiness = useMemo(() => cadDocumentReadiness({
    audit: kernelAudit,
    sketchDegreesOfFreedom: sketchSolverStatus.degreesOfFreedom,
    sketchConflicts: sketchSolverStatus.conflicts,
    gdtCount: gdt.length,
    gdtErrors: gdtValidation.findings.filter((finding) => finding.severity === "error").length,
    drawingReady: productionDrawingSheet?.validation.ready,
  }), [gdt.length, gdtValidation.findings, kernelAudit, productionDrawingSheet?.validation.ready, sketchSolverStatus.conflicts, sketchSolverStatus.degreesOfFreedom]);
  useEffect(() => {
    if (initialSolverStatusRef.current) return;
    initialSolverStatusRef.current = true;
    setStatus(sketchSolverStatus.conflicts.length
      ? `${sketchSolverStatus.conflicts.length} constraint conflict${sketchSolverStatus.conflicts.length === 1 ? "" : "s"}`
      : sketchSolverStatus.degreesOfFreedom === 0
        ? "Fully constrained · 0 degrees of freedom"
        : `Under-constrained · ${sketchSolverStatus.degreesOfFreedom} degrees of freedom`);
  }, [sketchSolverStatus.conflicts.length, sketchSolverStatus.degreesOfFreedom]);
  const designAnalysis = useMemo(() => analyzeCadDesign({
    entities,
    features: activeFeatures,
    audit: kernelAudit,
    bodyMetrics: exactBodyMetrics,
    assemblyChecks: exactAssemblyChecks,
    geometricConstraintCount: geometricConstraints.length,
    sketchDegreesOfFreedom: sketchSolverStatus.degreesOfFreedom,
    sketchConflicts: sketchSolverStatus.conflicts,
    assemblyInstanceCount: assemblyInstances.length,
    fixedAssemblyInstanceCount: assemblyInstances.filter((instance) => instance.fixed).length,
    gdtCount: gdt.length,
    gdtIssues: gdtValidation.findings,
    material,
    domainChecks: components.flatMap((component) => component.domain?.checks.map((check) => ({ source: component.name, ...check })) ?? []),
  }), [activeFeatures, assemblyInstances, components, entities, exactAssemblyChecks, exactBodyMetrics, gdt.length, gdtValidation.findings, geometricConstraints.length, kernelAudit, material, sketchSolverStatus]);
  const designValidation = useMemo(() => designValidationLifecycle({
    analysis: designAnalysis,
    buildState: exactBuildState,
    hasAudit: kernelAudit !== null,
    auditMatchesCurrentModel: validatedExactSignature === exactInputSignature,
  }), [designAnalysis, exactBuildState, exactInputSignature, kernelAudit, validatedExactSignature]);
  const projectData = useMemo<CadProjectData>(() => ({
    version: 17,
    roomId,
    meshFeatures,
    sceneNodes,
    animation: animationDocument,
    geometryGraph,
    materialGraph,
    viewport,
    canonicalUnits: "mm",
    displayUnits: units,
    entities,
    features,
    layers,
    geometricConstraints,
    parameters,
    gdt,
    components,
    assemblyInstances,
    assemblyMates,
    linkedGroups,
    importedBodies,
    volumes,
    drafting,
    sketchPlanes,
    rollbackIndex: clampedRollback,
    material,
    density,
    drawingScale,
    drawingRevision,
    drawingBook,
    configurations,
    activeConfigurationId,
    bimNodes: effectiveBimNodes,
    recipeGraphs,
    revisions,
    marketplace,
    appearance,
    kernel: "Open CASCADE B-Rep",
  }), [activeConfigurationId, appearance, assemblyInstances, assemblyMates, clampedRollback, components, configurations, density, drafting, drawingBook, drawingRevision, drawingScale, effectiveBimNodes, entities, features, gdt, geometricConstraints, importedBodies, layers, linkedGroups, marketplace, material, parameters, meshFeatures, sceneNodes, animationDocument, geometryGraph, materialGraph, recipeGraphs, revisions, roomId, sketchPlanes, units, viewport, volumes]);
  // Share one immutable container per authoring revision between dirty-state
  // comparison, autosave, explicit save and handoff. Do not pretty-print and
  // parse a full file just to update the save indicator.
  const containerRevision = useMemo(() => ({ embeddedGarment, paintCommit, projectData, projectTitle, sculptUnwrap, texture, units }),
    [embeddedGarment, paintCommit, projectData, projectTitle, sculptUnwrap, texture, units]);
  const containerCacheRef = useRef<{ revision: object; project: ReturnType<typeof createFormProject> } | null>(null);
  // A scene-only document may visit Model without authoring a CAD workspace.
  // Capture the hydrated empty editor once; persist CAD only after it changes.
  const uncreatedCadBaselineRef = useRef<string | null | undefined>(undefined);
  const buildProjectContainer = useCallback((garmentOverride?: GarmentProject) => {
    const cached = containerCacheRef.current;
    if (!garmentOverride && cached?.revision === containerRevision) return cached.project;
    const now = Date.now();
    const sealedCad = sealCadProject({ ...projectData, paintTexture: archivePaintTexture(texture, sculptUnwrap) });
    const cadObjectIds = [...new Set([
      ...projectData.entities.map((item) => item.id),
      ...projectData.features.map((item) => item.id),
      ...projectData.components.map((item) => item.id),
      ...projectData.importedBodies.map((item) => item.id),
      ...projectData.meshFeatures.map((item) => item.id),
      ...projectData.sceneNodes.map((item) => item.id),
    ])];
    const base = projectContainerRef.current ?? createFormProject(projectTitle, now);
    if (!formWorkspace(base, "cad") && uncreatedCadBaselineRef.current !== undefined) {
      if (uncreatedCadBaselineRef.current === null) uncreatedCadBaselineRef.current = sealedCad.checksum;
    }
    const uncreatedCadUnchanged = !formWorkspace(base, "cad") && uncreatedCadBaselineRef.current === sealedCad.checksum;
    let container = uncreatedCadUnchanged ? { ...base, name: projectTitle } : updateFormWorkspace({
      ...base,
      name: projectTitle,
      common: { ...base.common, displayUnits: units },
    }, "cad", {
      schema: FORM_CAD_WORKSPACE_SCHEMA,
      objectIds: cadObjectIds,
      data: sealedCad,
    }, now);
    if (garmentOverride ?? embeddedGarment) {
      const portableGarment = parseGarment(serializeGarment((garmentOverride ?? embeddedGarment)!));
      container = updateFormWorkspace(container, "fabric", {
        schema: FORM_FABRIC_WORKSPACE_SCHEMA,
        objectIds: [...new Set([
          ...portableGarment.pieces.map((item) => item.id),
          ...portableGarment.seams.map((item) => item.id),
          ...portableGarment.details.map((item) => item.id),
        ])],
        data: portableGarment,
      }, now);
    }
    projectContainerRef.current = container;
    if (!garmentOverride) containerCacheRef.current = { revision: containerRevision, project: container };
    return container;
  }, [containerRevision, embeddedGarment, projectData, projectTitle, sculptUnwrap, texture, units]);
  const buildProjectJson = useCallback((garmentOverride?: GarmentProject) => serializeProject(buildProjectContainer(garmentOverride)), [buildProjectContainer]);
  const initialProjectJsonRef = useRef<string | null>(null);
  const [documentSession] = useState(() => saveSession ?? new ProjectSaveSession());
  useSyncExternalStore(documentSession.subscribe, documentSession.getSnapshot, documentSession.getSnapshot);
  const sharedHydratingRef = useRef(Boolean(initialProjectContents));
  const applyHistoryContentsRef = useRef<(contents: string) => Promise<boolean | undefined>>(async () => false);
  const saveBeforeCloseRef = useRef<() => Promise<boolean>>(async () => false);
  useEffect(() => () => { documentSession.retainHistory("cad", historyRef.current); }, [documentSession]);
  const [documentDirty, setDocumentDirty] = useState(false);
  const [documentSaving, setDocumentSaving] = useState(false);
  useLayoutEffect(() => {
    if (saveSession && sharedHydratingRef.current) return;
    // Do not encode a multi-megabyte texture for every brush dab. A stroke is
    // dirty immediately; its canonical content is reconciled on commit/cancel.
    // Explicit Save below always captures canonical content, even mid-stroke.
    if (paintTransaction.current?.changed) documentSession.observe(`pending CAD paint ${paintCommit}`);
    else if (saveSession) documentSession.checkpointProject(buildProjectContainer(), "CAD", "Model, sketch or document edit");
    else documentSession.observeProject(buildProjectContainer());
    // Synchronize the imperative save transaction before the next user event.
    setDocumentDirty(documentSession.dirty);
  }, [buildProjectContainer, documentSession, paintCommit, saveSession]);
  useDocumentSafety("cad", documentDirty || documentSaving || documentSession.restoringHistory, true,
    () => saveBeforeCloseRef.current(), () => !documentSession.dirty && !documentSession.saving && !documentSession.restoringHistory);

  useEffect(() => {
    void detectNativeEngine().then((engine) => {
      setNativeEngine(engine);
      if (engine.available) void detectNativeGpu().then(setNativeGpu);
    });
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("form-extension-registry");
    if (!stored) { extensionRegistryHydrated.current = true; return; }
    void restoreExtensionRegistry(stored).then(setExtensionRegistry).catch((error) => {
      setStatus(error instanceof Error ? `Extension registry quarantined · ${error.message}` : "Extension registry quarantined");
      localStorage.removeItem("form-extension-registry");
    }).finally(() => { extensionRegistryHydrated.current = true; });
  }, []);

  useEffect(() => {
    if (!extensionRegistryHydrated.current) return;
    localStorage.setItem("form-extension-registry", serializeExtensionRegistry(extensionRegistry));
  }, [extensionRegistry]);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      void recordNativeFrontendError(event.message || "Unhandled frontend error", event.filename || "window.error");
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const message = event.reason instanceof Error ? event.reason.message : String(event.reason);
      void recordNativeFrontendError(message, "unhandledrejection");
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    if (!nativeEngine.available) return;
    const refresh = () => void listNativeJobs().then(setNativeJobs);
    refresh(); const timer = window.setInterval(refresh, 1500);
    return () => window.clearInterval(timer);
  }, [nativeEngine.available]);

  useEffect(() => () => {
    if (nativePreviewUrl) URL.revokeObjectURL(nativePreviewUrl);
  }, [nativePreviewUrl]);

  useEffect(() => {
    const worker = new Worker(new URL("./cad-kernel.worker.ts", import.meta.url), { type: "module" });
    exactWorkerRef.current = worker;
    worker.onmessage = (event: MessageEvent<{ token: number; ok: boolean; result?: { meshes: ExactSceneMesh[]; audit: ExactSolidAudit; topology: ExactTopologyRef[]; bodyMetrics: ExactBodyMetric[]; assemblyChecks: ExactAssemblyCheck[]; data?: string; sectionSvg?: string }; error?: string }>) => {
      if (event.data.token !== exactBuildTokenRef.current) return;
      if (!event.data.ok || !event.data.result) {
        setExactBuildState("error");
        setKernelStatus("error");
        setValidatedExactSignature(null);
        const message = event.data.error ?? "Background exact rebuild failed";
        setExactRebuildFailure({ message });
        setStatus(`Exact rebuild paused · ${message} · last valid body remains visible`);
        return;
      }
      let result = event.data.result;
      if (nativeDrawingRef.current?.token === event.data.token) {
        const native = nativeDrawingRef.current.result;
        try { verifyDrawingProjection(native, result); }
        catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setExactBuildState("error"); setKernelStatus("error"); setValidatedExactSignature(null);
          setExactRebuildFailure({ message }); setStatus(message); return;
        }
        result = { ...native, data: result.data, sectionSvg: result.sectionSvg };
        nativeDrawingRef.current = null;
      }
      const failure = exactResultFailure(result.audit);
      if (failure) {
        setKernelAudit(result.audit);
        setValidatedExactSignature(null);
        setKernelStatus("error"); setExactBuildState("error");
        setExactRebuildFailure(failure);
        setStatus(`Exact rebuild paused · ${failure.message} · last valid body remains visible`);
        return;
      }
      setExactMeshes(result.meshes);
      setExactTopology(result.topology);
      setExactBodyMetrics(result.bodyMetrics);
      setExactAssemblyChecks(result.assemblyChecks);
      setKernelAudit(result.audit);
      setValidatedExactSignature(currentExactSignatureRef.current);
      if (result.data?.startsWith("<svg")) {
        setExactDrawingSvg(result.data);
        setExactSectionSvg(result.sectionSvg?.startsWith("<svg") ? result.sectionSvg : "");
        setExactDrawingBounds(result.audit.bounds);
        setExactDrawingSignature(currentExactSignatureRef.current);
      }
      setKernelStatus(result.audit.valid ? "ready" : "error");
      setExactBuildState(result.audit.valid ? "ready" : "error");
      setExactRebuildFailure(null);
    };
    return () => {
      worker.terminate();
      if (exactWorkerRef.current === worker) exactWorkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    // Drawing owns the exact request while this workspace is active. A delayed
    // mesh-only request must not set "building" after a newer SVG has finished.
    if (view === "drawing" && (exactProfiles.length > 0 || importedBodies.length > 0)) return;
    const token = ++exactBuildTokenRef.current;
    const timer = window.setTimeout(() => {
      if (exactProfiles.length === 0 && importedBodies.length === 0) {
        setExactMeshes([]);
        setExactTopology([]);
        setExactBodyMetrics([]);
        setExactAssemblyChecks([]);
        setExactDrawingSvg("");
        setExactSectionSvg("");
        setExactDrawingBounds(null);
        setExactDrawingSignature("");
        setKernelAudit(null);
        setValidatedExactSignature(null);
        setExactBuildState("idle");
        return;
      }
      setExactBuildState("building");
      setKernelStatus("loading");
      if (nativeEngine.available && canUseNativeCad(exactProfiles, exactFeatures, importedBodies)) {
        void runNativeCadRebuild(exactProfiles, exactFeatures, exactPaths, importedBodies).then((result) => {
          if (token !== exactBuildTokenRef.current) return;
          const failure = exactResultFailure(result.audit);
          if (failure) {
            setKernelAudit(result.audit);
            setValidatedExactSignature(null);
            setKernelStatus("error"); setExactBuildState("error");
            setExactRebuildFailure(failure);
            setStatus(`Exact rebuild paused · ${failure.message} · last valid body remains visible`);
            return;
          }
          setExactMeshes(result.meshes);
          setExactTopology(result.topology);
          setExactBodyMetrics(result.bodyMetrics);
          setExactAssemblyChecks(result.assemblyChecks);
          setKernelAudit(result.audit);
          setValidatedExactSignature(currentExactSignatureRef.current);
          setKernelStatus(result.audit.valid ? "ready" : "error");
          setExactBuildState(result.audit.valid ? "ready" : "error");
          setExactRebuildFailure(null);
        }).catch(() => {
          if (token === exactBuildTokenRef.current) exactWorkerRef.current?.postMessage({ token, profiles: exactProfiles, features: exactFeatures, importedBodies, paths: exactPaths });
        });
      } else exactWorkerRef.current?.postMessage({ token, profiles: exactProfiles, features: exactFeatures, importedBodies, paths: exactPaths });
    }, 220);
    return () => window.clearTimeout(timer);
  }, [exactFeatures, exactPaths, exactProfiles, importedBodies, nativeEngine.available, view]);

  const requestExactDrawing = useCallback(async (token: number) => {
    nativeDrawingRef.current = null;
    try {
      const prepared = await prepareExactDrawing({ profiles: exactProfiles, features: exactFeatures, paths: exactPaths, importedBodies, nativeAvailable: nativeEngine.available });
      if (token !== exactBuildTokenRef.current) return;
      if (prepared.native) nativeDrawingRef.current = { token, result: prepared.native };
      exactWorkerRef.current?.postMessage({ token, ...prepared.request });
    } catch (error) {
      if (token !== exactBuildTokenRef.current) return;
      const message = error instanceof Error ? error.message : String(error);
      setExactBuildState("error"); setKernelStatus("error"); setValidatedExactSignature(null);
      setExactRebuildFailure({ message }); setStatus(`Drawing rebuild failed · ${message} · previous drawing retained; output blocked`);
    }
  }, [exactProfiles, exactFeatures, exactPaths, importedBodies, nativeEngine.available]);

  useEffect(() => {
    if (view !== "drawing" || (exactProfiles.length === 0 && importedBodies.length === 0)) return;
    const token = ++exactBuildTokenRef.current;
    queueMicrotask(() => setExactBuildState("building"));
    void requestExactDrawing(token);
  }, [exactProfiles.length, importedBodies.length, requestExactDrawing, view]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const projectJson = buildProjectJson();
      if (initialProjectJsonRef.current === null) initialProjectJsonRef.current = projectJson;
      try {
        if (projectJson.length < 4_000_000) localStorage.setItem("form-cad-project", projectJson);
      } catch {
        // Large imported B-Reps remain recoverable through the native autosave or an explicit project download.
      }
      void import("@tauri-apps/api/core").then(({ invoke, isTauri }) => {
        if (isTauri()) return invoke("autosave_project", { contents: projectJson, workspace: "cad" });
        return saveBrowserCadRecovery(projectJson);
      }).catch(() => setStatus("Recovery snapshot could not be written · save your project to a file now"));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [buildProjectJson]);

  useEffect(() => {
    void import("@tauri-apps/api/core").then(async ({ invoke, isTauri }) => {
      const nativeRecovery = isTauri()
        ? await invoke<Array<{ contents: string; savedAtMs: number }>>("read_autosave_projects", { workspace: "cad" })
        : [];
      const recovered = isTauri() ? nativeRecovery[0]?.contents ?? null : await readBrowserCadRecovery();
      if (recovered && recovered !== initialProjectJsonRef.current) setRecoveryContents(recovered);
      if (isTauri()) {
        setRecoverySnapshots(nativeRecovery.map((snapshot) => ({
          contents: snapshot.contents,
          checksum: cadProjectChecksum(snapshot.contents),
          savedAt: new Date(snapshot.savedAtMs).toISOString(),
        })).filter(validCadRecoverySnapshot));
      } else setRecoverySnapshots(await readBrowserCadRecoveryHistory());
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const history = historyRef.current;
    if (paintTransaction.current) return;
    if (history.skip) {
      history.skip = false;
      return;
    }
    const snapshot: CadSnapshot = {
      embeddedGarment: embeddedGarment ? structuredClone(embeddedGarment) : undefined,
      drawingBook: structuredClone(drawingBook),
      drawingScale,
      drawingRevision,
      units,
      geometryGraph: structuredClone(geometryGraph),
      materialGraph: structuredClone(materialGraph),
      animation: structuredClone(animationDocument),
      // These are immutable between strokes; copy-on-stroke protects history.
      texture,
      sculptUnwrap,
      meshFeatures: structuredClone(meshFeatures),
      sceneNodes: structuredClone(storedSceneNodes),
      entities: structuredClone(entities),
      features: structuredClone(features),
      geometricConstraints: structuredClone(geometricConstraints),
      parameters: structuredClone(parameters),
      gdt: structuredClone(gdt),
      components: structuredClone(components),
      assemblyInstances: structuredClone(assemblyInstances),
      assemblyMates: structuredClone(assemblyMates),
      linkedGroups: structuredClone(linkedGroups),
      importedBodies: structuredClone(importedBodies),
      drafting: structuredClone(drafting),
      configurations: structuredClone(configurations),
      activeConfigurationId,
      rollbackIndex,
      appearance: structuredClone(appearance),
    };
    const previous = history.entries[history.cursor];
    if (previous && previous.texture === texture && snapshotPayload(previous) === snapshotPayload(snapshot)) return;
    history.entries = retainHistory([...history.entries.slice(0, history.cursor + 1), snapshot],
      (entry) => snapshotPayload(entry).length * 4 + (entry.texture?.pixels.byteLength ?? 0));
    history.cursor = history.entries.length - 1;
    setHistoryControls({
      canUndo: history.cursor > 0,
      canRedo: history.cursor < history.entries.length - 1,
    });
  }, [activeConfigurationId, appearance, assemblyInstances, assemblyMates, components, configurations, drafting, drawingBook, drawingScale, drawingRevision, embeddedGarment, units, entities, features, gdt, geometricConstraints, importedBodies, linkedGroups, parameters, rollbackIndex, meshFeatures, storedSceneNodes, geometryGraph, materialGraph, animationDocument, texture, sculptUnwrap, paintCommit]);

  const restoreHistory = useCallback((direction: -1 | 1) => {
    const history = historyRef.current;
    if (paintTransaction.current) return;
    if (saveSession) {
      const label = direction < 0 ? documentSession.undoLabel : documentSession.redoLabel;
      void documentSession.travelHistory(direction, async (contents) => Boolean(await applyHistoryContentsRef.current(contents)))
        .then((restored) => { if (restored) setStatus(`${direction < 0 ? "Undo" : "Redo"} · ${label ?? "project edit"}`); })
        .catch((error) => setStatus(`History could not be restored · ${error instanceof Error ? error.message : "try again"}`));
      return;
    }
    const target = history.cursor + direction;
    if (target < 0 || target >= history.entries.length) return;
    const snapshot = history.entries[target];
    const currentSnapshot = history.entries[history.cursor];
    const sheetOnly = currentSnapshot && currentSnapshot.texture === snapshot.texture && sheetIndependentPayload(currentSnapshot) === sheetIndependentPayload(snapshot);
    history.cursor = target;
    history.skip = true;
    // Older in-memory entries can survive a development hot update.
    setDrawingScale((current) => snapshot.drawingScale ?? current);
    setDrawingRevision((current) => snapshot.drawingRevision ?? current);
    setDrawingBook((current) => snapshot.drawingBook ?? current);
    if (sheetOnly) {
      // Preserve exact geometry, its validation and source selection for paper-only edits.
      setStatus(direction < 0 ? "Undo · sheet edit restored" : "Redo · sheet edit restored");
      setHistoryControls({ canUndo: history.cursor > 0, canRedo: history.cursor < history.entries.length - 1 });
      return;
    }
    setEmbeddedGarment(snapshot.embeddedGarment ? structuredClone(snapshot.embeddedGarment) : undefined);
    setUnits((current) => snapshot.units ?? current);
    setGeometryGraph(structuredClone(snapshot.geometryGraph));
    setMaterialGraph(structuredClone(snapshot.materialGraph));
    setAnimation(structuredClone(snapshot.animation));
    setTexture(snapshot.texture);
    setSculptUnwrap(snapshot.sculptUnwrap);
    setMeshFeatures(structuredClone(snapshot.meshFeatures));
    setSceneNodes(structuredClone(snapshot.sceneNodes));
    setSelectedMeshId((current) => snapshot.meshFeatures.some((mesh) => mesh.id === current) ? current : null);
    clearMeshSelection();
    setSelectionBrushEnabled(false);
    setModalPreview(null);
    setStrokePreview(null);
    setEntities(structuredClone(snapshot.entities));
    setFeatures(structuredClone(snapshot.features));
    setGeometricConstraints(structuredClone(snapshot.geometricConstraints));
    setParameters(structuredClone(snapshot.parameters));
    setGdt(structuredClone(snapshot.gdt));
    setComponents(structuredClone(snapshot.components));
    setAssemblyInstances(structuredClone(snapshot.assemblyInstances ?? []));
    setAssemblyMates(structuredClone(snapshot.assemblyMates ?? []));
    setLinkedGroups(structuredClone(snapshot.linkedGroups ?? []));
    setImportedBodies(structuredClone(snapshot.importedBodies ?? []));
    setDrafting(structuredClone(snapshot.drafting ?? createCadDraftingDocument()));
    setConfigurations(structuredClone(snapshot.configurations ?? []));
    setActiveConfigurationId(snapshot.activeConfigurationId ?? null);
    setRollbackIndex(snapshot.rollbackIndex ?? snapshot.features.length);
    setAppearance(normalizeCadAppearance(snapshot.appearance));
    setSelectedId(snapshot.entities[0]?.id ?? "");
    setSelectedEntityIds(snapshot.entities[0]?.id ? [snapshot.entities[0].id] : []);
    setKernelAudit(null);
    setValidatedExactSignature(null);
    setStatus(direction < 0 ? "Undo · model history restored" : "Redo · model history restored");
    setHistoryControls({
      canUndo: history.cursor > 0,
      canRedo: history.cursor < history.entries.length - 1,
    });
  }, [clearMeshSelection, documentSession, saveSession, setAnimation, setMeshFeatures]);

  const worldToScreen = useCallback((point: Point, width: number, height: number) => ({
    x: width / 2 + (point.x - (view === "sketch" ? sketchCenter.x : 0)) * zoom,
    y: height / 2 - (point.y - (view === "sketch" ? sketchCenter.y : 0)) * zoom,
  }), [zoom, view, sketchCenter]);

  const screenToWorld = useCallback((event: React.PointerEvent<HTMLCanvasElement>, useSnap = snap, anchor: Point | null = null, excludeEntityIds: string[] = []) => {
    const rect = event.currentTarget.getBoundingClientRect();
    let point = { x: (event.clientX - rect.left - rect.width / 2) / zoom + sketchCenter.x, y: -(event.clientY - rect.top - rect.height / 2) / zoom + sketchCenter.y };
    if (useSnap) {
      const inference = inferSketchPoint(entities, point, { threshold: Math.max(1.2, 11 / zoom), grid, anchor, excludeEntityIds });
      setSketchInference(inference);
      if (inference) point = inference.point;
    } else setSketchInference(null);
    return point;
  }, [entities, grid, snap, zoom, sketchCenter]);

  const drawEntity = useCallback((context: CanvasRenderingContext2D, entity: Entity, width: number, height: number, selectedEntity = false, offset: Point = { x: 0, y: 0 }, cornerRadius = 0) => {
    const layer = layers.find((item) => item.id === entity.layer);
    if (!layer?.visible) return;
    const a = worldToScreen({ x: entity.a.x + offset.x, y: entity.a.y + offset.y }, width, height);
    const b = worldToScreen({ x: entity.b.x + offset.x, y: entity.b.y + offset.y }, width, height);
    context.save();
    context.strokeStyle = selectedEntity ? WORKSPACE_CANVAS.accent : canvasLayerInk(layer.color);
    context.lineWidth = selectedEntity ? Math.max(2.2, entity.strokeWidth ?? 0) : entity.strokeWidth ?? 1.35;
    context.globalAlpha = selectedEntity ? 1 : entity.strokeOpacity ?? 1;
    if (entity.strokeStyle) { context.lineCap = "round"; context.lineJoin = "round"; }
    context.setLineDash(entity.layer === "construction" ? [7, 5] : []);
    context.beginPath();
    if (entity.type === "line") {
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
    } else if (entity.type === "rectangle") {
      if (cornerRadius > 0 && (entity.rotation ?? 0) === 0) {
        pathRoundedRect(context, a.x, a.y, b.x - a.x, b.y - a.y, cornerRadius * zoom);
      } else {
        const corners = rectangleCorners(entity).map((point) =>
          worldToScreen({ x: point.x + offset.x, y: point.y + offset.y }, width, height));
        context.moveTo(corners[0].x, corners[0].y);
        corners.slice(1).forEach((point) => context.lineTo(point.x, point.y));
        context.closePath();
      }
    } else {
      context.arc(a.x, a.y, length(entity.a, entity.b) * zoom, 0, Math.PI * 2);
    }
    context.stroke();
    context.setLineDash([]);
    context.restore();
  }, [layers, worldToScreen, zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const measure = () => {
      const { width, height } = canvas.getBoundingClientRect();
      setSketchCanvasExtent(`${width}:${height}:${window.devicePixelRatio}`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [fabricOpen, view]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio, 2);
    canvas.width = Math.max(1, bounds.width * ratio);
    canvas.height = Math.max(1, bounds.height * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    const width = bounds.width;
    const height = bounds.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = view === "drawing" ? WORKSPACE_CANVAS.paper : sketchSession ? "rgba(240, 241, 244, 0.88)" : WORKSPACE_CANVAS.background;
    context.fillRect(0, 0, width, height);

    if (view === "drawing") {
      context.strokeStyle = "#252a27";
      context.lineWidth = 1;
      context.strokeRect(32, 28, width - 64, height - 56);
      context.strokeRect(width - 310, height - 118, 278, 90);
      context.fillStyle = "#252a27";
      context.font = "700 13px Arial";
      context.fillText("FORMCAD — FABRICATION DRAWING", width - 292, height - 88);
      context.font = "10px Arial";
      context.fillText(`SCALE ${activeDrawingScale} · ${units} · REV ${drawingRevision}`, width - 292, height - 65);
      context.fillText(`${material.toUpperCase()} · MODEL-DRIVEN`, width - 292, height - 46);
      const visible = entities.filter((entity) => layers.find((layer) => layer.id === entity.layer)?.visible);
      const views = [{ x: -65, y: 32, label: "FRONT" }, { x: 55, y: 32, label: "RIGHT" }, { x: -65, y: -42, label: "TOP" }];
      views.forEach((drawingView) => {
        visible.forEach((entity) => drawEntity(context, entity, width, height, false, drawingView));
        const label = worldToScreen({ x: drawingView.x, y: drawingView.y - 38 }, width, height);
        context.fillStyle = "#4e544f";
        context.font = "8px Arial";
        context.fillText(drawingView.label, label.x - 15, label.y);
      });
      return;
    }

    const spacing = grid * zoom;
    context.strokeStyle = WORKSPACE_CANVAS.grid;
    context.lineWidth = 1;
    const origin = worldToScreen({ x: 0, y: 0 }, width, height);
    for (let x = ((origin.x % spacing) + spacing) % spacing; x < width; x += spacing) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
    for (let y = ((origin.y % spacing) + spacing) % spacing; y < height; y += spacing) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
    context.strokeStyle = WORKSPACE_CANVAS.axis;
    context.beginPath(); context.moveTo(origin.x, 0); context.lineTo(origin.x, height); context.moveTo(0, origin.y); context.lineTo(width, origin.y); context.stroke();

    if (view === "model") {
      const depthOffset = { x: extrusion * 0.42, y: extrusion * 0.32 };
      modelState.instances.forEach((instance, index) => {
        const explodedOffset = explodedAssembly
          ? { x: (index % 3) * 16, y: Math.floor(index / 3) * 12 }
          : { x: 0, y: 0 };
        const isSelected = instance.sourceEntityId === selectedId;
        drawEntity(context, instance.entity, width, height, isSelected, {
          x: depthOffset.x + explodedOffset.x,
          y: depthOffset.y + explodedOffset.y,
        }, instance.cornerRadius);
        drawEntity(context, instance.entity, width, height, isSelected, explodedOffset, instance.cornerRadius);
        const corners = instance.entity.type === "rectangle" ? rectangleCorners(instance.entity) : [];
        corners.forEach((point) => {
          const start = worldToScreen({ x: point.x + explodedOffset.x, y: point.y + explodedOffset.y }, width, height);
          const end = worldToScreen({
            x: point.x + depthOffset.x + explodedOffset.x,
            y: point.y + depthOffset.y + explodedOffset.y,
          }, width, height);
          context.strokeStyle = "#88928c"; context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(end.x, end.y); context.stroke();
        });
      });
    } else {
      const targetIds = new Set(sketchTargets);
      sketchItems.filter((o) => o.closed && o.ids.some((id) => targetIds.has(id))).forEach((o) => {
        context.beginPath();
        o.points.forEach((point, index) => { const p = worldToScreen({ x: point.x + (sketchDrag?.dx ?? 0), y: point.y + (sketchDrag?.dy ?? 0) }, width, height); if (index) context.lineTo(p.x, p.y); else context.moveTo(p.x, p.y); });
        context.closePath(); context.fillStyle = "rgba(39, 91, 197, .09)"; context.fill();
      });
      visibleSketchEntities.forEach((entity) => drawEntity(context, entity, width, height, targetIds.has(entity.id), sketchDrag?.ids.includes(entity.id) ? { x: sketchDrag.dx, y: sketchDrag.dy } : undefined));
      const draftLayerColor = (layerId: string) => canvasLayerInk(layers.find((layer) => layer.id === layerId)?.color ?? WORKSPACE_CANVAS.accent);
      drafting.hatches.filter((hatch) => hatch.visible).forEach((hatch) => {
        context.save(); context.strokeStyle = draftLayerColor(hatch.layer); context.fillStyle = `${draftLayerColor(hatch.layer)}22`; context.lineWidth = 1;
        hatch.boundaries.forEach((boundary) => {
          if (boundary.length < 2) return;
          const first = worldToScreen(boundary[0], width, height); context.beginPath(); context.moveTo(first.x, first.y);
          boundary.slice(1).forEach((point) => { const screen = worldToScreen(point, width, height); context.lineTo(screen.x, screen.y); });
          context.closePath(); context.fill(); context.stroke();
        });
        context.restore();
      });
      drafting.leaders.filter((leader) => leader.visible).forEach((leader) => {
        context.save(); context.strokeStyle = draftLayerColor(leader.layer); context.fillStyle = draftLayerColor(leader.layer); context.lineWidth = 1;
        const points = leader.vertices.map((point) => worldToScreen(point, width, height)); context.beginPath(); context.moveTo(points[0].x, points[0].y); points.slice(1).forEach((point) => context.lineTo(point.x, point.y)); context.stroke();
        if (leader.hasArrowhead && points.length > 1) { context.beginPath(); context.arc(points[0].x, points[0].y, 2.5, 0, Math.PI * 2); context.fill(); }
        if (leader.annotation) { context.font = "9px Arial"; context.fillText(leader.annotation, points.at(-1)!.x + 5, points.at(-1)!.y - 4); }
        context.restore();
      });
      drafting.dimensions.filter((dimension) => dimension.visible).forEach((dimension) => {
        const geometry = draftDimensionGeometry(dimension); if (!geometry) return;
        const labelPosition = worldToScreen(geometry.label, width, height);
        context.save(); context.strokeStyle = draftLayerColor(dimension.layer); context.fillStyle = draftLayerColor(dimension.layer); context.lineWidth = 1;
        context.beginPath(); for (const [a, b] of geometry.segments) { const start = worldToScreen(a, width, height), end = worldToScreen(b, width, height); context.moveTo(start.x, start.y); context.lineTo(end.x, end.y); } context.stroke();
        context.font = "9px monospace"; const display = geometry.prefix + formatCadLength(geometry.value, units, precision), label = dimension.textOverride ? dimension.textOverride.replaceAll("<>", display) : display; context.fillText(label, labelPosition.x - context.measureText(label).width / 2, labelPosition.y - 5); context.restore();
      });
      drafting.texts.filter((text) => text.visible && text.text.trim()).forEach((text) => {
        const screen = worldToScreen(text.position, width, height); context.save(); context.translate(screen.x, screen.y); context.rotate(-text.rotation * Math.PI / 180); context.fillStyle = draftLayerColor(text.layer); context.font = `${Math.max(7, text.height * zoom)}px Arial`; text.text.split(/\\P|\n/).forEach((line, index) => context.fillText(line, 0, index * Math.max(9, text.height * zoom * 1.2))); context.restore();
      });
      if (freehandDraft && freehandDraft.length > 1 && (tool === "pen" || tool === "pencil")) {
        context.save();
        context.strokeStyle = canvasLayerInk(layers.find((layer) => layer.id === activeLayer)?.color ?? WORKSPACE_CANVAS.accent);
        context.globalAlpha = tool === "pencil" ? 0.62 : 1;
        context.lineCap = "round";
        context.lineJoin = "round";
        for (let index = 1; index < freehandDraft.length; index += 1) {
          const a = worldToScreen(freehandDraft[index - 1], width, height);
          const b = worldToScreen(freehandDraft[index], width, height);
          const pressure = Math.max(0.05, Math.min(1, (freehandDraft[index].pressure ?? 0.5)));
          context.lineWidth = tool === "pen" ? 0.9 + pressure * 1.4 : 0.8;
          context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke();
        }
        context.restore();
      }
      if (draft && tool === "polygon") {
        const radius = length(draft.start, draft.current);
        const points = Array.from({ length: 6 }, (_, index) => ({
          x: draft.start.x + Math.cos(index * Math.PI / 3) * radius,
          y: draft.start.y + Math.sin(index * Math.PI / 3) * radius,
        }));
        points.forEach((point, index) => drawEntity(context, {
          id: `draft-${index}`, type: "line", a: point, b: points[(index + 1) % points.length],
          rotation: 0, layer: activeLayer, constraints: [],
        }, width, height, true));
      } else if (draft) {
        drawEntity(context, { id: "draft", type: tool === "circle" ? "circle" : tool === "rectangle" ? "rectangle" : "line", a: draft.start, b: draft.current, rotation: 0, layer: activeLayer, constraints: [] }, width, height, true);
      }
      context.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";
      context.fillStyle = WORKSPACE_CANVAS.secondary;
      streamedEntities.forEach((entity) => {
        if (entity.type === "rectangle") {
          const a = worldToScreen(entity.a, width, height); const b = worldToScreen(entity.b, width, height);
          context.fillText(formatCadLength(Math.abs(entity.b.x - entity.a.x), units, precision), (a.x + b.x) / 2 - 25, Math.min(a.y, b.y) - 8);
          context.fillText(formatCadLength(Math.abs(entity.b.y - entity.a.y), units, precision), Math.max(a.x, b.x) + 8, (a.y + b.y) / 2);
        }
        if (entity.type === "circle") {
          const a = worldToScreen(entity.a, width, height);
          context.fillText(`Ø${formatCadLength(length(entity.a, entity.b) * 2, units, precision)}`, a.x + 8, a.y - length(entity.a, entity.b) * zoom - 8);
        }
        gdt.filter((annotation) => annotation.entityId === entity.id).forEach((annotation, index) => {
          const anchor = worldToScreen(entity.a, width, height);
          context.fillStyle = WORKSPACE_CANVAS.accent;
          context.fillText(
            `⌖ ${annotation.symbol.toUpperCase()} | ${formatCadLength(annotation.tolerance, units, precision)} | ${annotation.datum}`,
            anchor.x + 10,
            anchor.y + 18 + index * 13,
          );
        });
      });
      if (tool === "select" && sketchSelectionMode === "segment") {
        const activeEntity = entities.find((entity) => entity.id === selectedId);
        if (activeEntity && layers.find((layer) => layer.id === activeEntity.layer)?.visible) {
          handlesFor(activeEntity).forEach((spec) => {
            const s = worldToScreen(spec.world, width, height);
            context.strokeStyle = WORKSPACE_CANVAS.accent;
            context.lineWidth = 1.5;
            context.fillStyle = spec.kind.type === "move" ? WORKSPACE_CANVAS.accent : WORKSPACE_CANVAS.paper;
            context.beginPath();
            if (spec.kind.type === "move") context.arc(s.x, s.y, 5, 0, Math.PI * 2);
            else context.rect(s.x - 4, s.y - 4, 8, 8);
            context.fill();
            context.stroke();
          });
        }
      }
      if (sketchInference) {
        const marker = worldToScreen(sketchInference.point, width, height);
        context.save();
        if (draft && (sketchInference.kind === "horizontal" || sketchInference.kind === "vertical")) {
          const anchor = worldToScreen(draft.start, width, height);
          context.strokeStyle = sketchInference.kind === "horizontal" ? "#ba3b34" : WORKSPACE_CANVAS.seam;
          context.lineWidth = 1;
          context.setLineDash([6, 5]);
          context.beginPath(); context.moveTo(anchor.x, anchor.y); context.lineTo(marker.x, marker.y); context.stroke();
          context.setLineDash([]);
        }
        context.strokeStyle = WORKSPACE_CANVAS.accent;
        context.fillStyle = WORKSPACE_CANVAS.paper;
        context.lineWidth = 2;
        context.beginPath();
        if (sketchInference.kind === "center") context.arc(marker.x, marker.y, 5, 0, Math.PI * 2);
        else if (sketchInference.kind === "midpoint") { context.moveTo(marker.x, marker.y - 6); context.lineTo(marker.x + 6, marker.y + 5); context.lineTo(marker.x - 6, marker.y + 5); context.closePath(); }
        else { context.rect(marker.x - 4.5, marker.y - 4.5, 9, 9); }
        context.fill(); context.stroke();
        context.font = "600 12px Arial";
        const badgeWidth = context.measureText(sketchInference.label).width + 14;
        const badgeX = Math.max(4, Math.min(marker.x + 10, width - badgeWidth - 4));
        const badgeY = Math.max(4, marker.y - 28);
        context.fillStyle = WORKSPACE_CANVAS.paper;
        context.fillRect(badgeX, badgeY, badgeWidth, 22);
        context.fillStyle = WORKSPACE_CANVAS.accent;
        context.fillText(sketchInference.label, badgeX + 7, badgeY + 15);
        context.restore();
      }
    }
  }, [activeLayer, activeDrawingScale, draft, drafting, drawEntity, drawingRevision, entities, explodedAssembly, extrusion, freehandDraft, gdt, grid, layers, material, modelState, precision, selectedId, sketchInference, sketchSession, streamedEntities, tool, units, view, worldToScreen, zoom, visibleSketchEntities, sketchItems, sketchTargets, sketchDrag, sketchSelectionMode, sketchCanvasExtent, fabricOpen]);

  /**
   * Sculpted bodies rebuild from their cage exactly as solids rebuild from their
   * sketch, so editing a cage or its primitive re-derives the surface.
   */
  /**
   * The sculpts, rebuilt — with the in-flight transform folded in if one is
   * running against cage vertices, so the surface follows the pointer.
   *
   * An object-mode preview is not applied here: it moves the *body*, which the
   * scene graph handles, so replaying the cage for it would be wasted work.
   */
  const meshRebuilds = useMemo(() => meshFeatures.map((feature) => {
    let editing = feature;
    if (modalPreview?.vertices && feature.id === selectedMeshId) {
      editing = appendMeshEdit(editing, {
        id: "modal-preview",
        op: "transform",
        vertices: modalPreview.vertices,
        value: modalPreview.value,
        pivot: modalPreview.pivot as TransformVec3,
      });
    }
    if (strokePreview && sculptBrush && feature.id === selectedMeshId) {
      editing = sculptLayerId
        ? appendSculptLayerStroke(editing, sculptLayerId, { id: "stroke-preview", samples: strokePreview, brush: sculptBrush })
        : appendMeshEdit(editing, { id: "stroke-preview", op: "sculpt", samples: strokePreview, brush: sculptBrush });
    }
    return { feature, rebuild: rebuildMeshFeature(editing) };
  }), [meshFeatures, modalPreview, sculptBrush, strokePreview, selectedMeshId, sculptLayerId]);
  const creativeSourceIds = useMemo(
    () => new Set(meshFeatures.flatMap((feature) => feature.sourceExactEntityId ? [feature.sourceExactEntityId] : [])),
    [meshFeatures],
  );
  const selectedExactMesh = useMemo(
    () => exactMeshes.find((mesh) => mesh.sourceId === selectedId && !creativeSourceIds.has(mesh.sourceId)) ?? null,
    [creativeSourceIds, exactMeshes, selectedId],
  );
  const meshBodies = useMemo(() => meshRebuilds.map(({ feature, rebuild }) => {
    const photo = restoredPhotoTexture(feature.photoTexture, rebuild.surface);
    const ownsPaint = texture !== null && sculptUnwrap?.meshId === feature.id && (!feature.photoTexture || !!photo);
    return ({
    id: feature.id,
    name: feature.name,
    surface: rebuild.surface,
    selectedFaces: feature.id === selectedMeshId ? selectedMeshFaces : [],
    selectedEdges: feature.id === selectedMeshId ? meshSelection.edges : [],
    selectedVertices: feature.id === selectedMeshId ? meshSelection.vertices : [],
    shadingAngle: feature.shadingAngle,
    worldMatrix: (() => {
      const base = worldMatrix(posedNodes, feature.id);
      // An object-mode preview rides on top of the stored placement, so nothing
      // is written until the operator is confirmed.
      if (!modalPreview || modalPreview.vertices || feature.id !== selectedMeshId) return base;
      return multiplyMatrices(transformMatrix(modalPreview.value, modalPreview.pivot as TransformVec3), base);
    })(),
    visible: posedNodes.some((node) => node.id === feature.id) ? isVisible(posedNodes, feature.id) : true,
    // Only the body the texture was baked for wears it.
    uvOfCorner: ownsPaint ? sculptUnwrap!.unwrap.uvOfCorner : photo?.uvOfCorner ?? null,
    texture: ownsPaint ? texture : photo?.texture ?? null,
  }); }), [meshRebuilds, modalPreview, posedNodes, sculptUnwrap, texture, selectedMeshId, selectedMeshFaces, meshSelection.edges, meshSelection.vertices]);
  const selectedMesh = meshRebuilds.find(({ feature }) => feature.id === selectedMeshId) ?? null;
  const viewportMeshBodies = useMemo(() => {
    if (!meshCommandPreview || !meshPreviewCurrent(meshCommandPreview, meshFeatures.find(f=>f.id===meshCommandPreview.targetId), selectedMeshId, selectedMeshFaces)) return meshBodies;
    const surface = rebuildMeshFeature(meshCommandPreview.candidate).surface;
    const candidate = meshCommandPreview.candidate;
    const photoValid = !candidate.photoTexture || restoredPhotoTexture(candidate.photoTexture, surface);
    return meshBodies.map(body=>body.id===meshCommandPreview.targetId ? {...body,surface,...(!photoValid ? {texture:null,uvOfCorner:null} : {})} : body);
  }, [meshBodies, meshFeatures, meshCommandPreview, selectedMeshId, selectedMeshFaces]);
  // Document sheets resolve committed geometry only, not an unconfirmed drag or brush stroke.
  const documentMeshKey = JSON.stringify([...new Set(drawingBook.sheets.filter((s) => s.source?.kind === "mesh").map((s) => s.source!.id))].sort());
  const documentMeshIds = useMemo(() => new Set<string>(JSON.parse(documentMeshKey)), [documentMeshKey]);
  const documentMeshes = useMemo(() => meshFeatures.filter((f) => documentMeshIds.has(f.id)).map((feature) => {
    const surface = rebuildMeshFeature(feature).surface;
    const matrix = worldMatrix(sceneNodes, feature.id);
    return { id: feature.id, name: feature.name, mesh: { ...surface, positions: surface.positions.map((p) => transformPoint(matrix, p)) } };
  }), [meshFeatures, sceneNodes, documentMeshIds]);
  const linkedSheetInputs: LinkedSheetInputs = useMemo(() => ({ garment: embeddedGarment, entities, meshes: documentMeshes }), [embeddedGarment, entities, documentMeshes]);
  const linkedDrawingSheets = useMemo(() => new Map(documentLayouts.filter((s) => s.source && !isBimSheet(s)).map((s) => [s.id, buildLinkedSheet(s, linkedSheetInputs, drawingRevision, units)])), [documentLayouts, linkedSheetInputs, drawingRevision, units]);
  const sourceDrawingSheets = useMemo(() => new Map([...bimDrawingSheets, ...linkedDrawingSheets]), [bimDrawingSheets, linkedDrawingSheets]);
  const selectedMeshHandoff = useMemo(
    () => (selectedMesh ? prepareMeshHandoff(selectedMesh.rebuild, sculptRefinements) : null),
    [selectedMesh, sculptRefinements],
  );

  const addSculpt = useCallback((primitive: MeshPrimitive) => {
    const feature = setMeshPrimitive(defaultMeshFeature(`sculpt-${id()}`, `Sculpt ${meshFeatures.length + 1}`), primitive);
    setMeshFeatures((current) => [...current, feature]);
    // The node carries the sculpt's placement. Its id matches the sculpt's, so
    // the two never have to be matched up by a side table.
    setSceneNodes((current) => [...current, createNode(feature.id, feature.name, { kind: "sculpt", id: feature.id })]);
    setSelectedMeshId(feature.id);
    clearMeshSelection();
    setView("model");
    setStatus(`${feature.name} added · click a face in the 3D view, then push or inset it`);
  }, [clearMeshSelection, meshFeatures.length, setMeshFeatures]);

  const makeCreativeCopy = useCallback((initialModifier?: SmartModifierCommand) => {
    if (!selectedExactMesh) {
      setStatus("Select an exact body before creating a creative copy");
      return;
    }
    const positions = Array.from({ length: selectedExactMesh.positions.length / 3 }, (_, index) => [
      selectedExactMesh.positions[index * 3],
      selectedExactMesh.positions[index * 3 + 1],
      selectedExactMesh.positions[index * 3 + 2],
    ] as [number, number, number]);
    const faces = Array.from({ length: selectedExactMesh.indices.length / 3 }, (_, index) => [
      selectedExactMesh.indices[index * 3],
      selectedExactMesh.indices[index * 3 + 1],
      selectedExactMesh.indices[index * 3 + 2],
    ]);
    const featureId = `creative-${id()}`;
    const baseFeature = setMeshSmoothing(setMeshPrimitive(
      defaultMeshFeature(featureId, `Creative ${meshFeatures.length + 1}`),
      { kind: "mesh", positions, faces },
    ), 0);
    const feature = {
      ...baseFeature,
      sourceExactEntityId: selectedExactMesh.sourceId,
      shadingAngle: 45,
      modifiers: initialModifier
        ? [...baseFeature.modifiers, modifierFromSmartCommand(initialModifier, `mod-${id()}`)]
        : baseFeature.modifiers,
    } satisfies MeshFeature;
    setMeshFeatures((current) => [...current, feature]);
    setSceneNodes((current) => [...current, createNode(feature.id, feature.name, { kind: "sculpt", id: feature.id })]);
    setSelectedMeshId(feature.id);
    setSelectedId("");
    setSelectedEntityIds([]);
    setSelectedTopologyIds([]);
    clearMeshSelection();
    setModelToolCategory("modify");
    setStatus(initialModifier
      ? `${describeSmartModifierCommand(initialModifier)} · creative copy ready · exact source preserved`
      : "Creative copy ready · exact source preserved · add Bend, Twist, Taper, Bulge or Displace");
  }, [clearMeshSelection, meshFeatures.length, selectedExactMesh, setMeshFeatures]);

  const removeSculpt = useCallback((meshId: string) => {
    setMeshFeatures((current) => current.filter((feature) => feature.id !== meshId));
    setSceneNodes((current) => removeNode(current, meshId));
    setSelectedMeshId((current) => (current === meshId ? null : current));
    clearMeshSelection();
    setStatus("Sculpt removed");
  }, [clearMeshSelection, setMeshFeatures]);

  /**
   * A click on a sculpted body selects the n-gon face behind the picked triangle.
   *
   * A ray can only ever hit a face, so in vertex or edge mode the hit face is
   * converted into its corners or its edges. That is what makes one pointer
   * work for all three modes without a separate picking path for each.
   */
  const handlePickMeshFace = useCallback((meshId: string, faceIndex: number, additive: boolean) => {
    setPaintedSelection(null);
    setSelectedMeshId(meshId);
    const target = meshRebuilds.find(({ feature }) => feature.id === meshId);
    if (!target) return;
    const surface = target.rebuild.surface;

    setMeshSelection((current) => {
      const picked = setSelectionMode(surface, selectionWith(surface, "face", [faceIndex]), current.mode);
      if (!additive || meshId !== selectedMeshId) return picked;
      if (current.mode === "edge") return selectionWith(surface, "edge", [...current.edges, ...picked.edges]);
      return selectionWith(surface, current.mode, current.mode === "vertex"
        ? [...current.vertices, ...picked.vertices]
        : [...current.faces, ...picked.faces]);
    });
    setStatus(`Sculpt face ${faceIndex} picked · shift-click to add more`);
  }, [meshRebuilds, selectedMeshId]);

  /** Switching mode carries the selection across rather than dropping it. */
  const changeSelectionMode = useCallback((mode: SelectionMode) => {
    const target = meshRebuilds.find(({ feature }) => feature.id === selectedMeshId);
    const next = target ? setSelectionMode(target.rebuild.surface, meshSelection, mode) : selectNone(mode);
    setMeshSelection(next);
    setStatus(describeSelection(next));
  }, [meshRebuilds, meshSelection, selectedMeshId]);

  /** Grow, shrink, loop, ring and the rest, dispatched by name. */
  const runSelectionCommand = useCallback((command: SelectionCommand) => {
    setPaintedSelection(null);
    const target = meshRebuilds.find(({ feature }) => feature.id === selectedMeshId);
    if (!target) return setStatus("Add or select a sculpt first");
    const next = applySelectionCommand(target.rebuild.surface, meshSelection, command);
    setMeshSelection(next);
    setStatus(`${command} · ${describeSelection(next)}`);
  }, [meshRebuilds, meshSelection, selectedMeshId]);

  const armRegionSelection = useCallback((
    kind: "box" | "ellipse" | "lasso" | "polygon",
    combine: RegionMode = "replace",
    requestedMode?: SelectionMode,
  ) => {
    setSelectionBrushEnabled(false);
    setPaintedSelection(null);
    const target = meshRebuilds.find(({ feature }) => feature.id === selectedMeshId)
      ?? (meshRebuilds.length === 1 ? meshRebuilds[0] : null);
    const exactBodyMode = !selectedMeshId && exactMeshes.length > 0;
    if (!target && !exactBodyMode) return setStatus("Add an exact or sculpted body before using marquee selection");
    if (!exactBodyMode && target && target.feature.id !== selectedMeshId) setSelectedMeshId(target.feature.id);
    if (!exactBodyMode && target && requestedMode) {
      setMeshSelection((current) => setSelectionMode(target.rebuild.surface, current, requestedMode));
    }
    setRegionRequest((current) => ({ kind, combine, token: (current?.token ?? 0) + 1, scope: exactBodyMode ? "body" : "mesh" }));
    setView("model");
  }, [exactMeshes.length, meshRebuilds, selectedMeshId]);

  /**
   * Records a sculpt as another edit on the cage rather than baking the result,
   * which is what keeps the shape rebuildable afterwards.
   */
  const applySculptEdit = useCallback((op: "extrude" | "inset", amount: number) => {
    const feature = meshFeatures.find(f => f.id === selectedMeshId);
    if (!feature) return setStatus("Add or select a sculpt first");
    try {
      const plan = previewMeshCommand(feature, selectedMeshFaces, op, amount);
      setView("model");
      setMeshCommandPreview(plan);
      setStatus(`Preview ${op} · ${plan.faces.length} cage face(s) · ${amount} mm · Apply or Cancel`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to preview edit"); }
  }, [meshFeatures, selectedMeshFaces, selectedMeshId]);
  const acceptMeshCommandPreview = () => {
    if (!meshCommandPreview) return;
    const plan = meshCommandPreview, feature = meshFeatures.find(f=>f.id===plan.targetId);
    if (!meshPreviewCurrent(plan, feature, selectedMeshId, selectedMeshFaces)) {
      setMeshCommandPreview(null); setStatus("Selection or geometry changed; preview again"); return;
    }
    setMeshFeatures(current=>current.map(f=>f.id===plan.targetId ? plan.candidate : f));
    setMeshCommandPreview(null); clearMeshSelection();
    setStatus(`${plan.op === "extrude" ? "Pushed" : "Inset"} ${plan.faces.length} cage face(s) by ${plan.amount} · Undo available`);
  };

  /** Creases the picked faces' edges, so they stay crisp through smoothing. */
  const applySculptCrease = useCallback((sharpness: number) => {
    if (!selectedMeshId) return setStatus("Add or select a sculpt first");
    if (selectedMeshFaces.length === 0) return setStatus("Click a face in the 3D view first");
    const target = meshRebuilds.find(({ feature }) => feature.id === selectedMeshId);
    if (!target) return;
    const cageFaces = cageFacesForSurfaceFaces(target.rebuild, selectedMeshFaces);
    const edges = creaseEdgesForFaces(target.rebuild.cage, cageFaces);
    if (edges.length === 0) return setStatus("That selection has no cage edges to crease");
    setMeshFeatures((current) => current.map((feature) => feature.id !== selectedMeshId ? feature : appendMeshEdit(
      feature, { id: `edit-${id()}`, op: "crease", edges, sharpness },
    )));
    setStatus(sharpness > 0
      ? `Creased ${edges.length} edge(s) at sharpness ${sharpness}`
      : `Released ${edges.length} edge(s) back to smooth`);
  }, [meshRebuilds, selectedMeshFaces, selectedMeshId, setMeshFeatures]);

  /** Loop cut and bevel both act on the edges bounding the picked faces. */
  const applySculptTopology = useCallback((op: "loop-cut" | "bevel", amount: number) => {
    if (!selectedMeshId) return setStatus("Add or select a sculpt first");
    if (selectedMeshFaces.length === 0) return setStatus("Click a face in the 3D view first");
    const target = meshRebuilds.find(({ feature }) => feature.id === selectedMeshId);
    if (!target) return;
    const cageFaces = cageFacesForSurfaceFaces(target.rebuild, selectedMeshFaces);
    const edges = creaseEdgesForFaces(target.rebuild.cage, cageFaces);
    if (edges.length === 0) return setStatus("That selection has no cage edges to work on");
    setMeshFeatures((current) => current.map((feature) => feature.id !== selectedMeshId ? feature : appendMeshEdit(
      feature,
      op === "bevel"
        ? { id: `edit-${id()}`, op: "bevel", edges, amount }
        : { id: `edit-${id()}`, op: "loop-cut", edge: edges[0], position: 0.5 },
    )));
    clearMeshSelection();
    setStatus(op === "bevel"
      ? `Bevelled ${edges.length} edge(s) by ${amount}`
      : "Loop cut inserted · the ring around that edge is now split");
  }, [clearMeshSelection, meshRebuilds, selectedMeshFaces, selectedMeshId, setMeshFeatures]);

  /**
   * Exports the selected sculpt as STEP. The conversion runs the exact-geometry
   * bridge and OCCT, so it is slow enough to need a busy state, and its result
   * carries how much of the surface is exact rather than interpolated.
   */
  const exportSculptStep = useCallback(async () => {
    const target = meshRebuilds.find(({ feature }) => feature.id === selectedMeshId);
    if (!target) return setStatus("Select a sculpt to export");
    setSculptExporting(true);
    setStatus("Converting the sculpt to exact geometry…");
    try {
      const filename = `${target.feature.name.replace(/[^a-z0-9-_]+/gi, "-") || "sculpt"}.step`;
      const { step, conversion } = await sculptToStep(target.rebuild.cage, {
        refinements: sculptRefinements,
        filename,
        metadata: stepMetadataFor(target.feature.name),
      });
      download(step, filename, "application/step");
      const exactShare = conversion.exactPatches / (conversion.exactPatches + conversion.approximatedPatches);
      setStatus(conversion.closed
        ? `STEP exported · ${(exactShare * 100).toFixed(1)}% exact across ${conversion.exactPatches + conversion.approximatedPatches} patches`
          + ` · sewn at ${conversion.tolerance.toFixed(4)} mm`
        : `STEP exported as an open shell · ${conversion.notes.join(" · ")}`);
    } catch (error) {
      setStatus(error instanceof Error ? `STEP export failed · ${error.message}` : "STEP export failed");
    } finally {
      setSculptExporting(false);
    }
  }, [meshRebuilds, sculptRefinements, selectedMeshId]);

  /**
   * Exports every visible sculpt as one STEP file.
   *
   * The exchange carries geometry, not a transform tree, so each body's world
   * matrix is baked in on the way out — otherwise an assembly arrives as a pile
   * of parts stacked at the origin.
   */
  const exportSceneStep = useCallback(async () => {
    const bodies = meshRebuilds
      .filter(({ feature }) => meshBodies.find((body) => body.id === feature.id)?.visible !== false)
      .map(({ feature, rebuild }) => ({
        cage: rebuild.cage,
        name: feature.name,
        matrix: worldMatrix(sceneNodes, feature.id),
      }));
    if (bodies.length === 0) return setStatus("Nothing visible to export");
    setSculptExporting(true);
    setStatus(`Converting ${bodies.length} bod${bodies.length === 1 ? "y" : "ies"} to exact geometry…`);
    try {
      const filename = `${(projectTitle).replace(/[^a-z0-9-_]+/gi, "-")}.step`;
      const { step, conversions, notes } = await sceneToStep(bodies, {
        refinements: sculptRefinements,
        filename,
        metadata: stepMetadataFor(projectTitle),
      });
      download(step, filename, "application/step");
      const exact = conversions.reduce((total, one) => total + one.exactPatches, 0);
      const all = conversions.reduce((total, one) => total + one.exactPatches + one.approximatedPatches, 0);
      setStatus(`Scene exported · ${conversions.length} bodies, ${(exact / Math.max(all, 1) * 100).toFixed(1)}% exact · ${notes.join(" · ")}`);
    } catch (error) {
      setStatus(error instanceof Error ? `Scene export failed · ${error.message}` : "Scene export failed");
    } finally {
      setSculptExporting(false);
    }
  }, [meshBodies, meshRebuilds, projectTitle, sceneNodes, sculptRefinements]);

  /**
   * Edits the selected sculpt's modifier stack. Every change is a whole new
   * stack, so undo and autosave see it as one document change rather than a
   * sequence of half-applied ones.
   */
  const editModifiers = useCallback((change: (modifiers: MeshModifier[]) => MeshModifier[]) => {
    if (!selectedMeshId) return;
    setMeshFeatures((current) => current.map((feature) => feature.id !== selectedMeshId
      ? feature
      : setMeshModifiers(feature, change(feature.modifiers))));
  }, [selectedMeshId, setMeshFeatures]);

  const addSculptModifier = useCallback((kind: ModifierKind) => {
    editModifiers((modifiers) => [...modifiers, defaultModifier(kind, `mod-${id()}`)]);
    setStatus(`${MODIFIER_LABELS[kind].label} added · drag it up or down to change when it runs`);
  }, [editModifiers]);

  const applySmartModifierCommand = useCallback((intent: SmartModifierCommand) => {
    if (!selectedMeshId) {
      if (selectedExactMesh) return makeCreativeCopy(intent);
      setStatus("Select a creative or exact body before adding a modifier");
      return;
    }
    editModifiers((modifiers) => [...modifiers, modifierFromSmartCommand(intent, `mod-${id()}`)]);
    setStatus(`${describeSmartModifierCommand(intent)} added · parameters remain editable in the modifier stack`);
  }, [editModifiers, makeCreativeCopy, selectedExactMesh, selectedMeshId]);

  const applySmartLockCommand = useCallback((intent: SmartLockCommand) => {
    if (!selectedMeshId) return setStatus("Select a creative body before changing an intent lock");
    const feature = meshFeatures.find((entry) => entry.id === selectedMeshId);
    const target = [...(feature?.modifiers ?? [])].reverse().find((modifier): modifier is CreativeMeshModifier =>
      modifier.kind === "bend" || modifier.kind === "twist" || modifier.kind === "taper" || modifier.kind === "bulge" || modifier.kind === "displace");
    if (!target) return setStatus("Add Bend, Twist, Taper, Bulge or Displace before applying that intent lock");
    editModifiers((modifiers) => {
      return updateModifier(modifiers, target.id, { locks: { ...target.locks, [intent.lock]: intent.enabled } } as Partial<MeshModifier>);
    });
    setStatus(`${intent.lock === "preserveVolume" ? "Preserve volume" : "Anchor lower end"} ${intent.enabled ? "enabled" : "disabled"} · intent remains editable`);
  }, [editModifiers, meshFeatures, selectedMeshId]);

  /**
   * Fuses, cuts or intersects two sculpts.
   *
   * The result becomes a *new* sculpt with a given cage, and both operands are
   * left alone. A boolean cannot be replayed from a cage and an edit list, so
   * folding it into either input would quietly throw away that input's history;
   * making it a third body leaves the decision to delete them with the user.
   */
  const applySculptBoolean = useCallback(async (operation: BooleanOperation, otherId: string) => {
    const target = meshRebuilds.find(({ feature }) => feature.id === selectedMeshId);
    const other = meshRebuilds.find(({ feature }) => feature.id === otherId);
    if (!target || !other) return setStatus("Pick two sculpts to combine");

    setSculptExporting(true);
    setStatus(`Computing the ${operation}…`);
    try {
      const result = await booleanMeshes(target.rebuild.surface, other.rebuild.surface, operation);
      if (isEmptyResult(result)) {
        setStatus(`The ${operation} left nothing · ${result.notes.join(" · ")}`);
        return;
      }
      const feature = setMeshPrimitive(
        defaultMeshFeature(`sculpt-${id()}`, `${operation[0].toUpperCase()}${operation.slice(1)} ${meshFeatures.length + 1}`),
        { kind: "mesh", positions: result.mesh.positions, faces: result.mesh.faces },
      );
      // The operands were already smooth surfaces, so subdividing the result
      // again would round a shape that is finished.
      setMeshFeatures((current) => [...current, setMeshSmoothing(feature, 0)]);
      setSceneNodes((current) => [...current, createNode(feature.id, feature.name, { kind: "sculpt", id: feature.id })]);
      setSelectedMeshId(feature.id);
      clearMeshSelection();
      setStatus(`${operation} done · ${result.notes[0]} · both originals kept`);
    } catch (error) {
      setStatus(error instanceof Error ? `Boolean failed · ${error.message}` : "Boolean failed");
    } finally {
      setSculptExporting(false);
    }
  }, [clearMeshSelection, meshFeatures.length, meshRebuilds, selectedMeshId, setMeshFeatures]);

  /**
   * Flattens the selected sculpt into the plane, so it can carry a texture.
   *
   * The result is reported rather than just stored: a conformal map preserves
   * angles and not areas, and how badly the areas stretched is the one number
   * that decides whether the unwrap is usable.
   */
  const unwrapSculpt = useCallback((seamAngle: number) => {
    const target = meshRebuilds.find(({ feature }) => feature.id === selectedMeshId);
    if (!target) return setStatus("Select a sculpt to unwrap");
    const unwrap = unwrapMesh(target.rebuild.surface, { seamAngle });
    setSculptUnwrap({ meshId: target.feature.id, unwrap });
    setStatus(`Unwrapped · ${unwrap.notes.join(" · ")}`);
  }, [meshRebuilds, selectedMeshId]);

  const moveSculpt = useCallback((changes: Partial<NodeTransform>) => {
    if (!selectedMeshId) return;
    setSceneNodes((current) => updateTransform(current, selectedMeshId, changes));
  }, [selectedMeshId]);

  /**
   * Parents one sculpt to another, keeping it exactly where it is. Without that
   * the part would jump by the whole of its new parent's transform, which reads
   * as the operation having gone wrong.
   */
  const parentSculpt = useCallback((parentId: string | null) => {
    if (!selectedMeshId) return;
    setSceneNodes((current) => {
      const result = setParent(current, selectedMeshId, parentId);
      setStatus(result.problem ?? (parentId ? "Parented · it will follow its parent from now on" : "Unparented"));
      return result.nodes;
    });
  }, [selectedMeshId]);

  /**
   * What G, R and S will act on.
   *
   * A vertex selection puts the operator in edit mode and it moves those cage
   * vertices; with nothing selected it moves the whole body. That is the same
   * rule Blender uses, and it means one pair of keys covers both without a mode
   * switch.
   */
  const modalTarget = useMemo(() => {
    const target = meshRebuilds.find(({ feature }) => feature.id === selectedMeshId);
    if (!target) return null;

    const cageVertices = cageFacesForSurfaceFaces(target.rebuild, selectedMeshFaces)
      .flatMap((face) => target.rebuild.cage.faces[face] ?? []);
    const vertices = [...new Set(cageVertices)];

    if (vertices.length > 0) {
      return {
        meshId: target.feature.id,
        pivot: medianPoint(vertices.map((vertex) => target.rebuild.cage.positions[vertex])) as Triple,
        vertices,
      };
    }

    const node = sceneNodes.find((entry) => entry.id === target.feature.id);
    const bounds = meshBounds(target.rebuild.surface);
    const centre: TransformVec3 = [
      (bounds.min[0] + bounds.max[0]) / 2,
      (bounds.min[1] + bounds.max[1]) / 2,
      (bounds.min[2] + bounds.max[2]) / 2,
    ];
    const placed = node ? worldMatrix(sceneNodes, node.id) : null;
    const pivot: Triple = placed
      ? [
          placed[0] * centre[0] + placed[4] * centre[1] + placed[8] * centre[2] + placed[12],
          placed[1] * centre[0] + placed[5] * centre[1] + placed[9] * centre[2] + placed[13],
          placed[2] * centre[0] + placed[6] * centre[1] + placed[10] * centre[2] + placed[14],
        ]
      : centre as Triple;
    // The body's own axes, so a second press of X means *its* X.
    const frame: Triple[] | undefined = placed
      ? [[placed[0], placed[1], placed[2]], [placed[4], placed[5], placed[6]], [placed[8], placed[9], placed[10]]]
      : undefined;
    return { meshId: target.feature.id, pivot, frame };
  }, [meshRebuilds, sceneNodes, selectedMeshFaces, selectedMeshId]);

  /**
   * A confirmed modal transform.
   *
   * Vertices become another edit on the cage, so the move stays replayable and
   * undoable like everything else. A whole body instead folds into its scene
   * node, since that is where placement lives.
   */
  const commitModalTransform = useCallback((
    value: TransformValue,
    pivot: Triple,
    vertices?: number[],
  ) => {
    setModalPreview(null);
    if (!selectedMeshId) return;

    if (vertices && vertices.length > 0) {
      setMeshFeatures((current) => current.map((feature) => feature.id !== selectedMeshId
        ? feature
        : appendMeshEdit(feature, {
            id: `edit-${id()}`,
            op: "transform",
            vertices,
            value,
            pivot: pivot as TransformVec3,
          })));
      setStatus(`${value.kind} applied to ${vertices.length} cage vertex/vertices`);
      return;
    }

    setSceneNodes((current) => current.map((node) => {
      if (node.id !== selectedMeshId) return node;
      const transform = { ...node.transform };
      if (value.kind === "move") {
        transform.position = transform.position.map((axis, index) => axis + value.delta[index]) as Triple;
      } else if (value.kind === "scale") {
        transform.scale = transform.scale.map((axis, index) => axis * value.factor[index]) as Triple;
      } else {
        // Turning about a world axis composes onto the stored Euler angles only
        // when the axis is one of them; anything else is decomposed from the
        // matrix so the result is exact rather than approximately right.
        const rotated = multiplyMatrices(transformMatrix(value, pivot as TransformVec3), composeMatrix(node.transform));
        return { ...node, transform: decomposeMatrix(rotated) };
      }
      return { ...node, transform };
    }));
    setStatus(`${value.kind} applied to ${selectedMeshId}`);
  }, [selectedMeshId, setMeshFeatures]);

  /**
   * A brush stroke, previewed while it is drawn and recorded when it ends.
   *
   * The stroke goes into the edit list whole, so it replays with everything else
   * and the cage underneath stays editable — which is the difference between
   * sculpting here and sculpting in a tool that bakes.
   */
  const changeSculptBrush = useCallback((next: BrushSettings | null) => {
    setSculptBrush(next);
    setPainting(false);
    if (next) {
      setSculptSettings(next);
      setPainting(false);
      setSelectionBrushEnabled(false);
      setRegionRequest(null);
      setPickMode("entity");
    }
    setStrokePreview(null);
    setStatus(next ? `Sculpt mode on · ${describeBrush(next)}` : "Sculpt paused · drag to orbit");
  }, []);

  const createSculptLayer = useCallback(() => {
    if (!selectedMeshId) return;
    const layerId = `sculpt-layer-${id()}`;
    setMeshFeatures((current) => current.map((feature) => feature.id === selectedMeshId ? addSculptLayer(feature, layerId, `Layer ${(feature.sculptLayers?.length ?? 0) + 1}`, 1) : feature));
    setActiveSculptLayerId(layerId);
    setStatus("Added a non-destructive multires sculpt layer");
  }, [selectedMeshId, setMeshFeatures]);

  const handleSculptStroke = useCallback((samples: StrokeSample[], done: boolean) => {
    if (samples.length === 0) { setStrokePreview(null); return; }
    if (!sculptBrush || !selectedMeshId) return;
    if (!done) {
      setStrokePreview(samples);
      return;
    }
    setStrokePreview(null);
    if (samples.length === 0) return;

    const target = meshRebuilds.find(({ feature }) => feature.id === selectedMeshId);
    const result = target ? applyStroke(sculptLayerId ? target.rebuild.surface : target.rebuild.cage, samples, { ...sculptBrush, detail: sculptLayerId ? 0 : sculptBrush.detail }) : null;
    if (!result || result.applied === 0) {
      setStatus(result?.notes[0] ?? "The stroke did nothing");
      return;
    }
    setMeshFeatures((current) => current.map((feature) => feature.id !== selectedMeshId
      ? feature
      : sculptLayerId
        ? appendSculptLayerStroke(feature, sculptLayerId, { id: `stroke-${id()}`, samples, brush: sculptBrush })
        : appendMeshEdit(feature, { id: `edit-${id()}`, op: "sculpt", samples, brush: sculptBrush })));
    setStatus(`${describeBrush(sculptBrush)} · ${result.applied} sample(s)${sculptLayerId ? " · multires layer" : ""}`
      + (result.facesAdded > 0 ? ` · +${result.facesAdded} faces` : ""));
  }, [meshRebuilds, sculptBrush, selectedMeshId, setMeshFeatures, sculptLayerId]);

  /**
   * Re-evaluates the graph whenever it changes.
   *
   * Guarded against arriving out of order: a slow boolean started before a quick
   * edit would otherwise overwrite the newer result with the older one.
   */
  useEffect(() => {
    let current = true;
    void evaluateGeometryGraph(geometryGraph).then((result) => {
      if (!current) return;
      setGraphResult({ mesh: result.geometry, problem: result.problem, notes: result.notes });
    });
    return () => { current = false; };
  }, [geometryGraph]);

  const editGraph = useCallback((change: (graph: GeometryGraph) => GeometryGraph) => {
    setGeometryGraph((current) => change(current));
  }, []);

  const connectGraphNodes = useCallback((link: NodeLink) => {
    setGeometryGraph((current) => {
      const result = connectGraph(current, link);
      if (result.problem) setStatus(result.problem);
      return result.graph;
    });
  }, []);

  /**
   * Turns the graph's result into a sculpt.
   *
   * A copy rather than a live link: the graph keeps evaluating on its own, and a
   * sculpt that silently changed underneath its own edit list would be a
   * different thing from the one those edits were recorded against.
   */
  const applyGraphAsSculpt = useCallback(() => {
    const mesh = graphResult.mesh;
    if (!mesh || mesh.faces.length === 0) return setStatus("The graph produces no geometry yet");
    const feature = setMeshPrimitive(
      defaultMeshFeature(`sculpt-${id()}`, `Graph ${meshFeatures.length + 1}`),
      { kind: "mesh", positions: mesh.positions, faces: mesh.faces },
    );
    setMeshFeatures((current) => [...current, setMeshSmoothing(feature, 0)]);
    setSceneNodes((current) => [...current, createNode(feature.id, feature.name, { kind: "sculpt", id: feature.id })]);
    setSelectedMeshId(feature.id);
    clearMeshSelection();
    setView("model");
    setStatus(`${feature.name} baked from the graph · ${mesh.faces.length} faces`);
  }, [clearMeshSelection, graphResult.mesh, meshFeatures.length, setMeshFeatures]);

  const editMaterial = useCallback((change: (graph: MaterialGraph) => MaterialGraph) => {
    setMaterialGraph((current) => change(current));
  }, []);

  const connectMaterialNodes = useCallback((link: MaterialLink) => {
    setMaterialGraph((current) => {
      const result = connectMaterial(current, link);
      if (result.problem) setStatus(result.problem);
      return result.graph;
    });
  }, []);

  /**
   * Bakes the material, unwrapping the sculpt first if it has no UVs yet.
   *
   * A texture with nowhere to sit is not useful, and asking the user to run the
   * unwrap themselves first is a step whose only purpose is to be forgotten.
   */
  const bakeMaterialTexture = useCallback(() => {
    const target = meshRebuilds.find(({ feature }) => feature.id === selectedMeshId);
    if (!target) return setStatus("Select a sculpt to bake a material onto");

    if (sculptUnwrap?.meshId !== target.feature.id) {
      const unwrap = unwrapMesh(target.rebuild.surface, { seamAngle: 60 });
      setSculptUnwrap({ meshId: target.feature.id, unwrap });
    }
    const baked = bakeMaterial(materialGraph, bakeSize);
    setTexture({ pixels: baked.baseColor, size: baked.width, revision: 0 });
    setStatus(`Material baked at ${baked.width}px · ${describeMaterial(materialGraph)}`);
  }, [bakeSize, materialGraph, meshRebuilds, sculptUnwrap, selectedMeshId]);

  /**
   * One dab of paint.
   *
   * The buffer is written in place and only the revision changes, so a stroke
   * costs one small state update per dab rather than a copy of the whole image.
   */
  const beginPaint = useCallback(() => {
    if (paintTransaction.current) return;
    paintTransaction.current = {
      before: texture, working: texture ? { ...texture, pixels: texture.pixels.slice() } : null, changed: false,
    };
  }, [texture]);
  const endPaint = useCallback((cancelled: boolean) => {
    const transaction = paintTransaction.current;
    if (!transaction) return;
    paintTransaction.current = null;
    if (cancelled || !transaction.changed) setTexture(transaction.before);
    setPaintCommit((current) => current + 1);
  }, []);
  const paintOnTexture = useCallback((meshId: string, u: number, v: number) => {
    if (!paintTransaction.current || meshId !== sculptUnwrap?.meshId || meshId !== selectedMeshId) return;
    const transaction = paintTransaction.current;
    const current = transaction.working;
    if (!current) return;
    const touched = paintDab(current.pixels, current.size, { u, v },
      { color: paintColor, radius: paintRadius, strength: paintStrength, smudge: paintSoften });
    if (touched === 0) return;
    transaction.changed = true;
    transaction.working = { ...current, revision: current.revision + 1 };
    setTexture(transaction.working);
  }, [paintColor, paintRadius, paintStrength, paintSoften, sculptUnwrap, selectedMeshId]);

  const startSurfacePaint = () => {
    if (!selectedMesh) return setStatus("Select a creative mesh or make a creative copy first");
    if (texture && sculptUnwrap?.meshId !== selectedMeshId) return setStatus("Another mesh owns this project's paint texture. Select that mesh to preserve its paint.");
    const surface = selectedMesh.rebuild.surface;
    if (!surface.faces.length) return setStatus("This mesh has no paintable faces");
    if (selectedMesh.feature.photoTexture && !restoredPhotoTexture(selectedMesh.feature.photoTexture, surface)) return setStatus("Photo UVs no longer match this topology. Undo topology changes before painting the photo texture.");
    if (texture && sculptUnwrap && (sculptUnwrap.unwrap.uvOfCorner.length !== surface.faces.length || surface.faces.some((face, index) => face.length !== sculptUnwrap.unwrap.uvOfCorner[index]?.length))) {
      return setStatus("Mesh topology changed after painting. Undo the topology edit before resuming paint.");
    }
    if (!texture) {
      const photo = restoredPhotoTexture(selectedMesh.feature.photoTexture, surface);
      if (selectedMesh.feature.photoTexture && !photo) return setStatus("Photo UVs no longer match this topology. Undo topology changes before painting the photo texture.");
      setSculptUnwrap({ meshId: selectedMesh.feature.id, unwrap: photo ? { charts: [], uvOfCorner: photo.uvOfCorner, areaDistortion: 0, notes: ["Imported photo UVs"] } : unwrapMesh(surface, { seamAngle: 60 }) });
      setTexture(photo ? { ...photo.texture, pixels: photo.texture.pixels.slice() } : { pixels: blankTexture(512, [.8, .8, .8]), size: 512, revision: 0 });
    }
    clearMeshSelection();
    setSculptBrush(null);
    setSelectionBrushEnabled(false);
    setRegionRequest(null);
    setPickMode("entity");
    setViewport((current) => ({ ...current, shading: "shaded" }));
    setPainting(true);
    setStatus("Painting · drag on the selected mesh · pause to orbit · each stroke is undoable");
  };

  const exportPaintTexture = () => {
    if (!texture) return;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = texture.size;
    const context = canvas.getContext("2d");
    if (!context) return setStatus("Texture export is unavailable on this device");
    const pixels = context.createImageData(texture.size, texture.size);
    // UV v=0 is the bottom edge, whereas PNG scanlines start at the top.
    for (let y = 0; y < texture.size; y++) pixels.data.set(texture.pixels.subarray(y * texture.size * 4, (y + 1) * texture.size * 4), (texture.size - y - 1) * texture.size * 4);
    context.putImageData(pixels, 0, 0);
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "form-painted-texture.png";
    link.click();
    setStatus("Paint texture exported as PNG");
  };

  /** Turns a float buffer into a data URL the panel can show. */
  const previewFrom = useCallback((progress: RenderProgress, aov: Aov, exposure: number, denoise: boolean) => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = progress.width;
    canvas.height = progress.height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    const image = context.createImageData(progress.width, progress.height);
    image.data.set(denoise && aov === "beauty" ? toDenoisedImage(progress, exposure) : toImage(progress, aov, exposure));
    context.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  }, []);

  /** The bodies as the tracer wants them: geometry, a material, and a matrix. */
  const buildRenderScene = useCallback((): RenderScene | null => {
    const camera = viewportHandleRef.current?.readCamera();
    if (!camera) return null;
    const objects = meshRebuilds
      .filter(({ feature }) => meshBodies.find((body) => body.id === feature.id)?.visible !== false)
      .map(({ feature, rebuild }) => ({
        mesh: rebuild.surface,
        material: renderMaterialFromAppearance(appearance),
        matrix: worldMatrix(sceneNodes, feature.id),
      }));
    if (objects.length === 0 && volumes.length === 0) return null;

    const sky = CAD_ENVIRONMENTS[appearance.environment];
    const asRgb = (hex: string): Rgb => [1, 3, 5].map((offset) =>
      parseInt(hex.slice(offset, offset + 2), 16) / 255) as Rgb;
    return {
      objects,
      volumes,
      camera,
      environment: {
        horizon: asRgb(sky.hemisphereGround),
        zenith: asRgb(sky.hemisphereSky),
        intensity: sky.hemisphereIntensity * appearance.exposure,
      },
    };
  }, [appearance, meshBodies, meshRebuilds, sceneNodes, volumes]);

  const addImportedVolume = useCallback((result: OpenVdbImportResult) => {
    const densityScale = Math.min(2, 0.08 / Math.max(0.001, result.grid.maxDensity));
    setVolumes((current) => [...current, {
      grid: result.grid,
      densityScale,
      scatteringColor: [0.82, 0.88, 0.94],
      emissionStrength: result.grid.temperature ? 0.18 : 0,
      maxTemperature: 2200,
    }]);
    setView("model");
    const temperature = result.grid.temperature
      ? ` · temperature ${result.grid.temperature.minValue.toPrecision(3)}–${result.grid.temperature.maxValue.toPrecision(3)}`
      : "";
    setStatus(`${result.grid.name} imported · ${result.grid.dimensions.join("×")} · ${result.grid.activeIndices.length.toLocaleString()} active voxels${temperature} · ${result.parserVersion}`);
  }, []);

  const importVolume = useCallback(async (file: File) => {
    setVolumeImportBusy(true);
    setStatus(`Reading ${file.name} · browser compatibility decoder…`);
    try {
      const result = await importOpenVdbInWorker(file, { resolution: 48, densityCutoff: 0.001 });
      addImportedVolume(result);
      setStatus(`Compatibility preview imported · verify scalar values in the desktop app · ${result.parserVersion}`);
    } catch (error) {
      setStatus(error instanceof Error ? `OpenVDB import failed · ${error.message}` : "OpenVDB import failed");
    } finally {
      setVolumeImportBusy(false);
    }
  }, [addImportedVolume]);

  const chooseVolumeImport = useCallback(async () => {
    setVolumeImportBusy(true);
    setStatus("Choose an OpenVDB file · official native decoder");
    try {
      const result = await importOpenVdbNative({ resolution: 64, densityCutoff: 0.0001 });
      if (!result) { setStatus("OpenVDB import cancelled"); return; }
      addImportedVolume(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Native OpenVDB import failed";
      if (message.includes("standalone desktop")) {
        setStatus("Web compatibility preview · desktop uses the verified official OpenVDB decoder");
        volumeImportRef.current?.click();
      } else setStatus(`OpenVDB import failed · ${message}`);
    } finally {
      setVolumeImportBusy(false);
    }
  }, [addImportedVolume]);

  const queueRender = useCallback(() => {
    const scene = buildRenderScene();
    if (!scene) return setStatus("Nothing to render — add a sculpt first");
    const jobId = `render-${id()}`;
    setRenderQueue((current) => enqueue(current, jobId, `Render ${current.jobs.length + 1}`, renderSettings));
    setStatus(`Queued ${renderSettings.width}×${renderSettings.height} at ${renderSettings.samples} samples`);
  }, [buildRenderScene, renderSettings]);

  /**
   * Traces one pass per frame.
   *
   * A pass at a time rather than the whole render, because tracing blocks the
   * thread: a hundred samples in one go would freeze the tab for a minute with
   * nothing on screen. Between passes the browser gets to draw, so the image
   * resolves visibly and Stop is a button that can actually be pressed.
   */
  useEffect(() => {
    const job = nextJob(renderQueue);
    if (!job) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      let active = renderRef.current;
      if (!active || active.jobId !== job.id) {
        const scene = buildRenderScene();
        if (!scene) {
          setRenderQueue((current) => updateJob(current, job.id, { status: "cancelled" }));
          return;
        }
        active = {
          jobId: job.id, scene, prepared: prepareScene(scene), progress: startRender(job.settings),
        };
        renderRef.current = active;
        setRenderQueue((current) => updateJob(current, job.id, { status: "rendering" }));
      }

      active.progress = renderPass(active.scene, active.prepared, job.settings, active.progress);
      const done = active.progress.samples >= job.settings.samples;
      setRenderPreview(previewFrom(active.progress, renderAov, renderExposure, renderDenoise));
      setRenderQueue((current) => updateJob(current, job.id, {
        progress: active!.progress.samples,
        status: done ? "done" : "rendering",
        result: done ? active!.progress : null,
      }));
      if (done) {
        setStatus(`${job.name} finished · ${job.settings.samples} sample(s)`);
        renderRef.current = null;
      }
    }, 0);

    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [buildRenderScene, previewFrom, renderAov, renderDenoise, renderExposure, renderQueue]);

  /** Redraws the preview when the pass or exposure changes, without re-tracing. */
  useEffect(() => {
    const finished = renderRef.current?.progress
      ?? renderQueue.jobs.find((job) => job.status === "done")?.result;
    if (!finished) return;
    setRenderPreview(previewFrom(finished, renderAov, renderExposure, renderDenoise));
  }, [previewFrom, renderAov, renderDenoise, renderExposure, renderQueue]);

  /** The surface a region drag selects over, with the matrix placing it. */
  const regionTarget = useMemo(() => {
    const target = meshRebuilds.find(({ feature }) => feature.id === selectedMeshId);
    if (!target) return null;
    return {
      meshId: target.feature.id,
      surface: target.rebuild.surface,
      worldMatrix: worldMatrix(sceneNodes, target.feature.id),
    };
  }, [meshRebuilds, sceneNodes, selectedMeshId]);

  const maskTopology = useMemo(() => regionTarget ? selectionTopology(regionTarget.surface) : "", [regionTarget]);
  const activeSelectionWeights = useMemo(() => {
    if (!regionTarget) return [];
    if (paintedSelection?.meshId === regionTarget.meshId && paintedSelection.topology === maskTopology) return paintedSelection.weights;
    const picked = new Set(meshSelection.vertices);
    return regionTarget.surface.positions.map((_, i) => picked.has(i) ? 1 : 0);
  }, [regionTarget, paintedSelection, maskTopology, meshSelection.vertices]);
  const weightedSelectionCount = activeSelectionWeights.filter((w) => w > 0.001).length;
  const brushUnavailable = !selectedMesh ? "Select a creative mesh first"
    : selectedMesh.feature.sculptLayers?.some((layer) => layer.strokes.length) ? "Painted selection currently requires a mesh without multires sculpt layers"
    : selectedMesh.rebuild.surface.positions.length > 20_000 ? "Brush selection currently supports up to 20,000 evaluated vertices; reduce subdivision first"
    : "";
  const acceptSelectionWeights = useCallback((weights: number[]) => {
    if (!regionTarget) return;
    setPaintedSelection({ meshId: regionTarget.meshId, topology: maskTopology, weights });
  }, [regionTarget, maskTopology]);
  const applyWeightedSelection = (edit: MaskDeform) => {
    if (!selectedMesh || !weightedSelectionCount || !Number.isFinite(edit.amount)) return;
    if (brushUnavailable) return setStatus(brushUnavailable);
    setSelectionBrushEnabled(false);
    const modifier: MeshModifier = { id: `mask-${id()}`, kind: "selection", enabled: true, topology: maskTopology, weights: [...activeSelectionWeights], ...edit };
    setMeshFeatures((current) => current.map((feature) => feature.id === selectedMeshId ? { ...feature, modifiers: [...feature.modifiers, modifier] } : feature));
    setStatus(`${edit.operation} · ${weightedSelectionCount} weighted vertices · saved in modifier stack · Undo available`);
  };
  const selectionHudContent = selectionHudEnabled && selectedMeshId && !toolShelf.open && !brushUnavailable && (weightedSelectionCount > 0 || selectionBrushEnabled)
    ? <SelectionHud count={weightedSelectionCount} brush={selectionBrushEnabled} settings={selectionBrushSettings} onSettings={setSelectionBrushSettings} onApply={applyWeightedSelection} onClear={clearMeshSelection} onHide={() => setSelectionHudEnabled(false)} />
    : null;

  /** What a finished box or lasso drag did to the selection. */
  const applyRegionSelection = useCallback((
    items: (number | string)[],
    mode: RegionMode,
    summary: string,
  ) => {
    const target = meshRebuilds.find(({ feature }) => feature.id === selectedMeshId);
    if (!target) return;
    setPaintedSelection(null);
    setMeshSelection((current) => {
      const existing = current.mode === "vertex" ? current.vertices
        : current.mode === "edge" ? current.edges
        : current.faces;
      const merged = mergeRegionItems(existing, items, mode);
      return selectionWith(target.rebuild.surface, current.mode, merged as number[] & string[]);
    });
    const verb = mode === "extend" ? "added" : mode === "subtract" ? "removed" : "selected";
    setStatus(`${summary} ${verb}`);
  }, [meshRebuilds, selectedMeshId]);

  const applyExactBodyRegionSelection = useCallback((entityIds: string[], mode: RegionMode) => {
    setSelectedEntityIds((current) => {
      const next = mode === "replace" ? entityIds
        : mode === "extend" ? [...new Set([...current, ...entityIds])]
          : current.filter((entityId) => !entityIds.includes(entityId));
      setSelectedId(next.at(-1) ?? "");
      setStatus(`${next.length} exact ${next.length === 1 ? "body" : "bodies"} selected by marquee`);
      return next;
    });
    setSelectedTopologyIds([]);
    setPickMode("entity");
  }, []);

  /** Writes the selected sculpt's surface as OBJ, PLY, STL or glTF. */
  const exportSculptMesh = useCallback((format: MeshExportFormat) => {
    const target = meshRebuilds.find(({ feature }) => feature.id === selectedMeshId);
    if (!target) return setStatus("Select a sculpt to export");
    // Only this sculpt's own unwrap goes with it; a stale one from another body
    // would put the texture on the wrong geometry.
    const uv = sculptUnwrap?.meshId === target.feature.id ? sculptUnwrap.unwrap.uvOfCorner : undefined;
    const written = exportMesh(target.rebuild.surface, format, target.feature.name, uv);
    download(written.text, written.filename, written.mimeType);
    setStatus(`${written.filename} written · ${target.rebuild.surface.faces.length} faces${uv ? " with UVs" : ""}`);
  }, [meshRebuilds, sculptUnwrap, selectedMeshId]);

  /** Reads an OBJ, ASCII PLY or STL file in as a new sculpt. */
  const importSculptMesh = useCallback(async (file: File, sourceUnit: MeshImportUnit) => {
    try {
      const isText = /\.(obj|ply|usd|usda)$/i.test(file.name);
      const contents = isText ? await file.text() : await file.arrayBuffer();
      // glTF is always metres, +Y up; it is converted to this workspace's millimetres, Z-up.
      const mesh = /\.glb$/i.test(file.name)
        ? weldVertices(await editableMeshFromGlb(contents as ArrayBuffer), 1e-4)
        : importMesh(file.name, contents, { unit: sourceUnit });
      if (mesh.faces.length === 0) return setStatus(`${file.name} holds no faces`);

      const name = file.name.replace(/\.[^.]+$/, "") || "Imported";
      const feature = setMeshPrimitive(defaultMeshFeature(`sculpt-${id()}`, name), {
        kind: "mesh", positions: mesh.positions, faces: mesh.faces,
      });
      // An imported mesh is already the shape someone meant; smoothing it would
      // shrink it away from the dimensions it arrived with.
      setMeshFeatures((current) => [...current, setMeshSmoothing(feature, 0)]);
      setSceneNodes((current) => [...current, createNode(feature.id, feature.name, { kind: "sculpt", id: feature.id })]);
      setSelectedMeshId(feature.id);
      clearMeshSelection();
      setStatus(`${file.name} imported as ${/\.glb$/i.test(file.name) ? "glTF metres" : sourceUnit} · ${mesh.positions.length} vertices, ${mesh.faces.length} faces`);
    } catch (error) {
      setStatus(error instanceof Error ? `Import failed · ${error.message}` : "Import failed");
    }
  }, [clearMeshSelection, setMeshFeatures]);

  // Files sent from the thecreatingco Locker (or another app) open as sculpts.
  const lockerImportRef = useRef(importSculptMesh);
  useEffect(() => { lockerImportRef.current = importSculptMesh; }, [importSculptMesh]);
  useEffect(() => {
    onLockerOpen(async (entry: LockerEntry) => {
      const name = entry.name || "locker-model";
      if (!/\.(glb|stl|obj|ply|usd|usda)$/i.test(name)) { setStatus(`${name} · Form opens GLB, STL, OBJ, PLY and USD models from the Locker`); return; }
      setView("model");
      await lockerImportRef.current(new File([entry.blob], name, { type: entry.type }), "mm");
    });
  }, []);

  /** Interpreting a 3D pick is a document decision, so it lives here, not in the viewport. */
  const handleSelectEntityFrom3D = useCallback((entityId: string, additive: boolean) => {
    if (!additive) {
      setSelectedEntityIds([entityId]);
      setSelectedId(entityId);
      setStatus(`Selected ${entityId} · contextual actions ready`);
      return;
    }
    setSelectedEntityIds((current) => {
      const next = current.includes(entityId)
        ? current.filter((item) => item !== entityId)
        : [...current, entityId];
      setSelectedId(next.at(-1) ?? "");
      setStatus(`${next.length} ${next.length === 1 ? "body" : "bodies"} selected · Shift-click adds or removes`);
      return next;
    });
  }, []);
  const handlePickTopology = useCallback((topologyId: string, sourceEntityId: string, additive: boolean) => {
    setSelectedId(sourceEntityId);
    setSelectedEntityIds([sourceEntityId]);
    setSelectedTopologyIds((current) => {
      if (!additive) return [topologyId];
      return current.includes(topologyId)
        ? current.filter((item) => item !== topologyId)
        : [...current, topologyId];
    });
    const kind = topologyId.includes(":edge:") ? "edge" : "face";
    const purpose = kind === "edge" ? "Finish edge" : pickMode === "finish-face" ? "Shell opening face" : pickMode === "edit-face" ? "Push/Pull face" : "Exact face";
    setStatus(`${purpose} selected · Shift-click to add or remove targets`);
  }, [pickMode]);
  const beginEmbeddedSketch = useCallback((plane: SketchPlane, sourceEntityId?: string) => {
    setActiveSketchPlaneId(plane.id);
    setSketchSession({
      planeId: plane.id,
      planeName: plane.name,
      sourceEntityId,
      entityIdsBefore: entities.map((entity) => entity.id),
      entitiesBefore: structuredClone(entities),
      constraintsBefore: structuredClone(geometricConstraints),
    });
    setCompletedSketchRegion(null);
    setPickMode("entity");
    setModelToolCategory("sketch");
    setTool("line");
    toolShelfRef.current = { open: false, pinned: false };
    setToolShelf({ open: false, pinned: false });
    setView("sketch");
    setStatus(`Sketching on ${plane.name} · draw exact geometry, then Finish Sketch`);
  }, [entities, geometricConstraints]);
  const handlePickFace = useCallback((origin: Triple, normal: Triple, sourceEntityId?: string) => {
    let planeName = `Face @ ${origin.map((value) => value.toFixed(1)).join(", ")}`;
    let planeOrigin: Triple = origin;
    let nOut = new THREE.Vector3(...normal).normalize();
    let uOut: THREE.Vector3;
    let vOut: THREE.Vector3;
    const sourceEntity = sourceEntityId ? entities.find((entity) => entity.id === sourceEntityId) : undefined;
    if (sourceEntity && sourceEntity.type === "circle") {
      const sourcePlane = planeById(sketchPlanes, sourceEntity.sketchPlaneId);
      const axis = new THREE.Vector3(...sourcePlane.normal).normalize();
      const uW = new THREE.Vector3(...sourcePlane.u);
      const vW = new THREE.Vector3(...sourcePlane.v);
      const originW = new THREE.Vector3(...sourcePlane.origin);
      const centerW = originW.clone()
        .add(uW.clone().multiplyScalar(sourceEntity.a.x))
        .add(vW.clone().multiplyScalar(sourceEntity.a.y));
      const hitW = new THREE.Vector3(...origin);
      const toHit = hitW.clone().sub(centerW);
      const axialComp = toHit.dot(axis);
      const radial = toHit.clone().sub(axis.clone().multiplyScalar(axialComp));
      const radius = Math.hypot(sourceEntity.b.x - sourceEntity.a.x, sourceEntity.b.y - sourceEntity.a.y);
      const isSideWall = Math.abs(nOut.dot(axis)) < 0.3 && radial.length() > radius * 0.5;
      if (isSideWall) {
        const nRad = radial.clone().normalize();
        const uTan = new THREE.Vector3().crossVectors(axis, nRad).normalize();
        const snappedOrigin = centerW.clone()
          .add(nRad.clone().multiplyScalar(radius))
          .add(axis.clone().multiplyScalar(axialComp));
        planeOrigin = [snappedOrigin.x, snappedOrigin.y, snappedOrigin.z];
        nOut = nRad;
        uOut = uTan;
        vOut = axis.clone();
        planeName = `Cylinder wall @ ${planeOrigin.map((value) => value.toFixed(1)).join(", ")}`;
      } else {
        const ref = Math.abs(nOut.z) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
        uOut = new THREE.Vector3().crossVectors(ref, nOut).normalize();
        vOut = new THREE.Vector3().crossVectors(nOut, uOut).normalize();
        planeName = `Cylinder cap @ ${planeOrigin.map((value) => value.toFixed(1)).join(", ")}`;
      }
    } else {
      const ref = Math.abs(nOut.z) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
      uOut = new THREE.Vector3().crossVectors(ref, nOut).normalize();
      vOut = new THREE.Vector3().crossVectors(nOut, uOut).normalize();
    }
    const plane: SketchPlane = {
      id: id(),
      name: planeName,
      origin: planeOrigin,
      u: [uOut.x, uOut.y, uOut.z],
      v: [vOut.x, vOut.y, vOut.z],
      normal: [nOut.x, nOut.y, nOut.z],
    };
    setSketchPlanes((current) => [...current, plane]);
    beginEmbeddedSketch(plane, sourceEntityId);
  }, [beginEmbeddedSketch, entities, sketchPlanes]);

  const translateExactEntities = useCallback((entityIds: string[], worldDelta: Triple) => {
    const requested = new Set(entityIds.filter((entityId) => entities.some((entity) => entity.id === entityId)));
    if (requested.size === 0) return;
    setAssemblyInstances((current) => {
      const claimed = new Set<string>();
      const moved = current.map((instance) => {
        if (!instance.entityIds.some((entityId) => requested.has(entityId))) return instance;
        instance.entityIds.forEach((entityId) => claimed.add(entityId));
        return {
          ...instance,
          position: instance.position.map((value, axis) => value + worldDelta[axis]) as Triple,
        };
      });
      for (const entityId of requested) {
        if (claimed.has(entityId)) continue;
        const entity = entities.find((item) => item.id === entityId);
        moved.push({
          id: `placement-${entityId}`,
          name: `${entity?.type ?? "Body"} placement`,
          componentId: entityId,
          entityIds: [entityId],
          position: [...worldDelta],
          rotation: [0, 0, 0],
          fixed: false,
        });
      }
      return moved;
    });
  }, [entities]);

  const translateSelectedBodies = useCallback((worldDelta: Triple, sourceEntityId = selectedId) => {
    const selection = selectedEntityIds.includes(sourceEntityId) && selectedEntityIds.length > 1
      ? selectedEntityIds
      : [sourceEntityId];
    const exactIds = selection.filter((entityId) => entities.some((entity) => entity.id === entityId));
    const importedIds = new Set(selection.filter((entityId) => importedBodies.some((body) => body.id === entityId)));
    translateExactEntities(exactIds, worldDelta);
    if (importedIds.size > 0) {
      setImportedBodies((current) => current.map((body) => {
        if (!importedIds.has(body.id)) return body;
        const transform = [...(body.transform ?? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0])];
        transform[3] += worldDelta[0];
        transform[7] += worldDelta[1];
        transform[11] += worldDelta[2];
        return { ...body, transform };
      }));
    }
    setStatus(`Moved ${selection.length} exact ${selection.length === 1 ? "body" : "bodies"} · Δ ${worldDelta.map((value) => value.toFixed(2)).join(", ")} mm`);
  }, [entities, importedBodies, selectedEntityIds, selectedId, translateExactEntities]);

  const handleTransformCommit = useCallback((sourceEntityId: string, worldDelta: Triple) => {
    if (!entities.some((item) => item.id === sourceEntityId) && !importedBodies.some((body) => body.id === sourceEntityId)) return;
    translateSelectedBodies(worldDelta, sourceEntityId);
  }, [entities, importedBodies, translateSelectedBodies]);

  const setSelectedBodyPosition = useCallback((axis: 0 | 1 | 2, value: number) => {
    if (!Number.isFinite(value) || !selectedId) return;
    const delta: Triple = [0, 0, 0];
    delta[axis] = value - selectedBodyPosition[axis];
    if (Math.abs(delta[axis]) < 1e-9) return;
    translateSelectedBodies(delta);
  }, [selectedBodyPosition, selectedId, translateSelectedBodies]);

  const hitTest = (point: Point) => {
    let best: { id: string; distance: number } | null = null;
    for (const entity of visibleSketchEntities) {
      const hitDistance = distanceToCadEntity(entity, point);
      if (!best || hitDistance < best.distance) best = { id: entity.id, distance: hitDistance };
    }
    return best !== null && best.distance < Math.max(1.2, 10 / zoom) ? best.id : null;
  };

  const selectSketchObject = (object: SketchObject, additive = false) => {
    const has = object.ids.every((entityId) => sketchTargets.includes(entityId));
    const next = additive ? has ? sketchTargets.filter((entityId) => !object.ids.includes(entityId)) : [...new Set([...sketchTargets, ...object.ids])] : object.ids;
    setSelectedEntityIds(next); setSelectedId(next.at(-1) ?? ""); setTool("select"); setSketchSelectionMode("object"); setActiveEdit(null);
    setStatus(`${object.label} · ${object.closed ? "closed profile · ready to extrude" : "open path · edit segments or sweep"} · Shift-click to multi-select`);
    return next;
  };
  const selectAllSketchObjects = () => {
    const ids = visibleSketchEntities.map((e) => e.id);
    setSelectedEntityIds(ids); setSelectedId(ids.at(-1) ?? ""); setTool("select"); setSketchSelectionMode("object");
  };
  const fitSketch = (items = visibleSketchEntities.filter((e) => !sketchTargets.length || sketchTargets.includes(e.id))) => {
    const bounds = sketchBounds(items.flatMap(sketchEntityPoints));
    if (!bounds) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    setSketchCenter({ x: bounds.x, y: bounds.y });
    setZoom(Math.max(0.01, Math.min(12, ((rect?.width || 800) - 120) / Math.max(1, bounds.width), ((rect?.height || 600) - 220) / Math.max(1, bounds.height))));
  };
  const transformSketchSelection = (change: { dx?: number; dy?: number; scale?: number; angle?: number; mirror?: "x" | "y" }) => {
    if (!sketchTargets.length || sketchSelectionLocked) return;
    try { setEntities(transformSketchEntities(entities, sketchTargets, change)); setStatus("Selection updated · connected outline preserved · Undo available"); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Unable to transform selection"); }
  };
  const deleteSketchSelection = () => {
    if (!sketchTargets.length || sketchSelectionLocked) return;
    const deleting = new Set(sketchTargets);
    setEntities((current) => current.filter((e) => !deleting.has(e.id)));
    setGeometricConstraints((current) => current.filter((constraint) => !constraint.entityIds.some((entityId) => deleting.has(entityId))));
    setFeatures((current) => current.filter((f) => !featureSourceIds(f)?.some((sourceId) => deleting.has(sourceId) || sketchTargets.some((entityId) => wireSourceMap.get(entityId) === sourceId))));
    setSelectedId(""); setSelectedEntityIds([]); setStatus("Sketch selection deleted · Undo to restore");
  };
  const duplicateSketchSelection = () => {
    if (!sketchTargets.length || sketchSelectionLocked) return;
    const copies = transformSketchEntities(entities.filter((e) => sketchTargets.includes(e.id)), sketchTargets, { dx: Math.max(5, (sketchSelectionBounds?.width ?? 0) + 5) }).map((e) => ({ ...e, id: id(), constraints: [...e.constraints] }));
    setEntities((current) => [...current, ...copies]); setSelectedId(copies[0].id); setSelectedEntityIds(copies.map((e) => e.id)); setStatus("Selection duplicated · original untouched");
  };
  const openSketchObjectMenu = (event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: (event.clientX - rect.left - rect.width / 2) / zoom + sketchCenter.x, y: -(event.clientY - rect.top - rect.height / 2) / zoom + sketchCenter.y };
    const hit = hitSketchObject(sketchItems, visibleSketchEntities, point, 10 / zoom);
    if (!hit) { setObjectMenu(null); return; }
    selectSketchObject(hit, false); setSelectedMeshId(null); setSelectedTopologyIds([]);
    setObjectMenu({ x: event.clientX, y: event.clientY, target: hit.ids[0] });
  };

  const offsetSketchProfile = (entityId: string, amount = toolShelfAmount) => {
    if (!Number.isFinite(amount) || amount === 0) return setStatus("Enter a non-zero Offset distance");
    const offsetEntities = offsetCadProfile(entities, entityId, amount, id);
    if (!offsetEntities.length) return setStatus("Offset needs a circle, rectangle, or connected closed line loop");
    setEntities((current) => [...current, ...offsetEntities]);
    setSelectedId(offsetEntities[0].id);
    setStatus(`Profile offset ${amount > 0 ? "outward" : "inward"} · ${formatCadLength(Math.abs(amount), units, precision)} · editable linked geometry`);
  };

  const toggleTouchPan = () => {
    setTouchPan(!touchPan); touchPanPoints.current.clear(); setDraft(null); setSketchDrag(null); setFreehandDraft(null); setActiveEdit(null);
    setStatus(!touchPan ? "Navigate · drag to pan, pinch to zoom · tap Pan again to edit" : "Sketch editing ready");
  };
  const pointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (view !== "sketch") return;
    if (event.button !== 0) return;
    contextTap.current.down(event);
    if (compact && touchPan) {
      event.currentTarget.setPointerCapture(event.pointerId);
      if (!touchPanPoints.current.size) touchPanView.current = { zoom, center: sketchCenter };
      const rect = event.currentTarget.getBoundingClientRect();
      touchPanPoints.current.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top });
      return;
    }
    const freehand = tool === "pen" || tool === "pencil";
    const point = screenToWorld(event, !freehand && tool !== "select");
    if (tool === "select" && sketchSelectionMode === "object") {
      const hit = hitSketchObject(sketchItems, visibleSketchEntities, point, 8 / zoom);
      if (!hit) { if (!event.shiftKey) { setSelectedId(""); setSelectedEntityIds([]); } return; }
      const already = hit.ids.every((entityId) => sketchTargets.includes(entityId));
      const ids = already && !event.shiftKey ? sketchTargets : selectSketchObject(hit, event.shiftKey);
      if (!event.shiftKey && !visibleSketchEntities.some((e) => ids.includes(e.id) && layers.some((l) => l.id === e.layer && l.locked))) {
        event.currentTarget.setPointerCapture(event.pointerId);
        setSketchDrag({ ids, start: point, dx: 0, dy: 0 });
      }
      return;
    }
    if (freehand) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setFreehandDraft([{ ...point, pressure: event.pressure > 0 ? event.pressure : 0.5 }]);
      setStatus(tool === "pen" ? "Pen stabilizer active · close near the start to make a solid profile" : "Pencil sketching · close near the start to make a solid profile");
      return;
    }
    if (tool === "offset") {
      const hit = hitTest(point);
      if (!hit) return setStatus("Click a closed profile to Offset");
      offsetSketchProfile(hit);
      return;
    }
    if (tool === "select" && selected && !layers.some((l) => l.id === selected.layer && l.locked)) {
      const rect = event.currentTarget.getBoundingClientRect();
      const cursorScreen = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      for (const spec of handlesFor(selected)) {
        const s = worldToScreen(spec.world, rect.width, rect.height);
        if (Math.hypot(s.x - cursorScreen.x, s.y - cursorScreen.y) <= 10) {
          event.currentTarget.setPointerCapture(event.pointerId);
          setActiveEdit({
            entityId: selected.id,
            handle: spec.kind,
            originalSnapshot: structuredClone(selected),
            grabWorld: spec.world,
            screenX: cursorScreen.x,
            screenY: cursorScreen.y,
            phase: "dragging",
            buffer: "",
          });
          setStatus(spec.kind.type === "move" ? "Drag to move · release to type exact" : "Drag to resize · release to type exact");
          return;
        }
      }
    }
    if (tool === "select" || tool === "measure") {
      const hit = hitTest(point);
      if (hit) {
        setSelectedId(hit);
        setSelectedEntityIds([hit]);
        const entity = entities.find((item) => item.id === hit);
        if (entity && tool === "measure") setStatus(`${entity.type} · ${formatCadLength(length(entity.a, entity.b), units, precision)} · ${fmt(entityAngle(entity), precision)}°`);
      } else { setSelectedId(""); setSelectedEntityIds([]); }
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraft({ start: point, current: point });
  };

  const pointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    contextTap.current.move(event);
    if (compact && touchPan) {
      if (!touchPanPoints.current.has(event.pointerId)) return;
      const before = [...touchPanPoints.current.values()];
      const rect = event.currentTarget.getBoundingClientRect();
      touchPanPoints.current.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top });
      const next = moveSketchView(touchPanView.current, before, [...touchPanPoints.current.values()], { x: rect.width, y: rect.height });
      touchPanView.current = next; setZoom(next.zoom); setSketchCenter(next.center);
      return;
    }
    if (sketchDrag) {
      const point = screenToWorld(event, false);
      let dx = point.x - sketchDrag.start.x, dy = point.y - sketchDrag.start.y;
      if (Math.hypot(dx, dy) * zoom < 4) { dx = 0; dy = 0; }
      else if (snap) { dx = Math.round(dx / grid) * grid; dy = Math.round(dy / grid) * grid; }
      setSketchDrag({ ...sketchDrag, dx, dy }); return;
    }
    const freehand = tool === "pen" || tool === "pencil";
    let point = screenToWorld(event, !freehand, draft?.start ?? null, activeEdit ? [activeEdit.entityId] : []);
    setCursor(point);
    if (freehand && freehandDraft) {
      const sample = { ...point, pressure: event.pressure > 0 ? event.pressure : 0.5 };
      setFreehandDraft((current) => {
        if (!current?.length || length(current[current.length - 1], sample) >= Math.max(0.08, 0.65 / zoom)) return [...(current ?? []), sample];
        return current;
      });
      return;
    }
    if (activeEdit && activeEdit.phase === "dragging") {
      const rect = event.currentTarget.getBoundingClientRect();
      const cursorScreen = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      setEntities((current) => current.map((entity) => entity.id === activeEdit.entityId
        ? applyHandleDrag(activeEdit.originalSnapshot, activeEdit.handle, activeEdit.grabWorld, point)
        : entity));
      setActiveEdit((prev) => prev ? { ...prev, screenX: cursorScreen.x, screenY: cursorScreen.y } : prev);
      return;
    }
    if (!draft) return;
    if (tool === "line" && ortho) {
      const dx = Math.abs(point.x - draft.start.x); const dy = Math.abs(point.y - draft.start.y);
      point = dx > dy ? { x: point.x, y: draft.start.y } : { x: draft.start.x, y: point.y };
    }
    setDraft({ ...draft, current: point });
  };

  const pointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const tapped = contextTap.current.up(event);
    if (touchPanPoints.current.delete(event.pointerId) || (compact && touchPan)) return;
    if (tapped && tool === "select" && !activeEdit) {
      setSketchDrag(null); openSketchObjectMenu(event); return;
    }
    if (sketchDrag) {
      if (sketchDrag.dx || sketchDrag.dy) setEntities(transformSketchEntities(entities, sketchDrag.ids, sketchDrag));
      setSketchDrag(null); return;
    }
    if (freehandDraft && (tool === "pen" || tool === "pencil")) {
      const stroke = freehandStrokeToCadEntities(freehandDraft, {
        idPrefix: `stroke-${id()}`,
        layer: activeLayer,
        sketchPlaneId: activeSketchPlaneId,
        kind: tool,
        tolerance: Math.max(0.06, 0.8 / zoom),
        closeDistance: Math.max(1, 10 / zoom),
      });
      setFreehandDraft(null);
      if (stroke.entities.length === 0) return setStatus("Stroke was too short");
      setEntities((current) => [...current, ...stroke.entities]);
      setSelectedId(stroke.entities[0].id);
      setStatus(stroke.closed
        ? `${tool === "pen" ? "Pen" : "Pencil"} loop · ${stroke.entities.length} editable segments · ready for exact 3D`
        : `${tool === "pen" ? "Pen" : "Pencil"} path · ${stroke.entities.length} editable segments · ready for Sweep`);
      return;
    }
    if (activeEdit && activeEdit.phase === "dragging") {
      const current = entities.find((entity) => entity.id === activeEdit.entityId);
      setActiveEdit((prev) => prev
        ? { ...prev, phase: "editing", buffer: current ? handlePrimary(current, prev.handle, units, precision) : "" }
        : prev);
      setStatus("Type exact value · Enter to apply · Esc to revert");
      return;
    }
    if (!draft || length(draft.start, draft.current) < grid / 2) { setSketchInference(null); return setDraft(null); }
    if (tool === "polygon") {
      const radius = length(draft.start, draft.current);
      const points = Array.from({ length: 6 }, (_, index) => ({
        x: draft.start.x + Math.cos(index * Math.PI / 3) * radius,
        y: draft.start.y + Math.sin(index * Math.PI / 3) * radius,
      }));
      const polygon = points.map((point, index): Entity => ({
        id: id(),
        type: "line",
        a: point,
        b: points[(index + 1) % points.length],
        rotation: 0,
        layer: activeLayer,
        constraints: ["Coincident"],
        sketchPlaneId: activeSketchPlaneId,
      }));
      setEntities((current) => [...current, ...polygon]);
      setSelectedId(polygon[0].id);
      setDraft(null);
      setSketchInference(null);
      setStatus("Closed 6-sided profile · exact wire ready for features");
      return;
    }
    const entity: Entity = {
      id: id(),
      type: tool === "circle" ? "circle" : tool === "rectangle" ? "rectangle" : "line",
      a: draft.start,
      b: draft.current,
      rotation: 0,
      layer: activeLayer,
      constraints: tool === "line" && (draft.start.x === draft.current.x || draft.start.y === draft.current.y)
        ? [draft.start.x === draft.current.x ? "Vertical" : "Horizontal"]
        : tool === "rectangle" ? ["Horizontal", "Vertical", "Perpendicular"] : [],
      sketchPlaneId: activeSketchPlaneId,
    };
    setEntities((current) => [...current, entity]);
    const inferredAxis = entity.type === "line" && entity.constraints[0];
    if (inferredAxis === "Horizontal" || inferredAxis === "Vertical") {
      setGeometricConstraints((current) => [...current, { id: id(), kind: inferredAxis === "Horizontal" ? "horizontal" : "vertical", entityIds: [entity.id] }]);
    }
    setSelectedId(entity.id);
    setDraft(null);
    setSketchInference(null);
    setStatus(inferredAxis ? `Auto-constrained · ${inferredAxis}` : entity.type === "rectangle" ? "Rectangle created · perpendicular sides · size and position remain editable" : "Under-constrained · add dimensions");
  };

  const commitTypedEdit = () => {
    if (!activeEdit || !selected) { setActiveEdit(null); return; }
    const raw = activeEdit.buffer.trim();
    const h = activeEdit.handle;
    if (raw) {
      if (h.type === "move") {
        const parts = raw.split(/[, ]+/).filter(Boolean).map((s) => parseCadLength(s, units));
        if (parts.length >= 2 && parts.every(Number.isFinite)) {
          updateSelectedPosition("x", parts[0]);
          updateSelectedPosition("y", parts[1]);
        }
      } else if (selected.type === "line" && h.type === "endpoint") {
        const v = parseCadLength(raw, units);
        if (Number.isFinite(v)) updateSelected("length", v);
      } else if (selected.type === "circle" && h.type === "radius") {
        const v = parseCadLength(raw, units);
        if (Number.isFinite(v)) updateSelected("radius", v / 2);
      } else if (selected.type === "rectangle" && h.type === "corner") {
        const parts = raw.split(/[x×]/i).map((s) => parseCadLength(s.trim(), units));
        if (parts[0] !== undefined && Number.isFinite(parts[0])) updateSelected("width", Math.abs(parts[0]));
        if (parts[1] !== undefined && Number.isFinite(parts[1])) updateSelected("height", Math.abs(parts[1]));
      }
      setStatus("Exact value applied");
    }
    setActiveEdit(null);
  };

  const revertEdit = () => {
    if (!activeEdit) return;
    const snapshot = activeEdit.originalSnapshot;
    setEntities((current) => current.map((entity) => entity.id === activeEdit.entityId ? snapshot : entity));
    setActiveEdit(null);
    setStatus("Edit reverted");
  };

  const commitPrecisionEdit = (edit: (entity: Entity) => Entity, success: string) => {
    const result = solveGeometricEdit(entities, entities.map(edit), geometricConstraints);
    if (result.conflicts.length) { setStatus(`Edit not applied · ${result.conflicts.join(" · ")}`); return; }
    setEntities(result.entities);
    setStatus(success);
  };

  const updateSelected = (field: "width" | "height" | "radius" | "length", value: number) => {
    if (!selected) return;
    if (!Number.isFinite(value) || value <= 0) { setStatus("Enter a positive finite dimension"); return; }
    commitPrecisionEdit((entity) => {
      if (entity.id !== selected.id) return entity;
      if (field === "width") return { ...entity, b: { ...entity.b, x: entity.a.x + value } };
      if (field === "height") return { ...entity, b: { ...entity.b, y: entity.a.y + value } };
      if (field === "radius") return { ...entity, b: { x: entity.a.x + value, y: entity.a.y } };
      const radians = entityAngle(entity) * Math.PI / 180;
      return { ...entity, b: { x: entity.a.x + Math.cos(radians) * value, y: entity.a.y + Math.sin(radians) * value } };
    }, "Dimension updated · dependent geometry regenerated");
  };

  const updateSelectedAngle = (angle: number) => {
    if (!selected || !Number.isFinite(angle)) return;
    commitPrecisionEdit((entity) => {
      if (entity.id !== selected.id) return entity;
      if (entity.type !== "line") return { ...entity, rotation: angle };
      const lineLength = length(entity.a, entity.b);
      const radians = angle * Math.PI / 180;
      return {
        ...entity,
        b: {
          x: entity.a.x + Math.cos(radians) * lineLength,
          y: entity.a.y + Math.sin(radians) * lineLength,
        },
      };
    }, `Exact angle set · ${fmt(angle, precision)}°`);
  };

  const updateSelectedPosition = (axis: "x" | "y", value: number) => {
    if (!selected) return;
    commitPrecisionEdit((entity) => {
      if (entity.id !== selected.id) return entity;
      const delta = value - entity.a[axis];
      return {
        ...entity,
        a: { ...entity.a, [axis]: value },
        b: { ...entity.b, [axis]: entity.b[axis] + delta },
      };
    }, `Exact ${axis.toUpperCase()} coordinate updated`);
  };

  const applyGeometricConstraint = (kind: ConstraintKind) => {
    if (!selected) return setStatus("Select geometry before adding a constraint");
    const relational = ["equal-length", "parallel", "perpendicular", "coincident", "concentric", "tangent"].includes(kind);
    if (relational && (!constraintReference || constraintReference === selected.id)) {
      return setStatus("Set a different reference entity first");
    }
    const value = kind === "fixed-length" ? length(selected.a, selected.b)
      : kind === "fixed-angle" ? entityAngle(selected)
      : undefined;
    const constraint: GeometricConstraint = {
      id: id(),
      kind,
      entityIds: relational ? [constraintReference!, selected.id] : [selected.id],
      value,
    };
    const next = [...geometricConstraints, constraint];
    const result = solveGeometricConstraints(entities, next);
    setGeometricConstraints(next);
    setEntities(result.entities);
    setStatus(result.conflicts.length
      ? result.conflicts[0]
      : `Solved ${result.solved} constraints · residual ${result.residual.toExponential(2)} · ${result.degreesOfFreedom} DOF`);
  };

  const setSelectedGeometryFixed = (fixed: boolean) => {
    if (!selected) return;
    const nextConstraints = fixed
      ? geometricConstraints.some((constraint) => constraint.kind === "fixed" && constraint.entityIds[0] === selected.id)
        ? geometricConstraints
        : [...geometricConstraints, { id: id(), kind: "fixed" as const, entityIds: [selected.id] }]
      : geometricConstraints.filter((constraint) => !(constraint.kind === "fixed" && constraint.entityIds[0] === selected.id));
    const nextEntities = entities.map((entity) => entity.id !== selected.id ? entity : {
      ...entity,
      constraints: fixed
        ? entity.constraints.includes("Fixed") ? entity.constraints : [...entity.constraints, "Fixed"]
        : entity.constraints.filter((item) => item !== "Fixed"),
    });
    const result = solveGeometricConstraints(nextEntities, nextConstraints);
    setGeometricConstraints(nextConstraints);
    setEntities(result.entities);
    setStatus(fixed ? `Geometry fixed · ${result.degreesOfFreedom} DOF remain` : `Geometry released · ${result.degreesOfFreedom} DOF remain`);
  };

  const addParameter = () => {
    const name = parameterName.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const variables = Object.fromEntries(parameters.map((parameter) => [parameter.name, parameter.value]));
    const value = evaluateCadExpression(parameterExpression, variables, units);
    if (!name || !Number.isFinite(value)) return setStatus("Parameter formula is invalid or references an unknown variable");
    setParameters((current) => [
      ...current.filter((parameter) => parameter.name !== name),
      { id: id(), name, expression: parameterExpression, value },
    ]);
    setStatus(`${name} = ${formatCadLength(value, units, precision)}`);
  };

  const applyParameterToSelection = (parameter: CadParameter) => {
    if (!selected) return setStatus("Select geometry before applying a parameter");
    if (selected.type === "rectangle") updateSelected("width", parameter.value);
    if (selected.type === "circle") updateSelected("radius", parameter.value);
    if (selected.type === "line") updateSelected("length", parameter.value);
    setStatus(`${parameter.name} drives ${selected.type} · ${formatCadLength(parameter.value, units, precision)}`);
  };

  const captureConfiguration = () => {
    const configuration = captureCadConfiguration(id(), `Configuration ${configurations.length + 1}`, features, parameters);
    setConfigurations((current) => [...current, configuration]);
    setActiveConfigurationId(configuration.id);
    setStatus(`${configuration.name} captured · feature values and suppression state saved`);
  };

  const applyConfiguration = (configuration: CadConfiguration) => {
    const applied = applyCadConfiguration(features, parameters, configuration);
    setFeatures(applied.features);
    setParameters(applied.parameters);
    setActiveConfigurationId(configuration.id);
    setStatus(`${configuration.name} activated · exact model rebuilding`);
  };

  const deleteConfiguration = (configurationId: string) => {
    setConfigurations((current) => current.filter((configuration) => configuration.id !== configurationId));
    if (activeConfigurationId === configurationId) setActiveConfigurationId(null);
    setStatus("Configuration removed");
  };

  const addGdtAnnotation = () => {
    if (!selected) return setStatus("Select a feature before adding GD&T");
    const tolerance = parseCadLength(gdtTolerance, units);
    if (!Number.isFinite(tolerance) || tolerance < 0) return setStatus("Enter a valid tolerance");
    setGdt((current) => [...current, {
      id: id(),
      entityId: selected.id,
      symbol: gdtSymbol,
      tolerance,
      datum: gdtDatum.trim().toUpperCase() || "A",
      materialCondition: gdtMaterialCondition,
    }]);
    setStatus(`${gdtSymbol} tolerance added · ${formatCadLength(tolerance, units, precision)} · datum ${gdtDatum}`);
  };

  const createComponent = () => {
    if (!selected) return setStatus("Select geometry to create a reusable component");
    const origin = selected.a;
    const template = structuredClone(selected);
    template.a = { x: 0, y: 0 };
    template.b = { x: selected.b.x - origin.x, y: selected.b.y - origin.y };
    const component: CadComponent = {
      id: id(),
      name: `${selected.type[0].toUpperCase()}${selected.type.slice(1)} component`,
      entities: [template],
    };
    setComponents((current) => [...current, component]);
    setStatus(`${component.name} saved as a reusable component`);
  };

  const insertComponent = (component: CadComponent) => {
    const offset = 25 * (components.indexOf(component) + 1);
    const idMap = new Map(component.entities.map((template) => [template.id, id()]));
    const inserted = component.entities.map((template) => ({
      ...structuredClone(template),
      id: idMap.get(template.id)!,
      a: { x: template.a.x + offset, y: template.a.y + offset },
      b: { x: template.b.x + offset, y: template.b.y + offset },
    }));
    const insertedFeatures = (component.features ?? []).map((template) => ({
      ...structuredClone(template),
      id: id(),
      sourceEntityId: template.sourceEntityId ? idMap.get(template.sourceEntityId) : undefined,
      sourceEntityIds: template.sourceEntityIds?.map((sourceId) => idMap.get(sourceId)).filter((sourceId): sourceId is string => Boolean(sourceId)),
    }));
    setEntities((current) => [...current, ...inserted]);
    if (insertedFeatures.length) {
      setFeatures((current) => [...current, ...insertedFeatures]);
      setRollbackIndex((current) => current + insertedFeatures.length);
    }
    const instance: AssemblyInstance = {
      id: id(),
      name: `${component.name} ${assemblyInstances.length + 1}`,
      componentId: component.id,
      entityIds: inserted.map((entity) => entity.id),
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      fixed: assemblyInstances.length === 0,
    };
    setAssemblyInstances((current) => [...current, instance]);
    if (assemblyInstances.length === 0) setAssemblyMateFirstId(instance.id);
    else setAssemblyMateSecondId(instance.id);
    setSelectedId(inserted[0].id);
    setStatus(`${component.name} inserted · ${instance.fixed ? "fixed assembly base" : "ready for 3D mates"}`);
  };

  const addAssemblyMate = () => {
    if (assemblyInstances.length < 2) return setStatus("Insert at least two component instances before adding a mate");
    const first = assemblyInstances.find((instance) => instance.id === assemblyMateFirstId) ?? assemblyInstances[0];
    const second = assemblyInstances.find((instance) => instance.id === assemblyMateSecondId)
      ?? assemblyInstances.find((instance) => !instance.fixed && instance.id !== first.id)
      ?? assemblyInstances[1];
    const mate: AssemblyMate = {
      id: id(),
      kind: assemblyMateKind,
      firstId: first.id,
      secondId: second.id,
      value: assemblyMateValue,
      axis: assemblyMateAxis === "x" ? [1, 0, 0] : assemblyMateAxis === "y" ? [0, 1, 0] : [0, 0, 1],
    };
    const nextMates = [...assemblyMates, mate];
    const solved = solveAssemblyMates(assemblyInstances, nextMates);
    setAssemblyMates(nextMates);
    setAssemblyInstances(solved.instances);
    setStatus(solved.conflicts[0] ?? `Assembly solved · ${solved.solved} mates · ${solved.degreesOfFreedom} DOF · residual ${solved.residual.toExponential(2)}`);
  };

  const runKernel = async (format?: ExactExportFormat) => {
    if (exactProfiles.length === 0 && importedBodies.length === 0) return setStatus("Create a closed profile or import an exact body before exact-solid operations");
    const nativeExport = !!format && format !== "svg" && nativeEngine.available && canUseNativeCad(exactProfiles, exactFeatures, importedBodies);
    // Export has its own transaction: it must not cancel a pending viewport
    // rebuild or acknowledge that the visible mesh is current.
    const token = nativeExport ? exactBuildTokenRef.current : ++exactBuildTokenRef.current;
    const document = documentSession.checkpoint();
    const requestIsCurrent = () => token === exactBuildTokenRef.current && documentSession.matches(document);
    if (!nativeExport) {
      setKernelStatus("loading");
      setExactBuildState("building");
    }
    const validationSignature = exactInputSignature;
    setStatus(format ? `Generating exact scene ${format.toUpperCase()}…` : "Validating and healing the complete exact scene…");
    try {
      const useNative = nativeEngine.available && canUseNativeCad(exactProfiles, exactFeatures, importedBodies);
      if (format && format !== "svg" && useNative) {
        const saved = await runNativeCadExport(exactProfiles, exactFeatures, exactPaths, importedBodies, format);
        if (!requestIsCurrent()) return;
        setStatus(saved ? `Native Open CASCADE ${format.toUpperCase()} saved · ${saved}` : "Native export cancelled");
        return;
      }
      const nativeRebuild = useNative && !format;
      const result = nativeRebuild
        ? await runNativeCadRebuild(exactProfiles, exactFeatures, exactPaths, importedBodies)
        : await runExactScene(exactProfiles, exactFeatures, format, importedBodies, undefined, exactPaths);
      // An Open, Undo, or newer edit may finish while the kernel is busy.
      // Neither old meshes nor their status/exports may replace that document.
      if (!requestIsCurrent()) return;
      setKernelAudit(result.audit);
      const failure = exactResultFailure(result.audit);
      if (failure) {
        setValidatedExactSignature(null);
        setKernelStatus("error"); setExactBuildState("error");
        setExactRebuildFailure(failure);
        setStatus(`Exact rebuild paused · ${failure.message} · last valid body remains visible`);
        return;
      }
      setValidatedExactSignature(validationSignature);
      setExactRebuildFailure(null);
      setExactMeshes(result.meshes);
      setExactTopology(result.topology);
      setExactBodyMetrics(result.bodyMetrics);
      setExactAssemblyChecks(result.assemblyChecks);
      if (result.data && result.filename && result.mime) {
        download(result.data, result.filename, result.mime);
      }
      setKernelStatus(result.audit.valid ? "ready" : "error");
      setExactBuildState(result.audit.valid ? "ready" : "error");
      const warning = result.audit.warnings[0] ? ` · ${result.audit.warnings[0]}` : "";
      setStatus(`${nativeRebuild ? "Native Open CASCADE" : "Compatibility Open CASCADE"} · ${result.audit.valid ? "valid" : "invalid"} exact scene · ${result.bodyCount} bodies · ${result.audit.topology.faces} faces · ${result.audit.volume.toFixed(2)} mm³${warning}`);
    } catch (error) {
      if (!requestIsCurrent()) return;
      if (nativeExport) {
        setStatus(`Native export failed · ${error instanceof Error ? error.message : "Could not save the exact model"} · document and viewport unchanged`);
        return;
      }
      setKernelStatus("error");
      setExactBuildState("error");
      setValidatedExactSignature(null);
      const message = error instanceof Error ? error.message : "The exact-solid kernel could not start";
      setExactRebuildFailure({ message });
      setStatus(`Exact operation failed safely · ${message} · last valid body remains visible`);
    }
  };

  const suppressFailedExactFeature = () => {
    const featureId = exactRebuildFailure?.featureId;
    if (!featureId) {
      setExactRebuildFailure(null);
      setStatus("Exact diagnostic dismissed · no document geometry changed");
      return;
    }
    setFeatures((current) => current.map((feature) => feature.id === featureId ? { ...feature, enabled: false } : feature));
    setExactRebuildFailure(null);
    setStatus(`Suppressed ${featureId} · rebuilding the last valid exact history`);
  };

  const runNativePhysics = async () => {
    if (!nativeEngine.available) {
      setStatus("Native compute is available in the standalone application; the web edition keeps its safe worker fallback");
      return;
    }
    const sourceBodies = nativeBodiesFromMetrics(exactBodyMetrics, density);
    if (sourceBodies.length === 0) {
      setStatus("Create or import an exact solid before running the native physics solver");
      return;
    }
    const prepared = prepareNativeAssemblySimulation(sourceBodies, assemblyInstances, assemblyMates);
    setNativeComputeBusy(true);
    setStatus(`Sending ${prepared.bodies.length} exact bodies and ${prepared.joints.length} live mates to the compiled native physics engine…`);
    try {
      const result = await runNativeSceneSimulation(prepared.bodies, { joints: prepared.joints });
      setNativeSimulation(result);
      setNativeSimulationApplied(true);
      const skipped = prepared.warnings.length ? ` · ${prepared.warnings.length} unmapped mate${prepared.warnings.length === 1 ? "" : "s"}` : "";
      setStatus(`${result.backend} solved ${result.bodies.length} bodies and ${result.jointCount} joints over ${result.steps} steps in ${result.elapsedMs.toFixed(1)} ms · ${result.contactPairs} active contacts${skipped}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Native physics job failed");
    } finally {
      setNativeComputeBusy(false);
    }
  };

  const bakeNativePhysics = () => {
    if (!nativeSimulation) return;
    const importedIds = new Set(importedBodies.map((body) => body.id));
    const count = nativeSimulation.bodies.filter((body) => importedIds.has(body.id)).length;
    if (count === 0) {
      setStatus("The solved bodies are parametric features. Keep the reversible physics preview, or import exact B-Reps to bake transforms.");
      return;
    }
    setImportedBodies((current) => applyNativeSimulationToImportedBodies(current, nativeSimulation));
    setNativeSimulationApplied(false);
    setNativeSimulation(null);
    setStatus(`Baked ${count} native physics transform${count === 1 ? "" : "s"} into editable imported B-Rep placement`);
  };

  const runNativeSoftBody = async () => {
    if (!nativeEngine.available) return setStatus("Native deformable simulation is available in the standalone application");
    if (!exactBodyMetrics.length) return setStatus("Validate an exact body before building its tetrahedral deformable proxy");
    setNativeComputeBusy(true);
    setStatus(`Building a volume-preserving deformable proxy from ${exactBodyMetrics[0].sourceId}…`);
    try {
      const request = nativeSoftBodyFromMetrics(exactBodyMetrics, nativeSoftBodyResolution, nativeSoftBodyPreset);
      const result = await runNativeSoftBodySimulation(request);
      setNativeSoftBodyResult(result);
      setView("model");
      setStatus(`${result.backend} solved ${result.particles} particles / ${result.tetrahedra} tetrahedra in ${result.elapsedMs.toFixed(1)} ms · ${(result.maxVolumeError * 100).toFixed(2)}% max volume error · ${result.coupledCollisionCount} two-way contacts`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Native deformable-body job failed");
    } finally {
      setNativeComputeBusy(false);
    }
  };

  const runProductionCadSelfTest = async () => {
    setProductionCadBusy(true); setStatus("Running the versioned 18,000-entity production CAD corpus…");
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    try {
      const report = runProductionCadBenchmark(); setProductionCadReport(report);
      const total = Object.values(report.timingsMs).reduce((sum, value) => sum + value, 0);
      setStatus(`${report.pass ? "Production CAD gate passed" : "Production CAD gate failed"} · ${report.entities.toLocaleString()} entities · ${report.assemblyInstances.toLocaleString()} components · ${total.toFixed(1)} ms measured stages`);
    } catch (error) {
      setStatus(error instanceof Error ? `Production CAD self-test failed · ${error.message}` : "Production CAD self-test failed");
    } finally { setProductionCadBusy(false); }
  };

  const renderNativePreview = async () => {
    if (!nativeEngine.available) return setStatus("Native GPU rendering is available in the standalone application");
    const meshes = exactMeshes.filter((item) => item.positions.length >= 9 && item.indices.length >= 3 && (entities.length <= streamingWorkingSet.entityIds.length || streamedEntityIds.has(item.sourceId) || item.sourceId === selectedId));
    if (!meshes.length) return setStatus("Validate an exact solid first, then render its native GPU preview");
    setNativePreviewBusy(true);
    setStatus("Rendering the exact mesh through the native GPU pipeline…");
    try {
      const result = await runNativeGpuPreview(meshes);
      const url = URL.createObjectURL(new Blob([new Uint8Array(result.png)], { type: "image/png" }));
      setNativePreviewUrl(url);
      setNativePreview(result);
      setStatus(`${result.backend} rendered ${result.triangles.toLocaleString()} triangles in ${result.elapsedMs.toFixed(1)} ms`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Native GPU preview failed");
    } finally {
      setNativePreviewBusy(false);
    }
  };

  const renderNativePathTrace = async () => {
    if (!nativeEngine.available) return setStatus("Native GPU path tracing is available in the standalone application");
    setNativePreviewBusy(true);
    setStatus("Path tracing 24 samples × 4 bounces on the native GPU…");
    try {
      if (entities.length > streamingWorkingSet.entityIds.length) throw new Error("Load the complete scene before native rendering; a streamed subset is not a complete render");
      if (exactMeshes.length && (exactBuildState !== "ready" || validatedExactSignature !== exactInputSignature)) throw new Error("Rebuild the current exact model successfully before rendering; the last valid body is not the current authored scene");
      const scene=viewportHandleRef.current?.readNativeScene?.();
      if(!scene) throw new Error("The authored scene is not ready for native rendering");
      const width=640, height=Math.max(128,Math.min(1024,Math.round(width/scene.camera.aspect)));
      const result = await renderNativeAuthoredScene(scene,{width,height,samples:24});
      const url = URL.createObjectURL(new Blob([new Uint8Array(result.png)], { type: "image/png" }));
      setNativePreviewUrl(url);
      setNativePreview(result);
      setStatus(`${result.backend} rendered captured scene · ${result.triangles.toLocaleString()} triangles · ${result.samples} spp · ${scene.warnings.join(" · ")}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Native GPU path tracing failed");
    } finally {
      setNativePreviewBusy(false);
    }
  };

  const saveNativeDiagnostics = async () => {
    try {
      const path = await exportNativeDiagnostics();
      setStatus(path ? `Native diagnostics saved · ${path}` : "Diagnostics export cancelled");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Native diagnostics export failed");
    }
  };

  const resetNativeCache = async () => {
    await clearNativeCache();
    setNativeJobs(await listNativeJobs());
    setStatus("Native exact-result cache cleared");
  };

  const stopNativeJob = async (jobId: string) => {
    await cancelNativeJob(jobId);
    setNativeJobs(await listNativeJobs());
    setStatus(`${jobId} cancellation requested`);
  };

  const importExactFile = async (file: File) => {
    setKernelStatus("loading");
    setStatus(`Inspecting ${file.name} with Open CASCADE…`);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "step";
      const data = await file.arrayBuffer();
      const imported = await importExactBody(data, extension, file.name);
      setImportedBodies((current) => [...current, imported.body]);
      setExactMeshes((current) => [...current, imported.mesh]);
      setExactTopology((current) => [...current, ...imported.topology]);
      setKernelAudit(imported.audit);
      setSelectedId(imported.body.id);
      setSelectedEntityIds([imported.body.id]);
      setView("model");
      setKernelStatus(imported.audit.valid ? "ready" : "error");
      setStatus(`${file.name} imported as editable B-Rep · ${imported.audit.topology.solids} solids · ${imported.audit.topology.faces} faces`);
    } catch {
      setKernelStatus("error");
      setStatus(`${file.name} could not be read as STEP, STL or BREP`);
    }
  };

  const addSketchPolylines = (polylines: SketchPolyline[], label: string, style?: "pen" | "pencil") => {
    const imported = polylinesToCadEntities(polylines, {
      idPrefix: `vector-${id()}`,
      layer: activeLayer,
      sketchPlaneId: activeSketchPlaneId,
      style,
    });
    if (!imported.length) throw new Error("No editable vector segments were produced");
    setEntities((current) => [...current, ...imported]);
    setSelectedId(imported[0].id);
    setSelectedEntityIds(imported.map((entity) => entity.id));
    setSketchSelectionMode("object"); setTool("select"); setActiveEdit(null); setView("sketch"); fitSketch(imported);
    const closed = polylines.filter((polyline) => polyline.closed).length;
    const open = polylines.length - closed;
    setStatus(`${label} · ${imported.length} editable segments · ${closed} closed profile${closed === 1 ? "" : "s"}${open ? ` · ${open} sweep path${open === 1 ? "" : "s"}` : ""}`);
  };

  const importSvgSketch = async (file: File) => {
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error("SVG is larger than the 8 MB sketch limit");
      const polylines = importSvgPolylines(await file.text(), vectorWidthMm);
      addSketchPolylines(polylines, `${file.name} imported`);
    } catch (error) {
      setStatus(error instanceof Error ? `SVG import failed · ${error.message}` : "SVG import failed");
    }
  };

  /**
   * Opens Cast on a snapshot of what is selected. Cast never writes back, so a
   * snapshot (in world space, as drawn) is the honest input: a ring scaled in
   * the scene must be sized at the scale the user sees.
   */
  const openCast = () => {
    changeSculptBrush(null); closeToolShelf();
    const sources: CastSource[] = [];
    const body = meshBodies.find((item) => item.id === selectedMeshId) ?? (meshBodies.length === 1 ? meshBodies[0] : null);
    if (body) sources.push({ id: `sculpt-${body.id}`, name: body.name, origin: "sculpt", mesh: castMeshFromEditable({ ...body.surface, positions: body.surface.positions.map((p) => transformPoint(body.worldMatrix, p)) }) });
    // Exact bodies arrive tessellated face by face; welding the shared seams is what makes "open edges" mean holes rather than tessellation.
    const exact = (mesh: ExactSceneMesh) => weldCastMesh(castMeshFromBuffers(mesh.positions, mesh.indices), 1e-4).mesh;
    const note = "Tessellated exact body · seams welded at 0.0001 mm for checking";
    if (selectedExactMesh) sources.push({ id: `exact-${selectedExactMesh.sourceId}`, name: `Exact body ${selectedExactMesh.sourceId}`, origin: "exact", mesh: exact(selectedExactMesh), note });
    const visibleExact = exactMeshes.filter((mesh) => !creativeSourceIds.has(mesh.sourceId) && mesh.indices.length >= 3);
    if (visibleExact.length > 1 || (visibleExact.length === 1 && !selectedExactMesh)) {
      sources.push({ id: "exact-all", name: visibleExact.length === 1 ? `Exact body ${visibleExact[0].sourceId}` : `All exact bodies (${visibleExact.length})`, origin: "exact", mesh: combineCastMeshes(visibleExact.map(exact)), note });
    }
    setCastSources(sources);
    setStatus(sources.length ? `Cast opened on ${sources[0].name} · checks run on a copy; your project is not changed` : "Cast opened · open an STL or OBJ to check");
  };

  const addImageModel = ({ mesh, name, source = "silhouette", photoTexture }: ImageModelResult) => {
    const kind = source === "local-scan" ? "photo scan" : source === "ai" ? "AI estimate" : "silhouette";
    const feature = setMeshSmoothing(setMeshPrimitive(
      defaultMeshFeature(`photo-${id()}`, `${name.slice(0, 70)} · ${kind}`),
      { kind: "mesh", positions: mesh.positions, faces: mesh.faces },
    ), 0);
    if (photoTexture) {
      feature.photoTexture = photoTexture;
      // Preserve imported vertex/corner correspondence, including UV seam duplicates.
      feature.weldTolerance = 0;
      if (!restoredPhotoTexture(photoTexture, rebuildMeshFeature(feature).surface)) throw new Error("The imported photo UVs do not match the rebuilt model");
    }
    // Reject an import before mutating the document if it would no longer reopen.
    parseCadProject(JSON.stringify({ ...projectData, meshFeatures: [...meshFeatures, feature], paintTexture: archivePaintTexture(texture, sculptUnwrap) }));
    setMeshFeatures(current => [...current, feature]);
    setSceneNodes(current => [...current, createNode(feature.id, feature.name, { kind: "sculpt", id: feature.id })]);
    setSelectedMeshId(feature.id);
    setSelectedId(""); setSelectedEntityIds([]); setSelectedTopologyIds([]);
    clearMeshSelection(); changeSculptBrush(null); setSelectionBrushEnabled(false);
    setImageModelImport(null); setView("model"); setModelToolCategory("modify");
    setStatus(`${name} added · editable ${kind} mesh${photoTexture ? " with embedded photo colors" : ""} · ${source === "silhouette" ? "not reconstructed 3D" : "verify scale, coverage and topology before use"} · sculpt, paint or add modifiers`);
  };

  const importDxfSketch = async (file: File) => {
    try {
      const imported = importCadDxf(await file.text());
      const placed = imported.entities.map((entity) => ({ ...entity, sketchPlaneId: activeSketchPlaneId }));
      const palette = ["#e05d44", "#4c83d4", "#7c9a54", "#a16cc1", "#d59b3a", "#43a89c"];
      setLayers((current) => {
        const known = new Set(current.map((layer) => layer.id));
        const additions = imported.layers
          .filter((layer) => !known.has(layer.id))
          .map((layer, index) => ({ ...layer, color: palette[(current.length + index) % palette.length], visible: true, locked: false }));
        return additions.length ? [...current, ...additions] : current;
      });
      setEntities((current) => [...current, ...placed]);
      setDrafting((current) => mergeCadDraftingDocuments(current, imported.drafting));
      setSelectedId(placed[0].id);
      setActiveLayer(placed[0].layer);
      setView("sketch");
      const blocks = imported.diagnostics.blockInstances ? ` · ${imported.diagnostics.blockInstances} block instance${imported.diagnostics.blockInstances === 1 ? "" : "s"} preserved + previewed` : "";
      const annotations = imported.drafting.texts.length + imported.drafting.dimensions.length + imported.drafting.leaders.length + imported.drafting.hatches.length;
      const curves = imported.diagnostics.approximatedCurves ? ` · ${imported.diagnostics.approximatedCurves} curve${imported.diagnostics.approximatedCurves === 1 ? "" : "s"} tessellated` : "";
      const warning = imported.warnings.length ? ` · Review: ${imported.warnings.join(" · ")}` : "";
      setStatus(`${file.name} imported · ${placed.length} editable entities · ${imported.layers.length} layer${imported.layers.length === 1 ? "" : "s"} · ${imported.sourceUnits} → mm${blocks}${annotations ? ` · ${annotations} native drafting object${annotations === 1 ? "" : "s"}` : ""}${curves}${warning}`);
    } catch (error) {
      setStatus(error instanceof Error ? `DXF import failed · ${error.message}` : "DXF import failed");
    }
  };

  const importExtension = async (file: File) => {
    try {
      const source = await file.text();
      const parsed = JSON.parse(source) as { schema?: unknown };
      if (parsed.schema === EXTENSION_PACKAGE_SCHEMA) {
        const inspection = await inspectExtensionPackage(source);
        const extension = inspection.package.manifest;
        setExtensionRegistry((current) => installInspectedExtension(current, inspection, extension.permissions));
        setStatus(`${extension.name} ${extension.version} installed · Ed25519 ${inspection.signatureStatus} · API ${FORM_EXTENSION_API_VERSION} · ${extension.commands.length} safe commands`);
      } else {
        const extension = parseExtensionManifest(source);
        setExtensionRegistry((current) => installDeveloperExtension(current, source, extension.permissions));
        setStatus(`${extension.name} ${extension.version} installed as unsigned local developer tool · ${extension.commands.length} safe commands`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? `Extension rejected · ${error.message}` : "Extension rejected");
    }
  };

  const traceImageSketch = async (file: File) => {
    if (file.size > 32 * 1024 * 1024) return setStatus("Image trace is limited to 32 MB per source image");
    const url = URL.createObjectURL(file);
    try {
      const image = new Image(); image.src = url; await image.decode();
      const ratio = Math.min(1024 / image.width, 1024 / image.height, 1);
      const canvas = document.createElement("canvas"); canvas.width = Math.max(2, Math.round(image.width * ratio)); canvas.height = Math.max(2, Math.round(image.height * ratio));
      const context = canvas.getContext("2d", { willReadFrequently: true }); if (!context) throw new Error("Image tracing is unavailable");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const polylines = traceRasterPolylines(pixels.data, pixels.width, pixels.height, vectorWidthMm, traceContrast);
      addSketchPolylines(polylines, `${file.name} traced`, "pencil");
      const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-_]+/gi, "-") || "traced-image";
      setLastTracedSvg({ name: `${baseName}.svg`, contents: sketchPolylinesToSvg(polylines, baseName) });
    } catch (error) {
      setStatus(error instanceof Error ? `Image trace failed · ${error.message}` : "Image trace failed");
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const updateImportedBodyPosition = (bodyId: string, axis: 0 | 1 | 2, value: number) => {
    setImportedBodies((current) => current.map((body) => {
      if (body.id !== bodyId) return body;
      const transform = [...(body.transform ?? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0])];
      transform[axis === 0 ? 3 : axis === 1 ? 7 : 11] = value;
      return { ...body, transform };
    }));
  };

  const addFeature = (type: string, value: number) => {
    const guardedTypes = new Set<GuardedExactOperation>(["Extrude", "Revolve", "Fillet", "Chamfer", "Shell", "Offset", "Cut", "Fuse", "Intersect"]);
    const guarded = guardedTypes.has(type as GuardedExactOperation);
    const importedSelected = importedBodies.some((body) => body.id === selectedId);
    const source = selected && (selected.type !== "line" || type === "Sweep" || wireSourceMap.has(selected.id))
      ? selected.id
      : importedSelected ? selectedId : type === "Extrude" ? exactProfiles[0]?.id : undefined;
    const topologyIds = type === "Fillet" || type === "Chamfer"
      ? selectedTopologyIds.filter((topologyId) => topologyId.includes(":edge:"))
      : type === "Shell"
        ? selectedTopologyIds.filter((topologyId) => topologyId.includes(":face:"))
        : [];
    const booleanOperation = type === "Cut" || type === "Fuse" || type === "Intersect";
    const sourceIds = booleanOperation
      ? selectedEntityIds.filter((entityId) => entities.some((entity) => entity.id === entityId) || importedBodies.some((body) => body.id === entityId))
      : source ? [source] : [];
    const decision = guarded
      ? guardExactOperation({ type: type as GuardedExactOperation, value, sourceIds, topologyIds })
      : { ok: true, message: `${type} request is valid`, type, value, sourceIds: source ? [source] : [], topologyIds };
    if (!decision.ok) {
      setExactRebuildFailure({ message: decision.message });
      setStatus(`Operation blocked · ${decision.message}`);
      return;
    }
    const feature: Feature = {
      id: id(),
      type,
      value: decision.value,
      unit: type === "Draft" || type === "Revolve" ? "°" : type === "Pattern" ? "×" : "mm",
      enabled: true,
      sourceEntityId: decision.sourceIds.length === 1 ? decision.sourceIds[0] : undefined,
      sourceEntityIds: decision.sourceIds.length > 1 ? decision.sourceIds : undefined,
      topologyIds: decision.topologyIds.length ? decision.topologyIds : undefined,
    };
    setFeatures((current) => {
      const insertAt = Math.max(0, Math.min(rollbackIndex, current.length));
      const next = current.slice();
      next.splice(insertAt, 0, feature);
      return next;
    });
    setRollbackIndex((value) => value + 1);
    setSelectedFeatureId(feature.id);
    setExactRebuildFailure(null);
    setStatus(`${type === "Fuse" ? "Union" : type} committed · history position ${clampedRollback + 1} · ${decision.sourceIds.length} source${decision.sourceIds.length === 1 ? "" : "s"}${decision.topologyIds.length ? ` · ${decision.topologyIds.length} topology target(s)` : ""}`);
  };

  const commitDirectExactEdit = (edit: ExactDirectEdit, typedDistance?: number) => {
    const requested = typedDistance ?? edit.distance;
    if (!Number.isFinite(requested) || Math.abs(requested) < 0.001) {
      setDirectEditLive(null);
      return setStatus("Direct edit cancelled · enter or drag a non-zero distance");
    }
    if (edit.kind === "face") {
      const active = features.slice(0, clampedRollback);
      const result = applyDirectFaceEdit(entities, active, edit.sourceEntityId, edit.topologyId, requested);
      if (!result.ok) {
        setDirectEditLive(null);
        return setStatus(`Push/Pull blocked · ${result.message}`);
      }
      setEntities(result.entities);
      setFeatures(result.features);
      setRollbackIndex(result.features.length);
      setSelectedFeatureId(result.features.at(-1)?.id ?? "");
      setDirectEditAmount(requested);
      setDirectEditLive(null);
      setExactRebuildFailure(null);
      setStatus(`Push/Pull committed · ${result.message}`);
      return;
    }
    const radius = Math.max(0.001, Math.abs(requested));
    setDirectEditAmount(radius);
    setDirectEditLive(null);
    addFeature(directFinishKind, radius);
  };

  const createExactPrimitive = (kind: "box" | "cylinder" | "sphere") => {
    const entityId = `${kind}-${id()}`;
    const center = { x: cursor.x, y: cursor.y };
    const entity: Entity = kind === "box"
      ? { id: entityId, type: "rectangle", a: { x: center.x - 40, y: center.y - 25 }, b: { x: center.x + 40, y: center.y + 25 }, rotation: 0, layer: "model", constraints: ["Horizontal", "Vertical", "80.00 mm", "50.00 mm"] }
      : { id: entityId, type: "circle", a: center, b: { x: center.x + (kind === "sphere" ? 20 : 16), y: center.y }, rotation: 0, layer: "model", constraints: [kind === "sphere" ? "Ø40.00 mm" : "Ø32.00 mm"] };
    const feature: Feature = {
      id: `${kind}-feature-${id()}`,
      type: kind === "sphere" ? "Revolve" : "Extrude",
      value: kind === "sphere" ? 360 : kind === "box" ? 24 : 40,
      unit: kind === "sphere" ? "°" : "mm",
      enabled: true,
      sourceEntityId: entityId,
    };
    setEntities((current) => [...current, entity]);
    setFeatures((current) => [...current.slice(0, clampedRollback), feature]);
    setRollbackIndex(clampedRollback + 1);
    setSelectedId(entityId);
    setSelectedEntityIds([entityId]);
    setSelectedFeatureId(feature.id);
    setCompletedSketchRegion(null);
    setModelToolCategory("select");
    setStatus(kind === "box"
      ? "Box created · 80 × 50 × 24 mm · exact dimensions remain editable"
      : kind === "cylinder"
        ? "Cylinder created · Ø32 × 40 mm · exact dimensions remain editable"
        : "Sphere created · Ø40 mm revolved exact profile");
  };

  const beginWorldSketch = () => {
    const plane = planeById(sketchPlanes, activeSketchPlaneId || WORLD_PLANE_ID);
    beginEmbeddedSketch(plane, selected?.id);
  };

  const createCenteredMountHole = () => {
    if (!sketchSession) return;
    const existing = selected?.type === "circle" && selected.sketchPlaneId === sketchSession.planeId ? selected : null;
    const circleId = existing?.id ?? `mount-hole-${id()}`;
    const circle: Entity = {
      id: circleId,
      type: "circle",
      a: { x: 0, y: 0 },
      b: { x: 8, y: 0 },
      rotation: 0,
      layer: activeLayer,
      sketchPlaneId: sketchSession.planeId,
      constraints: ["Centered", "Ø16.00 mm", "Fixed"],
    };
    setEntities((current) => existing
      ? current.map((entity) => entity.id === circleId ? circle : entity)
      : [...current, circle]);
    setGeometricConstraints((current) => current.some((constraint) => constraint.kind === "fixed" && constraint.entityIds[0] === circleId)
      ? current
      : [...current, { id: id(), kind: "fixed", entityIds: [circleId] }]);
    setSelectedId(circleId);
    setSelectedEntityIds([circleId]);
    setTool("select");
    setStatus("Centered Ø16.00 mm circle · fully constrained · ready to Finish Sketch");
  };

  const finishEmbeddedSketch = () => {
    if (!sketchSession) {
      setView("model");
      setStatus("Returned to Model");
      return;
    }
    const existing = new Set(sketchSession.entityIdsBefore);
    const created = entities.filter((entity) => !existing.has(entity.id) && entity.sketchPlaneId === sketchSession.planeId);
    const selectedCreated = created.find((entity) => entity.id === selectedId && (entity.type !== "line" || wireSourceMap.has(entity.id)));
    const profile = selectedCreated
      ?? created.find((entity) => entity.type !== "line")
      ?? created.find((entity) => wireSourceMap.has(entity.id));
    setSketchSession(null);
    setView("model");
    setTool("select");
    setModelToolCategory("select");
    if (!profile) {
      setCompletedSketchRegion(null);
      setStatus(`Finished sketch on ${sketchSession.planeName} · no new closed region`);
      return;
    }
    setSelectedId(profile.id);
    setSelectedEntityIds([profile.id]);
    setCompletedSketchRegion({ profileId: profile.id, sourceEntityId: sketchSession.sourceEntityId, planeName: sketchSession.planeName });
    setStatus(`Closed region ready on ${sketchSession.planeName} · choose Extrude, Cut, or Revolve`);
  };

  const applyCompletedSketch = (type: "Extrude" | "Cut" | "Revolve") => {
    const region = completedSketchRegion;
    if (!region) return;
    const baseSource = region.sourceEntityId
      ?? [...features].reverse().flatMap((feature) => featureSourceIds(feature) ?? []).find((sourceId) => sourceId !== region.profileId)
      ?? entities.find((entity) => entity.id !== region.profileId && entity.type === "rectangle")?.id;
    if (type === "Cut" && !baseSource) {
      setStatus("Select a target body before cutting this sketch region");
      return;
    }
    const decision = guardExactOperation({
      type,
      value: type === "Revolve" ? 360 : type === "Extrude" ? quickExtrudeDepth : 0,
      sourceIds: type === "Cut" ? [baseSource!, region.profileId] : [region.profileId],
      topologyIds: [],
    });
    if (!decision.ok) {
      setExactRebuildFailure({ message: decision.message });
      setStatus(`Operation blocked · ${decision.message}`);
      return;
    }
    const feature: Feature = {
      id: `${type.toLowerCase()}-${id()}`,
      type,
      value: decision.value,
      unit: type === "Revolve" ? "°" : "mm",
      enabled: true,
      sourceEntityId: decision.sourceIds.length === 1 ? decision.sourceIds[0] : undefined,
      sourceEntityIds: decision.sourceIds.length > 1 ? decision.sourceIds : undefined,
    };
    setFeatures((current) => [...current.slice(0, clampedRollback), feature]);
    setRollbackIndex(clampedRollback + 1);
    setSelectedFeatureId(feature.id);
    setCompletedSketchRegion(null);
    setExactRebuildFailure(null);
    setStatus(type === "Cut"
      ? `Cut through body · ${region.profileId} · exact B-Rep rebuilding`
      : `${type} created from ${region.profileId} · exact B-Rep rebuilding`);
  };

  const makeSketch3D = () => {
    if (!Number.isFinite(quickExtrudeDepth) || quickExtrudeDepth <= 0) return setStatus("Enter a positive 3D depth");
    if (view === "sketch") {
      const chosen = sketchItems.filter((o) => o.ids.some((entityId) => sketchTargets.includes(entityId)));
      if (!chosen.length) return setStatus("Select a closed profile first · click inside a shape or choose one in Objects");
      if (chosen.some((o) => !o.closed) || sketchSelectionLocked) return setStatus("Make 3D blocked · the selected path is open or locked. Select closed, unlocked profiles; other profiles were not changed.");
      const active = features.slice(0, clampedRollback), added: Feature[] = [];
      for (const object of chosen) {
        const source = wireSourceMap.get(object.id) ?? object.id;
        const existing = [...active].reverse().find((f) => f.type === "Extrude" && featureSourceIds(f)?.some((entityId) => (wireSourceMap.get(entityId) ?? entityId) === source));
        if (existing) { const index = active.indexOf(existing); active[index] = { ...existing, value: quickExtrudeDepth, enabled: true }; }
        else added.push({ id: id(), type: "Extrude", value: quickExtrudeDepth, enabled: true, unit: "mm", sourceEntityId: object.id });
      }
      // One state commit / Undo for the whole multi-profile extrusion. Keep future history.
      setFeatures([...active, ...added, ...features.slice(clampedRollback)]);
      setRollbackIndex(clampedRollback + added.length); setSelectedFeatureId(added.at(-1)?.id ?? active.at(-1)?.id ?? "");
      setSketchSession(null); setCompletedSketchRegion(null); setTool("select"); setView("model");
      setStatus(`${chosen.length} selected profile${chosen.length === 1 ? "" : "s"} extruded ${formatCadLength(quickExtrudeDepth, units, precision)} · edit depth in Feature history or use Push/Pull`);
      return;
    }
    if (exactProfiles.length === 0) return setStatus("Close a Pen/Pencil loop, draw a rectangle or circle, or import a closed SVG first");
    const selectedProfile = selected && (selected.type !== "line" || wireSourceMap.has(selected.id));
    if (selected && !selectedProfile) return setStatus("Make 3D blocked · the selected path is open. Close this path or select a closed profile; other profiles were not changed.");
    const selectedSource = selectedProfile ? selected.id : undefined;
    const existing = features.slice(0, clampedRollback).reverse().find((feature) => feature.type === "Extrude"
      && (selectedSource ? featureSourceIds(feature)?.includes(selectedSource) : !featureSourceIds(feature)?.length));
    if (existing) {
      setFeatures((current) => current.slice(0, clampedRollback).map((feature) => feature.id === existing.id ? { ...feature, value: quickExtrudeDepth, enabled: true } : feature));
      setRollbackIndex(clampedRollback);
      setSelectedFeatureId(existing.id);
      setStatus(`Exact 3D updated · ${quickExtrudeDepth} mm extrusion${selectedSource ? " · selected profile only" : " · all closed profiles"}`);
    } else addFeature("Extrude", quickExtrudeDepth);
    setSketchSession(null);
    setCompletedSketchRegion(null);
    setTool("select");
    setView("model");
  };

  const pushPullSelection = (amount = toolShelfAmount) => {
    if (!Number.isFinite(amount) || amount === 0) return setStatus("Enter a non-zero Push / Pull distance");
    if (selectedMeshId && selectedMeshFaces.length) {
      applySculptEdit("extrude", amount);
      return;
    }
    const selectedProfile = selected && (selected.type !== "line" || wireSourceMap.has(selected.id));
    if (!selectedProfile) return setStatus("Select a closed sketch profile or mesh face before Push / Pull");
    const depth = Math.abs(amount);
    const existing = [...features].reverse().find((feature) => feature.type === "Extrude" && featureSourceIds(feature)?.includes(selected.id));
    if (existing) {
      setFeatures((current) => current.map((feature) => feature.id === existing.id ? { ...feature, value: depth, enabled: true } : feature));
      setSelectedFeatureId(existing.id);
      setRollbackIndex(features.length);
      setStatus(`Push / Pull updated · ${formatCadLength(depth, units, precision)} · exact solid rebuilding`);
    } else {
      addFeature("Extrude", depth);
      setStatus(`Push / Pull created · ${formatCadLength(depth, units, precision)} · exact history feature`);
    }
    setQuickExtrudeDepth(depth);
    setView("model");
  };

  const removeFeature = (featureId: string) => {
    setFeatures((current) => {
      const index = current.findIndex((item) => item.id === featureId);
      if (index < 0) return current;
      if (index < clampedRollback) setRollbackIndex((value) => Math.max(0, value - 1));
      return current.filter((item) => item.id !== featureId);
    });
    if (selectedFeatureId === featureId) setSelectedFeatureId(null);
    setStatus("Feature removed · model rebuilt");
  };

  const setRollbackTo = (position: number) => {
    const clamped = Math.max(0, Math.min(position, features.length));
    setRollbackIndex(clamped);
    setStatus(clamped === features.length
      ? "Rollback at end · all features active"
      : `Rollback at position ${clamped} · ${features.length - clamped} feature(s) suppressed`);
  };

  const moveFeature = (featureId: string, delta: -1 | 1) => {
    setFeatures((current) => {
      const index = current.findIndex((item) => item.id === featureId);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = current.slice();
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
    setStatus("Feature reordered · rebuild pipeline updated");
  };

  const selectFeature = (feature: Feature) => {
    setSelectedFeatureId(feature.id);
    if (feature.sourceEntityId && (entities.some((entity) => entity.id === feature.sourceEntityId) || importedBodies.some((body) => body.id === feature.sourceEntityId))) {
      setSelectedId(feature.sourceEntityId);
      setStatus(`${feature.type} · source highlighted${feature.topologyIds?.length ? ` · ${feature.topologyIds.length} persistent topology target(s)` : ""}`);
    } else {
      setStatus(`${feature.type} · no bound source`);
    }
  };

  const reassignFeatureSource = (featureId: string, additive: boolean) => {
    const feature = features.find((item) => item.id === featureId);
    const selectableId = selected && (selected.type !== "line" || feature?.type === "Sweep") ? selected.id : importedBodies.some((body) => body.id === selectedId) ? selectedId : null;
    if (!selectableId) return setStatus(feature?.type === "Sweep" ? "Select a closed profile or open path, then click the badge" : "Select a closed profile or imported body first, then click the badge");
    setFeatures((current) => current.map((item) => {
      if (item.id !== featureId) return item;
      if (!additive) return { ...item, sourceEntityId: selectableId, sourceEntityIds: undefined };
      const existing = featureSourceIds(item) ?? [];
      const next = existing.includes(selectableId)
        ? existing.filter((entityId) => entityId !== selectableId)
        : [...existing, selectableId];
      return { ...item, sourceEntityId: undefined, sourceEntityIds: next };
    }));
    setStatus(additive ? "Feature source list updated (shift-click)" : "Feature source replaced");
  };

  /**
   * Applies any industry module's plan to the workspace. The core does not know
   * what the module makes — only how to place entities, layers, components and
   * instances. See app/module-registry.ts for the contract.
   */
  const applyIndustryModule = useCallback(<Spec, Plan extends ModulePlan>(
    industryModule: IndustryModule<Spec, Plan>,
    requested: Partial<Spec>,
  ) => {
    const application = buildModuleApplication(industryModule, requested, {
      selectedEntity: entities.find((entity) => entity.id === selectedId) ?? null,
      cursor,
      activeSketchPlaneId,
      existingLayers: layers,
      featureCount: features.length,
      componentNames: components.map((component) => component.name),
      makeId: id,
    });
    if (application.newLayers.length) setLayers((current) => [...current, ...application.newLayers]);
    setEntities((current) => [...current, ...application.entities, ...application.hostEdits.entities]);
    setFeatures((current) => [...current, ...application.features, ...application.hostEdits.features]);
    setRollbackIndex(application.rollbackIndex);
    setComponents((current) => [...current, application.component as unknown as CadComponent]);
    setAssemblyInstances((current) => [...current, application.instance]);
    if (application.material) {
      setMaterial(application.material.name);
      setDensity(application.material.density);
    }
    if (application.selectEntityId) setSelectedId(application.selectEntityId);
    setView("model");
    setStatus(application.status);
    return application;
  }, [activeSketchPlaneId, components, cursor, entities, features.length, layers, selectedId]);

  const createEngineeringProPart = useCallback((requested: Partial<EngineeringProSpec> = engineeringSpec) => {
    const application = applyIndustryModule(engineeringModule, requested);
    setEngineeringSpec(application.spec as EngineeringProSpec);
    setDesignDiscipline("engineering");
    setProTab("engineering");
    return application.component.id;
  }, [applyIndustryModule, engineeringSpec]);

  const runRecipeGraph = () => {
    const prefix = `recipe-${id()}`;
    const result = evaluateRecipeGraph(activeRecipe, cursor, prefix);
    if (!result.valid) return setStatus(`Recipe blocked · ${result.errors.join(" · ")}`);
    const placed = result.entities.map((entity) => ({ ...entity, sketchPlaneId: activeSketchPlaneId }));
    setLayers((current) => current.some((layer) => layer.id === "recipe") ? current : [...current, { id: "recipe", name: "Recipe Graph outputs", color: "#c795ff", visible: true, locked: false }]);
    setEntities((current) => [...current, ...placed]); setFeatures((current) => [...current, ...result.features]);
    setRollbackIndex(features.length + result.features.length); setSelectedId(placed[0]?.id ?? selectedId); setView("model");
    setStatus(`${activeRecipe.name} executed · ${result.order.length} graph nodes · editable output`);
  };

  const createRecipeGraph = () => {
    const graph: RecipeGraph = { id: `recipe-${id()}`, name: "Untitled intelligent generator", version: 1, author: "Designer", shared: false, nodes: [] };
    setRecipeGraphs((current) => [...current, graph]); setActiveRecipeId(graph.id); setProTab("recipe");
  };

  const addRecipeNode = (kind: RecipeGraph["nodes"][number]["kind"]) => {
    const nodeId = `${kind}-${activeRecipe.nodes.length + 1}`;
    const parameters = activeRecipe.nodes.filter((node) => node.kind === "parameter");
    const profiles = activeRecipe.nodes.filter((node) => node.kind === "circle" || node.kind === "rectangle");
    const featuresInGraph = activeRecipe.nodes.filter((node) => ["extrude", "pattern", "fillet", "boolean"].includes(node.kind));
    const inputs = kind === "circle" ? parameters.slice(0, 1).map((node) => node.id)
      : kind === "rectangle" ? parameters.slice(0, 2).map((node) => node.id)
      : kind === "extrude" ? [profiles.at(-1)?.id, parameters.at(-1)?.id].filter((value): value is string => Boolean(value))
      : kind === "pattern" ? [profiles.at(-1)?.id].filter((value): value is string => Boolean(value))
      : kind === "fillet" ? [profiles.at(-1)?.id].filter((value): value is string => Boolean(value))
      : kind === "boolean" ? profiles.slice(-2).map((node) => node.id)
      : kind === "output" ? [featuresInGraph.at(-1)?.id].filter((value): value is string => Boolean(value)) : [];
    const values: Record<string, string | number> = kind === "parameter" ? { value: 20 } : kind === "rectangle" ? { width: 20, height: 20 } : kind === "pattern" ? { count: 4 } : kind === "fillet" ? { radius: 1 } : kind === "boolean" ? { operation: "Cut" } : {};
    setRecipeGraphs((current) => current.map((graph) => graph.id === activeRecipe.id ? { ...graph, version: graph.version + 1, nodes: [...graph.nodes, { id: nodeId, kind, inputs, values }] } : graph));
  };

  const refreshBimGraph = () => {
    const graph = migrateBimObjectGraph(effectiveBimNodes, entities, projectPath?.split(/[\\/]/).pop() ?? "Form BIM Project");
    const documents = generateArchitectureDocuments(graph);
    setBimNodes(graph); setDesignDiscipline("architecture"); setProTab("architecture");
    setStatus(`BIM synchronized · ${graph.length} objects · ${documents.plans.length} coordinated plans · audit ${documents.audit.score}/100`);
  };

  const patchBimNode = (nodeId: string, patch: Parameters<typeof updateBimNode>[2]) => {
    try {
      const graph = updateBimNode(effectiveBimNodes, nodeId, patch);
      setBimNodes(graph);
      setStatus(`BIM dependency graph rebuilt · ${graph.length} coordinated objects`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "BIM edit could not be applied");
    }
  };

  const addArchitectureLevel = () => {
    try {
      const graph = addBimStorey(effectiveBimNodes);
      const level = graph.filter((node) => node.kind === "storey").at(-1);
      setBimNodes(graph);
      setSelectedBimNodeId(level?.id ?? null);
      setStatus(`${level?.name ?? "Level"} added · plans, sections and schedules rebuilt`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Level could not be added");
    }
  };

  const openBimDocument = (documentId: string) => {
    const kind = architectureDocuments.plans.some((plan) => plan.id === documentId) ? "bim-plan" : "bim-section";
    setSelectedBimDocumentId(`bim:${kind}:${documentId}`);
    setDocumentPanel("sheet");
    setView("drawing");
    setStatus(`${architectureDocuments.plans.find((plan) => plan.id === documentId)?.name ?? architectureDocuments.sections.find((section) => section.id === documentId)?.name ?? "BIM document"} opened`);
  };

  const exportIfc = () => {
    const documents = generateArchitectureDocuments(effectiveBimNodes);
    if (!documents.audit.valid || !documents.documentAudit.valid || !documents.ifcValidation.ready) {
      const reason = [...documents.audit.errors, ...documents.documentAudit.errors, ...documents.ifcValidation.errors][0] ?? "BIM coordination checks did not pass";
      setStatus(`IFC4 export blocked · ${reason}`);
      return;
    }
    download(documents.ifc, "form-studio.ifc", "application/x-step");
    setStatus(`IFC4 coordination model exported · ${documents.ifcValidation.productCount} products · ${(documents.ifcValidation.geometryCoverage * 100).toFixed(0)}% exchange geometry`);
  };

  const importIfc = async (file: File) => {
    try {
      const imported = importIfc4(await file.text());
      if (!imported.validation.ready) throw new Error(imported.validation.errors[0] ?? "IFC4 import validation failed");
      const graph = rebuildBimObjectGraph(imported.nodes);
      setBimNodes(graph);
      setSelectedBimNodeId(graph.find((node) => node.kind === "building")?.id ?? null);
      setDesignDiscipline("architecture");
      setProTab("architecture");
      setStatus(`IFC4 imported · ${imported.validation.importedProducts} products · ${imported.validation.geometryProducts} swept-solid representations${imported.validation.warnings.length ? ` · ${imported.validation.warnings.length} warning(s)` : ""}`);
    } catch (error) {
      setStatus(error instanceof Error ? `IFC import failed · ${error.message}` : "IFC import failed");
    }
  };

  const checkpointRevision = () => {
    const revision = createRevision(activeBranch, revisionMessage, revisions);
    setRevisions((current) => [...current, revision]); setStatus(`${revision.id} created on ${activeBranch} · ready for review`);
  };

  const reviewLatestRevision = (action: "request" | "approve" | "changes") => {
    const latest = revisions.at(-1); if (!latest) return setStatus("Create a revision before starting review");
    const reviewed = updateRevisionReview(latest, "Project reviewer", action);
    setRevisions((current) => current.map((revision) => revision.id === latest.id ? reviewed : revision));
    setStatus(`${reviewed.id} · ${reviewed.status.replace("-", " ")}`);
  };

  const createDomainObject = useCallback((
    kind: DomainRecipeKind,
    requested: Partial<DomainParameters> = domainRecipeKind === kind ? domainParameters : {},
  ) => {
    const application = applyIndustryModule(domainsModule, { ...domainDefaultSpec(kind), ...requested, kind });
    setDesignDiscipline(application.plan.metadata.discipline);
    setDomainRecipeKind(kind);
    setDomainParameters(application.spec as DomainParameters);
    return application.component.id;
  }, [applyIndustryModule, domainParameters, domainRecipeKind]);

  const createJewelryPiece = useCallback((requested: Partial<JewelrySpec> = jewelrySpec) => {
    const application = applyIndustryModule(jewelryModule, requested);
    setJewelrySpec(application.spec as JewelrySpec);
    setDesignDiscipline("jewelry");
    setDomainRecipeKind("ring");
    return application.component.id;
  }, [applyIndustryModule, jewelrySpec]);

  const createSmartHardware = useCallback((
    kind: HardwareKind,
    requested: Partial<HardwareSpec> = hardwareKind === kind ? hardwareParameters : {},
    requestedMode: HardwareMode = hardwareMode,
  ) => {
    const application = applyIndustryModule(hardwareModule, {
      ...hardwareDefaultSpec(kind),
      ...requested,
      kind,
      mode: requestedMode,
      mountCut: hardwareMountCut,
    });
    const spec = application.spec as HardwareSpec;
    setHardwareKind(kind);
    setHardwareParameters(spec);
    setHardwareMode(requestedMode);
    return application.component.id;
  }, [applyIndustryModule, hardwareKind, hardwareMode, hardwareMountCut, hardwareParameters]);

  const buildLinkedGroup = (requested: Partial<LinkSystemSpec> = linkSpec, requestedGroupId?: string) => {
    const groupId = requestedGroupId ?? `linked-${id()}`;
    const existing = linkedGroups.find((group) => group.id === groupId);
    const previousPendant = existing?.anchors.find((anchor) => anchor.id === "pendant")?.position;
    const origin = previousPendant ? {
      x: previousPendant[0],
      y: previousPendant[1] + (existing!.spec.kind === "necklace" ? existing!.spec.drop * 0.9 : existing!.spec.kind === "bracelet" ? existing!.spec.drop / 2 : 0),
    } : cursor;
    let plan: ReturnType<typeof planLinkSystem>;
    try {
      plan = planLinkSystem(requested, origin, `${groupId}-master`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to build linked system");
      return;
    }
    const componentId = `${groupId}-component`;
    const allEntities: Entity[] = [];
    const allFeatures: Feature[] = [];
    const instances: AssemblyInstance[] = [];
    plan.placements.forEach((placement) => {
      const clone = cloneLinkTemplate(plan, placement, groupId);
      const placed = clone.entities.map((entity) => ({ ...entity, sketchPlaneId: activeSketchPlaneId }));
      allEntities.push(...placed);
      allFeatures.push(...clone.features);
      instances.push({
        id: placement.id,
        name: `${plan.spec.shape} link ${placement.index + 1}`,
        componentId,
        entityIds: placed.map((entity) => entity.id),
        position: placement.position,
        rotation: placement.rotation,
        fixed: placement.index === 0,
      });
    });
    const previousBindingState = new Map(existing?.bindings.map((binding) => [binding.kind, binding.enabled]) ?? []);
    const retainedBindings = existing?.bindings.filter((binding) =>
      binding.kind === "endpoint" && binding.targetIds.some((target) => target.startsWith("anchor:"))) ?? [];
    const anchorById = new Map(plan.anchors.map((anchor) => [anchor.id, anchor]));
    const attached = new Map(retainedBindings.flatMap((binding) => {
      const anchorId = binding.targetIds.find((target) => target.startsWith("anchor:"))?.slice(7) as LinkAnchor["id"] | undefined;
      const anchor = anchorId ? anchorById.get(anchorId) : undefined;
      return anchor ? [[binding.sourceId, anchor] as const] : [];
    }));
    const previousEntityIds = new Set(existing?.entityIds ?? []);
    const previousFeatureIds = new Set(existing?.featureIds ?? []);
    setEntities((current) => [
      ...current.filter((entity) => !previousEntityIds.has(entity.id)).map((entity) => {
        const anchor = attached.get(entity.id);
        if (!anchor) return entity;
        const dx = anchor.position[0] - entity.a.x;
        const dy = anchor.position[1] - entity.a.y;
        return { ...entity, a: { x: entity.a.x + dx, y: entity.a.y + dy }, b: { x: entity.b.x + dx, y: entity.b.y + dy } };
      }),
      ...allEntities,
    ]);
    setFeatures((current) => [...current.filter((feature) => !previousFeatureIds.has(feature.id)), ...allFeatures]);
    setRollbackIndex(features.filter((feature) => !previousFeatureIds.has(feature.id)).length + allFeatures.length);
    const component: CadComponent = {
      id: componentId,
      name: plan.name,
      entities: structuredClone(plan.templateEntities),
      features: structuredClone(plan.templateFeatures),
      linked: { groupId, role: "master" },
    };
    setComponents((current) => [...current.filter((item) => item.id !== componentId), component]);
    const previousInstanceIds = new Set(existing?.instanceIds ?? []);
    setAssemblyInstances((current) => [...current.filter((instance) => !previousInstanceIds.has(instance.id)), ...instances]);
    setAssemblyMates((current) => current.filter((mate) => !previousInstanceIds.has(mate.firstId) && !previousInstanceIds.has(mate.secondId)));
    const group: LinkedGroup = {
      id: groupId,
      name: plan.name,
      masterComponentId: componentId,
      instanceIds: instances.map((instance) => instance.id),
      entityIds: allEntities.map((entity) => entity.id),
      featureIds: allFeatures.map((feature) => feature.id),
      bindings: [...plan.bindings.map((binding) => ({ ...binding, enabled: previousBindingState.get(binding.kind) ?? binding.enabled })), ...retainedBindings],
      anchors: plan.anchors,
      spec: plan.spec,
      pathLength: plan.pathLength,
      averagePitch: plan.averagePitch,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    setLinkedGroups((current) => [...current.filter((item) => item.id !== groupId), group]);
    setLayers((current) => current.some((layer) => layer.id === "linked-system") ? current : [...current, { id: "linked-system", name: "Linked systems", color: "#e7c66a", visible: true, locked: false }]);
    setLinkSpec(plan.spec);
    setActiveLinkedGroupId(groupId);
    setSelectedId(allEntities[0]?.id ?? "");
    setView("model");
    setStatus(`${plan.name} · ${plan.pathLength.toFixed(1)} mm path · ${plan.bindings.filter((binding) => binding.enabled).length} live bindings${plan.warnings.length ? ` · ${plan.warnings.join(" · ")}` : ""}`);
  };

  const bindSelectedToLinkedAnchor = (anchorId: LinkAnchor["id"]) => {
    const group = linkedGroups.find((item) => item.id === activeLinkedGroupId);
    const anchor = group?.anchors.find((item) => item.id === anchorId);
    if (!group || !anchor || !selected) return setStatus("Select an external object and a linked group first");
    if (group.entityIds.includes(selected.id)) return setStatus("Select a pendant, clasp, or other object outside the link group");
    const dx = anchor.position[0] - selected.a.x;
    const dy = anchor.position[1] - selected.a.y;
    setEntities((current) => current.map((entity) => entity.id === selected.id ? {
      ...entity,
      a: { x: entity.a.x + dx, y: entity.a.y + dy },
      b: { x: entity.b.x + dx, y: entity.b.y + dy },
    } : entity));
    setLinkedGroups((current) => current.map((item) => item.id !== group.id ? item : {
      ...item,
      bindings: [...item.bindings.filter((binding) => !(binding.sourceId === selected.id && binding.kind === "endpoint")), {
        id: `${group.id}-attach-${selected.id}`,
        kind: "endpoint" as const,
        sourceId: selected.id,
        targetIds: [`anchor:${anchorId}`],
        expression: `object.position = ${anchorId} anchor`,
        enabled: true,
      }],
    }));
    setStatus(`${selected.id} bound to ${anchor.name} · it will follow necklace regeneration`);
  };

  const deleteLinkedGroup = (groupId: string) => {
    const group = linkedGroups.find((item) => item.id === groupId);
    if (!group) return;
    const entityIds = new Set(group.entityIds);
    const featureIds = new Set(group.featureIds);
    const instanceIds = new Set(group.instanceIds);
    setEntities((current) => current.filter((entity) => !entityIds.has(entity.id)));
    setFeatures((current) => current.filter((feature) => !featureIds.has(feature.id)));
    setComponents((current) => current.filter((component) => component.id !== group.masterComponentId));
    setAssemblyInstances((current) => current.filter((instance) => !instanceIds.has(instance.id)));
    setAssemblyMates((current) => current.filter((mate) => !instanceIds.has(mate.firstId) && !instanceIds.has(mate.secondId)));
    setLinkedGroups((current) => current.filter((item) => item.id !== groupId));
    if (activeLinkedGroupId === groupId) setActiveLinkedGroupId(null);
    setStatus(`${group.name} removed`);
  };

  const executeCommand = (requestedCommand = command) => {
    const input = requestedCommand.trim();
    if (!input) return;
    const remember = () => setCommandHistory((current) => [input, ...current.filter((item) => item !== input)].slice(0, 6));
    const stage = (preview: DesignCopilotPreview) => {
      remember();
      setCopilotPreview(preview);
      setCommand("");
      setStatus(`${preview.summary} · review the editable plan before applying`);
    };
    const selectionIntent = parseSelectionIntent(input, units);
    if (selectionIntent) {
      remember();
      setCommand("");
      if (selectionIntent.kind === "region") {
        armRegionSelection(selectionIntent.region, selectionIntent.combine, selectionIntent.mode);
        return;
      }
      if (selectionIntent.kind === "extrude") {
        const amount = selectionIntent.amount ?? 10;
        applySculptEdit("extrude", amount);
        return;
      }
      const target = meshRebuilds.find(({ feature }) => feature.id === selectedMeshId)
        ?? (meshRebuilds.length === 1 ? meshRebuilds[0] : null);
      if (!target) {
        setStatus("Add or select a sculpt before changing mesh selection");
        return;
      }
      if (target.feature.id !== selectedMeshId) setSelectedMeshId(target.feature.id);
      setMeshSelection((current) => {
        const based = selectionIntent.mode
          ? setSelectionMode(target.rebuild.surface, current, selectionIntent.mode)
          : current;
        const next = applySelectionCommand(target.rebuild.surface, based, selectionIntent.command);
        setStatus(`${selectionIntent.command} · ${describeSelection(next)}`);
        return next;
      });
      setView("model");
      return;
    }
    const smartCommand = parseSmartCommand(input, units);
    if (smartCommand) {
      if (smartCommand.kind === "modifier") {
        const summary = describeSmartModifierCommand(smartCommand);
        return stage({
          command: input,
          summary,
          actions: [
            selectedMeshId ? "Add to the selected non-destructive stack" : "Create a creative copy while preserving the exact source",
            `${["X", "Y", "Z"][smartCommand.axis]} deformation axis`,
            smartCommand.anchorStart ? "Anchor the lower end" : "Allow the lower end to move",
            smartCommand.preserveVolume ? "Compensate closed volume" : "Leave volume unconstrained",
          ],
          plan: { kind: "modifier", value: smartCommand },
        });
      }
      if (smartCommand.kind === "lock") {
        const label = smartCommand.lock === "preserveVolume" ? "Preserve volume" : "Anchor lower end";
        return stage({
          command: input,
          summary: `${label} · ${smartCommand.enabled ? "enable" : "disable"}`,
          actions: ["Update the latest creative modifier", "Keep the change non-destructive", "Leave every other parameter unchanged"],
          plan: { kind: "lock", value: smartCommand },
        });
      }
      return stage({
        command: input,
        summary: "Create an editable creative copy",
        actions: ["Preserve the exact B-Rep source", "Copy its evaluated surface", "Open the non-destructive modifier stack"],
        plan: { kind: "smart-action", value: { actionId: smartCommand.actionId } },
      });
    }
    const assessment = assessDesignCopilotRequest(input);
    if (assessment.status === "excluded") {
      setStatus(`Design Copilot scope · ${assessment.message}`);
      return;
    }
    const garment = parseGarmentIntent(input);
    if (garment) {
      return stage({ command: input, summary: garment.summary, actions: garment.actions, plan: { kind: "garment", value: garment } });
    }
    const linked = parseLinkSystemCommand(input, units);
    if (linked) {
      const requested = { ...linkSpec, ...linked };
      return stage({
        command: input,
        summary: `${requested.count} editable ${requested.shape} links · ${requested.kind}`,
        actions: ["Exact master link", "Live path distribution", "Clasp and endpoint bindings", "Editable assembly instances"],
        plan: { kind: "linked", value: requested },
      });
    }
    const jewelry = parseJewelryCommand(input, units);
    if (jewelry) {
      const requested = { ...jewelrySpec, ...jewelry };
      const metrics = jewelryMetrics(requested);
      return stage({
        command: input,
        summary: `${requested.ringSystem} ${requested.ringSize} ${requested.stoneShape} ${requested.settingStyle} ring`,
        actions: [`${metrics.innerDiameter.toFixed(2)} mm exact inner diameter`, `${requested.stoneLength.toFixed(1)} × ${requested.stoneWidth.toFixed(1)} mm stone`, `${requested.prongCount} production prongs`, "Editable setting history"],
        plan: { kind: "jewelry", value: requested },
      });
    }
    const domain = parseDomainCommand(input, units);
    if (domain) {
      const recipe = DOMAIN_RECIPES.find((entry) => entry.kind === domain.kind);
      return stage({
        command: input,
        summary: `Exact ${recipe?.name ?? domain.kind}`,
        actions: ["Parametric dimensions", "Editable sketches and features", "Domain design checks", "Manufacturing-ready B-Rep"],
        plan: { kind: "domain", value: domain },
      });
    }
    const hardware = parseHardwareCommand(input, units);
    if (hardware) {
      const recipe = HARDWARE_RECIPES.find((entry) => entry.kind === hardware.kind);
      const parameters = { ...hardwareDefaults(hardware.kind), ...hardware.parameters };
      return stage({
        command: input,
        summary: `Parametric ${recipe?.name ?? hardware.kind}`,
        actions: [`${parameters.size.toFixed(2)} mm primary size`, `${parameters.length.toFixed(2)} mm length`, `${parameters.clearance.toFixed(2)} mm clearance`, "Editable manufacturing feature history"],
        plan: { kind: "hardware", value: hardware },
      });
    }
    const intent = parseIntentModelCommand(input, units);
    if (intent) {
      return stage({
        command: input,
        summary: intent.summary,
        actions: [`${intent.entities.length} constrained sketch${intent.entities.length === 1 ? "" : "es"}`, ...intent.features.map((feature) => `${feature.type}${feature.value ? ` ${feature.value.toFixed(2)} ${feature.unit}` : ""}`)],
        plan: { kind: "exact", value: intent },
      });
    }
    const parsed = parseCadCommand(input, units);
    if (!parsed) {
      setStatus(`Design Copilot scope · ${assessment.status === "candidate"
        ? `${assessment.capability.promise} Try: “${assessment.capability.example}”`
        : assessment.message}`);
      return;
    }
    remember();
    setCommand("");
    if (parsed.type === "units") {
      setUnits(parsed.unit);
      setStatus(`Display units changed to ${parsed.unit} · physical geometry unchanged`);
      return;
    }
    if (parsed.type === "rectangle") {
      const entity: Entity = {
        id: id(),
        type: "rectangle",
        a: parsed.origin,
        b: { x: parsed.origin.x + parsed.width, y: parsed.origin.y + parsed.height },
        rotation: 0,
        layer: activeLayer,
        constraints: ["Horizontal", "Vertical", "Perpendicular", "Exact width", "Exact height"],
      };
      setEntities((current) => [...current, entity]);
      setSelectedId(entity.id);
      setStatus(`Created rectangle · ${formatCadLength(parsed.width, units, precision)} × ${formatCadLength(parsed.height, units, precision)}`);
      return;
    }
    if (parsed.type === "circle") {
      const entity: Entity = {
        id: id(),
        type: "circle",
        a: parsed.center,
        b: { x: parsed.center.x + parsed.radius, y: parsed.center.y },
        rotation: 0,
        layer: activeLayer,
        constraints: ["Exact diameter", "Fixed center"],
      };
      setEntities((current) => [...current, entity]);
      setSelectedId(entity.id);
      setStatus(`Created circle · Ø${formatCadLength(parsed.radius * 2, units, precision)}`);
      return;
    }
    if (parsed.type === "line") {
      const entity: Entity = {
        id: id(),
        type: "line",
        a: parsed.start,
        b: parsed.end,
        rotation: 0,
        layer: activeLayer,
        constraints: ["Exact length", "Exact angle"],
      };
      setEntities((current) => [...current, entity]);
      setSelectedId(entity.id);
      setStatus(`Created line · ${formatCadLength(length(parsed.start, parsed.end), units, precision)} at ${fmt(entityAngle(entity), precision)}°`);
      return;
    }
    if (parsed.type === "set-dimension") {
      if (!selected) return setStatus("Select geometry before changing a dimension");
      const field = parsed.field === "diameter" ? "radius" : parsed.field;
      const value = parsed.field === "diameter" ? parsed.value / 2 : parsed.value;
      if (field === "width" || field === "height" || field === "radius" || field === "length") updateSelected(field, value);
      return;
    }
    if (parsed.type === "set-angle") {
      if (!selected) return setStatus("Select a line or rectangle before changing its angle");
      updateSelectedAngle(parsed.angle);
      return;
    }
    setFeatures((current) => {
      const existing = current.find((feature) => feature.type === parsed.feature);
      if (existing) return current.map((feature) => feature.id === existing.id
        ? { ...feature, value: parsed.value, unit: parsed.angular ? "°" : parsed.feature === "Pattern" ? "×" : "mm", enabled: true }
        : feature);
      return [...current, { id: id(), type: parsed.feature, value: parsed.value, unit: parsed.angular ? "°" : parsed.feature === "Pattern" ? "×" : "mm", enabled: true }];
    });
    setStatus(`${parsed.feature} set precisely · ${parsed.angular ? `${fmt(parsed.value, precision)}°` : parsed.feature === "Pattern" ? `${parsed.value}×` : formatCadLength(parsed.value, units, precision)}`);
  };

  const applyCopilotPreview = () => {
    if (!copilotPreview) return;
    const { plan, summary } = copilotPreview;
    setCopilotPreview(null);
    if (plan.kind === "garment") {
      setFabricInitialProject(plan.value.project);
      setFabricOpen(true);
      setStatus(`${summary} · opened as an editable garment project`);
      return;
    }
    if (plan.kind === "linked") {
      setLinkSpec(plan.value);
      buildLinkedGroup(plan.value);
      return;
    }
    if (plan.kind === "jewelry") return void createJewelryPiece(plan.value);
    if (plan.kind === "domain") return void createDomainObject(plan.value.kind, plan.value.parameters);
    if (plan.kind === "hardware") return void createSmartHardware(plan.value.kind, plan.value.parameters);
    if (plan.kind === "modifier") return void applySmartModifierCommand(plan.value);
    if (plan.kind === "lock") return void applySmartLockCommand(plan.value);
    if (plan.kind === "smart-action") return void makeCreativeCopy();
    const plannedEntities: Entity[] = plan.value.entities.map((entity) => ({ ...entity, sketchPlaneId: activeSketchPlaneId }));
    const plannedFeatures: Feature[] = plan.value.features;
    const entityIds = new Set(plannedEntities.map((entity) => entity.id));
    const featureIds = new Set(plannedFeatures.map((feature) => feature.id));
    setEntities((current) => [...current.filter((entity) => !entityIds.has(entity.id)), ...plannedEntities]);
    setFeatures((current) => [...current.filter((feature) => !featureIds.has(feature.id)), ...plannedFeatures]);
    setRollbackIndex((current) => current + plannedFeatures.length);
    setSelectedId(plannedEntities[0].id);
    setView("model");
    setStatus(`${summary} · editable feature plan applied`);
  };

  const exportDXF = () => {
    download(exportCadDxf(entities, layers, drafting), "formcad-drawing.dxf", "application/dxf");
    const authored = drafting.texts.length + drafting.dimensions.length + drafting.leaders.length + drafting.hatches.length + drafting.blockInstances.length;
    setStatus(`DXF drawing exported · millimeters declared · ${layers.length} layers · ${authored} authored drafting objects`);
  };

  const printDrawing = async () => {
    if (view === "drawing" && !activeSheetLayout.source && (!productionDrawingSheet || drawingOutputBlocked)) return setStatus("Rebuild the current drawing before printing");
    if (view === "drawing" && activeSheetLayout.source && !sourceDrawingSheets.get(activeSheetLayout.id)?.svg) return setStatus("Restore the linked source before printing");
    setStatus(await requestDocumentPrint(async () => {
      const { invoke, isTauri } = await import("@tauri-apps/api/core");
      const { width, height } = sheetSize(activeSheetLayout);
      await withDocumentPrintSheet(document, width, height, async () => {
        if (isTauri()) await invoke("print_document_sheet", { widthMm: width, heightMm: height });
        else window.print();
      }, isTauri() && /Mac/.test(navigator.platform));
    }));
  };

  const rebuildDocumentViews = () => {
    if (!exactWorkerRef.current || (exactProfiles.length === 0 && importedBodies.length === 0)) return;
    const token = ++exactBuildTokenRef.current;
    setExactBuildState("building");
    setKernelStatus("loading");
    setStatus("Rebuilding calibrated drawing views and section…");
    void requestExactDrawing(token);
  };

  const documentExportPending = useRef(false);
  const saveDocumentExport = async (contents: string, name: string, format: DrawingExportFormat) => {
    if (documentExportPending.current) return setStatus("Finish or cancel the current drawing export first");
    documentExportPending.current = true;
    try {
      const result = await saveDrawingExport(contents, name, format);
      setStatus(result.state === "saved" ? `Drawing saved · ${result.path}` : result.state === "cancelled" ? "Drawing export cancelled · project unchanged" : "Drawing download requested · confirm completion in your browser");
    } catch (error) { setStatus(`Drawing export failed · ${error instanceof Error ? error.message : String(error)} · project unchanged`); }
    finally { documentExportPending.current = false; }
  };
  const exportProductionDrawing = () => {
    if (drawingOutputBlocked) return setStatus("Resolve or finish the exact rebuild before exporting this drawing");
    if (!productionDrawingSheet) return setStatus("Exact production sheet is still rebuilding");
    const slug = projectTitle.replace(/[^a-z0-9-_]+/gi, "-") || "form-project";
    void saveDocumentExport(productionDrawingSheet.svg, `${slug}-${activeSheetLayout.id}-rev-${productionDrawingSheet.metadata.revision}.svg`, "svg");
  };

  const exportFabricationReview = () => {
    if (drawingOutputBlocked) return setStatus("Resolve or finish the exact rebuild before exporting a shop review");
    if (!productionDrawingSheet) return setStatus("Exact production sheet is still rebuilding");
    const review = createFabricationReviewPackage(productionDrawingSheet);
    void saveDocumentExport(JSON.stringify(review, null, 2), `${review.packageId}.form-review.json`, "json");
  };

  const exportArtistReview = () => {
    const revision = revisions.at(-1)?.id ?? `working-${drawingRevision}`;
    const review = createArtistReviewPackage({
      projectId: roomId || "local-project",
      title: projectTitle,
      revision,
      checksum: cadProjectChecksum(projectData),
    });
    download(JSON.stringify(review, null, 2), `${review.packageId}.form-artist-review.json`, "application/json");
    setStatus(`Independent artist-review package exported · ${review.criteria.filter((criterion) => criterion.required).length} required checks · approval remains pending`);
  };

  const exportViewportPng = () => {
    const handle = viewportHandleRef.current;
    if (!handle) return setStatus("Open Model view before rendering an image");
    void handle.captureImage().then((blob) => {
      if (!blob) return setStatus("Image render failed · try the native preview");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${projectTitle.replace(/[^a-z0-9-_]+/gi, "-") || "form-project"}-render.png`;
      offerLocker(blob, anchor.download, "image/png", { kind: "render" });
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 800);
      setStatus(`Rendered PNG · ${appearance.environment} light · ${appearance.preset} finish`);
    });
  };

  const exportBlenderFile = async (kind: "glb" | "obj") => {
    const sources = viewportHandleRef.current?.exportSources?.() ?? [];
    if (!sources.length) return setStatus("Open Model view before exporting for Blender");
    const nodeName = new Map(sceneNodes.filter((node) => node.content).map((node) => [node.content!.id, node.name]));
    const featureName = new Map(meshFeatures.map((feature) => [feature.id, feature.name]));
    let body = 0;
    const nameOf = (mesh: { userData: Record<string, unknown> }) => {
      const id = String(mesh.userData.meshFeatureId ?? mesh.userData.sourceEntityId ?? "");
      return nodeName.get(id) ?? featureName.get(id) ?? `Body ${++body}`;
    };
    // Only real surfaces: no edge lines, selection overlays, previews or helpers.
    const include = (mesh: { userData: Record<string, unknown>; material: unknown }) =>
      (mesh.userData.sourceEntityId !== undefined || mesh.userData.meshFeatureId !== undefined)
      && !mesh.userData.softBodyPreview
      && !(Array.isArray(mesh.material) ? mesh.material : [mesh.material]).some((material) => (material as { isMeshBasicMaterial?: boolean }).isMeshBasicMaterial);
    const stem = projectTitle.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "form-model";
    setBlenderBusy(true);
    try {
      if (kind === "glb") {
        const group = bakeForBlender(sources, CAD_FRAME, { name: projectTitle || "Form model", nameOf, include });
        if (!group.children.length) throw new Error("There is nothing visible to export yet");
        const bytes = await blenderGlb(group, { generator: "Form", sourceUnits: "mm, Z-up" });
        group.traverse((object) => { const mesh = object as { isMesh?: boolean; geometry?: { dispose: () => void } }; if (mesh.isMesh) mesh.geometry?.dispose(); });
        download(bytes, `${stem}.glb`, "model/gltf-binary");
        setStatus(`${stem}.glb · ${group.children.length} part${group.children.length === 1 ? "" : "s"} in metres, Y-up · ${BLENDER_IMPORT_STEPS.split(".")[0]}`);
      } else {
        const zip = await blenderObjZip(sources, projectTitle || "Form model", CAD_FRAME, { app: "Form", nameOf, include });
        download(zip.blob, `${stem}-obj.zip`, "application/zip");
        setStatus(`${stem}-obj.zip · ${zip.parts} parts, ${zip.materials} materials, ${zip.textures} textures · metres, Y-up`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? `Blender export failed · ${error.message}` : "Blender export failed");
    } finally { setBlenderBusy(false); }
  };

  const exportManufacturingReport = () => {
    const report = createManufacturingReport(projectTitle, designAnalysis, {
      audit: kernelAudit,
      bodyMetrics: exactBodyMetrics,
      material,
      density,
      units,
      gdt,
      drawingValidation: gdtValidation,
      productionDrawing: productionDrawingSheet ? {
        schema: productionDrawingSheet.schema,
        metadata: productionDrawingSheet.metadata,
        dimensions: productionDrawingSheet.dimensions,
        views: productionDrawingSheet.views,
        validation: productionDrawingSheet.validation,
      } : null,
      semanticComponents: [...components.filter((component) => component.domain || component.jewelry || component.engineering).map((component) => ({
        id: component.id,
        name: component.name,
        domain: component.domain,
        jewelry: component.jewelry,
        engineering: component.engineering,
      })), { type: "bim-project", nodes: effectiveBimNodes, documents: architectureDocuments, revisions }],
    });
    download(JSON.stringify(report, null, 2), `${projectTitle.replace(/[^a-z0-9-_]+/gi, "-")}-manufacturing-report.json`, "application/json");
    setStatus(`Manufacturing release report exported · ${designAnalysis.score}/100 · ${designAnalysis.grade}`);
  };

  const exportInterchangeManifest = () => {
    const manifest = createInterchangeManifest({
      project: projectTitle,
      version: "0.40.0",
      units,
      entities: entities.length,
      features: activeFeatures.length,
      exactBodies: exactBodyMetrics.length,
      designScore: designAnalysis.score,
    });
    download(JSON.stringify(manifest, null, 2), `${projectTitle.replace(/[^a-z0-9-_]+/gi, "-")}-handoff-manifest.json`, "application/json");
    setStatus(`Interchange capability manifest exported · independent qualification not evaluated · ${manifest.releaseDecision}`);
  };

  // Static review builds (VITE_FORM_HOSTED_CLOUD=off) have no /api backend, so
  // they stay in local-file mode instead of autosaving to a missing endpoint.
  const hostedCloudAvailable = typeof window !== "undefined"
    && (typeof import.meta.env === "undefined" || (import.meta.env as unknown as Record<string, string | undefined>).VITE_FORM_HOSTED_CLOUD !== "off")
    && window.location.protocol.startsWith("http")
    && !["localhost", "127.0.0.1"].includes(window.location.hostname)
    && !window.location.hostname.endsWith(".localhost");
  const cloud = useCloudSync({ roomId, title: projectTitle, project: projectData, enabled: !sharedProjectPending && hostedCloudAvailable });
  const loadLatest = cloud.loadLatest;
  const [historyOpen, setHistoryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [projectAssets, setProjectAssets] = useState<ProjectAsset[]>([]);
  const [assetBusy, setAssetBusy] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");

  const refreshProjectAssets = useCallback(async () => {
    const assets = await listProjectAssets(roomId);
    setProjectAssets(assets);
    return assets;
  }, [roomId]);

  const addProjectAsset = useCallback(async (file: File) => {
    setAssetBusy(true);
    await cloud.saveNow();
    const result = await uploadProjectAsset(roomId, file);
    if (result.ok) {
      await refreshProjectAssets();
      setStatus(`${result.asset.filename} uploaded to streamed project storage`);
    } else setStatus(result.error);
    setAssetBusy(false);
  }, [cloud, refreshProjectAssets, roomId]);

  const applyProjectContents = useCallback(async (contents: string, path?: string | null, initial = false, recovered = false, historyRestore = false) => {
    try {
      const container = parseProjectIfContainer(contents);
      const hasNoCad = container !== null && !formWorkspace(container, "cad");
      const project = parseCadProject<CadProjectData & { units?: CadUnit }>(hasNoCad
        ? JSON.stringify({ entities: [], features: [], displayUnits: container.common.displayUnits })
        : contents);
      const fabric = container ? formWorkspace<GarmentProject>(container, "fabric") : undefined;
      const garment = fabric ? parseGarment(JSON.stringify(fabric.data)) : undefined;
      const painted = restorePaintTexture(project.paintTexture);
      if (!initial && documentSession.saving) { setStatus("Wait for the current save to finish before opening another project"); return; }
      if (!initial && documentSession.dirty) {
        const checkpoint = documentSession.checkpoint();
        if (!await confirmDocumentAction("open")) { setStatus("Open cancelled · your changes are still here"); return; }
        if (!documentSession.matches(checkpoint)) { setStatus("The document changed during confirmation · open again after saving"); return; }
      }
      if (!historyRestore && !(initial && saveSession)) documentSession.replace(!(initial && initialProjectDirty) && !recovered);
      if (!initial && hasNoCad && formWorkspace(container, "scene") && onOpenRigLab) {
        documentSession.observeProject(container);
        onOpenRigLab({ contents, path: recovered ? null : path ?? null, dirty: documentSession.dirty });
        return true;
      }
      // A newly opened document owns a new undo history. Never allow Undo or
      // sketch Cancel to restore another document under this document's path.
      historyRef.current = (initial && saveSession ? documentSession.getHistory<typeof historyRef.current>("cad") : undefined)
        ?? { entries: [], cursor: -1, skip: false };
      setHistoryControls({ canUndo: historyRef.current.cursor > 0, canRedo: historyRef.current.cursor < historyRef.current.entries.length - 1 });
      setSketchSession(null);
      setCompletedSketchRegion(null);
      setSelectedFeatureId(null);
      projectContainerRef.current = container;
      containerCacheRef.current = null;
      uncreatedCadBaselineRef.current = hasNoCad ? null : undefined;
      sharedHydratingRef.current = false;
      setProjectTitle(container?.name ?? path?.split(/[\\/]/).pop()?.replace(/\.(form|formcad)$/i, "") ?? "Form Project");
      setEmbeddedGarment(garment);
      setEditedMeshFeatures(project.meshFeatures ?? []);
      setSceneNodes(normalizeSceneGraph(project.sceneNodes));
      setAnimation({ ...normalizeAnimation(project.animation), playing: false });
      setGeometryGraph(project.geometryGraph ? normalizeGeometryGraph(project.geometryGraph) : starterGraph());
      setMaterialGraph(project.materialGraph ? normalizeMaterialGraph(project.materialGraph) : starterMaterial());
      setViewport(normalizeViewportState(project.viewport));
      setSelectedMeshId(null);
      clearMeshSelection();
      setRegionRequest(null);
      setTexture(painted?.texture ?? null);
      setPainting(false);
      setSculptUnwrap(painted?.mapping ?? null);
      setEntities(project.entities);
      setFeatures(project.features);
      setLayers(project.layers?.length ? project.layers : layers);
      setGeometricConstraints(project.geometricConstraints ?? []);
      setParameters(project.parameters ?? []);
      setGdt(project.gdt ?? []);
      setComponents(project.components ?? []);
      setAssemblyInstances(project.assemblyInstances ?? []);
      setAssemblyMates(project.assemblyMates ?? []);
      setLinkedGroups(project.linkedGroups ?? []);
      setActiveLinkedGroupId(project.linkedGroups?.[0]?.id ?? null);
      setLinkSpec(structuredClone(project.linkedGroups?.[0]?.spec ?? DEFAULT_LINK_SYSTEM_SPEC));
      setImportedBodies(project.importedBodies ?? []);
      setVolumes(validateProjectVolumes(project.volumes));
      setDrafting(project.drafting ?? createCadDraftingDocument());
      setConfigurations(project.configurations ?? []);
      setActiveConfigurationId(project.activeConfigurationId ?? null);
      setBimNodes(project.bimNodes?.length ? migrateBimObjectGraph(project.bimNodes, project.entities) : []);
      setSelectedBimNodeId(null);
      setSelectedBimDocumentId(null);
      setRecipeGraphs(project.recipeGraphs?.length ? project.recipeGraphs : [structuredClone(STARTER_RECIPE_GRAPH)]);
      setActiveRecipeId(project.recipeGraphs?.[0]?.id ?? STARTER_RECIPE_GRAPH.id);
      setRevisions(project.revisions ?? []);
      setMarketplace(project.marketplace?.length ? project.marketplace : structuredClone(DEFAULT_MARKETPLACE));
      setSketchPlanes(project.sketchPlanes?.length ? project.sketchPlanes : DEFAULT_PLANES);
      setRollbackIndex(project.rollbackIndex ?? project.features.length);
      setUnits(project.displayUnits ?? project.units ?? "mm");
      setMaterial(project.material ?? "Aluminum 6061");
      setDensity(project.density ?? 2.7);
      setDrawingScale(project.drawingScale ?? "1:1");
      setDrawingRevision(project.drawingRevision ?? "A");
      setDrawingBook(project.drawingBook ?? createDrawingBook());
      setAppearance(normalizeCadAppearance(project.appearance));
      setAdoptedRoomId(roomIdForProject(project.roomId));
      setSelectedId(project.entities[0]?.id ?? "");
      setSelectedEntityIds(project.entities[0]?.id ? [project.entities[0].id] : []);
      setProjectPath(path ?? null);
      setRecoveryContents(null);
      setStatus(`${recovered ? "Recovered unsaved snapshot · save to a new file" : "Project opened"} · ${project.entities.length} sketch entities · ${project.features.length} features${fabric ? " · garment workspace preserved" : ""}`);
      return true;
    } catch (error) {
      setStatus(error instanceof Error ? `Project could not be opened · ${error.message}` : "That file is not a valid Form project");
    }
  }, [clearMeshSelection, documentSession, initialProjectDirty, layers, onOpenRigLab, saveSession, setAnimation]);

  useLayoutEffect(() => {
    applyHistoryContentsRef.current = (contents) => applyProjectContents(contents, projectPath, true, false, true);
  }, [applyProjectContents, projectPath]);

  const initialProjectAppliedRef = useRef(false);
  useEffect(() => {
    if (initialProjectAppliedRef.current || !initialProjectContents) return;
    initialProjectAppliedRef.current = true;
    applyProjectContents(initialProjectContents, initialProjectPath, true);
  }, [applyProjectContents, initialProjectContents, initialProjectPath]);

  useEffect(() => {
    if (!sharedProjectPending || sharedJoinAttemptedRef.current) return;
    sharedJoinAttemptedRef.current = true;
    void loadLatest().then(async (latest) => {
      if (latest?.project) {
        if (await applyProjectContents(JSON.stringify(latest.project))) setStatus(`Shared project joined · revision ${latest.revision}`);
      } else {
        setStatus("This shared project is unavailable or you have not been invited");
      }
      setSharedProjectPending(false);
    });
  }, [applyProjectContents, loadLatest, sharedProjectPending]);

  const openProject = async () => {
    try {
      const { invoke, isTauri } = await import("@tauri-apps/api/core");
      if (isTauri()) {
        try {
          const payload = await invoke<{ path: string; contents: string } | null>("open_project_file");
          if (payload) await applyProjectContents(payload.contents, payload.path);
        } catch (error) {
          setStatus(`Open failed · ${String(error)}`);
        }
        return;
      }
    } catch {
      // Web fallback below.
    }
    projectImportRef.current?.click();
  };

  const saveProject = async (saveAs = false) => {
    if (documentSession.saving) return;
    try { documentSession.observeProject(buildProjectContainer()); }
    catch (error) { setStatus(`Save failed · ${String(error)}`); return; }
    const ticket = documentSession.beginSave();
    if (!ticket) return;
    setDocumentSaving(true);
    try {
      const contents = buildProjectJson();
      const { invoke, isTauri } = await import("@tauri-apps/api/core");
      if (isTauri()) {
          const savedPath = projectPath && !saveAs
            ? await invoke<string>("write_project_file", { path: projectPath, contents })
            : await invoke<string | null>("save_project_file", { contents, suggestedName: `${projectTitle}.form` });
          if (savedPath && documentSession.finishSave(ticket, true)) {
            setProjectPath(savedPath);
            // Never delete recovery here: edits may have arrived while Save As
            // was open, and their newer checkpoints must remain recoverable.
            setStatus(`Saved · ${savedPath.split(/[\\/]/).pop()}${documentSession.dirty ? " · newer edits remain unsaved" : ""}`);
          } else if (!savedPath) {
            documentSession.finishSave(ticket, false);
            setStatus("Save cancelled · your changes are still here");
          }
        return;
      }
      download(contents, `${projectTitle}.form`, "application/json");
      documentSession.finishSave(ticket, true);
      setStatus("Project downloaded · browser autosave remains active");
    } catch (error) {
      documentSession.finishSave(ticket, false);
      setStatus(`Save failed · ${String(error)}`);
    } finally {
      setDocumentSaving(false);
      setDocumentDirty(documentSession.dirty);
    }
  };

  useLayoutEffect(() => {
    saveBeforeCloseRef.current = async () => {
      if (documentSession.saving || documentSession.restoringHistory) return false;
      const generation = documentSession.checkpoint().generation;
      await saveProject();
      return generation === documentSession.checkpoint().generation && !documentSession.dirty && !documentSession.saving;
    };
  });

  const recoverProject = () => {
    if (recoveryContents) applyProjectContents(recoveryContents, null, false, true);
  };

  const openProductCenter = (tab: ProductCenterTab) => {
    setProductCenterTab(tab);
    setProductCenterOpen(true);
  };

  const applyStarterTemplate = async (template: StarterTemplate) => {
    if (template.action.kind === "blank") {
      if (documentSession.saving) { setStatus("Wait for the current save to finish before starting a new project"); return; }
      const hasWork = entities.length > 0 || features.length > 0 || importedBodies.length > 0 || meshFeatures.length > 0;
      if (hasWork || documentSession.dirty) {
        const checkpoint = documentSession.checkpoint();
        try {
          if (!await confirmDocumentAction("blank")) return;
          if (!documentSession.matches(checkpoint)) { setStatus("The document changed during confirmation · try again after saving"); return; }
        } catch (error) { setStatus(`New project cancelled · confirmation unavailable: ${String(error)}`); return; }
      }
      setProjectPath(null);
      setProjectTitle("Form Project");
      documentSession.replace(false);
      historyRef.current = { entries: [], cursor: -1, skip: false };
      setHistoryControls({ canUndo: false, canRedo: false });
      setSketchSession(null);
      setCompletedSketchRegion(null);
      setParameters([]);
      setVolumes([]);
      setBimNodes([]);
      setConfigurations([]);
      setActiveConfigurationId(null);
      setDrafting(createCadDraftingDocument());
      setDrawingBook(createDrawingBook());
      setDrawingRevision("A");
      setSketchPlanes(DEFAULT_PLANES);
      setRollbackIndex(0);
      setRevisions([]);
      setRecipeGraphs([structuredClone(STARTER_RECIPE_GRAPH)]);
      setMarketplace(structuredClone(DEFAULT_MARKETPLACE));
      setSelectedFeatureId(null);
      setRecoveryContents(null);
      projectContainerRef.current = null;
      setSceneNodes([]);
      setAnimation(normalizeAnimation(undefined));
      setGeometryGraph(starterGraph());
      setMaterialGraph(starterMaterial());
      setEmbeddedGarment(undefined);
      setTexture(null);
      clearMeshSelection();
      setEntities([]);
      setFeatures([]);
      setGeometricConstraints([]);
      setGdt([]);
      setComponents([]);
      setAssemblyInstances([]);
      setAssemblyMates([]);
      setLinkedGroups([]);
      setImportedBodies([]);
      setEditedMeshFeatures([]);
      setSelectedId("");
      setSelectedEntityIds([]);
      setSelectedMeshId(null);
      setExactMeshes([]);
      setExactTopology([]);
      setKernelAudit(null);
      setValidatedExactSignature(null);
      setKernelStatus("idle");
      setExactBuildState("idle");
      setView("sketch");
      setStatus("Blank precision part ready · draw, import, or open Command Center");
    } else if (template.action.kind === "domain") {
      createDomainObject(template.action.recipe);
      setView("model");
      setStatus(`${template.name} generated · edit its semantic parameters in Properties`);
    } else if (template.action.kind === "hardware") {
      createSmartHardware(template.action.hardware);
      setView("model");
      setStatus(`${template.name} generated · exact geometry, mates and metadata remain editable`);
    } else if (template.action.kind === "command") {
      executeCommand(template.action.command);
    } else {
      setFabricInitialProject(createGarmentTemplate(template.action.garment));
      setFabricOpen(true);
      setStatus(`${template.name} loaded in Fabric Studio`);
    }
    closeProductCenter();
  };

  const executeProductCommand = (commandId: string) => {
    let close = true;
    switch (commandId) {
      case "start-center": openProductCenter("start"); close = false; break;
      case "help-context": openProductCenter("guides"); close = false; break;
      case "shortcut-editor": openProductCenter("shortcuts"); close = false; break;
      case "open-project": void openProject(); break;
      case "save-project": void saveProject(); break;
      case "recover-project": recoverProject(); break;
      case "undo": restoreHistory(-1); break;
      case "redo": restoreHistory(1); break;
      case "view-sketch": setView("sketch"); break;
      case "view-model": setView("model"); break;
      case "view-drawing": setView("drawing"); break;
      case "tool-line": setView("sketch"); setTool("line"); break;
      case "tool-rectangle": setView("sketch"); setTool("rectangle"); break;
      case "tool-circle": setView("sketch"); setTool("circle"); break;
      case "tool-pen": setView("sketch"); setTool("pen"); break;
      case "tool-pencil": setView("sketch"); setTool("pencil"); break;
      case "tool-offset": setView("sketch"); setTool("offset"); break;
      case "import-svg": setView("sketch"); svgImportRef.current?.click(); break;
      case "import-dxf": dxfImportRef.current?.click(); break;
      case "trace-image": setView("sketch"); rasterImportRef.current?.click(); break;
      case "image-to-model": changeSculptBrush(null); setView("model"); setImageModelImport({}); break;
      case "cast-prep": setView("model"); openCast(); break;
      case "make-3d": makeSketch3D(); break;
      case "push-pull": pushPullSelection(); break;
      case "validate-exact": void runKernel(); break;
      case "render-png": exportViewportPng(); break;
      case "export-step": void runKernel("step"); break;
      case "export-dxf": exportDXF(); break;
      case "print-document": printDrawing(); break;
      case "open-fabric": setFabricOpen(true); break;
      case "drape-sketch": {
        const silhouettes = silhouettesFromCadEntities(entities);
        if (silhouettes.length === 0) setStatus("Draw or import a closed outline first · Command Center can open SVG, DXF and trace tools");
        else {
          const inferred = inferGarmentFromSilhouettes(silhouettes, { simplifyEpsilon: 6, seamType: "plain" });
          setFabricInitialProject(inferred);
          setFabricOpen(true);
        }
        break;
      }
      case "guide-sketch": setView("sketch"); setProductCenterTab("guides"); close = false; break;
      case "guide-model": setView("model"); setProductCenterTab("guides"); close = false; break;
      case "guide-drawing": setView("drawing"); setProductCenterTab("guides"); close = false; break;
      case "guide-fabric": setFabricOpen(true); break;
      default: setStatus(`Command unavailable · ${commandId}`); break;
    }
    if (close) closeProductCenter();
  };

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (productCenterOpen || event.defaultPrevented) return;
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault(); void saveProject(true); return;
      }
      const target = event.target as HTMLElement | null;
      const editing = target?.matches?.("input, textarea, select, [contenteditable=true]") ?? false;
      if (view === "sketch" && !fabricOpen && !editing) {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") { event.preventDefault(); selectAllSketchObjects(); return; }
        if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); deleteSketchSelection(); return; }
      }
      const action = (Object.keys(shortcuts) as Array<keyof ShortcutMap>).find((id) => shortcutMatches(shortcuts[id], event));
      if (!action || (editing && action !== "save-project" && action !== "open-project" && action !== "command-center")) return;
      event.preventDefault();
      if (action === "command-center") openProductCenter("commands");
      else if (action === "start-center") openProductCenter("start");
      else if (action === "open-project") void openProject();
      else if (action === "save-project") void saveProject();
      else if (action === "open-fabric") setFabricOpen(true);
      else if (action === "undo") restoreHistory(-1);
      else if (action === "redo") restoreHistory(1);
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  });

  useEffect(() => {
    type FormCadWindow = Window & {
      formCAD?: {
        version: string;
        getProject: () => CadProjectData;
        getProjectFile: () => string;
        getProjectPath: () => string | null;
        getDesignAnalysis: () => typeof designAnalysis;
        stageCommand: (command: string) => void;
        generateHardware: (kind: HardwareKind, parameters?: Partial<HardwareParameters>, mode?: HardwareMode) => string;
        generateDomainObject: (kind: DomainRecipeKind, parameters?: Partial<DomainParameters>) => string;
        generateJewelry: (spec?: Partial<JewelrySpec>) => string;
        generateEngineering: (spec?: Partial<EngineeringProSpec>) => string;
        getBimGraph: () => BimNode[];
        evaluateRecipe: (graph?: RecipeGraph) => ReturnType<typeof evaluateRecipeGraph>;
        select: (entityId: string) => boolean;
      };
    };
    const target = window as FormCadWindow;
    target.formCAD = {
      version: "0.40.0",
      getProject: () => structuredClone(projectData),
      getProjectFile: () => buildProjectJson(),
      getProjectPath: () => projectPath,
      getDesignAnalysis: () => structuredClone(designAnalysis),
      stageCommand: (nextCommand) => { setCommand(nextCommand); setStatus("Automation command staged · press Run to preview or apply"); },
      generateHardware: (kind, parameters, mode) => createSmartHardware(kind, parameters, mode),
      generateDomainObject: (kind, parameters) => createDomainObject(kind, parameters),
      generateJewelry: (spec) => createJewelryPiece(spec),
      generateEngineering: (spec) => createEngineeringProPart(spec),
      getBimGraph: () => structuredClone(effectiveBimNodes),
      evaluateRecipe: (graph = activeRecipe) => evaluateRecipeGraph(graph, cursor, `automation-recipe`),
      select: (entityId) => {
        const exists = entities.some((entity) => entity.id === entityId) || importedBodies.some((body) => body.id === entityId);
        if (exists) setSelectedId(entityId);
        return exists;
      },
    };
    return () => { delete target.formCAD; };
  }, [activeRecipe, buildProjectJson, createDomainObject, createEngineeringProPart, createJewelryPiece, createSmartHardware, cursor, designAnalysis, effectiveBimNodes, entities, importedBodies, projectData, projectPath]);

  const smartActionContext = useMemo<SmartActionContext>(() => {
    const meshCount = selectionCount(meshSelection);
    const topologyKind = selectedTopologyIds.some((topologyId) => topologyId.includes(":edge:"))
      ? "exact-edge"
      : selectedTopologyIds.some((topologyId) => topologyId.includes(":face:")) ? "exact-face" : null;
    const closedProfile = Boolean(completedSketchRegion || (selected && (selected.type !== "line" || wireSourceMap.has(selected.id))));
    const selection = selectedMeshId
      ? meshCount > 0 ? `mesh-${meshSelection.mode}` as const : "mesh-body" as const
      : topologyKind
        ? topologyKind
        : selectedEntityIds.length > 1
          ? "exact-multi-body" as const
          : view === "model" && (Boolean(selected) || importedBodies.some((body) => body.id === selectedId))
            ? "exact-body" as const
            : view === "sketch" && selected
              ? closedProfile ? "sketch-profile" as const : "sketch-segment" as const
              : "none" as const;
    return {
      view,
      selection,
      selectionCount: selectedMeshId ? Math.max(meshCount, 1) : Math.max(selectedEntityIds.length, selectedTopologyIds.length),
      hasGeometry: entities.length > 0 || importedBodies.length > 0 || meshFeatures.length > 0,
      hasClosedProfile: closedProfile,
      hasExactBody: Boolean(selectedExactMesh || importedBodies.some((body) => body.id === selectedId)),
      hasCreativeBody: Boolean(selectedMeshId),
      canMakeCreativeCopy: Boolean(selectedExactMesh),
    };
  }, [completedSketchRegion, entities.length, importedBodies, meshFeatures.length, meshSelection, selected, selectedEntityIds.length, selectedExactMesh, selectedId, selectedMeshId, selectedTopologyIds, view, wireSourceMap]);
  const smartActions = useMemo(() => recommendSmartActions(smartActionContext), [smartActionContext]);
  const recommendedSmartActions = smartActions.filter((action) => action.available).slice(0, 5);
  const unavailableSmartActions = smartActions.filter((action) => !action.available).slice(0, 4);

  const addLinkedDocument = (source: SheetSource, title: string, garment?: GarmentProject) => {
    try {
      const existing = drawingBook.sheets.find((s) => s.source?.kind === source.kind && s.source.id === source.id && s.source.itemId === source.itemId);
      if (!existing && drawingBook.sheets.length >= 100) throw new Error("Drawing book limit reached (100 sheets)");
      let input = garment ? { ...linkedSheetInputs, garment } : linkedSheetInputs;
      if (source.kind === "mesh" && !input.meshes.some((m) => m.id === source.id)) {
        const feature = meshFeatures.find((m) => m.id === source.id);
        if (!feature) throw new Error("Linked mesh is missing");
        const surface = rebuildMeshFeature(feature).surface, matrix = worldMatrix(sceneNodes, feature.id);
        input = { ...input, meshes: [...input.meshes, { id: feature.id, name: feature.name, mesh: { ...surface, positions: surface.positions.map((p) => transformPoint(matrix, p)) } }] };
      }
      const content = linkedSheetContent(source, input);
      const sheet = existing ?? createLinkedSheet(source, title, content);
      if (garment) setEmbeddedGarment(garment);
      if (!existing) setDrawingBook((book) => ({ ...book, sheets: [...book.sheets, sheet] }));
      setSelectedBimDocumentId(sheet.id); setSelectedSheetView(sheetSourceViews(sheet)[0]);
      setDocumentPanel("sheet"); setSketchSession(null); setView("drawing");
      setFabricOpen(false); setFabricInitialProject(undefined);
      setStatus(`${title} linked to Document · changes to the source update this sheet · save the Form project to preserve the link`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to link source"); }
  };
  if (fabricOpen) return <Suspense fallback={<div className="cad-workspace-loading"><b>FORM FABRIC</b><span>Loading the garment workspace…</span></div>}><FabricStudio onClose={() => { setFabricOpen(false); setFabricInitialProject(undefined); }} initialProject={fabricInitialProject ?? embeddedGarment} onProjectChange={setEmbeddedGarment}
    animationLink={project => garmentAnimationLink(projectContainerRef.current ?? createFormProject(), `garment:${project.id}`, garmentSourceRevision(project))}
    reviewAnimation={sourceId => reviewLinkedAnimation(projectContainerRef.current ?? createFormProject(), sourceId)}
    documentImpact={(project, changedIds) => linkedDocumentImpact(drawingBook, "fabric", project.id, changedIds)} onAnimate={onOpenRigLab ? async (project, character) => {
    if (documentSession.saving) throw new Error("Wait for the current project save to finish");
    if (character.updateExisting) {
      const { updateGarmentInProject } = await import("./garment-update");
      const { parseProject } = await import("./project-format");
      updateGarmentInProject(parseProject(buildProjectJson(project)), character); // Fail in Fabric before switching workspaces.
    }
    const models = character.updateExisting ? [character] : [character, ...collectAnimationModels(true)];
    onOpenRigLab({ contents: buildProjectJson(project), path: projectPath, dirty: true, models });
  } : undefined} onDocument={(project, pieceId) => addLinkedDocument({ kind: "fabric", id: project.id, ...(pieceId ? { itemId: pieceId } : {}) }, pieceId ? project.pieces.find((p) => p.id === pieceId)?.name ?? project.name : `${project.name} patterns`, project)} /></Suspense>;

  const sketchToolNames: Record<Tool, string> = {
    select: "Select",
    pen: "Pen",
    pencil: "Pencil",
    line: "Line",
    rectangle: "Rectangle",
    circle: "Circle",
    polygon: "Polygon",
    offset: "Offset",
    measure: "Measure",
  };
  const toolShelfTitle = view === "sketch" ? `${sketchToolNames[tool]} tool`
    : view === "drawing" ? "Document output"
    : modelToolCategory === "sculpt" ? "Sculpt toolbox"
    : modelToolCategory === "paint" ? "Paint toolbox"
    : selectedMeshId ? `${meshSelection.mode[0].toUpperCase()}${meshSelection.mode.slice(1)} selection`
    : `${modelToolCategory[0].toUpperCase()}${modelToolCategory.slice(1)} tools`;
  const toolShelfDetail = view === "sketch"
    ? tool === "pen" || tool === "pencil" ? "Draw, vectorize, and turn closed strokes into exact solids"
      : tool === "select" ? "Selection, snapping, and viewport controls"
      : tool === "measure" ? "Inspect geometry with exact units and snapping"
      : tool === "offset" ? "Click a closed profile to create an editable parallel outline"
      : `Create a constrained ${sketchToolNames[tool].toLowerCase()} on ${activePlane.name}`
    : view === "drawing" ? "Fabrication-ready exports from the current model"
    : modelToolCategory === "sculpt" ? "Shape, refine and smooth · replayable brush strokes"
    : modelToolCategory === "paint" ? "Brush color directly onto a mesh surface"
    : selectedMeshId ? `${describeSelection(meshSelection)} · editable cage operations`
    : modelToolCategory === "create" ? "Add clean exact primitives with editable dimensions"
      : modelToolCategory === "sketch" ? "Select a face or plane, draw precisely, then finish into a solid operation"
      : modelToolCategory === "modify" ? "Only operations valid for the current selection"
      : modelToolCategory === "measure" ? "Inspect distances, radii, angles, and exact body metrics"
      : "Select a body, face, edge, vertex, sketch, segment, or region";
  const toolShelfSize = view === "model" ? "wide"
    : view === "sketch" && (tool === "pen" || tool === "pencil") ? "medium"
    : "compact";
  const closeToolShelf = () => {
    const next = { open: false, pinned: false };
    toolShelfRef.current = next;
    setToolShelf(next);
  };
  const pinToolShelf = () => {
    const next = { open: true, pinned: true };
    toolShelfRef.current = next;
    setToolShelf(next);
  };
  const openSculptToolbox = () => {
    setPainting(false);
    setModelToolCategory("sculpt");
    setPickMode("entity");
    if (selectedMeshId) changeSculptBrush(sculptSettings);
    pinToolShelf();
  };
  const openPaintToolbox = () => {
    changeSculptBrush(null);
    setSelectionBrushEnabled(false);
    setRegionRequest(null);
    setModelToolCategory("paint");
    pinToolShelf();
    setStatus("Paint · select a mesh, then start painting");
  };
  const toggleToolShelfPin = () => {
    const next = { open: true, pinned: !toolShelf.pinned };
    toolShelfRef.current = next;
    setToolShelf(next);
  };
  const drapeSketchAsGarment = () => {
    const silhouettes = silhouettesFromCadEntities(entities);
    if (silhouettes.length === 0) {
      setStatus("Draw a closed rectangle, circle, or connected polyline to drape");
      return;
    }
    const inferred = inferGarmentFromSilhouettes(silhouettes, { simplifyEpsilon: 6, seamType: "plain" });
    setFabricInitialProject(inferred);
    setFabricOpen(true);
    setStatus(`Draping ${inferred.pieces.length} piece(s) · ${inferred.seams.length} seam(s) inferred`);
  };
  const executeSmartAction = (actionId: SmartActionId) => {
    switch (actionId) {
      case "create.box": createExactPrimitive("box"); return;
      case "sketch.start": beginWorldSketch(); return;
      case "sketch.make-3d": makeSketch3D(); return;
      case "sketch.offset": if (selected) offsetSketchProfile(selected.id); else setStatus("Select a closed profile to offset"); return;
      case "sketch.fix": setSelectedGeometryFixed(true); return;
      case "sketch.drape": drapeSketchAsGarment(); return;
      case "exact.push-pull":
        setModelToolCategory("modify"); setPickMode("edit-face"); closeToolShelf();
        setStatus(selectedTopologyIds.some((topologyId) => topologyId.includes(":face:")) ? "Push / Pull ready · drag the handle or type a distance" : "Push / Pull · select an exact face");
        return;
      case "exact.sketch-face": setModelToolCategory("sketch"); setPickMode("face"); setStatus("Click the exact face to begin an oriented sketch"); return;
      case "exact.fillet": addFeature("Fillet", Math.abs(toolShelfAmount)); return;
      case "exact.chamfer": addFeature("Chamfer", Math.abs(toolShelfAmount)); return;
      case "exact.shell": addFeature("Shell", Math.abs(toolShelfAmount)); return;
      case "exact.union": addFeature("Fuse", 0); return;
      case "exact.subtract": addFeature("Cut", 0); return;
      case "exact.creative-copy": makeCreativeCopy(); return;
      case "measure.inspect": setModelToolCategory("measure"); setTool("measure"); pinToolShelf(); setStatus("Exact inspection ready · dimensions, topology and validation are visible"); return;
      case "mesh.select-faces": changeSelectionMode("face"); pinToolShelf(); return;
      case "mesh.extrude": applySculptEdit("extrude", toolShelfAmount); return;
      case "mesh.inset": applySculptEdit("inset", Math.abs(toolShelfAmount)); return;
      case "mesh.edge-loop": runSelectionCommand("loop"); return;
      case "mesh.bevel": applySculptTopology("bevel", Math.abs(toolShelfAmount)); return;
      case "mesh.bend": addSculptModifier("bend"); return;
      case "mesh.twist": addSculptModifier("twist"); return;
      case "mesh.taper": addSculptModifier("taper"); return;
      case "mesh.bulge": addSculptModifier("bulge"); return;
      case "mesh.displace": addSculptModifier("displace"); return;
    }
  };
  const closeProjectMenu = () => projectMenuRef.current?.removeAttribute("open");
  const openRigWorkspace = () => {
    if (documentSession.saving) { setStatus("Wait for the current save to finish before switching workspaces"); return; }
    onOpenRigLab?.({ contents: buildProjectJson(), path: projectPath, dirty: documentSession.dirty });
  };
  function collectAnimationModels(all = false) {
      if ((all || !selectedMeshId) && (exactBuildState === "building" || exactBuildState === "error")) throw new Error("Finish the exact rebuild before sending the Model scene to Animation");
      const hasSelection = !all && Boolean(selectedMeshId || selectedId || selectedEntityIds.length);
      const models: AnimationModelSnapshot[] = [];
      for (const body of meshBodies) {
        if (!body.visible || (hasSelection && body.id !== selectedMeshId)) continue;
        models.push(animationModelSnapshot(body.id, body.name, { ...body.surface, positions: body.surface.positions.map((p) => transformPoint(body.worldMatrix, p)) }));
      }
      for (const mesh of exactMeshes) {
        if (creativeSourceIds.has(mesh.sourceId) || (hasSelection && mesh.sourceId !== selectedId && !selectedEntityIds.includes(mesh.sourceId))) continue;
        const positions: [number, number, number][] = [];
        const faces: number[][] = [];
        for (let i = 0; i < mesh.positions.length; i += 3) positions.push([mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]]);
        for (let i = 0; i < mesh.indices.length; i += 3) faces.push([mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]]);
        const entity = entities.find((e) => e.id === mesh.sourceId);
        if (entity && layers.find((layer) => layer.id === entity.layer)?.visible === false) continue;
        const name = importedBodies.find((b) => b.id === mesh.sourceId)?.name ?? `${entity?.type ?? "Model"} · ${mesh.sourceId}`;
        models.push(animationModelSnapshot(mesh.sourceId, name, { positions, faces }));
      }
      return models;
  }
  const animateModel = () => {
    if (documentSession.saving) { setStatus("Wait for the current save to finish"); return; }
    try {
      const models = collectAnimationModels();
      if (!models.length) { setStatus("Select a finished 3D body, or clear selection to animate the scene. Sketches must first become 3D."); return; }
      setAnimationReview(models.map(model => { const review = reviewLinkedAnimation(projectContainerRef.current ?? createFormProject(), model.sourceId); return { ...model, expectedTargetRevision: review.revision, review }; }));
      setAnimationReviewMode("linked");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Animation handoff failed"); }
  };
  const openDraftingTools = (message: string, panel: DocumentPanel = "annotations") => {
    setDocumentPanel(panel);
    setInspectorCollapsed(false);
    setStatus(message);
    window.setTimeout(() => document.getElementById("inspector-drafting")?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 0);
  };

  const documentSheets: DocumentSheet[] = [
    ...documentLayouts.map((layout) => ({ id: layout.id, title: layout.title, detail: `${layout.paper} · ${layout.orientation} · ${effectiveSheetScale(layout, drawingScale)} · Rev ${drawingRevision}${layout.source ? isBimSheet(layout) ? " · BIM coordination" : ` · Linked ${layout.source.kind}` : ""}`, svg: layout.source ? sourceDrawingSheets.get(layout.id)?.svg ?? null : productionDrawingSheets[drawingBook.sheets.indexOf(layout)]?.svg ?? null })),
  ];
  const activeDocumentSheet = documentSheets.find((sheet) => sheet.id === selectedBimDocumentId) ?? documentSheets[0];
  const activeDocumentIsProduction = !activeSheetLayout.source;
  const activeSheetErrors = activeDocumentIsProduction ? productionDrawingSheet?.validation.errors ?? [] : sourceDrawingSheets.get(activeSheetLayout.id)?.errors ?? [];
  const editorView = sheetSourceViews(activeSheetLayout).includes(selectedSheetView) ? selectedSheetView : sheetSourceViews(activeSheetLayout)[0];
  const selectionValue = documentSelection.value;
  const sheetSelection = documentSelection.sheet === activeSheetLayout.id && (selectionValue?.kind !== "annotation" || activeSheetLayout.annotations.some((a) => a.id === selectionValue.id)) ? selectionValue : null;
  const selectedDocumentEdges = documentEdges.sheet === activeSheetLayout.id && documentEdges.view === editorView ? documentEdges.ids : [];
  const selectDocumentItem = (value: DocumentSelection) => {
    setDocumentSelection({ sheet: activeSheetLayout.id, value });
    if (value?.kind === "view") setSelectedSheetView(value.view);
    if (value?.kind === "annotation") { const annotation = activeSheetLayout.annotations.find((a) => a.id === value.id); if (annotation) setSelectedSheetView(annotation.view); }
  };
  const updateSheetLayout = (next: SheetLayout) => {
    if (!drawingBook.sheets.some((s) => s.id === next.id) && drawingBook.sheets.length >= 100) { setStatus("Drawing book limit reached (100 authored sheets)"); return; }
    setDrawingBook((book) => ({ ...book, sheets: book.sheets.some((s) => s.id === next.id) ? book.sheets.map((sheet) => sheet.id === next.id ? next : sheet) : [...book.sheets, next] }));
  };
  const placeOnSheet = (x: number, y: number) => {
    if (sheetPlacement === "select" || sheetPlacement === "pan" || sheetPlacement === "edge" || sheetPlacement === "move") return;
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 10000 || Math.abs(y) > 10000) return;
    const pos = activeSheetLayout.views[editorView];
    if (!pos.visible) { setStatus(`Show ${editorView} before placing it or its annotations`); return; }
    if (sheetPlacement !== "note" && !sheetDimensionDirection(sheetPlacement, editorView)) { setStatus(`Choose a compatible orthographic view for this dimension`); return; }
    {
      if (activeSheetLayout.annotations.length >= 1000) { setStatus("Sheet annotation limit reached (1,000)"); return; }
      const annotationId = `annotation-${id()}`;
      updateSheetLayout({ ...activeSheetLayout, annotations: [...activeSheetLayout.annotations, { id: annotationId, view: editorView, x: x - pos.x, y: y - pos.y, kind: sheetPlacement, text: sheetPlacement === "note" ? "New note" : "" }] });
      selectDocumentItem({ kind: "annotation", id: annotationId }); setSheetPlacement("select");
      setDocumentPanel("annotations");
    }
  };
  const sheetEditor = (panel: "sheet" | "annotations") => <CadSheetEditor sheet={activeSheetLayout} panel={panel} onChange={updateSheetLayout}
    selectedView={editorView} onView={(view) => selectDocumentItem({ kind: "view", view })} placement={sheetPlacement} onPlacement={setSheetPlacement}
    selectedAnnotationId={sheetSelection?.kind === "annotation" ? sheetSelection.id : null} onSelectAnnotation={(id) => selectDocumentItem(id ? { kind: "annotation", id } : null)}
    selectedEdgeIds={selectedDocumentEdges} onEdges={(ids) => setDocumentEdges({ sheet: activeSheetLayout.id, view: editorView, ids })}
    errors={activeSheetErrors} scale={activeDrawingScale} geometry={activeDocumentIsProduction ? exactSheetGeometry : sourceDrawingSheets.get(activeSheetLayout.id)?.geometry}
    onDuplicate={() => { if (drawingBook.sheets.length >= 100) { setStatus("Drawing book limit reached (100 sheets)"); return; } const next = { ...structuredClone(activeSheetLayout), id: `sheet-${id()}`, title: `${activeSheetLayout.title} copy`.slice(0, 100) }; setDrawingBook((book) => ({ ...book, sheets: [...book.sheets, next] })); setSelectedBimDocumentId(next.id); }}
    onRemove={() => { if (activeSheetLayout.id === "production") return; setDrawingBook((book) => ({ ...book, sheets: book.sheets.filter((sheet) => sheet.id !== activeSheetLayout.id) })); setSelectedBimDocumentId(null); }}
    onSaveTemplate={() => void saveDocumentExport(JSON.stringify({ schema: "form-drawing-book-v1", sheets: [{ ...activeSheetLayout, id: "production", source: undefined, annotations: [] }] }, null, 2), "form-sheet-template.json", "json")}
  />;
  const exportActiveDocumentSheet = () => {
    if (activeDocumentIsProduction) return exportProductionDrawing();
    if (!activeDocumentSheet.svg) return;
    void saveDocumentExport(activeDocumentSheet.svg, `${activeDocumentSheet.title.replace(/[^a-z0-9-]/gi, "-")}.svg`, "svg");
  };
  const exportActiveSheetDxf = () => {
    if (!activeDocumentSheet.svg || (activeDocumentIsProduction && drawingOutputBlocked)) return setStatus("Rebuild or restore the drawing before exporting");
    try {
      void saveDocumentExport(exportSheetDxf(activeDocumentSheet.svg), `${activeDocumentSheet.title.replace(/[^a-z0-9-]/gi, "-")}-sheet.dxf`, "dxf");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Sheet DXF export failed"); }
  };

  return <section
    className={`cad-shell cad-view-${view} ${workspaceLayoutClasses(visibleLayout)}`}
    data-ui-density={workspaceUi.layout.density}
    style={{ ...workspaceLayoutStyle(view === "drawing" ? { ...visibleLayout, inspectorSize: documentUi.layout.inspectorSize } : visibleLayout, "cad"), ...compactViewport }}
  >
    {objectMenu && (objectMenu.target === selectedMeshId || sketchTargets.includes(objectMenu.target) || objectMenu.target === selectedId) && <ObjectContextMenu anchor={objectMenu} title={selectedMeshId ? `${selectedMesh?.feature.name ?? "Mesh"}` : view === "sketch" ? `${selected?.type ?? "Sketch"} selection` : "Solid selection"} onClose={() => setObjectMenu(null)} actions={[
      { id: "properties", label: "Edit properties", run: () => setInspectorCollapsed(false) },
      ...recommendedSmartActions.filter((action) => action.id !== "sketch.drape").map((action) => ({ id: action.id, label: action.label, disabled: sketchSelectionLocked, run: () => executeSmartAction(action.id) })),
      ...(view === "sketch" ? [
        { id: "fit", label: "Frame selection", run: () => fitSketch() },
        { id: "duplicate", label: "Duplicate", disabled: sketchSelectionLocked, run: duplicateSketchSelection },
        { id: "mirror", label: "Mirror horizontally", disabled: sketchSelectionLocked, run: () => transformSketchSelection({ mirror: "x" }) },
        { id: "delete", label: "Delete selection", danger: true, disabled: sketchSelectionLocked, run: deleteSketchSelection },
      ] : selectedMeshId ? [{ id: "sculpt", label: "Sculpt mesh", run: openSculptToolbox }, { id: "delete", label: "Delete mesh", danger: true, run: () => removeSculpt(selectedMeshId) }] : []),
    ]} />}
    {animationReview && <div className="cad-animation-review" role="region" aria-label="Review Model to Animation" onKeyDown={event => { if (event.key === "Escape") setAnimationReview(null); }}>
      <h2>Model → Animation</h2><p>Review {animationReview.length} visible {animationReview.length === 1 ? "body" : "bodies"}. Model originals remain editable.</p>
      <label>Transfer mode<select autoFocus aria-label="Model Animation transfer mode" value={animationReviewMode} onChange={event => setAnimationReviewMode(event.target.value as typeof animationReviewMode)}><option value="linked">Create linked snapshots</option><option value="independent">Create independent copies</option><option value="update">Update existing linked models</option></select></label>
      <ul>{animationReview.map(model => { const review = model.review; const sheets = linkedDocumentImpact(drawingBook, "mesh", model.sourceId); return <li key={model.sourceId}><strong>{model.name}</strong>{animationReviewMode === "update" && <p>{review.blocked ?? `${review.keyframes} keys and transforms preserved; old cloth bake cleared.`}</p>}{sheets.map(sheet => <p key={sheet.id}>{sheet.title}: live geometry; {sheet.annotations} annotations and sheet layout preserved.</p>)}</li>; })}</ul>
      <p>{animationReviewMode === "update" ? "Only embedded geometry is replaced. Independently edited or locked targets are protected. Undo is available in Animation." : "Linked copies can be refreshed later. Independent copies are excluded from source updates."}</p>
      <button onClick={async () => { try {
        if (documentSession.saving) throw new Error("Wait for the current save to finish");
        const current = collectAnimationModels();
        if (current.length !== animationReview.length || current.some((model, index) => model.sourceId !== animationReview[index].sourceId || model.sourceRevision !== animationReview[index].sourceRevision)) throw new Error("Source or selection changed. Cancel and review again.");
        const contents = buildProjectJson();
        const models = animationReview.map(model => ({ ...model, independent: animationReviewMode === "independent", updateExisting: animationReviewMode === "update" }));
        if (animationReviewMode === "update") { const { updateLinkedModelInProject } = await import("./garment-update"); const { parseProject } = await import("./project-format"); models.reduce(updateLinkedModelInProject, parseProject(contents)); }
        onOpenRigLab?.({ contents, path: projectPath, dirty: true, models }); setAnimationReview(null);
      } catch(error) { setStatus(error instanceof Error ? error.message : "Transfer failed"); } }}>Confirm model transfer</button><button onClick={() => setAnimationReview(null)}>Cancel transfer</button>
    </div>}
    <header className="cad-topbar">
      <div className="cad-brand"><button onClick={onClose ?? (() => openProductCenter("start"))} aria-label="Back" title={onClose ? "Back" : "Start center"}><UiIcon name="back" /></button><FormLogo /><strong>FORM STUDIO</strong><em title={documentSaving ? "Saving project" : documentDirty ? "Unsaved project changes" : "Project saved"}>{projectPath?.split(/[\\/]/).pop() ?? "UNTITLED.FORM"}{documentSaving ? " …" : documentDirty ? " •" : ""}</em></div>
      <nav className="cad-view-switch" aria-label="Workspaces">
        <button aria-label="2 Model" className={view === "model" ? "active" : ""} onClick={() => sketchSession ? finishEmbeddedSketch() : setView("model")}>Model</button>
        <button aria-label="1 Sketch" className={view === "sketch" ? "active" : ""} onClick={() => view === "sketch" ? undefined : beginWorldSketch()}>{sketchSession ? "Sketching" : "Sketch"}</button>
        <button aria-label="3 Document" className={`cad-specialist-tab${view === "drawing" ? " active" : ""}`} onClick={() => { setSketchSession(null); setView("drawing"); setSelectedBimDocumentId(null); }}>Document</button>
        <button className="cad-workspace-jump" onClick={() => setFabricOpen(true)}>Fabric</button>
        {onOpenRigLab && <><button className="cad-workspace-jump" onClick={openRigWorkspace}>Animation</button>{view === "model" && <button className="cad-workspace-jump" title="Copy selected bodies, or the visible scene when nothing is selected, to Animation. CAD originals stay editable." onClick={animateModel}>Animate model</button>}</>}
      </nav>
      <div className="cad-actions"><div className="cad-history"><button disabled={saveSession ? !documentSession.canUndo : !historyControls.canUndo} onClick={() => restoreHistory(-1)} title="Undo"><UiIcon name="undo" /></button><button disabled={saveSession ? !documentSession.canRedo : !historyControls.canRedo} onClick={() => restoreHistory(1)} title="Redo"><UiIcon name="redo" /></button></div><WorkspaceUiControls
        density={workspaceUi.layout.density}
        onPreset={(preset) => { workspaceUi.applyPreset(preset); if (view === "drawing") documentUi.applyPreset(preset); }} onReset={() => { workspaceUi.reset(); if (view === "drawing") documentUi.reset(); }} onFocus={workspaceUi.toggleFocus} focused={workspaceUi.focused}
        onDensity={workspaceUi.cycleDensity}
        toolsCollapsed={workspaceUi.layout.toolsCollapsed}
        onTools={() => workspaceUi.update("toolsCollapsed", !workspaceUi.layout.toolsCollapsed)}
        inspectorCollapsed={inspectorCollapsed}
        onInspector={() => setInspectorCollapsed(!inspectorCollapsed)}
        timelineCollapsed={workspaceUi.layout.timelineCollapsed}
        onTimeline={() => workspaceUi.update("timelineCollapsed", !workspaceUi.layout.timelineCollapsed)}
        showTimeline={view === "model"}
      /><button className="cad-icon-action" onClick={() => openProductCenter("commands")} title={`${shortcuts["command-center"]} · search every command and guide`} aria-label="Search commands"><UiIcon name="search" /></button>{hostedCloudAvailable && <button className="cad-share-action" title="Invite collaborators and manage access" onClick={() => { setShareOpen((open) => !open); setAssetsOpen(false); setHistoryOpen(false); void cloud.refreshMembers(); }}><UiIcon name="share" /> Share</button>}<button className="accent cad-save-action" onClick={() => void saveProject()}><UiIcon name="save" /> Save</button>{hostedCloudAvailable ? <span className={`cad-sync cad-sync-${cloud.state.phase}`} title={`Room ${cloud.roomId}`}><i />{describeSync(cloud.state)}</span> : <span className="cad-sync cad-sync-local" title="Standalone projects use local .FORM files and native recovery checkpoints"><i />LOCAL</span>}
        <button className="cad-icon-action" title="Shared model properties (alpha)" aria-label="Start shared editing" disabled={view !== "model"} onClick={() => {
          try {
            reviewSession.current?.();
            reviewSession.current = openCollaboration({
              product: "Form Studio", title: projectTitle,
              isCurrent: () => reviewDocument.current === `${roomId}:model`,
              read: () => formSharedFields(sharedFeatures.current),
              apply: values => {
                const next = applyFormSharedFields(sharedFeatures.current, values);
                sharedFeatures.current = next;
                setFeatures(next);
                setStatus("Shared model properties updated");
              },
              capture: async () => {
                const image = await viewportHandleRef.current?.captureImage();
                if (!image) throw new Error("Open Model view before publishing a preview.");
                return previewImage(image);
              },
            });
          } catch (error) { setStatus(error instanceof Error ? error.message : "Could not open live review."); }
        }}><UiIcon name="share" /></button>
        <button className="cad-phone-inspector-toggle" aria-label={inspectorCollapsed ? "Show properties" : "Hide properties"} title={inspectorCollapsed ? "Show properties" : "Hide properties"} aria-expanded={!inspectorCollapsed} aria-controls="cad-properties" onClick={() => setInspectorCollapsed(!inspectorCollapsed)}><UiIcon name="inspector" /></button>
        {suiteMenu && <tcc-suite-menu />}
        <details ref={projectMenuRef} className="cad-project-menu" onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          closeProjectMenu();
          projectMenuRef.current?.querySelector<HTMLElement>("summary")?.focus();
        }}>
          <summary aria-label="Project and workspace actions" title="Project and workspace actions"><UiIcon name="menu" /></summary>
          <div role="menu" aria-label="Project and workspace actions" onClick={(event) => {
            if ((event.target as HTMLElement).closest("button")) closeProjectMenu();
          }}>
            <section><strong>CREATE</strong><button role="menuitem" onClick={() => openProductCenter("start")}>Start center</button><button role="menuitem" onClick={() => openProductCenter("commands")}>Search commands</button><button role="menuitem" onClick={drapeSketchAsGarment}>Drape as garment</button></section>
            <section><strong>SPECIALIST WORKSPACES</strong><button role="menuitem" onClick={() => { setInspectorMode("specialist"); setInspectorCollapsed(false); setStatus("Specialist systems visible in Properties"); }}>Show specialist tools</button><button role="menuitem" onClick={() => { setSketchSession(null); setView("drawing"); setSelectedBimDocumentId(null); }}>Open Document Studio</button>{onOpenRigLab && <button role="menuitem" onClick={openRigWorkspace}>Open Animation Studio</button>}<button role="menuitem" onClick={() => setFabricOpen(true)}>Open Fabric Studio</button><button role="menuitem" onClick={() => { setView("model"); openCast(); }}>Open Cast · print & cast prep (alpha)</button></section>
            <section><strong>PROJECT</strong><button role="menuitem" disabled={documentSaving} onClick={() => void openProject()}>Open project…</button>{recoveryContents && <button role="menuitem" onClick={recoverProject}>Recover autosave</button>}<button role="menuitem" disabled={documentSaving} onClick={() => void saveProject()}>Save project</button><button role="menuitem" disabled={documentSaving} onClick={() => void saveProject(true)}>Save project as…</button>{desktopUpdaterEnabled() && <button role="menuitem" onClick={() => void checkForDesktopUpdate()} disabled={desktopUpdate.phase === "checking" || desktopUpdate.phase === "installing"}>Check for updates</button>}</section>
            <section><strong>INTERCHANGE</strong><button role="menuitem" onClick={() => { setView("model"); setBlenderOpen(true); }}>Export for Blender…</button><button role="menuitem" onClick={() => dxfImportRef.current?.click()}>Import DXF…</button><button role="menuitem" onClick={exportDXF}>Export DXF</button><button role="menuitem" onClick={() => void runKernel("step")}>Export STEP</button></section>
            {hostedCloudAvailable && <section><strong>COLLABORATION</strong><button role="menuitem" onClick={() => { setAssetsOpen((open) => !open); setShareOpen(false); setHistoryOpen(false); void refreshProjectAssets(); }}>Project assets</button><button role="menuitem" onClick={() => { setShareOpen((open) => !open); setAssetsOpen(false); setHistoryOpen(false); void cloud.refreshMembers(); }}>Share project</button><button role="menuitem" onClick={() => { setHistoryOpen((open) => !open); setAssetsOpen(false); setShareOpen(false); void cloud.refreshRevisions(); }}>Version history</button></section>}
          </div>
        </details>
      </div>
    </header>
    {imageModelImport && <ImageModelStudio initialFile={imageModelImport.file} onClose={() => setImageModelImport(null)} onAdd={addImageModel} />}
    {castSources && <CastStudio sources={castSources} onClose={() => setCastSources(null)} onStatus={setStatus} />}
    {blenderOpen && <div className="cast-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setBlenderOpen(false); }}>
      <section className="blender-sheet" role="dialog" aria-modal="true" aria-label="Export for Blender" onKeyDown={(event) => { if (event.key === "Escape") setBlenderOpen(false); }}>
        <header><div><small>EXPORT FOR BLENDER</small><h2>Take it into Blender.</h2></div><button type="button" aria-label="Close Export for Blender" onClick={() => setBlenderOpen(false)}>×</button></header>
        <div className="blender-options">
          <section><h3>glTF binary · .glb</h3><p>Recommended. One file: a named object per body, PBR materials, embedded textures, normals.</p><button type="button" className="blender-primary" disabled={blenderBusy} onClick={() => void exportBlenderFile("glb")}>{blenderBusy ? "Exporting…" : "Download .glb ↓"}</button></section>
          <section><h3>OBJ + MTL · .zip</h3><p>For older workflows: geometry, normals, UVs, materials and PNG textures.</p><button type="button" disabled={blenderBusy} onClick={() => void exportBlenderFile("obj")}>Download OBJ ZIP ↓</button></section>
        </div>
        <p>Form models in millimetres with Z up; these files are converted to real-world metres with Y up, the glTF standard. {BLENDER_IMPORT_STEPS}</p>
        <p>Exports what is visible in Model view, as shown. For exact CAD hand-offs use STEP.</p>
      </section>
    </div>}
    <CadProductCenter
      open={productCenterOpen}
      tab={productCenterTab}
      context={view}
      shortcuts={shortcuts}
      onClose={closeProductCenter}
      onTabChange={setProductCenterTab}
      onCommand={executeProductCommand}
      onTemplate={applyStarterTemplate}
      onShortcutsChange={updateShortcuts}
    />
    {desktopUpdate.phase !== "idle" && <section className={`cad-update-notice ${desktopUpdate.phase}`} role={desktopUpdate.phase === "available" ? "dialog" : "status"} aria-label="Form Studio update">
      <div><span>SIGNED DESKTOP UPDATE</span><strong>{desktopUpdate.phase === "available" ? `Form Studio ${desktopUpdate.info?.version} is available` : desktopUpdate.phase === "installing" ? "Installing verified update…" : desktopUpdate.phase === "checking" ? "Checking the signed release feed…" : desktopUpdate.message}</strong>{desktopUpdate.info?.body && <p>{desktopUpdate.info.body}</p>}{desktopUpdate.phase === "installing" && <progress value={desktopUpdate.downloaded ?? 0} max={desktopUpdate.total ?? 1} />}</div>
      {desktopUpdate.phase === "available" && <button className="accent" onClick={() => {
        setDesktopUpdate((current) => ({ ...current, phase: "installing" }));
        void installDesktopUpdate((downloaded, total) => setDesktopUpdate((current) => ({ ...current, phase: "installing", downloaded, total }))).catch((error) => setDesktopUpdate({ phase: "error", message: error instanceof Error ? error.message : "Update installation failed" }));
      }}>Download, verify and restart</button>}
      {(desktopUpdate.phase === "current" || desktopUpdate.phase === "error" || desktopUpdate.phase === "available") && <button onClick={() => setDesktopUpdate({ phase: "idle" })}>Not now</button>}
    </section>}
    {assetsOpen && <div className="cad-assets-panel">
      <header><div><strong>Project assets</strong><small>Streamed separately from exact project history</small></div><button onClick={() => setAssetsOpen(false)} aria-label="Close project assets">×</button></header>
      <button className="cad-assets-upload" disabled={assetBusy} onClick={() => assetImportRef.current?.click()}>{assetBusy ? "Uploading…" : "＋ Upload model, texture or reference"}</button>
      <div className="cad-assets-list">{projectAssets.map((asset) => <article key={asset.id}><span><b>{asset.filename}</b><small>{formatProjectAssetBytes(asset.bytes)} · {asset.content_type}<br />{asset.uploaded_by}</small></span><a href={projectAssetUrl(roomId, asset.id)} download={asset.filename}>Download</a><button aria-label={`Remove ${asset.filename}`} onClick={() => void deleteProjectAsset(roomId, asset.id).then((ok) => { if (ok) void refreshProjectAssets(); })}>×</button></article>)}{projectAssets.length === 0 && <p>No streamed assets yet. Project geometry remains in version history; large scans and textures belong here.</p>}</div>
      <footer>64 MB per asset · 250 assets per project · membership protected</footer>
    </div>}
    {shareOpen && <div className="cad-share-panel">
      <header><div><strong>Share project</strong><small>{cloud.roster?.role === "owner" ? "Owner controls" : "Project access"}</small></div><button onClick={() => setShareOpen(false)} aria-label="Close sharing">×</button></header>
      <div className="cad-share-link"><input readOnly value={typeof window === "undefined" ? "" : `${window.location.origin}${window.location.pathname}?room=${roomId}`} /><button onClick={() => void navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?room=${roomId}`).then(() => setStatus("Secure project link copied · only invited accounts can open it"))}>Copy link</button></div>
      {(!cloud.roster || cloud.roster.role === "owner") && <form onSubmit={(event) => {
        event.preventDefault();
        void cloud.inviteMember(inviteEmail, inviteRole).then((result) => {
          if (result.ok) { setStatus(`${inviteEmail} invited as ${inviteRole}`); setInviteEmail(""); }
          else setStatus(result.error ?? "Invitation failed");
        });
      }}><input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} type="email" required placeholder="collaborator@example.com" aria-label="Collaborator email"/><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as "editor" | "viewer")}><option value="editor">Can edit</option><option value="viewer">View only</option></select><button type="submit">Invite</button></form>}
      <div className="cad-share-members">
        {(cloud.roster?.members ?? []).map((member) => <div key={member.user_id}><span><b>{member.name || member.email || "Collaborator"}</b><small>{member.email}</small></span>{member.role === "owner" ? <em>Owner</em> : cloud.roster?.role === "owner" ? <><select value={member.role} onChange={(event) => void cloud.changeMemberRole(member.user_id, event.target.value as "editor" | "viewer")}><option value="editor">Editor</option><option value="viewer">Viewer</option></select><button onClick={() => void cloud.removeMember({ userId: member.user_id })}>Remove</button></> : <em>{member.role}</em>}</div>)}
        {(cloud.roster?.invitations ?? []).filter((invite) => !invite.accepted_at).map((invite) => <div key={invite.email}><span><b>{invite.email}</b><small>Invitation pending</small></span><em>{invite.role}</em>{cloud.roster?.role === "owner" && <button onClick={() => void cloud.removeMember({ email: invite.email })}>Cancel</button>}</div>)}
        {cloud.roster && cloud.roster.members.length === 0 && <p>No collaborators yet.</p>}
      </div>
      <footer>Access is email-bound. The link alone never grants project access.</footer>
    </div>}
    {historyOpen && <div className="cad-history-panel">
      <header>
        <strong>Version history</strong>
        <button onClick={() => setHistoryOpen(false)} aria-label="Close version history">×</button>
      </header>
      {cloud.state.phase === "conflict" && <div className="cad-history-conflict">
        <p>{describeSync(cloud.state)}</p>
        <button onClick={() => { void cloud.loadLatest().then((latest) => { if (latest?.project) applyProjectContents(JSON.stringify(latest.project), projectPath); }); }}>Load the newer version</button>
        <button onClick={cloud.keepLocalCopy}>Keep my version</button>
      </div>}
      {cloud.revisions.length === 0
        ? <p className="cad-history-empty">No saved versions yet. Edits sync automatically once you are signed in.</p>
        : <ol>{cloud.revisions.map((entry) => <li key={entry.revision}>
            <b>#{entry.revision}</b>
            <span>{new Date(entry.updated_at).toLocaleString()}<small>{entry.updated_by}</small></span>
            <button onClick={() => { void cloud.restoreRevision(entry.revision).then((restored) => { if (restored) { applyProjectContents(JSON.stringify(restored), projectPath); setStatus(`Restored revision ${entry.revision} · save to keep it`); setHistoryOpen(false); } else setStatus("That revision is no longer stored"); }); }}>Restore</button>
          </li>)}</ol>}
    </div>}
    <input ref={projectImportRef} hidden type="file" accept=".form,.formcad,.json" onChange={(event) => {
      const file = event.target.files?.[0];
      if (file) void file.text().then((contents) => applyProjectContents(contents));
      event.currentTarget.value = "";
    }} />
    <input ref={assetImportRef} hidden type="file" multiple onChange={(event) => {
      const files = Array.from(event.target.files ?? []).slice(0, 12); const input = event.currentTarget;
      void files.reduce((chain, file) => chain.then(() => addProjectAsset(file)), Promise.resolve()).finally(() => { input.value = ""; });
    }} />
    <input ref={svgImportRef} aria-label="Import SVG file" hidden type="file" accept=".svg,image/svg+xml" onChange={(event) => {
      const file = event.target.files?.[0]; if (file) void importSvgSketch(file); event.currentTarget.value = "";
    }} />
    <input ref={dxfImportRef} hidden type="file" accept=".dxf,application/dxf,image/vnd.dxf" onChange={(event) => {
      const file = event.target.files?.[0]; if (file) void importDxfSketch(file); event.currentTarget.value = "";
    }} />
    <input ref={ifcImportRef} hidden type="file" accept=".ifc,application/x-step" onChange={(event) => {
      const file = event.target.files?.[0]; if (file) void importIfc(file); event.currentTarget.value = "";
    }} />
    <input ref={rasterImportRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/bmp,image/gif" onChange={(event) => {
      const file = event.target.files?.[0]; if (file) void traceImageSketch(file); event.currentTarget.value = "";
    }} />
    <input ref={extensionImportRef} hidden type="file" accept=".formext,.formextpkg,.json,application/json" onChange={(event) => {
      const file = event.target.files?.[0]; if (file) void importExtension(file); event.currentTarget.value = "";
    }} />
    <input ref={volumeImportRef} hidden type="file" accept=".vdb,application/octet-stream" onChange={(event) => {
      const file = event.target.files?.[0]; if (file) void importVolume(file); event.currentTarget.value = "";
    }} />

    <aside className="cad-tools">
      {view === "sketch" ? <>
        {([
          ["select", "select", "Select"], ["pen", "pen", "Pen"], ["pencil", "pencil", "Pencil"], ["line", "line", "Line"], ["rectangle", "rectangle", "Rectangle"], ["circle", "circle", "Circle"], ["polygon", "polygon", "Polygon"], ["offset", "overlap", "Offset"], ["measure", "measure", "Measure"],
        ] as [Tool, UiIconName, string][]).map(([item, icon, label]) => <button className={tool === item ? "active" : ""} key={item} title={label} onClick={() => setTool(item)}><b><UiIcon name={icon} /></b><span>{label}</span></button>)}
      </> : view === "model" ? <>
        <button className={modelToolCategory === "select" ? "active" : ""} title="Select bodies, faces, edges or vertices" onClick={() => { changeSculptBrush(null); setModelToolCategory("select"); setPickMode("entity"); setTool("select"); closeToolShelf(); }}><b><UiIcon name="select" /></b><span>Select</span></button>
        <button className={modelToolCategory === "create" ? "active" : ""} title="Create exact primitives" onClick={() => { changeSculptBrush(null); setModelToolCategory("create"); pinToolShelf(); }}><b><UiIcon name="add" /></b><span>Create</span></button>
        <button aria-label="Import image to Model" title="Ghost Studio · image to model" onClick={() => { changeSculptBrush(null); closeToolShelf(); setImageModelImport({}); }}><b><UiIcon name="add" /></b><span>Images</span></button>
        <button aria-label="Open Cast print and cast prep" title="Cast · ring size, thickness, mesh health and resin-print checks (alpha)" onClick={openCast}><b><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><ellipse cx="12" cy="13" rx="7" ry="7.5" /><ellipse cx="12" cy="13" rx="4.2" ry="4.7" /><path d="M9.5 5.6 12 2.5l2.5 3.1" /></svg></b><span>Cast</span></button>
        <button className={modelToolCategory === "sketch" || pickMode === "face" ? "active" : ""} title="Select a face or plane and enter Sketch Mode" onClick={() => { changeSculptBrush(null); setModelToolCategory("sketch"); setPickMode("face"); pinToolShelf(); setStatus("Select a face to begin Sketch Mode · or choose World plane"); }}><b><UiIcon name="draw" /></b><span>Sketch</span></button>
        <button className={modelToolCategory === "modify" ? "active" : ""} title="Push/Pull, fillet, chamfer, shell and booleans" onClick={() => { changeSculptBrush(null); setModelToolCategory("modify"); pinToolShelf(); }}><b><UiIcon name="move" /></b><span>Modify</span></button>
        <button className={modelToolCategory === "sculpt" ? "active" : ""} title="Shape meshes with sculpt brushes" onClick={openSculptToolbox}><b><UiIcon name="draw" /></b><span>Sculpt</span></button>
        <button className={modelToolCategory === "paint" ? "active" : ""} aria-label="Paint mode" title="Paint color directly onto a mesh" onClick={openPaintToolbox}><b><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m14 4 6 6-9 9-6-6Z M15 3l6 6 M5 13l-2 8 8-2 M3 21l5-5" /></svg></b><span>Paint</span></button>
        <button className={modelToolCategory === "measure" ? "active" : ""} title="Measure exact geometry" onClick={() => { changeSculptBrush(null); setModelToolCategory("measure"); setTool("measure"); pinToolShelf(); }}><b><UiIcon name="measure" /></b><span>Measure</span></button>
      </> : <>
        <button title="Select" className={tool === "select" ? "active" : ""} onClick={() => setTool("select")}><b><UiIcon name="select" /></b><span>Select</span></button>
        <button title="Export DXF" onClick={exportDXF}><b><UiIcon name="upload" /></b><span>DXF</span></button>
        <button title="Print or save PDF" onClick={printDrawing}><b><UiIcon name="scene" /></b><span>Print</span></button>
        <button title="Open drawing markups" onClick={() => openDraftingTools("Drawing markups ready · place text, leaders or hatches in the inspector")}><b><UiIcon name="draw" /></b><span>Markup</span></button>
        <button title="Open model-derived dimensions" onClick={() => openDraftingTools("Dimension tools ready · select geometry to place an associative dimension")}><b><UiIcon name="measure" /></b><span>Dimensions</span></button>
        <button title="Open drawing notes" onClick={() => openDraftingTools("Drawing notes ready · enter the annotation and place it on the sheet")}><b><UiIcon name="line" /></b><span>Notes</span></button>
      </>}
    </aside>

    <main className={`cad-canvas-wrap${view === "sketch" && activeSketchPlaneId !== WORLD_PLANE_ID ? " off-world-plane" : ""}${sketchSession ? " embedded-sketch" : ""}`} onDragOver={(event) => { if ((view === "sketch" || view === "model") && event.dataTransfer.types.includes("Files")) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; } }} onDrop={(event) => {
      if (view !== "sketch" && view !== "model") return;
      event.preventDefault(); const file = event.dataTransfer.files[0];
      if (view === "model") {
        if (file && /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name)) { changeSculptBrush(null); closeToolShelf(); setImageModelImport({ file }); }
        else setStatus("Drop a PNG, JPEG or WebP to open Ghost Studio image import");
      } else if (file && /\.svg$/i.test(file.name)) void importSvgSketch(file);
      else setStatus("Drop an SVG file here · use Trace image for bitmap artwork");
    }}>
      <canvas ref={canvasRef} aria-label="Sketch canvas" onContextMenu={openSketchObjectMenu} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerLeave={() => !draft && setSketchInference(null)} onPointerCancel={(event) => { contextTap.current.cancel(event); touchPanPoints.current.delete(event.pointerId); setSketchDrag(null); setDraft(null); setFreehandDraft(null); setSketchInference(null); }} style={{ display: view === "model" || view === "drawing" ? "none" : "block" }} />
      {view !== "drawing" && entities.length === 0 && importedBodies.length === 0 && meshFeatures.length === 0 && <section className="cad-canvas-empty" aria-label="Empty project guidance">
        <span>EMPTY {view.toUpperCase()} WORKSPACE</span>
        <h2>{view === "sketch" ? "Draw the first profile" : view === "model" ? "Create or import a body" : "A model is needed for a production sheet"}</h2>
        <p>{view === "sketch" ? "Start precisely, import existing vectors, or choose a verified procedural template." : view === "model" ? "Return to Sketch for exact solids, import a body, or use a professional starter." : "Build and validate geometry before generating documentation."}</p>
        <div><button className="accent" onClick={() => openProductCenter("start")}>Choose a template</button><button onClick={() => openProductCenter("commands")}>Find a command</button>{view !== "sketch" && <button onClick={() => setView("sketch")}>Go to Sketch</button>}</div>
      </section>}
      {documentSession.historyNotice && <section className="cad-recovery-notice" role="alert">{documentSession.historyNotice}</section>}
      {exactBuildState === "error" && !exactRebuildFailure && <section className="cad-recovery-notice" role="alert">
        <div><strong>Exact rebuild needs attention</strong><p>The editable model is safe. Retry the kernel, inspect recovery, or continue in Sketch without losing source geometry.</p></div>
        <button className="accent" onClick={() => void runKernel()}>Retry rebuild</button>
        {recoveryContents && <button onClick={recoverProject}>Open recovery</button>}
        <button onClick={() => openProductCenter("guides")}>Troubleshoot</button>
        <button aria-label="Dismiss exact rebuild notice" onClick={() => setExactBuildState("idle")}>×</button>
      </section>}
      {sketchSession && <section className="cad-sketch-mode-bar" aria-label="Embedded Sketch Mode">
        <span><i />SKETCHING ON</span><strong>{sketchSession.planeName}</strong>
        <nav aria-label="Embedded sketch tools"><button className={tool === "line" ? "active" : ""} onClick={() => setTool("line")}>Line</button><button className={tool === "rectangle" ? "active" : ""} onClick={() => setTool("rectangle")}>Rectangle</button><button className={tool === "circle" ? "active" : ""} onClick={() => setTool("circle")}>Circle</button><button className={tool === "offset" ? "active" : ""} onClick={() => setTool("offset")}>Offset</button></nav>
        <small className={sketchSolverStatus.conflicts.length ? "conflict" : sketchSolverStatus.degreesOfFreedom === 0 ? "solved" : "under"}>{sketchSolverStatus.conflicts.length ? `${sketchSolverStatus.conflicts.length} conflict` : sketchSolverStatus.degreesOfFreedom === 0 ? "Fully constrained" : `${sketchSolverStatus.degreesOfFreedom} DOF`}</small>
        <button title="Create the certified centered mounting-hole profile" onClick={createCenteredMountHole}>Centered Ø16</button>
        <button disabled={!selected} onClick={() => setSelectedGeometryFixed(true)}>Fix selected</button>
        {compact && <button aria-pressed={touchPan} title="Pan with one finger; pinch with two to zoom. Turn off to draw or select." onClick={toggleTouchPan}>Pan</button>}
        <button className="accent" onClick={finishEmbeddedSketch}>Finish Sketch</button><button onClick={() => { setEntities(sketchSession.entitiesBefore); setGeometricConstraints(sketchSession.constraintsBefore); setSelectedId(sketchSession.sourceEntityId ?? ""); setSelectedEntityIds(sketchSession.sourceEntityId ? [sketchSession.sourceEntityId] : []); setSketchSession(null); setCompletedSketchRegion(null); setView("model"); setTool("select"); setStatus("Sketch cancelled · existing model unchanged"); }}>Cancel</button>
      </section>}
      {completedSketchRegion && view === "model" && <section className="cad-region-actions" aria-label="Closed sketch region actions">
        <span><i />CLOSED REGION</span><strong>{completedSketchRegion.profileId}</strong><label className="cad-region-depth">Depth<ExactLengthInput label="Sketch extrusion depth" value={quickExtrudeDepth} unit={units} precision={precision} onCommit={setQuickExtrudeDepth} /></label><button className="accent" onClick={() => applyCompletedSketch("Extrude")}>Extrude</button><button onClick={() => applyCompletedSketch("Cut")}>Cut through</button><button onClick={() => applyCompletedSketch("Revolve")}>Revolve</button><button aria-label="Dismiss region actions" onClick={() => setCompletedSketchRegion(null)}>×</button>
      </section>}
      {view === "sketch" && !sketchSession && <div className="sketch-canvas-toolbar" role="toolbar" aria-label="Sketch quick actions"><button onClick={() => svgImportRef.current?.click()}>Import SVG</button><span>Drop SVG · click a shape · make it 3D</span>{compact && <button aria-pressed={touchPan} title="Pan with one finger; pinch with two to zoom. Turn off to draw or select." onClick={toggleTouchPan}>Pan</button>}<button onClick={() => fitSketch()}>Fit view</button></div>}
      {view === "drawing" && <CadDocumentWorkspace
        outputDisabled={activeDocumentIsProduction && drawingOutputBlocked}
        placement={sheetPlacement} onPlacement={setSheetPlacement}
        layout={activeSheetLayout} linked={!activeDocumentIsProduction} scale={activeDrawingScale}
        geometry={activeDocumentIsProduction ? exactSheetGeometry : sourceDrawingSheets.get(activeSheetLayout.id)?.geometry}
        selection={sheetSelection} onSelection={selectDocumentItem}
        edgeIds={selectedDocumentEdges} onEdge={(view, edge, additive) => { setSelectedSheetView(view); setDocumentEdges({ sheet: activeSheetLayout.id, view, ids: additive && documentEdges.sheet === activeSheetLayout.id && documentEdges.view === view ? [...documentEdges.ids.filter((id) => id !== edge).slice(-1), edge] : [edge] }); selectDocumentItem({ kind: "view", view }); }}
        onMoveAnnotation={(id, dx, dy) => updateSheetLayout({ ...activeSheetLayout, annotations: activeSheetLayout.annotations.map((a) => a.id === id ? { ...a, x: Math.max(-10000, Math.min(10000, a.x + dx)), y: Math.max(-10000, Math.min(10000, a.y + dy)) } : a) })}
        onEditNote={(id, text) => updateSheetLayout({ ...activeSheetLayout, annotations: activeSheetLayout.annotations.map((a) => a.id === id && a.kind === "note" ? { ...a, text } : a) })}
        onDeleteAnnotation={(id) => updateSheetLayout({ ...activeSheetLayout, annotations: activeSheetLayout.annotations.filter((a) => a.id !== id) })}
        onPlace={placeOnSheet}
        onMove={(name, dx, dy) => { const p = activeSheetLayout.views[name]; setSelectedSheetView(name); updateSheetLayout({ ...activeSheetLayout, views: { ...activeSheetLayout.views, [name]: { ...p, x: Math.max(-10000, Math.min(10000, p.x + dx)), y: Math.max(-10000, Math.min(10000, p.y + dy)) } } }); }}
        sheets={documentSheets} activeId={activeDocumentSheet.id}
        onSelect={(sheetId) => { setSelectedBimDocumentId(sheetId === "production" ? null : sheetId); setSheetPlacement("select"); }}
        onPanel={(panel) => openDraftingTools(`Document ${panel} ready`, panel)}
        onLinkContent={() => { setDocumentLinkOpen(true); openDraftingTools("Choose content to link to a sheet", "sheet"); }}
        onRebuild={activeDocumentIsProduction ? rebuildDocumentViews : () => { setDocumentPanel("review"); setStatus("Linked sheets update live from their source; review checks shown"); }}
        building={activeDocumentIsProduction && exactBuildState === "building"} error={activeSheetErrors.length > 0 || (activeDocumentIsProduction && exactBuildState === "error")}
        empty={activeDocumentIsProduction && exactProfiles.length === 0 && importedBodies.length === 0}
        emptyMessage={!activeDocumentIsProduction && !activeDocumentSheet.svg ? activeSheetErrors[0] : undefined}
        review={!activeDocumentIsProduction ? `${isBimSheet(activeSheetLayout) ? "BIM coordination only" : `Linked ${activeSheetLayout.source?.kind} review`} · ${activeSheetErrors.length ? `${activeSheetErrors.length} drawing issues` : "Internal source / layout checks passed"} · Not fabrication approval`
          : productionDrawingSheet && drawingOutputBlocked ? "Drawing needs rebuild · Export and print are unavailable until current views are ready"
          : productionDrawingSheet ? `${drawingReadiness.decision === "ready" ? "Internal gates passed" : "Review required"} · Structure ${productionDrawingSheet.validation.ready ? "passed" : "needs review"} · ${drawingReadiness.gates.filter((gate) => gate.state !== "pass").length} open gates · External approval required`
          : "Exact model-derived sheets · Review before fabrication"}
      />}
      {view === "drawing" && <style media="print">{`@page { size: ${sheetSize(activeSheetLayout).width}mm ${sheetSize(activeSheetLayout).height}mm; margin: 0; } .form-document-paper { width: ${sheetSize(activeSheetLayout).width}mm !important; height: ${sheetSize(activeSheetLayout).height}mm !important; }`}</style>}
      <CadViewport3D
        handleRef={viewportHandleRef}
        visible={view === "model" || Boolean(sketchSession)}
        modelState={streamedModelState}
        entities={streamedEntities}
        layers={layers}
        sketchPlanes={sketchPlanes}
        activeSketchPlaneId={activeSketchPlaneId}
        exactMeshes={exactMeshes.filter((mesh) => !creativeSourceIds.has(mesh.sourceId) && (entities.length <= streamingWorkingSet.entityIds.length || streamedEntityIds.has(mesh.sourceId) || mesh.sourceId === selectedId))}
        physicsTransforms={nativeSimulationApplied ? nativeSimulation?.bodies ?? [] : []}
        softBodyPreview={nativeSoftBodyResult}
        meshBodies={viewportMeshBodies}
        appearance={appearance}
        viewport={viewport}
        explodedAssembly={explodedAssembly}
        selectedId={selectedId}
        selectedIds={selectedEntityIds}
        selectedTopologyIds={selectedTopologyIds}
        pickMode={pickMode}
        onViewportChange={setViewport}
        onStatus={setStatus}
        onSelectEntity={handleSelectEntityFrom3D}
        onObjectContext={(target, x, y) => {
          if (target.mesh) handlePickMeshFace(target.id, target.face, false);
          else { setSelectedMeshId(null); clearMeshSelection(); if (target.id !== selectedId) setSelectedTopologyIds([]); handleSelectEntityFrom3D(target.id, false); }
          setObjectMenu({ x, y, target: target.id });
        }}
        onClearSelection={() => { setSelectedId(""); setSelectedEntityIds([]); setSelectedTopologyIds([]); clearMeshSelection(); setStatus("Selection cleared"); }}
        onPickTopology={handlePickTopology}
        onPickFace={handlePickFace}
        onPickMeshFace={handlePickMeshFace}
        onTransformCommit={handleTransformCommit}
        onDirectEditPreview={(edit) => {
          setDirectEditLive(edit);
          if (edit && Math.abs(edit.distance) >= 0.001) {
            setDirectEditAmount(edit.kind === "edge" ? Math.abs(edit.distance) : edit.distance);
            setStatus(`${edit.kind === "face" ? "Push/Pull" : directFinishKind} preview · ${edit.distance.toFixed(2)} mm · release to commit`);
          }
        }}
        onDirectEditCommit={commitDirectExactEdit}
        modalTarget={modalTarget}
        onModalChange={(value, header) => {
          setModalPreview(value && modalTarget
            ? { value, pivot: modalTarget.pivot, vertices: modalTarget.vertices }
            : null);
          if (header) setStatus(header);
        }}
        onModalCommit={commitModalTransform}
        regionTarget={regionTarget}
        selectionMode={meshSelection.mode}
        regionRequest={regionRequest}
        onRegionRequestComplete={() => setRegionRequest(null)}
        onRegionSelect={applyRegionSelection}
        onRegionSelectEntities={applyExactBodyRegionSelection}
        sculptBrush={selectedMeshId && !painting && !selectionBrushEnabled ? sculptBrush : null}
        sculptTargetId={selectedMeshId}
        onSculptStroke={handleSculptStroke}
        painting={painting && texture !== null && !selectionBrushEnabled}
        paintRadius={paintRadius}
        onPaint={paintOnTexture}
        onPaintBegin={beginPaint}
        onPaintEnd={endPaint}
        selectionBrushInput={{ brush: selectionBrushEnabled && !brushUnavailable ? selectionBrushSettings : null, target: regionTarget, weights: activeSelectionWeights, painted: paintedSelection?.meshId === selectedMeshId && paintedSelection?.topology === maskTopology, onChange: acceptSelectionWeights, onSettings: setSelectionBrushSettings }}
        selectionThrough={selectionBrushSettings.through}
        selectionHud={selectionHudContent}
      />
      {view === "model" && selectedMeshId && !sculptBrush && modelToolCategory !== "paint" && <nav className="form-selection-toolbar" aria-label="Creative selection tools">
        <span>SELECT</span>
        <button aria-pressed={!selectionBrushEnabled && !regionRequest} onClick={() => { setSelectionBrushEnabled(false); setRegionRequest(null); }}>Point</button>
        <button onClick={() => armRegionSelection("box")}>Rectangle</button>
        <button onClick={() => armRegionSelection("ellipse")}>Ellipse</button>
        <button onClick={() => armRegionSelection("lasso")}>Lasso</button>
        <button onClick={() => armRegionSelection("polygon")}>Polygon</button>
        <button aria-pressed={selectionBrushEnabled} title={brushUnavailable || "Paint a weighted surface selection"} disabled={!!brushUnavailable} onClick={() => { setRegionRequest(null); setSelectionBrushEnabled((enabled) => !enabled); setSculptBrush(null); setPainting(false); setSelectionHudEnabled(true); }}>Brush</button>
        <button disabled={!selectedMeshFaces.length} onClick={() => {
          if (!selectedMesh) return;
          const faces = selectLinkedFlat(selectedMesh.rebuild.surface, selectedMeshFaces[0], 20, 40);
          setSelectionBrushEnabled(false); setPaintedSelection(null);
          setMeshSelection(selectionWith(selectedMesh.rebuild.surface, "face", faces));
          setStatus(`Magic Surface · ${faces.length} connected faces · 20° local / 40° seed limit · geometry-based, not AI`);
        }} title="Connected patch bounded by normal changes; not AI segmentation">Magic Surface</button>
        <button disabled={!selectedMeshFaces.length} onClick={() => runSelectionCommand("linked")}>Connected</button>
        <label title="Normal-facing filters exclude back faces, but not other objects. Through includes the far side. Brush mode uses depth raycasts."><input type="checkbox" checked={selectionBrushSettings.through} onChange={(e) => setSelectionBrushSettings((s) => ({ ...s, through: e.target.checked }))} />Through</label>
        <button aria-pressed={selectionHudEnabled} onClick={() => setSelectionHudEnabled((enabled) => !enabled)}>Controls</button>
      </nav>}
      {view === "model" && !selectedMeshId && <nav className="cad-model-selection-filter" aria-label="Exact selection filter">
        <span>SELECT</span>
        <button className={pickMode === "entity" ? "active" : ""} onClick={() => { setPickMode("entity"); setSelectedTopologyIds([]); setDirectEditLive(null); }}>Body</button>
        <button className={pickMode === "edit-face" ? "active" : ""} onClick={() => { setPickMode("edit-face"); setSelectedTopologyIds([]); setDirectEditLive(null); setStatus("Face filter · click an exact face for Push/Pull"); }}>Face</button>
        <button className={pickMode === "edge" ? "active" : ""} onClick={() => { setPickMode("edge"); setSelectedTopologyIds([]); setDirectEditLive(null); setStatus("Edge filter · click exact edges for Fillet or Chamfer"); }}>Edge</button>
        <button onClick={() => armRegionSelection("box")} title="Marquee-select exact bodies">Marquee</button>
      </nav>}
      {view === "model" && !selectedMeshId && selectedTopologyIds.at(-1) && (pickMode === "edit-face" || pickMode === "edge") && <section className="cad-topology-edit" aria-label="Direct topology edit">
        <header><span>{pickMode === "edit-face" ? "FACE HANDLE" : "EDGE HANDLE"}</span><strong>{pickMode === "edit-face" ? "Push / Pull" : directFinishKind}</strong><small>Drag the lime handle or type an exact value</small></header>
        {pickMode === "edge" && <nav><button className={directFinishKind === "Fillet" ? "active" : ""} onClick={() => setDirectFinishKind("Fillet")}>Fillet</button><button className={directFinishKind === "Chamfer" ? "active" : ""} onClick={() => setDirectFinishKind("Chamfer")}>Chamfer</button></nav>}
        <label><span>{pickMode === "edit-face" ? "Distance" : directFinishKind === "Fillet" ? "Radius" : "Distance"}</span><ExactLengthInput label="Direct edit distance" value={directEditLive?.distance ?? directEditAmount} unit={units} precision={precision} onCommit={setDirectEditAmount} /><em>{units}</em></label>
        <button className="accent" onClick={() => commitDirectExactEdit({ sourceEntityId: selectedId, topologyId: selectedTopologyIds.at(-1)!, kind: pickMode === "edit-face" ? "face" : "edge", distance: directEditAmount }, directEditAmount)}>Apply exact</button>
        <button onClick={() => { setSelectedTopologyIds([]); setPickMode("entity"); setDirectEditLive(null); setStatus("Direct edit cancelled"); }}>Cancel</button>
        <footer>{pickMode === "edit-face" ? "Primitive walls and extrusion caps rewrite their source parameters" : "Release adds one non-destructive exact history feature"}</footer>
      </section>}
      {toolShelf.open && (
        <section
          className={`cad-tool-shelf ${toolShelfSize}${toolShelf.pinned ? " pinned" : " transient"}${view === "model" && (modelToolCategory === "sculpt" || modelToolCategory === "paint") ? " sculpt-shelf" : ""}`}
          role="region"
          aria-label={`${toolShelfTitle} features`}
          data-pinned={toolShelf.pinned ? "true" : "false"}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <header>
            <div><span>TOOL FEATURES</span><strong>{toolShelfTitle}</strong><small>{toolShelfDetail}</small></div>
            <nav>
              <kbd>SPACE</kbd>
              <button className={toolShelf.pinned ? "active" : ""} onClick={toggleToolShelfPin} aria-label={toolShelf.pinned ? "Unpin tool features" : "Pin tool features"} title="Keep this shelf on screen">●</button>
              <button onClick={closeToolShelf} aria-label="Close tool features">×</button>
            </nav>
          </header>

          {(view !== "model" || (modelToolCategory !== "sculpt" && modelToolCategory !== "paint")) && <div className="cad-smart-shelf" aria-label="Recommended smart actions">
            <header><span>RECOMMENDED</span><strong>{recommendedSmartActions[0]?.reason ?? "Select geometry to see relevant actions"}</strong></header>
            <div>{recommendedSmartActions.slice(0, 5).map((action, index) => <button aria-label={`Recommended action ${index + 1}: ${action.detail}`} className={index === 0 ? "primary" : ""} key={action.id} title={`${action.label} · ${action.reason}`} onClick={() => executeSmartAction(action.id)}><span>{action.label}</span><small>{action.detail}</small></button>)}</div>
            {unavailableSmartActions.length > 0 && <details><summary>Why other actions are unavailable</summary>{unavailableSmartActions.map((action) => <p key={action.id}><b>{action.label}</b><span>{action.unavailableReason}</span></p>)}</details>}
          </div>}

          {view === "sketch" && <div className="cad-tool-shelf-body">
            <div className="cad-tool-feature-grid">
              <button className={snap ? "active" : ""} onClick={() => setSnap((value) => !value)}><b>⌁</b><span>Snap</span><small>{snap ? `${grid} mm grid` : "Free placement"}</small></button>
              <button className={ortho ? "active" : ""} onClick={() => setOrtho((value) => !value)}><b>⊥</b><span>Ortho</span><small>{ortho ? "Axis locked" : "Any angle"}</small></button>
              <button className={tool === "offset" ? "active" : ""} onClick={() => setTool("offset")}><b>▱</b><span>Offset</span><small>Parallel profile</small></button>
              <button onClick={() => dxfImportRef.current?.click()}><b>⌗</b><span>Import DXF</span><small>Blocks + curves + layers</small></button>
              {(tool === "pen" || tool === "pencil") && <>
                <button onClick={() => svgImportRef.current?.click()}><b>↥</b><span>Import SVG</span><small>Editable vectors</small></button>
                <button onClick={() => rasterImportRef.current?.click()}><b>▧</b><span>Trace image</span><small>Raster to paths</small></button>
                <button className="accent" onClick={makeSketch3D}><b>⬡</b><span>Make 3D</span><small>{quickExtrudeDepth} mm exact solid</small></button>
              </>}
              {tool !== "pen" && tool !== "pencil" && <>
                <button onClick={() => setTool("select")}><b>⌖</b><span>Select</span><small>Return to selection</small></button>
                <button className="accent" onClick={makeSketch3D}><b>⬡</b><span>Make 3D</span><small>{quickExtrudeDepth} mm exact solid</small></button>
              </>}
            </div>
            <div className="cad-tool-feature-fields">
              <label><span>Grid</span><input type="number" min="0.01" step="1" value={grid} onChange={(event) => setGrid(Math.max(0.01, Number(event.target.value) || 0.01))} /><em>mm</em></label>
              {tool === "offset" && <label><span>Offset</span><input type="number" step="1" value={toolShelfAmount} onChange={(event) => setToolShelfAmount(Number(event.target.value))} /><em>mm</em></label>}
              {(tool === "pen" || tool === "pencil") && <label><span>3D depth</span><input type="number" min="0.01" step="1" value={quickExtrudeDepth} onChange={(event) => setQuickExtrudeDepth(Math.max(0.01, Number(event.target.value) || 0.01))} /><em>mm</em></label>}
              <label><span>Layer</span><select value={activeLayer} onChange={(event) => setActiveLayer(event.target.value)}>{layers.map((layer) => <option key={layer.id} value={layer.id}>{layer.name}</option>)}</select></label>
            </div>
          </div>}

          {view === "model" && modelToolCategory === "sculpt" && <div className="cad-tool-shelf-body">
            {selectedMesh ? <SculptToolbox brush={sculptBrush} settings={sculptSettings} onChange={changeSculptBrush} unit={units} precision={precision} targetName={selectedMesh.feature.name} layered={!!sculptLayerId} layers={selectedMesh.feature.sculptLayers ?? []} activeLayerId={sculptLayerId} onSelectLayer={setActiveSculptLayerId} onAddLayer={createSculptLayer} /> : <div className="sculpt-empty">
              <strong>Start with a sculptable mesh</strong><p>Select a creative mesh, add a starting block, or make a creative copy of an exact body. Your CAD original stays unchanged.</p>
              <button disabled={!selectedExactMesh} onClick={() => { makeCreativeCopy(); setModelToolCategory("sculpt"); changeSculptBrush(sculptSettings); }}>Sculpt a creative copy</button>
              <button onClick={() => { addSculpt({ kind: "box", width: 40, height: 40, depth: 40 }); changeSculptBrush(sculptSettings); }}>Add sculpt block</button>
            </div>}
          </div>}
          {view === "model" && selectedMesh?.feature.photoTexture && !restoredPhotoTexture(selectedMesh.feature.photoTexture, selectedMesh.rebuild.surface) && <p className="ghost-import-error">Photo colors hidden: topology changed. Undo the topology change to restore the original UV mapping.</p>}
          {view === "model" && modelToolCategory === "paint" && <div className="cad-tool-shelf-body">
            {selectedMesh ? <PaintToolbox name={selectedMesh.feature.name} ready={!!texture && sculptUnwrap?.meshId === selectedMeshId} painting={painting}
              blocked={texture && sculptUnwrap?.meshId !== selectedMeshId ? "Another mesh owns the project's paint texture. Select that mesh to continue without losing its paint." : undefined}
              color={paintColor} radius={paintRadius} strength={paintStrength} soften={paintSoften}
              onStart={startSurfacePaint} onPause={() => { setPainting(false); setStatus("Painting paused · drag to orbit"); }}
              onColor={setPaintColor} onRadius={setPaintRadius} onStrength={setPaintStrength} onSoften={setPaintSoften} onExport={exportPaintTexture} /> : <div className="sculpt-empty">
              <strong>Choose a surface to paint</strong><p>Select a creative mesh, or make a paintable copy of your exact body. The CAD original stays unchanged.</p>
              <button disabled={!selectedExactMesh} onClick={() => { makeCreativeCopy(); setModelToolCategory("paint"); }}>Make paintable copy</button>
              <button onClick={() => { addSculpt({ kind: "box", width: 40, height: 40, depth: 40 }); setModelToolCategory("paint"); }}>Add paintable block</button>
            </div>}
          </div>}
          {view === "model" && modelToolCategory !== "sculpt" && modelToolCategory !== "paint" && selectedMeshId && <div className="cad-tool-shelf-body model-selection">
            <div className="cad-tool-feature-grid component-modes">
              {(["vertex", "edge", "face"] as SelectionMode[]).map((mode) => <button className={meshSelection.mode === mode ? "active" : ""} key={mode} onClick={() => changeSelectionMode(mode)}><b>{mode === "vertex" ? "•" : mode === "edge" ? "╱" : "▰"}</b><span>{mode}</span><small>Component mode</small></button>)}
            </div>
            <div className="cad-tool-feature-grid selection-actions">
              <button onClick={() => runSelectionCommand("all")}><span>Select all</span><small>Every {meshSelection.mode}</small></button>
              <button onClick={() => runSelectionCommand("none")}><span>None</span><small>Clear selection</small></button>
              <button onClick={() => runSelectionCommand("invert")}><span>Invert</span><small>Swap selected</small></button>
              <button onClick={() => armRegionSelection("box")}><span>Marquee</span><small>Box select · B</small></button>
              <button onClick={() => armRegionSelection("ellipse")}><span>Ellipse</span><small>Oval region</small></button>
              <button onClick={() => armRegionSelection("lasso")}><span>Lasso</span><small>Free region · L</small></button>
              <button onClick={() => runSelectionCommand("grow")}><span>Grow</span><small>Adjacent components</small></button>
              <button onClick={() => runSelectionCommand("shrink")}><span>Shrink</span><small>Trim boundary</small></button>
              {meshSelection.mode === "edge" && <><button onClick={() => runSelectionCommand("loop")}><span>Loop</span><small>Continue edge loop</small></button><button onClick={() => runSelectionCommand("ring")}><span>Ring</span><small>Parallel edge ring</small></button></>}
            </div>
            <div className="cad-tool-operation-row">
              <label><span>Amount</span><input type="number" step="1" value={toolShelfAmount} onChange={(event) => setToolShelfAmount(Number(event.target.value))} /><em>mm</em></label>
              <button className="accent" disabled={selectedMeshFaces.length === 0 || !Number.isFinite(toolShelfAmount) || toolShelfAmount === 0} onClick={() => applySculptEdit("extrude", toolShelfAmount)}>Extrude selection</button>
              <button disabled={selectedMeshFaces.length === 0 || !Number.isFinite(toolShelfAmount) || toolShelfAmount === 0} onClick={() => applySculptEdit("inset", Math.abs(toolShelfAmount))}>Inset selection</button>
            </div>
          </div>}

          {view === "model" && modelToolCategory !== "sculpt" && modelToolCategory !== "paint" && !selectedMeshId && <div className="cad-tool-shelf-body">
            {modelToolCategory === "create" && <div className="cad-tool-feature-grid cad-core-tools">
              <button className="accent" onClick={() => createExactPrimitive("box")}><b>□</b><span>Box</span><small>80 × 50 × 24 mm</small></button>
              <button onClick={() => createExactPrimitive("cylinder")}><b>○</b><span>Cylinder</span><small>Ø32 × 40 mm</small></button>
              <button onClick={() => createExactPrimitive("sphere")}><b>●</b><span>Sphere</span><small>Ø40 mm revolve</small></button>
              <button onClick={beginWorldSketch}><b>⌗</b><span>Plane / Sketch</span><small>World or active plane</small></button>
            </div>}
            {modelToolCategory === "sketch" && <div className="cad-tool-feature-grid cad-core-tools">
              <button className={pickMode === "face" ? "active accent" : ""} onClick={() => { setPickMode("face"); setStatus("Click a face · Form will orient the sketch and fade the solid"); }}><b>▰</b><span>Select face</span><small>Embedded Sketch Mode</small></button>
              <button onClick={beginWorldSketch}><b>XY</b><span>World plane</span><small>Start an unconstrained sketch</small></button>
              {sketchPlanes.filter((plane) => plane.id !== WORLD_PLANE_ID).slice(-2).map((plane) => <button key={plane.id} onClick={() => beginEmbeddedSketch(plane)}><b>◇</b><span>{plane.name.split(" @ ")[0]}</span><small>Reuse work plane</small></button>)}
            </div>}
            {modelToolCategory === "modify" && <>
              <div className="cad-tool-feature-grid cad-core-tools">
                <button className={selectedExactMesh ? "accent" : ""} disabled={!selectedExactMesh} onClick={() => makeCreativeCopy()}><b>✦</b><span>Creative copy</span><small>Preserve exact source</small></button>
                <button className={`accent${pickMode === "edit-face" ? " active" : ""}`} disabled={!selected} onClick={() => { setPickMode("edit-face"); setSelectedTopologyIds([]); closeToolShelf(); setStatus("Push/Pull · click an exact face, then drag its handle or type a distance"); }}><b>↥</b><span>Push / Pull</span><small>Select a real face</small></button>
                <button disabled={!selected && !importedBodies.some((body) => body.id === selectedId)} onClick={() => addFeature("Offset", Math.abs(toolShelfAmount))}><b>▱</b><span>Offset face</span><small>Exact B-Rep offset</small></button>
                <button className={pickMode === "edge" ? "active" : ""} onClick={() => setPickMode("edge")}><b>╱</b><span>Fillet / Chamfer</span><small>Pick exact edges first</small></button>
                <button className={pickMode === "finish-face" ? "active" : ""} onClick={() => setPickMode("finish-face")}><b>▰</b><span>Shell</span><small>Pick opening faces</small></button>
                <button disabled={selectedEntityIds.length < 2} onClick={() => addFeature("Fuse", 0)}><b>∪</b><span>Union</span><small>{selectedEntityIds.length} selected bodies</small></button>
                <button disabled={selectedEntityIds.length < 2} onClick={() => addFeature("Cut", 0)}><b>−</b><span>Subtract</span><small>Last selected cuts first</small></button>
                <button disabled={selectedEntityIds.length < 2} onClick={() => addFeature("Intersect", 0)}><b>∩</b><span>Intersect</span><small>Common volume</small></button>
              </div>
              <div className="cad-tool-operation-row"><label><span>Amount</span><input type="number" step="1" value={toolShelfAmount} onChange={(event) => setToolShelfAmount(Number(event.target.value))} /><em>mm</em></label><button disabled={!selectedTopologyIds.some((id) => id.includes(":edge:"))} onClick={() => addFeature("Fillet", Math.abs(toolShelfAmount))}>Fillet</button><button disabled={!selectedTopologyIds.some((id) => id.includes(":edge:"))} onClick={() => addFeature("Chamfer", Math.abs(toolShelfAmount))}>Chamfer</button><button disabled={!selectedTopologyIds.some((id) => id.includes(":face:"))} onClick={() => addFeature("Shell", Math.abs(toolShelfAmount))}>Shell</button></div>
            </>}
            {modelToolCategory === "measure" && <div className="cad-core-measure">
              <strong>{selected ? `${selected.type.toUpperCase()} · ${selected.id}` : "SELECT GEOMETRY TO MEASURE"}</strong>
              <span>X {selected ? formatCadLength(selected.a.x, units, precision) : "—"}</span><span>Y {selected ? formatCadLength(selected.a.y, units, precision) : "—"}</span>
              {selected?.type === "rectangle" && <><span>W {formatCadLength(Math.abs(selected.b.x - selected.a.x), units, precision)}</span><span>H {formatCadLength(Math.abs(selected.b.y - selected.a.y), units, precision)}</span></>}
              {selected?.type === "circle" && <span>Ø {formatCadLength(length(selected.a, selected.b) * 2, units, precision)}</span>}
              <button onClick={() => setStatus(kernelAudit ? `Exact body · ${kernelAudit.topology.solids} solid(s) · ${kernelAudit.topology.faces} faces` : "Validate the exact model to inspect body metrics")}>Inspect exact body</button>
            </div>}
            {modelToolCategory === "select" && <div className="cad-selection-guide"><strong>{selectedEntityIds.length ? `${selectedEntityIds.length} selected` : "Selection is contextual"}</strong><span>Click a body to select · Shift-click adds or removes · click empty space clears</span><span>Sketch asks for a face · Modify asks for edges or opening faces only when required</span><span><kbd>Esc</kbd> backs out one level · <kbd>Delete</kbd> removes the selection · <kbd>⌘Z</kbd> undo</span><div><button onClick={() => { const ids = [...entities.filter((entity) => entity.type !== "line").map((entity) => entity.id), ...importedBodies.map((body) => body.id)]; setSelectedEntityIds(ids); setSelectedId(ids.at(-1) ?? ""); setStatus(`${ids.length} exact ${ids.length === 1 ? "body" : "bodies"} selected`); }}>Select all bodies</button><button disabled={selectedEntityIds.length === 0} onClick={() => { setSelectedEntityIds([]); setSelectedId(""); setSelectedTopologyIds([]); }}>Clear selection</button></div></div>}
          </div>}

          {view === "drawing" && <div className="cad-tool-shelf-body">
            <div className="cad-tool-feature-grid">
              <button onClick={printDrawing}><b>▤</b><span>Print / PDF</span><small>Current sheet</small></button>
              <button disabled={!activeDocumentSheet.svg || (activeDocumentIsProduction && drawingOutputBlocked)} onClick={exportActiveDocumentSheet}><b>⌑</b><span>Export sheet</span><small>Active drawing · SVG</small></button>
              <button onClick={exportDXF}><b>⌗</b><span>Export DXF</span><small>Editable drawing</small></button>
              <button onClick={() => void runKernel("svg")}><b>◇</b><span>Exact SVG</span><small>Hidden-line output</small></button>
              <button onClick={exportManufacturingReport}><b>✓</b><span>Release report</span><small>Manufacturing audit</small></button>
              <button onClick={exportFabricationReview}><b>✦</b><span>Shop review</span><small>Independent approval pack</small></button>
            </div>
          </div>}

          <footer><span>{toolShelf.pinned ? "Pinned · Space or Escape closes" : "Holding Space · release to dismiss"}</span><em>{view === "sketch" ? `Active plane · ${activePlane.name}` : view === "model" ? "Edits remain in model history" : `Scale ${activeDrawingScale}`}</em></footer>
        </section>
      )}
      {view === "model" && (<>
        <div className="cad-3d-tools">
          <button
            type="button"
            className={regionRequest?.kind === "box" ? "active" : ""}
            disabled={!selectedMeshId && meshRebuilds.length !== 1 && exactMeshes.length === 0}
            title={selectedMeshId ? "Marquee select the active vertices, edges or faces · Shift adds · Control subtracts · B" : "Marquee select exact bodies · Shift adds · Control subtracts · B"}
            onClick={(event) => armRegionSelection(
              "box",
              event.shiftKey ? "extend" : event.ctrlKey ? "subtract" : "replace",
            )}
          >Marquee select</button>
          <button
            type="button"
            className={pickMode === "face" ? "active" : ""}
            title="Pick a mesh face to create a sketch plane"
            onClick={() => {
              setPickMode((mode) => (mode === "face" ? "entity" : "face"));
              setStatus(pickMode === "face" ? "Face pick cancelled" : "Click any face to create a sketch plane on it");
            }}
          >Sketch on face</button>
          <button
            type="button"
            className={pickMode === "edge" ? "active" : ""}
            title="Pick exact B-Rep edges for fillet or chamfer"
            onClick={() => {
              setPickMode((mode) => (mode === "edge" ? "entity" : "edge"));
              setStatus(pickMode === "edge" ? "Edge pick cancelled" : "Click an exact edge · Shift-click adds more");
            }}
          >Pick finish edge</button>
          <button
            type="button"
            className={pickMode === "finish-face" ? "active" : ""}
            title="Pick exact B-Rep faces to open for shell"
            onClick={() => {
              setPickMode((mode) => (mode === "finish-face" ? "entity" : "finish-face"));
              setStatus(pickMode === "finish-face" ? "Face target cancelled" : "Click an exact face · Shift-click adds more");
            }}
          >Pick shell face</button>
          <button type="button" title="Export the current camera with PBR lighting" onClick={exportViewportPng}>Render PNG</button>
          {selectedTopologyIds.length > 0 && <button type="button" onClick={() => setSelectedTopologyIds([])}>Clear {selectedTopologyIds.length}</button>}
          <span className={`cad-exact-state ${exactBuildState}`}>
            {exactBuildState === "building" ? "Rebuilding exact in background…" : exactBuildState === "ready" ? `Exact · ${exactMeshes.length} ${exactMeshes.length === 1 ? "body" : "bodies"} · ${exactTopology.length} stable refs` : exactBuildState === "error" ? "Exact rebuild needs attention" : "Exact idle"}
          </span>
        </div>
        {exactRebuildFailure && <section className="cad-exact-recovery" role="alert" aria-label="Exact operation recovery">
          <span>EXACT OPERATION PAUSED</span>
          <strong>{exactRebuildFailure.message}</strong>
          <small>The last valid solid remains visible. Fix the inputs, retry, or suppress only the failing history feature.</small>
          <button onClick={() => void runKernel()}>Retry</button>
          <button className="accent" onClick={suppressFailedExactFeature}>{exactRebuildFailure.featureId ? "Suppress failing feature" : "Dismiss"}</button>
        </section>}
      </>)}
      {view === "sketch" && (
        <div className={`cad-plane-pill${activeSketchPlaneId === WORLD_PLANE_ID ? "" : " off-world"}`} title="Active sketch plane">
          <i />
          <span>Plane</span>
          <select
            value={activeSketchPlaneId}
            onChange={(event) => { setActiveSketchPlaneId(event.target.value); setStatus(`Active plane · ${planeById(sketchPlanes, event.target.value).name}`); }}
            aria-label="Active sketch plane"
          >
            {sketchPlanes.map((plane) => <option key={plane.id} value={plane.id}>{plane.name}</option>)}
          </select>
          {activeSketchPlaneId !== WORLD_PLANE_ID && (
            <em title="Plane origin (world)">@ {activePlane.origin.map((value) => value.toFixed(1)).join(", ")}</em>
          )}
          {activeSketchPlaneId !== WORLD_PLANE_ID && <>
            <button type="button" title="Rotate plane 90° around its normal" onClick={() => {
              setSketchPlanes((current) => current.map((plane) => {
                if (plane.id !== activeSketchPlaneId) return plane;
                const u = new THREE.Vector3(...plane.u);
                const v = new THREE.Vector3(...plane.v);
                return { ...plane, u: [v.x, v.y, v.z], v: [-u.x, -u.y, -u.z] };
              }));
              setStatus("Plane rotated 90°");
            }}>↻</button>
            <button type="button" title="Delete this plane" onClick={() => {
              const dependents = entities.filter((entity) => entity.sketchPlaneId === activeSketchPlaneId);
              if (dependents.length > 0) {
                const ok = window.confirm(`${dependents.length} entities are on this plane. Reassign them to World XY?`);
                if (!ok) return;
                setEntities((current) => current.map((entity) => entity.sketchPlaneId === activeSketchPlaneId ? { ...entity, sketchPlaneId: WORLD_PLANE_ID } : entity));
              }
              const deletedId = activeSketchPlaneId;
              setSketchPlanes((current) => current.filter((plane) => plane.id !== deletedId));
              setActiveSketchPlaneId(WORLD_PLANE_ID);
              setStatus(dependents.length > 0
                ? `Plane deleted · ${dependents.length} entities reassigned to World XY`
                : "Plane deleted · reverted to World XY");
            }}>✕</button>
          </>}
        </div>
      )}
      {activeEdit && selected && (
        <div className="cad-live-hud" style={{ left: activeEdit.screenX + 14, top: Math.max(4, activeEdit.screenY - 34) }}>
          {activeEdit.phase === "dragging" ? (
            <span>{handleReadout(selected, activeEdit.handle, units, precision)}</span>
          ) : (
            <input
              autoFocus
              value={activeEdit.buffer}
              onChange={(event) => setActiveEdit((prev) => prev ? { ...prev, buffer: event.target.value } : prev)}
              onKeyDown={(event) => {
                if (event.key === "Enter") { event.preventDefault(); commitTypedEdit(); }
                else if (event.key === "Escape") { event.preventDefault(); revertEdit(); }
              }}
              onBlur={() => setActiveEdit(null)}
              aria-label="Exact value"
            />
          )}
        </div>
      )}
      <button className={`cad-release-gate ${designValidation.phase}`} onClick={exportManufacturingReport} title="Export the current manufacturing release report">
        <span>DESIGN</span><strong>{designValidation.score ?? "—"}</strong><em>{designValidation.label}</em>
      </button>
      <div className="cad-origin">X <i /> Y</div>
      {!toolShelf.open && !selectionHudContent && view !== "drawing" && recommendedSmartActions.length > 0 && <section className="cad-smart-hud" aria-label="Smart actions">
        <header><span>NEXT</span><strong>{recommendedSmartActions[0].reason}</strong></header>
        <div>{recommendedSmartActions.slice(0, 3).map((action, index) => <button aria-label={`Next action ${index + 1}: ${action.detail}`} className={index === 0 ? "primary" : ""} key={action.id} title={`${action.label} · ${action.reason}`} onClick={() => executeSmartAction(action.id)}><span>{action.label}</span><small>{action.detail}</small></button>)}</div>
      </section>}
      <div className="cad-command">
        <span><UiIcon name="magic" /></span>
        <input
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") executeCommand();
            if (event.key === "ArrowUp" && commandHistory[0]) setCommand(commandHistory[0]);
          }}
          placeholder={view === "model" ? "Ask Form…  Add 4 mm fillet to all edges" : view === "drawing" ? "Ask Form…  Create a section and dimension the selected body" : "Ask Form…  Create a mounting bracket 80 × 50 × 6 mm"}
          aria-label="Precision CAD command"
        />
        <button onClick={() => executeCommand()}>Apply</button>
      </div>
      <details className="cad-command-more"><summary>Generators</summary><div aria-label="One-click production briefs">{DESIGN_COPILOT_CAPABILITIES.filter((capability) => capability.id !== "vector").map((capability) => <button key={capability.id} title={`${capability.promise} Example: ${capability.example}`} onClick={() => executeCommand(capability.example)}>{capability.label}</button>)}</div></details>
      {meshCommandPreview && <section className="cad-intent-preview" aria-label="Mesh edit preview" onKeyDown={e=>{if(e.key==="Escape")setMeshCommandPreview(null);}}>
        <header><strong>{meshCommandPreview.op === "extrude" ? "Extrude" : "Inset"} selection</strong></header>
        <p>{meshCommandPreview.faces.length} cage faces · {meshCommandPreview.amount} mm. The viewport shows the proposed geometry; your saved model is unchanged.</p>
        {!meshPreviewCurrent(meshCommandPreview, meshFeatures.find(f=>f.id===meshCommandPreview.targetId), selectedMeshId, selectedMeshFaces) && <p role="alert">Selection or geometry changed. Cancel and preview again.</p>}
        <footer><button onClick={()=>setMeshCommandPreview(null)}>Cancel mesh preview</button><button onClick={acceptMeshCommandPreview}>Apply mesh edit</button></footer>
      </section>}
      {copilotPreview && <div className="cad-intent-preview" role="dialog" aria-label="Design Copilot editable plan">
        <header><span>DESIGN COPILOT · EDITABLE PLAN</span><button aria-label="Cancel plan" onClick={() => setCopilotPreview(null)}>✕</button></header>
        <strong>{copilotPreview.summary}</strong>
        <p>{copilotPreview.command}</p>
        <div>{copilotPreview.actions.map((action) => <b key={action}>{action}</b>)}</div>
        <footer><button onClick={() => setCopilotPreview(null)}>Cancel</button><button className="accent" onClick={applyCopilotPreview}>Apply design</button></footer>
      </div>}
      <footer className="cad-statusbar">
        <div className="cad-status" role="status" aria-label="Workspace status" aria-live="polite"><i />{view === "drawing" && /Under-constrained|Fully constrained|degrees of freedom/.test(status) ? `${activeDocumentSheet.title} · ${activeDocumentIsProduction ? "Exact model views" : "Live-linked source"}` : status}</div>
        <div className="cad-coordinates">X {fmt(fromMillimeters(cursor.x, units), precision)} &nbsp; Y {fmt(fromMillimeters(cursor.y, units), precision)} &nbsp; Z {fmt(0, precision)}</div>
        <button className={snap ? "active" : ""} onClick={() => setSnap((value) => !value)}>Snap</button>
        <button className={ortho ? "active" : ""} onClick={() => setOrtho((value) => !value)}>Ortho</button>
        <span>Grid {fmt(fromMillimeters(grid, units), precision)} {units}</span>
        <span>{activePlane.name}</span>
        {view === "model" && <span className={`cad-status-exact ${exactBuildState}`}>{exactBuildState === "building" ? "Exact rebuilding" : exactBuildState === "ready" ? `${exactMeshes.length} exact ${exactMeshes.length === 1 ? "body" : "bodies"}` : exactBuildState === "error" ? "Exact needs review" : "Exact idle"}</span>}
        <div className="cad-zoom"><button aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(1.5, value - 0.5))}>−</button><span>{Math.round(zoom * 24)}%</span><button aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(12, value + 0.5))}>＋</button></div>
      </footer>
    </main>

    <aside id="cad-properties" aria-label="Properties" className={`cad-inspector ${inspectorMode}-mode${view === "sketch" && !sketchAdvanced ? " sketch-simple" : ""}`} data-property-scope={inspectorExpanded ? "all" : "focused"} data-selection-context={view === "sketch" ? "sketch" : view === "drawing" ? "drawing" : selectedMeshId ? "mesh" : "exact"} onKeyDown={event => { if (compact && event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); setInspectorCollapsed(true); document.querySelector<HTMLButtonElement>(".cad-phone-inspector-toggle")?.focus({ preventScroll: true }); } }}>
      <button className="cad-phone-inspector-close" aria-label="Close properties" title="Close properties" onClick={() => { setInspectorCollapsed(true); document.querySelector<HTMLButtonElement>(".cad-phone-inspector-toggle")?.focus({ preventScroll: true }); }}><UiIcon name="close" /></button>
      <UiResizeHandle axis="x" value={view === "drawing" ? documentUi.layout.inspectorSize : workspaceUi.layout.inspectorSize} min={300} max={560} invert onChange={(value) => (view === "drawing" ? documentUi : workspaceUi).update("inspectorSize", value)} label={view === "drawing" ? "Resize Document inspector" : "Resize CAD inspector"} />
      <div className="cad-panel-head"><span>{view === "drawing" ? "DOCUMENT" : view === "sketch" ? "SKETCH" : "PROPERTIES"}</span><strong>{view === "drawing" ? activeDocumentSheet.title : view === "sketch" ? sketchTargets.length ? "Edit your selection" : "Select or import artwork" : selectedMesh ? selectedMesh.feature.name : selected ? `${selected.type[0].toUpperCase()}${selected.type.slice(1)}` : "Nothing selected"}</strong></div>
      <div className="cad-scroll">
        {view === "sketch" && <SketchWorkbench objects={sketchItems} selectedIds={sketchTargets} unit={units} precision={precision} bounds={sketchSelectionBounds} locked={sketchSelectionLocked}
          mode={sketchSelectionMode} onMode={(mode) => { setSketchSelectionMode(mode); setTool("select"); setActiveEdit(null); setSketchDrag(null); if (mode === "segment") setSelectedEntityIds(selectedId ? [selectedId] : []); }}
          onSelect={selectSketchObject} onClear={() => { setSelectedId(""); setSelectedEntityIds([]); }} onSelectAll={selectAllSketchObjects} onFit={() => fitSketch()}
          onTransform={transformSketchSelection} onDelete={deleteSketchSelection} onDuplicate={duplicateSketchSelection} onOffset={() => { setTool("offset"); pinToolShelf(); setStatus("Set the Offset distance in the tool shelf, then click the outline"); }}
          onImport={() => svgImportRef.current?.click()} onTrace={() => rasterImportRef.current?.click()} importWidth={vectorWidthMm} onImportWidth={(value) => { if (value > 0 && value <= 100000) setVectorWidthMm(value); else setStatus("Import width must be greater than 0 and at most 100000 mm"); }}
          depth={quickExtrudeDepth} onDepth={setQuickExtrudeDepth} onExtrude={makeSketch3D}>
          <label>Trace contrast<input aria-label="Trace contrast" type="range" min="4" max="180" value={traceContrast} onChange={(event) => setTraceContrast(Number(event.target.value))}/></label>
          {lastTracedSvg && <button onClick={() => download(lastTracedSvg.contents, lastTracedSvg.name, "image/svg+xml")}>Save traced SVG</button>}
        </SketchWorkbench>}
        {view === "sketch" && <button className="sketch-advanced-toggle" aria-expanded={sketchAdvanced} onClick={() => setSketchAdvanced(!sketchAdvanced)}>{sketchAdvanced ? "Hide advanced properties" : "Constraints, history & advanced tools"}</button>}
        {view === "drawing" ? <DocumentInspector panel={documentPanel} onPanel={setDocumentPanel}>
          {documentPanel === "sheet" && <>
            <section className="form-document-fields"><details className="form-document-link" open={documentLinkOpen} onToggle={(event) => setDocumentLinkOpen(event.currentTarget.open)}><summary>Add linked content</summary><label>Source<select aria-label="Add linked content" value="" onChange={(event) => {
              const source = JSON.parse(event.target.value) as SheetSource;
              const title = source.kind === "fabric" ? source.itemId ? embeddedGarment?.pieces.find((p) => p.id === source.itemId)?.name : `${embeddedGarment?.name} patterns` : source.kind === "sketch" ? sketchPlanes.find((p) => p.id === source.id)?.name : meshFeatures.find((m) => m.id === source.id)?.name;
              addLinkedDocument(source, title ?? "Linked sheet");
            }}><option value="" disabled>Choose content…</option>{embeddedGarment && <optgroup label="Clothing Lab"><option value={JSON.stringify({ kind: "fabric", id: embeddedGarment.id })}>All garment patterns</option>{embeddedGarment.pieces.map((p) => <option key={p.id} value={JSON.stringify({ kind: "fabric", id: embeddedGarment.id, itemId: p.id })}>{p.name}</option>)}</optgroup>}<optgroup label="Sketch planes">{sketchPlanes.filter((p) => entities.some((e) => (e.sketchPlaneId ?? WORLD_PLANE_ID) === p.id)).map((p) => <option key={p.id} value={JSON.stringify({ kind: "sketch", id: p.id })}>{p.name}</option>)}</optgroup><optgroup label="Mesh models">{meshFeatures.map((m) => <option key={m.id} value={JSON.stringify({ kind: "mesh", id: m.id })}>{m.name}</option>)}</optgroup></select></label><p>CAD and BIM already have model sheets. Add patterns, sketches or meshes here; save the Form project to keep source links.</p></details></section>
            {activeDocumentIsProduction ? <section className="form-document-fields">
              <h3>Sheet settings</h3>
              <label>Scale<DrawingScaleInput key={activeSheetLayout.id} value={activeDrawingScale} onCommit={(value) => { updateSheetLayout({ ...activeSheetLayout, scale: value }); setStatus(`Sheet scale updated · ${value} · other sheets unchanged`); }} /></label>
              <label>Revision<input aria-label="Drawing revision" value={drawingRevision} onChange={(event) => setDrawingRevision(event.target.value.toUpperCase())} /></label>
              <label>Units<select aria-label="Drawing units" value={units} onChange={(event) => setUnits(event.target.value as CadUnit)}><option value="mm">Millimeters</option><option value="cm">Centimeters</option><option value="m">Meters</option><option value="in">Inches</option><option value="ft">Feet</option></select></label>
              <p>1:2 prints the model at half size. Dimensions show actual model measurements.</p>
            </section> : <section className="form-document-fields"><h3>Linked sheet</h3><p>{isBimSheet(activeSheetLayout) ? "Editable layout linked to BIM bounds and spans. Coordination diagram, not exact construction linework." : activeSheetLayout.source?.kind === "fabric" ? "Pattern outlines, seam allowance and grain lines. For full-size cutting and construction details, use Clothing Lab’s apparel exports." : activeSheetLayout.source?.kind === "mesh" ? "Committed mesh in world space. All-edge review views, not exact hidden-line CAD drawings." : "Sketch geometry in local plane coordinates. No 3D solid required."}</p><label>Scale<select aria-label={isBimSheet(activeSheetLayout) ? "BIM drawing scale" : "Linked drawing scale"} value={activeSheetLayout.scale ?? "1:100"} onChange={(e) => updateSheetLayout({ ...activeSheetLayout, scale: e.target.value })}>{["1:1", "1:2", "1:5", "1:10", "1:20", "1:50", "1:100", "1:200", "1:500", "1:1000", "1:2000", "1:5000", "1:10000"].map((s) => <option key={s}>{s}</option>)}</select></label><label>Revision<input aria-label="Drawing revision" value={drawingRevision} onChange={(e) => setDrawingRevision(e.target.value.toUpperCase())} /></label></section>}
            {sheetEditor("sheet")}
          </>}
          {documentPanel === "export" && <section className="form-document-exports">
            <h3>Export {activeDocumentSheet.title}</h3><p>{activeDocumentSheet.detail}</p>
            {(!activeDocumentSheet.svg || (activeDocumentIsProduction && drawingOutputBlocked)) && <p role="status">{activeDocumentIsProduction ? "Generate current views before exporting." : "Restore the linked source before exporting."}</p>}
            {activeSheetErrors.length > 0 && <p role="status">{activeSheetErrors.length} layout or reference issues. <button onClick={() => setDocumentPanel("review")}>Review issues</button></p>}
            <button disabled={!activeDocumentSheet.svg || (activeDocumentIsProduction && drawingOutputBlocked)} onClick={exportActiveDocumentSheet}><UiIcon name="upload" />Export sheet <small>SVG</small></button>
            <p>Scalable artwork at the selected physical paper size.</p>
            <button disabled={!activeDocumentSheet.svg || (activeDocumentIsProduction && drawingOutputBlocked)} onClick={exportActiveSheetDxf}><UiIcon name="draw" />Active sheet <small>DXF</small></button>
            <p>Editable linework and text in paper millimeters. Live model associations stay in the Form project.</p>
            <button disabled={!activeDocumentSheet.svg || (activeDocumentIsProduction && drawingOutputBlocked)} onClick={printDrawing}><UiIcon name="rectangle" />Print / PDF</button>
            <p>Use matching paper, 100% / Actual size and no browser headers. Save as PDF through the system print dialog.</p>
            {activeDocumentIsProduction && <button disabled={!productionDrawingSheet || drawingOutputBlocked} onClick={exportFabricationReview}>Export shop review <small>JSON</small></button>}
            <details className="form-document-advanced"><summary>Model-space output</summary><button onClick={exportDXF}>Sketch drawing <small>DXF · model mm</small></button><p>This exports Sketch geometry, not the sheet layout.</p></details>
            <p>{activeSheetLayout.source?.kind === "fabric" ? "For cutting patterns with construction details, use Clothing Lab’s apparel exports. This sheet is for review." : "Internal review is not external fabrication or construction approval."}</p>
          </section>}
          {documentPanel === "annotations" && <>
            {sheetEditor("annotations")}
            <details className="form-sheet-legacy"><summary>Sketch / DXF annotations</summary>
            <section className="form-document-fields"><h3>Editable drawing annotations</h3><p>Model-space XY notes, linear dimensions and leaders can sync to a production sheet’s Top view using the switch above. Blocks and hatches remain in Sketch DXF. BIM sheets use their own on-sheet annotations.</p><label>Source<select aria-label="Annotation source" value={selected?.id ?? ""} onChange={(event) => { setSelectedId(event.target.value); setSelectedEntityIds(event.target.value ? [event.target.value] : []); }}><option value="">Choose geometry</option>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.type} · {entity.id}</option>)}</select></label></section>
            <CadDraftingPanel document={drafting} selectedEntity={selected} activeLayer={activeLayer} scale={activeDrawingScale} revision={drawingRevision} onDocument={setDrafting} onScale={(scale) => updateSheetLayout({ ...activeSheetLayout, scale })} onRevision={setDrawingRevision} onStatus={setStatus} onExportDxf={exportDXF} onExportSvg={() => void runKernel("svg")} onExportReview={exportFabricationReview} embedded />
            </details>
          </>}
          {documentPanel === "review" && <>
            <section className="form-document-summary"><UiIcon name="inspector" /><h3>Review before release</h3><p>Internal checks are guidance, not external fabrication approval.</p></section>
            <div className="form-sheet-issues">{[...activeSheetErrors, ...(activeDocumentIsProduction ? productionDrawingSheet?.validation.warnings ?? [] : [])].map((message, index) => <p key={index}>{message}</p>)}</div>
            {activeDocumentIsProduction ? <><ul className="form-document-checks">{drawingReadiness.gates.map((gate) => <li key={gate.id} data-state={gate.state}><span aria-hidden="true">{gate.state === "pass" ? "✓" : "!"}</span><div><strong>{gate.label}</strong><p>{gate.detail}</p></div><small>{gate.state}</small></li>)}</ul><button className="form-document-review-export" disabled={!productionDrawingSheet || drawingOutputBlocked} onClick={exportFabricationReview}>Export shop review</button></> : isBimSheet(activeSheetLayout) ? <section><h3>BIM coordination</h3><p>{architectureDocuments.audit.valid ? "Graph checks passed" : "Graph checks require attention"}</p>{[...architectureDocuments.audit.errors, ...architectureDocuments.audit.warnings].map((message, index) => <p key={index}>{message}</p>)}</section> : <section><h3>Linked source review</h3><p>Check dimensions and construction details in the source workspace. These sheets document geometry; they do not certify fit, drape, strength or manufacturing readiness.</p></section>}
          </>}
        </DocumentInspector> : <>
        <div className="cad-selection-context" aria-label="Selection context">
          <strong>{selectedMeshId ? describeSelection(meshSelection) : selectedTopologyIds.length ? `${selectedTopologyIds.length} ${pickMode === "edge" ? "edge" : "face"} selected` : selectedEntityIds.length ? `${selectedEntityIds.length} object${selectedEntityIds.length === 1 ? "" : "s"} selected` : "No selection"}</strong>
          <span>{view === "sketch" ? "Draw a closed profile, finish, then set its depth." : selectedMeshId ? "Edit the mesh or add an editable modifier below." : pickMode === "edit-face" ? "Orange: selected · mint: hover. Drag the handle or type a distance." : pickMode === "edge" ? "Shift-click adds edges. Apply Fillet or Chamfer." : "Select a body to move it, or switch to Face to push and pull."}</span>
          <button aria-expanded={inspectorExpanded} onClick={() => setInspectorExpanded((value) => !value)}>{inspectorExpanded ? "Use focused properties" : "Show all properties"}</button>
        </div>
      {view === "model" && pickMode === "entity" && !selectedMeshId && ((selected && selected.type !== "line") || importedBodies.some((body) => body.id === selectedId)) && <section className="cad-direct-transform" aria-label="Exact body placement">
        <header><span>DIRECT MOVE</span><strong>{selectedEntityIds.length > 1 ? `${selectedEntityIds.length} BODIES` : selectedId}</strong><small>Drag the XYZ gizmo or type an exact position</small></header>
        <div>
          {(["X", "Y", "Z"] as const).map((axis, index) => <label key={axis}><span>{axis}</span><ExactLengthInput label={`Body position ${axis}`} value={selectedBodyPosition[index]} unit={units} precision={precision} onCommit={(value) => setSelectedBodyPosition(index as 0 | 1 | 2, value)} /><em>{units}</em></label>)}
          <button disabled={selectedBodyPosition.every((value) => Math.abs(value) < 1e-9)} onClick={() => translateSelectedBodies(selectedBodyPosition.map((value) => -value) as Triple)}>Reset</button>
        </div>
        <footer><kbd>G</kbd> move · axis keys constrain · drag snaps 1 mm · typed values accept mm, cm, in, and ft</footer>
      </section>}
        <nav className="cad-inspector-mode" aria-label="Property scope">
          <button className={inspectorMode === "core" ? "active" : ""} onClick={() => setInspectorMode("core")}><b>Core</b><small>Model · Sketch · Document</small></button>
          <button className={inspectorMode === "specialist" ? "active" : ""} onClick={() => setInspectorMode("specialist")}><b>Specialist</b><small>BIM · engineering · recipes</small></button>
        </nav>
        <CadInspectorNav appearanceAvailable={view === "model"} geometryAvailable={Boolean(selected) && !selectedMeshId} onNavigate={(category) => { if (category === "constraints" || category === "manufacturing") setInspectorExpanded(true); }} />
        {selected && <section id="inspector-geometry">
          <h3>Exact geometry</h3>
          <label>Origin X<ExactLengthInput label="Origin X" value={selected.a.x} unit={units} precision={precision} onCommit={(value) => updateSelectedPosition("x", value)} /><em>{units}</em></label>
          <label>Origin Y<ExactLengthInput label="Origin Y" value={selected.a.y} unit={units} precision={precision} onCommit={(value) => updateSelectedPosition("y", value)} /><em>{units}</em></label>
          {selected.type === "rectangle" && <>
            <label>Width<ExactLengthInput label="Width" value={Math.abs(selected.b.x - selected.a.x)} unit={units} precision={precision} onCommit={(value) => updateSelected("width", value)} /><em>{units}</em></label>
            <label>Height<ExactLengthInput label="Height" value={Math.abs(selected.b.y - selected.a.y)} unit={units} precision={precision} onCommit={(value) => updateSelected("height", value)} /><em>{units}</em></label>
          </>}
          {selected.type === "circle" && <>
            <label>Radius<ExactLengthInput label="Radius" value={length(selected.a, selected.b)} unit={units} precision={precision} onCommit={(value) => updateSelected("radius", value)} /><em>{units}</em></label>
            <label>Diameter<ExactLengthInput label="Diameter" value={length(selected.a, selected.b) * 2} unit={units} precision={precision} onCommit={(value) => updateSelected("radius", value / 2)} /><em>{units}</em></label>
          </>}
          {selected.type === "line" && <label>Length<ExactLengthInput label="Length" value={length(selected.a, selected.b)} unit={units} precision={precision} onCommit={(value) => updateSelected("length", value)} /><em>{units}</em></label>}
          {selected.type !== "circle" && <label>Angle<input type="number" step="0.01" value={fmt(entityAngle(selected), precision)} onChange={(event) => updateSelectedAngle(Number(event.target.value))} /><em>°</em></label>}
          <div className="cad-constraints" aria-label="Driving geometry constraints">{geometricConstraints.filter((constraint) => constraint.entityIds.includes(selected.id)).map((constraint) => {
            const label = constraint.kind === "fixed" ? "Fixed" : constraint.kind.replaceAll("-", " ");
            return <button key={constraint.id} title={`Remove ${label} constraint`} onClick={() => constraint.kind === "fixed" ? setSelectedGeometryFixed(false) : setGeometricConstraints((current) => current.filter((item) => item.id !== constraint.id))}>◆ {label}{constraint.value === undefined ? "" : ` · ${constraint.kind === "fixed-angle" ? `${fmt(constraint.value, precision)}°` : formatCadLength(constraint.value, units, precision)}`} ×</button>;
          })}{!geometricConstraints.some((constraint) => constraint.kind === "fixed" && constraint.entityIds[0] === selected.id) && <button onClick={() => setSelectedGeometryFixed(true)}>＋ Fix geometry</button>}</div>
          {!geometricConstraints.some((constraint) => constraint.entityIds.includes(selected.id)) && <small>No driving constraints · dimensions remain editable</small>}
          <button className="cad-delete" onClick={() => {
            if (selectedLinkedGroup) deleteLinkedGroup(selectedLinkedGroup.id);
            else {
              setEntities((current) => current.filter((entity) => entity.id !== selected.id));
              setSelectedId("");
            }
          }}>{selectedLinkedGroup ? "Delete linked group" : "Delete entity"}</button>
        </section>}
        {view === "model" && <div id="inspector-appearance"><AppearancePanel
          appearance={appearance}
          onAppearanceChange={setAppearance}
          onStatus={setStatus}
          onExportPng={exportViewportPng}
        /></div>}
        <section id="inspector-design">
          <h3>Document precision</h3>
          <label>Units<select value={units} onChange={(event) => setUnits(event.target.value as CadUnit)}><option value="mm">Millimeters</option><option value="cm">Centimeters</option><option value="m">Meters</option><option value="in">Inches</option><option value="ft">Feet</option></select></label>
          <label>Precision<select value={precision} onChange={(event) => setPrecision(Number(event.target.value))}><option value="0">0</option><option value="1">0.0</option><option value="2">0.00</option><option value="3">0.000</option><option value="4">0.0000</option></select></label>
          <label>Grid<ExactLengthInput label="Grid spacing" value={grid} unit={units} precision={precision} onCommit={(value) => setGrid(Math.max(0.001, value))} /><em>{units}</em></label>
          <p>Canonical geometry: millimeters · display conversion is non-destructive.</p>
        </section>
        <section className={`cad-domain-section ${designDiscipline}`} id="inspector-specialist">
          <div className="cad-section-title"><h3>Design workspaces</h3><span>SEMANTIC CAD</span></div>
          <div className="cad-domain-tabs" role="tablist" aria-label="Design discipline">
            {DESIGN_PACKS.map((pack) => <button
              aria-selected={designDiscipline === pack.id}
              className={designDiscipline === pack.id ? "active" : ""}
              key={pack.id}
              onClick={() => {
                const firstRecipe = DOMAIN_RECIPES.find((recipe) => recipe.discipline === pack.id)!;
                setDesignDiscipline(pack.id);
                setDomainRecipeKind(firstRecipe.kind);
                setDomainParameters(domainDefaults(firstRecipe.kind));
              }}
              role="tab"
            ><b>{pack.icon}</b><span>{pack.name}<small>{pack.tagline}</small></span></button>)}
          </div>
          <div className="cad-domain-recipes">
            {activeDomainRecipes.map((recipe) => <button
              className={domainRecipeKind === recipe.kind ? "active" : ""}
              key={recipe.kind}
              onClick={() => {
                const next = domainRecipeKind === recipe.kind ? domainParameters : domainDefaults(recipe.kind);
                createDomainObject(recipe.kind, next);
              }}
            ><b>{recipe.icon}</b><span>{recipe.name}<small>{recipe.description}</small></span></button>)}
          </div>
          <div className="cad-domain-parameters">
            <label>{domainLabels.width}<ExactLengthInput label={domainLabels.width} value={domainParameters.width} unit={units} precision={precision} onCommit={(value) => setDomainParameters((current) => ({ ...current, width: value }))} /><em>{units}</em></label>
            <label>{domainLabels.height}<ExactLengthInput label={domainLabels.height} value={domainParameters.height} unit={units} precision={precision} onCommit={(value) => setDomainParameters((current) => ({ ...current, height: value }))} /><em>{units}</em></label>
            <label>{domainLabels.depth}<ExactLengthInput label={domainLabels.depth} value={domainParameters.depth} unit={units} precision={precision} onCommit={(value) => setDomainParameters((current) => ({ ...current, depth: value }))} /><em>{units}</em></label>
            <label>{domainLabels.wall}<ExactLengthInput label={domainLabels.wall} value={domainParameters.wall} unit={units} precision={precision} onCommit={(value) => setDomainParameters((current) => ({ ...current, wall: value }))} /><em>{units}</em></label>
            <label>Count<input aria-label="Domain element count" type="number" min="1" max="64" value={domainParameters.count} onChange={(event) => setDomainParameters((current) => ({ ...current, count: Math.max(1, Number(event.target.value)) }))} /><em>×</em></label>
            <label>Clearance<ExactLengthInput label="Domain clearance" value={domainParameters.clearance} unit={units} precision={precision} onCommit={(value) => setDomainParameters((current) => ({ ...current, clearance: value }))} /><em>{units}</em></label>
          </div>
          {activeDomainChecks.length > 0 && <div className="cad-domain-checks">{activeDomainChecks.map((check, index) => <span className={check.severity} key={`${index}-${check.message}`}>{check.severity === "pass" ? "✓" : "!"} {check.message}</span>)}</div>}
          <button className="cad-domain-generate" onClick={() => createDomainObject(domainRecipeKind, domainParameters)}>Generate editable {DOMAIN_RECIPES.find((recipe) => recipe.kind === domainRecipeKind)?.name}</button>
          <p>One exact model can drive geometry, reusable components, process checks, assemblies, quantities and drawings.</p>
        </section>
        {designDiscipline === "jewelry" && <section className="cad-jewelry-pro">
          <div className="cad-section-title"><h3>Jewelry Pro</h3><span>CAST + SET</span></div>
          <p className="cad-jewelry-lead">A production ring from one editable specification—sizing, stone, setting, alloy, casting compensation and customer variants.</p>
          <div className="cad-jewelry-size">
            <label>Ring standard<select value={jewelrySpec.ringSystem} onChange={(event) => setJewelrySpec((current) => ({ ...current, ringSystem: event.target.value as JewelrySpec["ringSystem"] }))}>{(["US", "EU", "UK", "JP"] as const).map((system) => <option key={system}>{system}</option>)}</select></label>
            <label>Size<input type="number" step="0.5" value={jewelrySpec.ringSize} onChange={(event) => setJewelrySpec((current) => ({ ...current, ringSize: Number(event.target.value) }))} /></label>
          </div>
          <div className="cad-jewelry-shapes" aria-label="Stone shape">
            {STONE_SHAPES.map((shape) => <button className={jewelrySpec.stoneShape === shape.id ? "active" : ""} key={shape.id} onClick={() => setJewelrySpec((current) => ({ ...current, stoneShape: shape.id }))}><b>{shape.icon}</b><span>{shape.name}</span></button>)}
          </div>
          <div className="cad-jewelry-settings" aria-label="Setting style">
            {SETTING_STYLES.map((setting) => <button className={jewelrySpec.settingStyle === setting.id ? "active" : ""} key={setting.id} onClick={() => setJewelrySpec((current) => ({ ...current, settingStyle: setting.id }))}><b>{setting.name}</b><small>{setting.description}</small></button>)}
          </div>
          <div className="cad-jewelry-dimensions">
            <label>Stone length<ExactLengthInput label="Stone length" value={jewelrySpec.stoneLength} unit={units} precision={precision} onCommit={(value) => setJewelrySpec((current) => ({ ...current, stoneLength: value }))} /><em>{units}</em></label>
            <label>Stone width<ExactLengthInput label="Stone width" value={jewelrySpec.stoneWidth} unit={units} precision={precision} onCommit={(value) => setJewelrySpec((current) => ({ ...current, stoneWidth: value }))} /><em>{units}</em></label>
            <label>Band width<ExactLengthInput label="Band width" value={jewelrySpec.bandWidth} unit={units} precision={precision} onCommit={(value) => setJewelrySpec((current) => ({ ...current, bandWidth: value }))} /><em>{units}</em></label>
            <label>Band wall<ExactLengthInput label="Band wall" value={jewelrySpec.bandThickness} unit={units} precision={precision} onCommit={(value) => setJewelrySpec((current) => ({ ...current, bandThickness: value }))} /><em>{units}</em></label>
            <label>Setting height<ExactLengthInput label="Setting height" value={jewelrySpec.settingHeight} unit={units} precision={precision} onCommit={(value) => setJewelrySpec((current) => ({ ...current, settingHeight: value }))} /><em>{units}</em></label>
            <label>Seat clearance<ExactLengthInput label="Seat clearance" value={jewelrySpec.clearance} unit={units} precision={precision} onCommit={(value) => setJewelrySpec((current) => ({ ...current, clearance: value }))} /><em>{units}</em></label>
          </div>
          <div className="cad-jewelry-materials">
            <label>Alloy<select value={jewelrySpec.metal} onChange={(event) => setJewelrySpec((current) => ({ ...current, metal: event.target.value as JewelrySpec["metal"] }))}>{JEWELRY_METALS.map((metal) => <option key={metal.id} value={metal.id}>{metal.name}</option>)}</select></label>
            <label>Gem<select value={jewelrySpec.gemMaterial} onChange={(event) => setJewelrySpec((current) => ({ ...current, gemMaterial: event.target.value as JewelrySpec["gemMaterial"] }))}>{GEM_MATERIALS.map((gem) => <option key={gem.id} value={gem.id}>{gem.name}</option>)}</select></label>
            <label>Prongs<input type="number" min="2" max="12" value={jewelrySpec.prongCount} onChange={(event) => setJewelrySpec((current) => ({ ...current, prongCount: Number(event.target.value) }))} /></label>
            <label>Pavé stones<input type="number" min="0" max="48" value={jewelrySpec.paveCount} onChange={(event) => setJewelrySpec((current) => ({ ...current, paveCount: Number(event.target.value) }))} /></label>
            <label>Shrinkage %<input type="number" min="0" max="5" step="0.1" value={jewelrySpec.shrinkagePercent} onChange={(event) => setJewelrySpec((current) => ({ ...current, shrinkagePercent: Number(event.target.value) }))} /></label>
            <label>Variants<input type="number" min="1" max="9" value={jewelrySpec.variantCount} onChange={(event) => setJewelrySpec((current) => ({ ...current, variantCount: Number(event.target.value) }))} /></label>
          </div>
          <label className="cad-jewelry-engraving">Inner engraving<input value={jewelrySpec.engraving} maxLength={80} placeholder="Optional inscription" onChange={(event) => setJewelrySpec((current) => ({ ...current, engraving: event.target.value }))} /></label>
          <details className="cad-jewelry-costs"><summary>Cost assumptions</summary><div><label>Metal / gram<input type="number" min="0" value={jewelrySpec.metalCostPerGram} onChange={(event) => setJewelrySpec((current) => ({ ...current, metalCostPerGram: Number(event.target.value) }))} /></label><label>Stone / carat<input type="number" min="0" value={jewelrySpec.stoneCostPerCarat} onChange={(event) => setJewelrySpec((current) => ({ ...current, stoneCostPerCarat: Number(event.target.value) }))} /></label></div></details>
          <div className="cad-jewelry-metrics">
            <span><small>Finished ID</small><b>{jewelryPreview.finalInnerDiameter.toFixed(2)} mm</b></span>
            <span><small>Metal</small><b>{jewelryPreview.estimatedMetalWeightGrams.toFixed(2)} g</b></span>
            <span><small>Center stone</small><b>{jewelryPreview.estimatedStoneCarats.toFixed(2)} ct</b></span>
            <span><small>Materials</small><b>${jewelryPreview.estimatedMaterialCost.toFixed(0)}</b></span>
          </div>
          <div className="cad-jewelry-variants">{jewelryPreview.variants.map((variant) => <span key={variant.label}>{variant.label}<b>Ø {variant.innerDiameter.toFixed(2)}</b></span>)}</div>
          <div className="cad-domain-checks">{jewelryPreview.checks.map((check, index) => <span className={check.severity} key={`${index}-${check.message}`}>{check.severity === "pass" ? "✓" : "!"} {check.message}</span>)}</div>
          <button className="cad-jewelry-generate" onClick={() => createJewelryPiece(jewelrySpec)}>Generate production ring</button>
          <p className="cad-jewelry-command">Command ready: “US size 7 oval 8 x 6 mm halo ring in 18k yellow gold with 16 pavé stones”</p>
        </section>}
        <section className={`cad-pro-systems ${proTab}`}>
          <div className="cad-section-title"><h3>Professional systems</h3><span>TRUSTED PREVIEW</span></div>
          <div className="cad-capability-strip" aria-label="Capability maturity">
            {(["production", "beta", "experimental"] as const).map((maturity) => <span className={maturity} key={maturity} title={PRO_CAPABILITIES.filter((item) => item.maturity === maturity).map((item) => `${item.name}: ${item.evidence}${item.limitation ? ` — ${item.limitation}` : ""}`).join("\n")}><b>{PRO_CAPABILITIES.filter((item) => item.maturity === maturity).length}</b>{maturity}</span>)}
          </div>
          <div className="cad-pro-tabs" role="tablist" aria-label="Professional systems">
            {([[
              "engineering", "⚙", "Engineer"], ["architecture", "⌂", "BIM"], ["recipe", "⌘", "Recipes"], ["collaboration", "⑂", "Review"], ["performance", "ϟ", "Scale"]] as const).map(([tab, icon, label]) => <button role="tab" aria-selected={proTab === tab} className={proTab === tab ? "active" : ""} key={tab} onClick={() => setProTab(tab)}><b>{icon}</b><small>{label}</small></button>)}
          </div>

          {proTab === "engineering" && <div className="cad-pro-pane">
            <div className="cad-pro-kind">{(["thread", "gear", "spring"] as const).map((kind) => <button className={engineeringSpec.kind === kind ? "active" : ""} key={kind} onClick={() => setEngineeringSpec((current) => ({ ...current, kind }))}>{kind === "thread" ? "⌁ True thread" : kind === "gear" ? "⚙ Gear" : "∿ Spring"}</button>)}</div>
            <div className="cad-pro-fields">
              <label>Diameter<ExactLengthInput label="Engineering diameter" value={engineeringSpec.diameter} unit={units} precision={precision} onCommit={(value) => setEngineeringSpec((current) => ({ ...current, diameter: value }))} /></label>
              <label>Length<ExactLengthInput label="Engineering length" value={engineeringSpec.length} unit={units} precision={precision} onCommit={(value) => setEngineeringSpec((current) => ({ ...current, length: value }))} /></label>
              <label>Pitch / module<input type="number" min="0.1" step="0.05" value={engineeringSpec.kind === "gear" ? engineeringSpec.module : engineeringSpec.pitch} onChange={(event) => setEngineeringSpec((current) => ({ ...current, [current.kind === "gear" ? "module" : "pitch"]: Number(event.target.value) }))} /></label>
              <label>{engineeringSpec.kind === "gear" ? "Teeth" : "Wire Ø"}<input type="number" min="1" step={engineeringSpec.kind === "gear" ? 1 : 0.1} value={engineeringSpec.kind === "gear" ? engineeringSpec.teeth : engineeringSpec.wireDiameter} onChange={(event) => setEngineeringSpec((current) => current.kind === "gear" ? { ...current, teeth: Number(event.target.value) } : { ...current, wireDiameter: Number(event.target.value) })} /></label>
              <label>Load N<input type="number" min="0" value={engineeringSpec.load} onChange={(event) => setEngineeringSpec((current) => ({ ...current, load: Number(event.target.value) }))} /></label>
              <label>Yield MPa<input type="number" min="1" value={engineeringSpec.yieldStrength} onChange={(event) => setEngineeringSpec((current) => ({ ...current, yieldStrength: Number(event.target.value) }))} /></label>
              <label>+ tolerance<input type="number" min="0" step="0.01" value={engineeringSpec.tolerancePlus} onChange={(event) => setEngineeringSpec((current) => ({ ...current, tolerancePlus: Number(event.target.value) }))} /></label>
              <label>− tolerance<input type="number" min="0" step="0.01" value={engineeringSpec.toleranceMinus} onChange={(event) => setEngineeringSpec((current) => ({ ...current, toleranceMinus: Number(event.target.value) }))} /></label>
            </div>
            <p className="cad-sculpt-hint">Concept estimates only · not validated FEA or engineering approval.</p>
            <div className="cad-pro-metrics"><span><small>Beam estimate</small><b>{engineeringPreview.stressMpa.toFixed(2)} MPa</b></span><span><small>Deflection estimate</small><b>{engineeringPreview.deflectionMm.toFixed(4)} mm</b></span><span><small>Safety estimate</small><b>{engineeringPreview.factorOfSafety.toFixed(2)}×</b></span><span><small>RSS stack</small><b>±{engineeringPreview.rssTolerance.toFixed(3)}</b></span></div>
            <div className="cad-motion-study" title="Kinematic relationship preview; not a coupled dynamics solve">{engineeringPreview.motion.map((sample) => <i key={sample.time} style={{ height: `${15 + Math.abs(sample.outputDegrees) / Math.max(1, Math.abs(engineeringPreview.motion.at(-1)?.outputDegrees ?? 1)) * 28}px` }} />)}</div>
            <div className="cad-advanced-mate"><select value={advancedMateKind} onChange={(event) => setAdvancedMateKind(event.target.value as typeof advancedMateKind)}>{(["gear", "rack-pinion", "screw", "cam", "path"] as const).map((kind) => <option key={kind} value={kind}>{kind.replace("-", " / ")} mate</option>)}</select><input aria-label="Mate driver angle" type="number" value={motionDriver} onChange={(event) => setMotionDriver(Number(event.target.value))} /><span>{advancedMatePreview.rotation.toFixed(1)}° / {advancedMatePreview.translation.toFixed(2)} mm</span></div>
            <div className="cad-domain-checks">{engineeringPreview.checks.map((check, index) => <span className={check.severity} key={`${index}-${check.message}`}>{check.severity === "pass" ? "✓" : "!"} {check.message}</span>)}</div>
            <button className="cad-pro-primary" onClick={() => createEngineeringProPart(engineeringSpec)}>Generate exact {engineeringSpec.kind}</button>
          </div>}

          {proTab === "architecture" && <div className="cad-pro-pane">
            <div className="cad-bim-summary"><span><b>{architectureDocuments.audit.score}</b> graph audit</span><span><b>{architectureDocuments.audit.counts.storey}</b> levels</span><span><b>{architectureDocuments.audit.counts.space}</b> spaces</span><span><b>{architectureDocuments.plans.length + architectureDocuments.sections.length}</b> documents</span></div>
            <div className={`cad-bim-readiness ${architectureDocuments.audit.valid && architectureDocuments.documentAudit.valid && architectureDocuments.ifcValidation.ready ? "pass" : "error"}`}>
              <header><span><small>PRODUCTION GATE</small><b>{architectureDocuments.audit.valid && architectureDocuments.documentAudit.valid && architectureDocuments.ifcValidation.ready ? "Ready for IFC4 export" : "Coordination review required"}</b></span><em>IFC4</em></header>
              <div>
                <span><small>Graph</small><b>{architectureDocuments.audit.score}</b><i>{architectureDocuments.audit.valid ? "pass" : "blocked"}</i></span>
                <span><small>Documents</small><b>{architectureDocuments.documentAudit.score}</b><i>{architectureDocuments.documentAudit.valid ? "pass" : "blocked"}</i></span>
                <span><small>Exchange</small><b>{architectureDocuments.ifcValidation.score}</b><i>{architectureDocuments.ifcValidation.ready ? "pass" : "blocked"}</i></span>
              </div>
              <footer><span>{architectureDocuments.ifcValidation.productCount} products</span><span>{architectureDocuments.ifcValidation.relationshipCount} relationships</span><span>{(architectureDocuments.ifcValidation.geometryCoverage * 100).toFixed(0)}% geometry</span></footer>
              {[...architectureDocuments.documentAudit.errors, ...architectureDocuments.ifcValidation.errors].slice(0, 2).map((message) => <small className="cad-bim-gate-message" key={message}>{message}</small>)}
            </div>
            <div className={`cad-bim-audit ${architectureDocuments.audit.valid ? architectureDocuments.audit.warnings.length ? "warning" : "pass" : "error"}`}>
              <b>{architectureDocuments.audit.valid ? architectureDocuments.audit.warnings.length ? "Coordinated with warnings" : "Graph coordinated" : "Graph blocked"}</b>
              <span>{architectureDocuments.audit.errors.length} errors · {architectureDocuments.audit.warnings.length} warnings</span>
              {[...architectureDocuments.audit.errors, ...architectureDocuments.audit.warnings].slice(0, 2).map((message) => <small key={message}>{message}</small>)}
            </div>
            <div className="cad-bim-tree" aria-label="BIM object graph">{effectiveBimNodes.slice(0, 24).map((node) => <div className={selectedBimNodeId === node.id ? "selected" : ""} key={node.id}>
              <button className="cad-bim-node-button" onClick={() => setSelectedBimNodeId(node.id)}><b>{node.kind}</b><span>{node.name}</span></button>
              <select aria-label={`${node.name} phase`} value={node.phase} onChange={(event) => patchBimNode(node.id, { phase: event.target.value as BimNode["phase"] })}><option value="existing">existing</option><option value="new">new</option><option value="demolished">demolished</option></select>
            </div>)}</div>
            {selectedBimNode && <div className="cad-bim-editor">
              <header><span><b>{selectedBimNode.name}</b><small>{selectedBimNode.kind} · {selectedBimNode.id}</small></span><button aria-label="Close BIM property editor" onClick={() => setSelectedBimNodeId(null)}>×</button></header>
              <label>Name<input key={`${selectedBimNode.id}-name`} defaultValue={selectedBimNode.name} onBlur={(event) => patchBimNode(selectedBimNode.id, { name: event.target.value })} /></label>
              {(selectedBimNode.kind === "storey" ? [["elevation", "Elevation"], ["height", "Storey height"]]
                : selectedBimNode.kind === "wall" ? [["height", "Wall height"], ["thickness", "Thickness"]]
                : ["door", "window", "opening"].includes(selectedBimNode.kind) ? [["width", "Width"], ["height", "Height"], ["sill", "Sill"]]
                : selectedBimNode.kind === "space" ? [["height", "Room height"]] : []).map(([property, label]) => <label key={`${selectedBimNode.id}-${property}`}>{label}<input type="number" step="1" defaultValue={Number(selectedBimNode.properties[property] ?? 0)} onBlur={(event) => {
                  const value = Number(event.target.value);
                  if (!Number.isFinite(value) || (property !== "elevation" && property !== "sill" && value <= 0) || (property === "sill" && value < 0)) return setStatus(`${label} must be a valid ${property === "elevation" ? "number" : property === "sill" ? "non-negative length" : "positive length"}`);
                  patchBimNode(selectedBimNode.id, { properties: { [property]: value, ...((property === "height" && ["wall", "space"].includes(selectedBimNode.kind)) ? { heightMode: "unconnected" } : {}) } });
                }} /><em>mm</em></label>)}
              {selectedBimNode.kind === "wall" && <div className="cad-bim-computed"><span>Gross <b>{(Number(selectedBimNode.properties.grossArea ?? 0) / 1_000_000).toFixed(2)} m²</b></span><span>Openings <b>{(Number(selectedBimNode.properties.openingArea ?? 0) / 1_000_000).toFixed(2)} m²</b></span><span>Net <b>{(Number(selectedBimNode.properties.area ?? 0) / 1_000_000).toFixed(2)} m²</b></span></div>}
            </div>}
            <div className="cad-bim-documents" aria-label="Coordinated architecture documents">
              {architectureDocuments.plans.map((plan) => <button key={plan.id} onClick={() => openBimDocument(plan.id)}><object data={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(plan.svg)}`} type="image/svg+xml" aria-label={`${plan.name} preview`} /><span><b>{plan.name}</b><small>{plan.elementIds.length} elements · {(plan.grossArea / 1_000_000).toFixed(2)} m²</small></span></button>)}
              {architectureDocuments.sections.map((section) => <button key={section.id} onClick={() => openBimDocument(section.id)}><object data={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(section.svg)}`} type="image/svg+xml" aria-label={`${section.name} preview`} /><span><b>{section.name}</b><small>{section.spans.length} coordinated spans</small></span></button>)}
            </div>
            <div className="cad-bim-schedule">{architectureDocuments.schedule.map((row) => <span key={row.category}><b>{row.category}</b>{row.count} × · {(row.area / 1_000_000).toFixed(2)} m² · {(row.volume / 1_000_000_000).toFixed(2)} m³</span>)}</div>
            <div className="cad-bim-quantities">{architectureDocuments.quantities.slice(0, 5).map((row) => <span key={row.material}><b>{row.material}</b>{row.elements} elements · {(row.area / 1_000_000).toFixed(2)} m² · {(row.volume / 1_000_000_000).toFixed(2)} m³</span>)}</div>
            <div className="cad-pro-actions"><button onClick={refreshBimGraph}>Sync model</button><button onClick={addArchitectureLevel}>Add level</button><button onClick={() => ifcImportRef.current?.click()}>Import IFC4</button><button disabled={!architectureDocuments.plans[0]} onClick={() => architectureDocuments.plans[0] && openBimDocument(architectureDocuments.plans[0].id)}>Open plans</button><button disabled={!architectureDocuments.audit.valid || !architectureDocuments.documentAudit.valid || !architectureDocuments.ifcValidation.ready} title="IFC4 coordination export; release corpus is independently schema and EXPRESS validated, while project-specific downstream review remains required" onClick={exportIfc}>Export IFC4</button></div>
          </div>}

          {proTab === "recipe" && <div className="cad-pro-pane">
            <div className="cad-recipe-picker"><label>Generator<select value={activeRecipe.id} onChange={(event) => setActiveRecipeId(event.target.value)}>{recipeGraphs.map((graph) => <option key={graph.id} value={graph.id}>{graph.name} v{graph.version}</option>)}</select></label><button onClick={createRecipeGraph}>New graph</button></div>
            <label>Name<input value={activeRecipe.name} onChange={(event) => setRecipeGraphs((current) => current.map((graph) => graph.id === activeRecipe.id ? { ...graph, name: event.target.value } : graph))} /></label>
            <div className="cad-recipe-tools">{(["parameter", "circle", "rectangle", "extrude", "fillet", "boolean", "pattern", "output"] as const).map((kind) => <button key={kind} onClick={() => addRecipeNode(kind)}>+ {kind}</button>)}</div>
            <div className="cad-recipe-graph">{activeRecipe.nodes.map((node, index) => <div className={node.kind} key={node.id}><i>{index + 1}</i><span><b>{node.kind}</b><small>{node.id} · {node.inputs.join(" + ") || "input"}</small></span>{node.kind === "parameter" ? <input aria-label={`${node.id} value`} type="number" value={Number(node.values.value ?? 0)} onChange={(event) => setRecipeGraphs((current) => current.map((graph) => graph.id !== activeRecipe.id ? graph : { ...graph, nodes: graph.nodes.map((item) => item.id === node.id ? { ...item, values: { ...item.values, value: Number(event.target.value) } } : item) }))} /> : <button aria-label={`Remove ${node.id}`} onClick={() => setRecipeGraphs((current) => current.map((graph) => graph.id === activeRecipe.id ? { ...graph, version: graph.version + 1, nodes: graph.nodes.filter((item) => item.id !== node.id) } : graph))}>×</button>}</div>)}</div>
            <div className={`cad-recipe-result ${recipePreview.valid ? "valid" : "invalid"}`}><b>{recipePreview.valid ? "Graph valid" : "Graph blocked"}</b><span>{recipePreview.order.length} nodes · {recipePreview.entities.length} profiles · {recipePreview.features.length} features</span></div>
            <div className="cad-pro-actions"><button onClick={runRecipeGraph}>Run generator</button><button onClick={() => { const copy = structuredClone(activeRecipe); copy.id = `recipe-${id()}`; copy.name = `${copy.name} Copy`; copy.version = 1; copy.shared = false; setRecipeGraphs((current) => [...current, copy]); setActiveRecipeId(copy.id); }}>Duplicate</button><button onClick={() => { setMarketplace((current) => current.some((item) => item.graph?.id === activeRecipe.id) ? current : [...current, { id: `market-${activeRecipe.id}`, name: activeRecipe.name, category: "Recipe Graph", version: activeRecipe.version, downloads: 0, rating: 5, graph: { ...activeRecipe, shared: true } }]); setStatus(`${activeRecipe.name} saved to your local component library`); }}>Save to library</button></div>
            <div className="cad-marketplace" aria-label="Local component library">{marketplace.map((item) => <button key={item.id} onClick={() => item.graph && !recipeGraphs.some((graph) => graph.id === item.graph!.id) && setRecipeGraphs((current) => [...current, structuredClone(item.graph!)])}><b>{item.name}</b><span>{item.category} · local template v{item.version}</span></button>)}</div>
          </div>}

          {proTab === "collaboration" && <div className="cad-pro-pane">
            <div className="cad-branch"><label>Branch<input value={activeBranch} onChange={(event) => setActiveBranch(event.target.value)} /></label><label>Revision note<input value={revisionMessage} onChange={(event) => setRevisionMessage(event.target.value)} /></label><button onClick={checkpointRevision}>Create revision</button></div>
            <div className="cad-revisions">{revisions.length === 0 ? <p>No revisions yet. Create a checkpoint to begin review.</p> : revisions.slice().reverse().map((revision) => <article className={revision.status} key={revision.id}><b>{revision.branch} · {revision.id}</b><span>{revision.message}</span><small>{revision.status.replace("-", " ")} · {revision.approvals.length} approval(s)</small></article>)}</div>
            <div className="cad-pro-actions"><button onClick={() => reviewLatestRevision("request")}>Request review</button><button onClick={() => reviewLatestRevision("approve")}>Approve</button><button onClick={() => reviewLatestRevision("changes")}>Request changes</button><button onClick={exportArtistReview}>Export artist review</button></div>
          </div>}

          {proTab === "performance" && <div className="cad-pro-pane">
            <div className={`cad-native-engine ${nativeEngine.available ? "native" : "web"}`}><header><span><i />COMPUTE ENGINE</span><b>{nativeEngine.available ? "NATIVE" : "WEB FALLBACK"}</b></header><strong>{nativeEngine.runtime} · {nativeEngine.architecture}</strong><small>{nativeEngine.available ? `${nativeEngine.workerThreads} parallel workers · SIMD ${nativeEngine.simd ? "enabled" : "unavailable"} · ${nativeEngine.geometryBackend}` : "Install the standalone application to unlock compiled compute"}</small></div>
            <div className="cad-performance-head"><strong>{entities.length.toLocaleString()}</strong><span>{streamingWorkingSet.entityIds.length.toLocaleString()} resident · {streamingWorkingSet.deferredEntities.toLocaleString()} streamed · {(streamingWorkingSet.bytes / 1024 / 1024).toFixed(1)} MB estimate</span></div>
            <button className="cad-wide" disabled={productionCadBusy} onClick={() => void runProductionCadSelfTest()}>{productionCadBusy ? "Running production corpus…" : "Run production CAD self-test"}</button>
            {productionCadReport && <div className={`cad-production-benchmark ${productionCadReport.pass ? "pass" : "fail"}`} aria-label="Production CAD benchmark result"><header><b>{productionCadReport.pass ? "PRODUCTION GATE PASSED" : "PRODUCTION GATE FAILED"}</b><span>{productionCadReport.entities.toLocaleString()} entities · {productionCadReport.assemblyInstances.toLocaleString()} components</span></header><div><span><small>Constraints</small><b>{productionCadReport.timingsMs.constraintSolve.toFixed(1)} ms</b></span><span><small>Model rebuild</small><b>{productionCadReport.timingsMs.parametricRebuild.toFixed(1)} ms</b></span><span><small>DXF round trip</small><b>{productionCadReport.timingsMs.dxfRoundTrip.toFixed(1)} ms</b></span><span><small>Checksum</small><b>{productionCadReport.timingsMs.projectChecksum.toFixed(1)} ms</b></span></div>{productionCadReport.failures.map((failure) => <small key={failure}>{failure}</small>)}</div>}
            <div className="cad-stream-list">{streamingWorkingSet.chunks.slice(0, 8).map((chunk) => <div key={chunk.id}><b>{chunk.id}</b><span>{chunk.entityIds.length} objects</span><em className={chunk.lod}>{chunk.lod}</em><i style={{ width: `${Math.max(5, chunk.priority * 100)}%` }} /></div>)}</div>
            <div className="cad-pro-metrics"><span><small>Exact geometry</small><b>{exactBuildState}</b></span><span><small>Native physics</small><b>{nativeEngine.available ? "Rapier 3D" : "desktop only"}</b></span><span><small>GPU backend</small><b>{nativeGpu ? `${nativeGpu.backend} · ${nativeGpu.adapter}` : nativeEngine.available ? "probing…" : "desktop only"}</b></span><span><small>Native jobs</small><b>{nativeJobs.length ? `${nativeJobs.filter((job) => job.status === "running").length} active · ${nativeJobs.length} retained` : "—"}</b></span><span><small>CPU workers</small><b>{nativeEngine.available ? nativeEngine.workerThreads : 1}</b></span><span><small>Last native job</small><b>{nativeJobs[0] ? `${nativeJobs[0].phase} · ${nativeJobs[0].elapsedMs.toFixed(1)} ms` : nativeSimulation ? `${nativeSimulation.elapsedMs.toFixed(1)} ms` : "—"}</b></span></div>
            {nativePreviewUrl && nativePreview && <figure className="cad-native-preview"><div className="cad-native-preview-image" role="img" aria-label="Native GPU exact-model render" style={{ backgroundImage: `url(${nativePreviewUrl})` }} /><figcaption><b>{nativePreview.backend}{"samples" in nativePreview ? " · PATH TRACE" : " · RASTER"}</b><span>{nativePreview.triangles.toLocaleString()} triangles{"samples" in nativePreview ? ` · ${nativePreview.samples} spp · ${nativePreview.maxBounces} bounces${nativePreview.denoised ? " · denoised" : ""}` : ""} · {nativePreview.elapsedMs.toFixed(1)} ms</span></figcaption></figure>}
            {nativeSimulation && <div className="cad-native-simulation" aria-label="Native physics result"><header><span><b>LIVE RIGID-BODY RESULT</b><small>{nativeSimulation.bodies.length} bodies · {nativeSimulation.jointCount} joints · {nativeSimulation.simulatedSeconds.toFixed(2)} s</small></span><em>{nativeSimulationApplied ? "PREVIEW ON" : "PREVIEW OFF"}</em></header><div><button onClick={() => setNativeSimulationApplied((value) => !value)}>{nativeSimulationApplied ? "Hide solved pose" : "Show solved pose"}</button><button onClick={bakeNativePhysics}>Bake imported transforms</button><button onClick={() => { setNativeSimulation(null); setNativeSimulationApplied(false); setStatus("Native physics result cleared without changing the model"); }}>Discard</button></div></div>}
            <div className="cad-deformable-controls"><label>Material<select aria-label="Deformable material" value={nativeSoftBodyPreset} onChange={(event) => setNativeSoftBodyPreset(event.target.value as NativeSoftBodyPreset)}>{Object.entries(NATIVE_SOFT_BODY_PRESETS).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}</select></label><label>Resolution<input aria-label="Deformable lattice resolution" type="number" min="1" max="8" step="1" value={nativeSoftBodyResolution} onChange={(event) => setNativeSoftBodyResolution(Math.max(1, Math.min(8, Math.round(Number(event.target.value) || 1))))} /></label><span>{(nativeSoftBodyResolution + 1) ** 3} particles · {nativeSoftBodyResolution ** 3 * 6} tetrahedra</span></div>
            {nativeSoftBodyResult && <div className="cad-native-simulation deformable" aria-label="Native deformable physics result"><header><span><b>VOLUME-PRESERVING DEFORMABLE RESULT</b><small>{nativeSoftBodyResult.particles} particles · {nativeSoftBodyResult.tetrahedra} tetrahedra · {nativeSoftBodyResult.coupledCollisionCount} two-way contacts</small></span><em>PREVIEW ON</em></header><div className="cad-soft-metrics"><span>Volume error <b>{(nativeSoftBodyResult.maxVolumeError * 100).toFixed(2)}%</b></span><span>Edge strain <b>{(nativeSoftBodyResult.maxEdgeStrain * 100).toFixed(2)}%</b></span><span>Solve <b>{nativeSoftBodyResult.elapsedMs.toFixed(1)} ms</b></span></div><div><button onClick={() => setView("model")}>Show lattice</button><button onClick={() => { setNativeSoftBodyResult(null); setStatus("Deformable preview discarded without changing exact geometry"); }}>Discard</button></div></div>}
            <div className="cad-pro-actions"><button disabled={!nativeEngine.available || nativePreviewBusy} onClick={() => void renderNativePathTrace()}>{nativePreviewBusy ? "Rendering…" : "Native path trace"}</button><button disabled={!nativeEngine.available || nativePreviewBusy} onClick={() => void renderNativePreview()}>GPU raster preview</button><button disabled={!nativeEngine.available} onClick={() => void saveNativeDiagnostics()}>Diagnostics</button><button disabled={!nativeEngine.available} onClick={() => void resetNativeCache()}>Clear exact cache</button></div>
            {nativeJobs.length > 0 && <div className="cad-native-jobs" aria-label="Native compute jobs">{nativeJobs.slice(0, 5).map((job) => <div className={job.status} key={job.id}><span><b>{job.label}</b><small>{job.phase} · {job.elapsedMs.toFixed(1)} ms{job.cacheHit ? " · cache hit" : ""}</small></span><i style={{ width: `${Math.max(2, job.progress * 100)}%` }} />{job.status === "running" && <button onClick={() => void stopNativeJob(job.id)}>Cancel</button>}</div>)}</div>}
            <div className="cad-interchange-gate"><header><span>FORMAT SUPPORT</span><b>Not qualified</b></header>{INTERCHANGE_CAPABILITIES.map((format) => <div className={format.status} key={format.id} title={`${format.limitation} · Independent professional acceptance not evaluated`}><b>{format.label}</b><span>{format.import ? "I" : "—"} / {format.export ? "E" : "—"}</span><em>{interchangeSupport(format)}</em></div>)}</div>
            <button onClick={exportInterchangeManifest}>Export honest handoff manifest</button>
            <button className="cad-pro-primary" disabled={nativeComputeBusy} onClick={() => void runNativePhysics()}>{nativeComputeBusy ? "Native solver running…" : nativeEngine.available ? "Run compiled rigid physics" : "Native engine available in desktop app"}</button>
            <button className="cad-pro-primary" disabled={nativeComputeBusy} onClick={() => void runNativeSoftBody()}>{nativeComputeBusy ? "Native solver running…" : nativeEngine.available ? "Run deformable + coupled solve" : "Deformables require desktop app"}</button>
          </div>}
        </section>
        <section className="cad-hardware-section">
          <div className="cad-section-title"><h3>Smart hardware</h3><span>ONE CLICK</span></div>
          <div className="cad-hardware-grid">
            {HARDWARE_RECIPES.map((recipe) => <button
              className={hardwareKind === recipe.kind ? "active" : ""}
              key={recipe.kind}
              title={`Generate ${recipe.name}`}
              onClick={() => {
                const next = hardwareKind === recipe.kind ? hardwareParameters : hardwareDefaults(recipe.kind);
                createSmartHardware(recipe.kind, next);
              }}
            ><b>{recipe.icon}</b><span>{recipe.name}<small>{recipe.description}</small></span></button>)}
          </div>
          <div className="cad-hardware-modes" role="group" aria-label="Hardware output mode">
            {(["visual", "manufacturing", "simulation"] as HardwareMode[]).map((mode) => <button className={hardwareMode === mode ? "active" : ""} key={mode} onClick={() => setHardwareMode(mode)}>{mode}</button>)}
          </div>
          <div className="cad-hardware-parameters">
            <label>Size<ExactLengthInput label="Hardware size" value={hardwareParameters.size} unit={units} precision={precision} onCommit={(value) => setHardwareParameters((current) => ({ ...current, size: value }))} /><em>{units}</em></label>
            <label>Thickness<ExactLengthInput label="Hardware thickness" value={hardwareParameters.thickness} unit={units} precision={precision} onCommit={(value) => setHardwareParameters((current) => ({ ...current, thickness: value }))} /><em>{units}</em></label>
            <label>Length<ExactLengthInput label="Hardware length" value={hardwareParameters.length} unit={units} precision={precision} onCommit={(value) => setHardwareParameters((current) => ({ ...current, length: value }))} /><em>{units}</em></label>
            <label>Count<input aria-label="Hardware count" type="number" min="1" max="30" value={hardwareParameters.count} onChange={(event) => setHardwareParameters((current) => ({ ...current, count: Math.max(1, Number(event.target.value)) }))} /><em>×</em></label>
            <label>Clearance<ExactLengthInput label="Hardware clearance" value={hardwareParameters.clearance} unit={units} precision={precision} onCommit={(value) => setHardwareParameters((current) => ({ ...current, clearance: value }))} /><em>{units}</em></label>
          </div>
          <label className="cad-hardware-toggle"><span>Automatic mounting cut</span><input type="checkbox" aria-label="Automatic mounting cut" checked={hardwareMountCut} onChange={(event) => setHardwareMountCut(event.target.checked)} /></label>
          <button className="cad-hardware-generate" onClick={() => createSmartHardware(hardwareKind, hardwareParameters)}>Generate {HARDWARE_RECIPES.find((recipe) => recipe.kind === hardwareKind)?.name}</button>
          <p>Select a face or profile to place and cut. Or type “24 chain links, 18 mm size” in the command bar.</p>
        </section>
        <section className="cad-linked-section">
          <div className="cad-section-title"><h3>Linked systems</h3><span>LIVE GROUPS</span></div>
          <p>Build one exact master link, distribute lightweight bound instances, then edit or regenerate the whole necklace as one system.</p>
          <div className="cad-link-kinds" role="group" aria-label="Linked system type">
            {(["necklace", "bracelet", "chain"] as const).map((kind) => <button className={linkSpec.kind === kind ? "active" : ""} key={kind} onClick={() => setLinkSpec((current) => ({ ...current, kind }))}>{kind === "necklace" ? "⌄ Necklace" : kind === "bracelet" ? "○ Bracelet" : "∞ Chain"}</button>)}
          </div>
          <div className="cad-link-shapes" role="group" aria-label="Link shape">
            {(["oval", "round", "curb"] as const).map((shape) => <button className={linkSpec.shape === shape ? "active" : ""} key={shape} onClick={() => setLinkSpec((current) => ({ ...current, shape }))}>{shape}</button>)}
          </div>
          <div className="cad-link-fields">
            <label>Link width<ExactLengthInput label="Link width" value={linkSpec.linkWidth} unit={units} precision={precision} onCommit={(value) => setLinkSpec((current) => ({ ...current, linkWidth: value }))} /></label>
            <label>Link height<ExactLengthInput label="Link height" value={linkSpec.linkHeight} unit={units} precision={precision} onCommit={(value) => setLinkSpec((current) => ({ ...current, linkHeight: value }))} /></label>
            <label>Wire Ø<ExactLengthInput label="Link wire diameter" value={linkSpec.wireDiameter} unit={units} precision={precision} onCommit={(value) => setLinkSpec((current) => ({ ...current, wireDiameter: value }))} /></label>
            <label>Clearance<ExactLengthInput label="Link clearance" value={linkSpec.clearance} unit={units} precision={precision} onCommit={(value) => setLinkSpec((current) => ({ ...current, clearance: value }))} /></label>
            <label>Span<ExactLengthInput label="Linked path span" value={linkSpec.span} unit={units} precision={precision} onCommit={(value) => setLinkSpec((current) => ({ ...current, span: value }))} /></label>
            <label>Drop<ExactLengthInput label="Linked path drop" value={linkSpec.drop} unit={units} precision={precision} onCommit={(value) => setLinkSpec((current) => ({ ...current, drop: value }))} /></label>
            <label>Clasp gap<ExactLengthInput label="Clasp gap" value={linkSpec.claspGap} unit={units} precision={precision} onCommit={(value) => setLinkSpec((current) => ({ ...current, claspGap: value }))} /></label>
            <label>Links<input type="number" min="2" max="240" value={linkSpec.count} disabled={linkSpec.fitMode === "fit-path"} onChange={(event) => setLinkSpec((current) => ({ ...current, count: Number(event.target.value) }))} /></label>
            <label>Alternate twist<input type="number" min="0" max="180" step="5" value={linkSpec.alternateTwist} onChange={(event) => setLinkSpec((current) => ({ ...current, alternateTwist: Number(event.target.value) }))} /></label>
          </div>
          <label className="cad-link-fit"><span>Distribution</span><select value={linkSpec.fitMode} onChange={(event) => setLinkSpec((current) => ({ ...current, fitMode: event.target.value as LinkSystemSpec["fitMode"] }))}><option value="fixed-count">Fixed link count</option><option value="fit-path">Fit links to path</option></select></label>
          <button className="cad-link-generate" onClick={() => buildLinkedGroup(linkSpec, activeLinkedGroupId ?? undefined)}>{activeLinkedGroup ? "Regenerate linked group" : `Create ${linkSpec.kind}`}</button>
          {activeLinkedGroup && <button className="cad-link-new" onClick={() => { setActiveLinkedGroupId(null); setLinkSpec(structuredClone(DEFAULT_LINK_SYSTEM_SPEC)); }}>＋ Start a new linked group</button>}
          {activeLinkedGroup && <>
            <div className="cad-link-metrics"><span><small>Path</small><b>{activeLinkedGroup.pathLength.toFixed(1)} mm</b></span><span><small>Pitch</small><b>{activeLinkedGroup.averagePitch.toFixed(2)} mm</b></span><span><small>Instances</small><b>{activeLinkedGroup.instanceIds.length}</b></span><span><small>Bindings</small><b>{activeLinkedGroup.bindings.filter((binding) => binding.enabled).length}</b></span></div>
            <div className="cad-link-bindings">{activeLinkedGroup.bindings.map((binding) => <button className={binding.enabled ? "active" : ""} key={binding.id} title={binding.expression} onClick={() => setLinkedGroups((current) => current.map((group) => group.id !== activeLinkedGroup.id ? group : { ...group, bindings: group.bindings.map((item) => item.id === binding.id ? { ...item, enabled: !item.enabled } : item) }))}>{binding.kind.replace("-", " ")}</button>)}</div>
            <div className="cad-link-attach"><button onClick={() => bindSelectedToLinkedAnchor("start")}>Bind clasp start</button><button onClick={() => bindSelectedToLinkedAnchor("pendant")}>Bind pendant</button><button onClick={() => bindSelectedToLinkedAnchor("end")}>Bind clasp end</button></div>
          </>}
          {linkedGroups.length > 0 && <div className="cad-linked-groups">{linkedGroups.map((group) => <div className={group.id === activeLinkedGroupId ? "active" : ""} key={group.id}><button onClick={() => { setActiveLinkedGroupId(group.id); setLinkSpec(structuredClone(group.spec)); setSelectedId(group.entityIds[0] ?? ""); }}><b>∞</b><span>{group.name}<small>{group.instanceIds.length} instances · {group.bindings.filter((binding) => binding.enabled).length} bindings</small></span></button><button title="Delete linked group" onClick={() => deleteLinkedGroup(group.id)}>×</button></div>)}</div>}
        </section>
        {recoverySnapshots.length > 0 && <section className="cad-pro-section">
          <h3>Recovery timeline</h3>
          <div className="cad-recovery-list">{recoverySnapshots.map((snapshot, index) => <button key={`${index}-${snapshot.checksum}`} onClick={() => applyProjectContents(snapshot.contents, null, false, true)}>
            <b>{index === 0 ? "LATEST" : `−${index}`}</b><span>{new Date(snapshot.savedAt).toLocaleString()}<small>{snapshot.checksum}</small></span><em>Restore</em>
          </button>)}</div>
          <p>{nativeEngine.available ? "Three flushed, integrity-checked desktop checkpoints are retained automatically." : "Eight integrity-checked browser checkpoints are retained automatically."}</p>
        </section>}
        <section className="cad-pro-section" id="inspector-constraints">
          <h3>Geometric solver</h3>
          <div className="cad-solver-status"><i /><span>{geometricConstraints.length} live constraints · residual {sketchSolverStatus.residual.toExponential(1)}</span><b>{sketchSolverStatus.degreesOfFreedom} DOF</b></div>
          {sketchSolverStatus.conflicts.map((conflict) => <p className="cad-solver-conflict" key={conflict}>⚠ {conflict}</p>)}
          <div className="cad-constraint-grid">
            {(["horizontal", "vertical", "fixed-length", "fixed-angle"] as ConstraintKind[]).map((kind) => <button key={kind} onClick={() => applyGeometricConstraint(kind)}>{kind.replace("-", " ")}</button>)}
          </div>
          <button className={`cad-reference ${constraintReference === selected?.id ? "active" : ""}`} disabled={!selected} onClick={() => selected && setConstraintReference(selected.id)}>⌖ {constraintReference === selected?.id ? "Reference set" : "Set selected as reference"}</button>
          <div className="cad-constraint-grid relational">
            {(["equal-length", "parallel", "perpendicular", "coincident", "concentric", "tangent"] as ConstraintKind[]).map((kind) => <button key={kind} onClick={() => applyGeometricConstraint(kind)}>{kind.replace("-", " ")}</button>)}
          </div>
          {geometricConstraints.length > 0 && <button className="cad-clear-pro" onClick={() => setGeometricConstraints([])}>Clear constraints</button>}
        </section>
        <section className="cad-pro-section">
          <h3>Parametric variables</h3>
          <div className="cad-parameter-editor"><input value={parameterName} onChange={(event) => setParameterName(event.target.value)} aria-label="Parameter name" /><input value={parameterExpression} onChange={(event) => setParameterExpression(event.target.value)} aria-label="Parameter formula" /><button onClick={addParameter}>＋</button></div>
          <p>Formulas accept variables, arithmetic, fractions, inches, feet and metric units.</p>
          <div className="cad-parameter-list">{parameters.map((parameter) => <button key={parameter.id} onClick={() => applyParameterToSelection(parameter)}><span>{parameter.name}<small>{parameter.expression}</small></span><b>{formatCadLength(parameter.value, units, precision)}</b></button>)}</div>
        </section>
        <section className="cad-pro-section">
          <h3>Design configurations</h3>
          <button className="cad-wide" onClick={captureConfiguration}>Capture current variant</button>
          <div className="cad-configuration-list">{configurations.map((configuration) => <div className={activeConfigurationId === configuration.id ? "active" : ""} key={configuration.id}>
            <button onClick={() => applyConfiguration(configuration)}><b>◇</b><span>{configuration.name}<small>{Object.keys(configuration.features).length} features · {Object.keys(configuration.parameters).length} parameters</small></span></button>
            <button title="Delete configuration" onClick={() => deleteConfiguration(configuration.id)}>✕</button>
          </div>)}</div>
          <p>Variants preserve feature values, suppression state and driving parameters without duplicating geometry.</p>
        </section>
        <section className="cad-pro-section cad-extension-section">
          <h3>Extensions <button onClick={() => extensionImportRef.current?.click()}>Import</button></h3>
          <p>API {FORM_EXTENSION_API_VERSION} · Ed25519 packages · explicit permissions · no arbitrary code, network, shell or filesystem access.</p>
          {extensionRegistry.entries.map((entry) => <div className={`cad-extension ${entry.enabled ? "" : "disabled"}`} key={entry.manifest.id}><header><b>{entry.manifest.name}</b><span><small>v{entry.manifest.version}</small><em className={entry.signatureStatus}>{entry.signatureStatus.replace("unsigned-local", "LOCAL").replace("self-signed", "SIGNED").replace("built-in", "BUILT-IN").toUpperCase()}</em></span></header><div className="cad-extension-controls"><button onClick={() => setExtensionRegistry((current) => setExtensionEnabled(current, entry.manifest.id, !entry.enabled))}>{entry.enabled ? "Disable" : "Enable"}</button>{entry.source !== "built-in" && <button onClick={() => setExtensionRegistry((current) => uninstallExtension(current, entry.manifest.id))}>Remove</button>}</div>{entry.enabled && entry.manifest.commands.map((extensionCommand) => <button key={extensionCommand.id} title={extensionCommand.description} onClick={() => executeCommand(resolveExtensionCommand(entry.manifest, extensionCommand.id, { selection: selected?.id }))}><span>{extensionCommand.label}</span><em>Run</em></button>)}</div>)}
        </section>
        <section className="cad-pro-section">
          <h3>Tolerances + GD&amp;T</h3>
          <div className="cad-gdt-editor"><select value={gdtSymbol} onChange={(event) => setGdtSymbol(event.target.value as GdtSymbol)}>{["Position", "Flatness", "Perpendicularity", "Parallelism", "Concentricity", "Circularity", "Cylindricity", "Runout", "Total runout", "Profile"].map((symbol) => <option key={symbol}>{symbol}</option>)}</select><input value={gdtTolerance} onChange={(event) => setGdtTolerance(event.target.value)} aria-label="Tolerance" /><input value={gdtDatum} onChange={(event) => setGdtDatum(event.target.value)} aria-label="Datum frame, for example A or A|B|C" /><select aria-label="Material condition" value={gdtMaterialCondition} onChange={(event) => setGdtMaterialCondition(event.target.value as GdtMaterialCondition)}><option>RFS</option><option>MMC</option><option>LMC</option></select><button onClick={addGdtAnnotation}>Add</button></div>
          <div className={`cad-gdt-validation ${gdtValidation.ready ? "ready" : "review"}`}><b>{gdtValidation.ready ? "Inspection controls valid" : "Drawing review"}</b><span>{gdtValidation.controlledFeatures}/{gdtValidation.eligibleFeatures} features controlled</span>{gdtValidation.findings.slice(0, 3).map((finding) => <small className={finding.severity} key={`${finding.annotationId}-${finding.message}`}>{finding.severity === "error" ? "×" : "!"} {finding.message}</small>)}</div>
          {productionDrawingSheet && <div className={`cad-drawing-validation ${productionDrawingSheet.validation.ready ? "ready" : "review"}`}><b>{productionDrawingSheet.validation.ready ? "Production sheet verified" : "Sheet QA requires review"}</b><span>5 exact/model-derived views · 3 overall dimensions · Rev {productionDrawingSheet.metadata.revision}</span>{productionDrawingSheet.validation.errors.slice(0, 2).map((error) => <small key={error}>× {error}</small>)}</div>}
          <div className="cad-gdt-list">{gdt.filter((annotation) => annotation.entityId === selected?.id).map((annotation) => <div key={annotation.id}><b>⌖</b><span>{annotation.symbol}</span><em>{formatCadLength(annotation.tolerance, units, precision)} {annotation.materialCondition ?? "RFS"}</em><strong>{annotation.datum || "—"}</strong><button aria-label={`Remove ${annotation.symbol} tolerance`} onClick={() => setGdt((current) => current.filter((item) => item.id !== annotation.id))}>×</button></div>)}</div>
        </section>
        <section className="cad-pro-section">
          <h3>Components + assemblies</h3>
          <button className="cad-wide" onClick={createComponent}>Create component from selected</button>
          <button className={`cad-wide ${explodedAssembly ? "active" : ""}`} onClick={() => { setExplodedAssembly((value) => !value); setView("model"); }}>{explodedAssembly ? "Collapse assembly" : "Explode assembly view"}</button>
          <div className="cad-component-list">{components.map((component) => <button key={component.id} onClick={() => insertComponent(component)}><b>{component.jewelry ? "✦" : component.engineering ? "⚙" : component.domain ? DESIGN_PACKS.find((pack) => pack.id === component.domain!.discipline)?.icon : component.hardware ? "⚙" : "◇"}</b><span>{component.name}<small>{component.jewelry ? `${JEWELRY_METALS.find((metal) => metal.id === component.jewelry!.spec.metal)?.name} · ${component.jewelry.estimatedMetalWeightGrams.toFixed(2)} g` : component.engineering ? `${component.engineering.standard} · FOS ${component.engineering.analysis.factorOfSafety.toFixed(2)}` : component.domain ? `${component.domain.discipline} · ${component.domain.process}` : component.hardware ? `${component.hardware.mode} hardware` : `${component.entities.length} part`}</small></span><em>Insert</em></button>)}</div>
          {assemblyInstances.length > 0 && <div className="cad-assembly-list">{assemblyInstances.map((instance) => <div key={instance.id}><button title="Toggle grounded" onClick={() => setAssemblyInstances((current) => current.map((item) => item.id === instance.id ? { ...item, fixed: !item.fixed } : item))}>{instance.fixed ? "●" : "○"}</button><span>{instance.name}</span><em>{instance.position.map((value) => value.toFixed(1)).join(", ")}</em></div>)}</div>}
          {assemblyInstances.length >= 2 && <div className="cad-mate-editor">
            <select aria-label="First component" value={assemblyMateFirstId || assemblyInstances[0]?.id} onChange={(event) => setAssemblyMateFirstId(event.target.value)}>{assemblyInstances.map((instance) => <option key={instance.id} value={instance.id}>{instance.name}</option>)}</select>
            <select aria-label="Second component" value={assemblyMateSecondId || assemblyInstances[1]?.id} onChange={(event) => setAssemblyMateSecondId(event.target.value)}>{assemblyInstances.map((instance) => <option key={instance.id} value={instance.id}>{instance.name}</option>)}</select>
            <select aria-label="Mate type" value={assemblyMateKind} onChange={(event) => setAssemblyMateKind(event.target.value as AssemblyMateKind)}>{(["coincident", "concentric", "distance", "parallel", "perpendicular", "angle"] as AssemblyMateKind[]).map((kind) => <option key={kind}>{kind}</option>)}</select>
            <select aria-label="Mate axis" value={assemblyMateAxis} onChange={(event) => setAssemblyMateAxis(event.target.value as "x" | "y" | "z")}><option value="x">X axis</option><option value="y">Y axis</option><option value="z">Z axis</option></select>
            <input aria-label="Mate value" type="number" value={assemblyMateValue} onChange={(event) => setAssemblyMateValue(Number(event.target.value))} />
            <button onClick={addAssemblyMate}>Solve mate</button>
          </div>}
          <p>3D component placements are solved from coincident, concentric, distance, parallel, perpendicular and angular mates.</p>
        </section>
        <section className="cad-kernel-panel" id="inspector-manufacturing">
          <div className={`cad-native-kernel-strip ${nativeEngine.available ? "native" : "web"}`}><span><i />{nativeEngine.available ? `Compiled engine · ${nativeEngine.workerThreads} workers · ${nativeEngine.physicsBackend}` : "Web compatibility engine"}</span><b>{nativeEngine.available ? "DESKTOP POWER" : "BROWSER"}</b></div>
          <div className="cad-kernel">
            <div><i className={kernelStatus} /><span><strong>Open CASCADE B-Rep</strong><small>Exact solids · healing · manufacturing</small></span></div>
            <button onClick={() => runKernel()}>{kernelStatus === "loading" ? "Loading…" : "Validate + heal"}</button>
          </div>
          <input ref={exactImportRef} hidden type="file" accept=".step,.stp,.stl,.brep" onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importExactFile(file);
            event.currentTarget.value = "";
          }} />
          <div className="cad-kernel-actions">
            <button onClick={() => exactImportRef.current?.click()}>Import</button>
            <button onClick={() => runKernel("step")}>STEP</button>
            <button onClick={() => runKernel("stl")}>STL</button>
            <button onClick={() => runKernel("brep")}>BREP</button>
            <button onClick={() => runKernel("svg")}>Drawing</button>
          </div>
          {kernelAudit && kernelDimensions && <div className="cad-audit">
            <div><b>{kernelAudit.valid ? "✓ VALID" : "⚠ REVIEW"}</b><span>{kernelAudit.healed ? "Healed" : "Native topology"}</span></div>
            <dl>
              <div><dt>Volume</dt><dd>{kernelAudit.volume.toFixed(2)} mm³</dd></div>
              <div><dt>Area</dt><dd>{kernelAudit.surfaceArea.toFixed(2)} mm²</dd></div>
              <div><dt>Bounds</dt><dd>{kernelDimensions.width.toFixed(2)} × {kernelDimensions.height.toFixed(2)} × {kernelDimensions.depth.toFixed(2)}</dd></div>
              <div><dt>Topology</dt><dd>{kernelAudit.topology.solids} S · {kernelAudit.topology.faces} F · {kernelAudit.topology.edges} E</dd></div>
              <div><dt>Mass</dt><dd>{estimatedMassKg.toFixed(4)} kg</dd></div>
              <div><dt>Center</dt><dd>{kernelAudit.centerOfMass.x.toFixed(2)}, {kernelAudit.centerOfMass.y.toFixed(2)}, {kernelAudit.centerOfMass.z.toFixed(2)}</dd></div>
            </dl>
            {kernelAudit.warnings.map((warning, index) => <p key={`${index}-${warning}`}>⚠ {warning}</p>)}
          </div>}
          <div className={`cad-design-intelligence ${designValidation.phase}`}>
            <header>
              <div className="cad-score" aria-label={designValidation.score == null ? `Design validation ${designValidation.label}` : `Design score ${designValidation.score} out of 100`}><strong>{designValidation.score ?? "—"}</strong><span>{designValidation.score == null ? "" : "/100"}</span></div>
              <div><b>Design Intelligence</b><small>{designValidation.label} · {designAnalysis.checksPassed} checks passed</small></div>
              <button onClick={exportManufacturingReport}>Report</button>
            </header>
            {exactAssemblyChecks.length > 0 && <div className="cad-clearance-summary">
              <span>Exact interference <b>{designAnalysis.interferenceVolume.toFixed(3)} mm³</b></span>
              <span>Minimum clearance <b>{designAnalysis.minimumClearance == null ? "—" : `${designAnalysis.minimumClearance.toFixed(3)} mm`}</b></span>
            </div>}
            <div className="cad-design-findings">
              {designAnalysis.issues.length === 0
                ? <p className="pass">✓ No release blockers detected</p>
                : designAnalysis.issues.slice(0, 6).map((issue) => <article key={issue.id} className={issue.severity}>
                  <i>{issue.severity === "critical" ? "!" : issue.severity === "warning" ? "△" : "i"}</i>
                  <span><strong>{issue.title}</strong><small>{issue.detail}</small><em>{issue.action}</em></span>
                </article>)}
            </div>
          </div>
          <div className="cad-material">
            <select value={material} onChange={(event) => {
              const next = event.target.value;
              setMaterial(next);
              setDensity(next === "Steel" ? 7.85 : next === "Brass" ? 8.5 : next === "ABS Plastic" ? 1.04 : next === "Hardwood" ? 0.7 : 2.7);
            }} aria-label="Material"><option>Aluminum 6061</option><option>Steel</option><option>Brass</option><option>ABS Plastic</option><option>Hardwood</option></select>
            <label>Density<input type="number" min="0" step="0.01" value={density} onChange={(event) => setDensity(Math.max(0, Number(event.target.value)))} /><em>g/cm³</em></label>
          </div>
          {importedBodies.length > 0 && <div className="cad-imported-bodies">{importedBodies.map((body) => {
            const transform = body.transform ?? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
            return <div key={body.id} className={selectedId === body.id ? "active" : ""} onClick={() => { setSelectedId(body.id); setSelectedEntityIds([body.id]); }}><strong>{body.name}</strong><span>Editable exact B-Rep</span><label>X<input type="number" value={transform[3]} onChange={(event) => updateImportedBodyPosition(body.id, 0, Number(event.target.value))} /></label><label>Y<input type="number" value={transform[7]} onChange={(event) => updateImportedBodyPosition(body.id, 1, Number(event.target.value))} /></label><label>Z<input type="number" value={transform[11]} onChange={(event) => updateImportedBodyPosition(body.id, 2, Number(event.target.value))} /></label><button onClick={(event) => { event.stopPropagation(); setImportedBodies((current) => current.filter((item) => item.id !== body.id)); setSelectedId(""); setSelectedEntityIds([]); }}>Remove</button></div>;
          })}</div>}
        </section>
        <SculptPanel
          meshFeatures={meshFeatures}
          selectedMeshId={selectedMeshId}
          selection={{
            mode: meshSelection.mode,
            count: selectionCount(meshSelection),
            label: describeSelection(meshSelection),
          }}
          handoff={selectedMeshHandoff}
          provenanceLostAt={selectedMesh?.rebuild.provenanceLostAt ?? null}
          skipped={selectedMesh?.rebuild.skipped ?? []}
          unit={units}
          precision={precision}
          onAddSculpt={(kind) => addSculpt(kind === "box"
            ? { kind: "box", width: 40, height: 40, depth: 40 }
            : kind === "plane"
              ? { kind: "plane", width: 60, depth: 60, columns: 2, rows: 2 }
              : { kind: "cylinder", radius: 20, height: 40, segments: 12 })}
          onSelectSculpt={(meshId) => { setSelectedMeshId(meshId); clearMeshSelection(); }}
          onRemoveSculpt={removeSculpt}
          onApplyEdit={applySculptEdit}
          onApplyCrease={applySculptCrease}
          onApplyTopology={applySculptTopology}
          onSelectionMode={changeSelectionMode}
          onSelectionCommand={runSelectionCommand}
          onAddModifier={addSculptModifier}
          onMoveModifier={(modifierId, direction) => editModifiers((modifiers) => moveModifier(modifiers, modifierId, direction))}
          onToggleModifier={(modifierId) => editModifiers((modifiers) => toggleModifier(modifiers, modifierId))}
          onRemoveModifier={(modifierId) => editModifiers((modifiers) => removeModifier(modifiers, modifierId))}
          onChangeModifier={(modifierId, changes) => editModifiers((modifiers) => updateModifier(modifiers, modifierId, changes))}
          sculptLayers={selectedMesh?.feature.sculptLayers ?? []}
          activeSculptLayerId={sculptLayerId}
          onSelectSculptLayer={setActiveSculptLayerId}
          onAddSculptLayer={createSculptLayer}
          onChangeSculptLayer={(layerId, changes) => setMeshFeatures((current) => current.map((feature) => feature.id === selectedMeshId ? updateSculptLayer(feature, layerId, changes) : feature))}
          onRemoveSculptLayer={(layerId) => {
            setMeshFeatures((current) => current.map((feature) => feature.id === selectedMeshId ? removeSculptLayer(feature, layerId) : feature));
            if (activeSculptLayerId === layerId) setActiveSculptLayerId(null);
          }}
          unwrap={sculptUnwrap?.meshId === selectedMeshId ? {
            charts: sculptUnwrap.unwrap.charts.length,
            areaDistortion: sculptUnwrap.unwrap.areaDistortion,
            problems: sculptUnwrap.unwrap.charts.filter((chart) => chart.problem).length,
          } : null}
          onUnwrap={unwrapSculpt}
          edits={selectedMesh?.feature.edits ?? []}
          rollback={selectedMesh?.feature.rollback}
          onToggleEdit={(editId) => setMeshFeatures((current) => current.map((feature) =>
            feature.id === selectedMeshId ? toggleMeshEdit(feature, editId) : feature))}
          onMoveEdit={(editId, direction) => setMeshFeatures((current) => current.map((feature) =>
            feature.id === selectedMeshId ? moveMeshEdit(feature, editId, direction) : feature))}
          onRemoveEdit={(editId) => setMeshFeatures((current) => current.map((feature) =>
            feature.id === selectedMeshId ? removeMeshEdit(feature, editId) : feature))}
          onEditAmount={(editId, name, value) => setMeshFeatures((current) => current.map((feature) =>
            feature.id === selectedMeshId
              ? updateMeshEdit(feature, editId, { [name]: value } as Partial<MeshEdit>)
              : feature))}
          onRollback={(position) => setMeshFeatures((current) => current.map((feature) =>
            feature.id === selectedMeshId ? setMeshRollback(feature, position) : feature))}
          brush={sculptBrush}
          brushSettings={sculptSettings}
          onBrushChange={changeSculptBrush}
          placement={(() => {
            const node = sceneNodes.find((entry) => entry.id === selectedMeshId);
            return node
              ? { transform: node.transform, parentId: node.parentId, depth: ancestorsOf(sceneNodes, node.id).length }
              : null;
          })()}
          onMove={moveSculpt}
          onParent={parentSculpt}
          onShadingAngle={(degrees) => setMeshFeatures((current) => current.map((feature) =>
            feature.id === selectedMeshId ? setMeshShadingAngle(feature, degrees) : feature))}
          onBoolean={(operation, otherId) => void applySculptBoolean(operation, otherId)}
          onExportStep={() => void exportSculptStep()}
          onExportSceneStep={() => void exportSceneStep()}
          refinements={sculptRefinements}
          onRefinementsChange={setSculptRefinements}
          onExportMesh={exportSculptMesh}
          onImportMesh={(file, sourceUnit) => void importSculptMesh(file, sourceUnit)}
          exporting={sculptExporting}
        />
        <GeometryNodePanel
          graph={geometryGraph}
          status={{
            summary: describeGraph(geometryGraph),
            problem: graphResult.problem,
            notes: graphResult.notes,
          }}
          unit={units}
          precision={precision}
          onAdd={(kind: NodeKind) => editGraph((graph) => addGraphNode(graph, kind, `${kind}-${id()}`))}
          onRemove={(nodeId) => editGraph((graph) => removeGraphNode(graph, nodeId))}
          onConnect={connectGraphNodes}
          onDisconnect={(nodeId, socket) => editGraph((graph) => disconnectGraph(graph, nodeId, socket))}
          onParam={(nodeId, name, value) => editGraph((graph) => setNodeParam(graph, nodeId, name, value))}
          onOption={(nodeId, name, value) => editGraph((graph) => setNodeOption(graph, nodeId, name, value))}
          onOutput={(nodeId) => editGraph((graph) => ({ ...graph, output: nodeId || null }))}
          onApply={applyGraphAsSculpt}
        />
        <MaterialNodePanel
          graph={materialGraph}
          status={describeMaterial(materialGraph)}
          bakeSize={bakeSize}
          painting={painting}
          paintColor={paintColor}
          paintRadius={paintRadius}
          hasTexture={texture !== null}
          onAdd={(kind: MaterialNodeKind) => editMaterial((graph) => addMaterialNode(graph, kind, `${kind}-${id()}`))}
          onRemove={(nodeId) => editMaterial((graph) => removeMaterialNode(graph, nodeId))}
          onConnect={connectMaterialNodes}
          onDisconnect={(nodeId, socket) => editMaterial((graph) => ({
            ...graph,
            links: graph.links.filter((link) => !(link.to.node === nodeId && link.to.socket === socket)),
          }))}
          onParam={(nodeId, name, value) => editMaterial((graph) => setMaterialParam(graph, nodeId, name, value))}
          onOption={(nodeId, name, value) => editMaterial((graph) => setMaterialOption(graph, nodeId, name, value))}
          onBakeSize={setBakeSize}
          onBake={bakeMaterialTexture}
          onClearTexture={() => { setTexture(null); setPainting(false); setStatus("Texture cleared"); }}
          onPaintingChange={(next) => {
            if (next) startSurfacePaint();
            else { setPainting(false); setStatus("Painting off"); }
          }}
          onPaintColor={setPaintColor}
          onPaintRadius={setPaintRadius}
        />
        <GraphEditorPanel
          curves={selectedActionCurves}
          playhead={animation.playhead}
          onCurves={editSelectedCurves}
        />
        <section className="cad-nodes cad-volume-panel">
          <div className="cad-section-title"><h3>Sparse volumes</h3><span>OPENVDB</span></div>
          <div className="cad-modifier-head">
            <button disabled={volumeImportBusy} onClick={() => void chooseVolumeImport()}>
              {volumeImportBusy ? "Parsing…" : "Import .vdb"}
            </button>
            <small>Official native OpenVDB · density + fire temperature</small>
          </div>
          {volumes.length === 0
            ? <p className="cad-sculpt-empty">Import smoke, cloud, fog, or simulation density. The grid remains sparse in the project and is sampled in world space during rendering.</p>
            : volumes.map((volume, volumeIndex) => {
                const color = `#${volume.scatteringColor.map((channel) => Math.round(Math.max(0, Math.min(1, channel)) * 255).toString(16).padStart(2, "0")).join("")}`;
                return <div className="cad-node" key={volume.grid.id}>
                  <div className="cad-node-title"><span>{volume.grid.name}</span><small>{volume.grid.dimensions.join("×")} · {volume.grid.activeIndices.length.toLocaleString()} active</small><button onClick={() => setVolumes((current) => current.filter((_, index) => index !== volumeIndex))}>×</button></div>
                  <label>Density
                    <input type="range" min="0" max="2" step="0.005" value={volume.densityScale} onChange={(event) => setVolumes((current) => current.map((item, index) => index === volumeIndex ? { ...item, densityScale: Number(event.target.value) } : item))} />
                    <small>{volume.densityScale.toFixed(3)}</small>
                  </label>
                  <label>Scatter color
                    <input type="color" value={color} onChange={(event) => {
                      const hex = event.target.value;
                      const next = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255) as Rgb;
                      setVolumes((current) => current.map((item, index) => index === volumeIndex ? { ...item, scatteringColor: next } : item));
                    }} />
                  </label>
                  {volume.grid.temperature && <>
                    <label>Fire emission
                      <input type="range" min="0" max="2" step="0.01" value={volume.emissionStrength ?? 0} onChange={(event) => setVolumes((current) => current.map((item, index) => index === volumeIndex ? { ...item, emissionStrength: Number(event.target.value) } : item))} />
                      <small>{(volume.emissionStrength ?? 0).toFixed(2)}</small>
                    </label>
                    <label>Hottest color
                      <input type="range" min="800" max="6000" step="50" value={volume.maxTemperature ?? 2200} onChange={(event) => setVolumes((current) => current.map((item, index) => index === volumeIndex ? { ...item, maxTemperature: Number(event.target.value) } : item))} />
                      <small>{Math.round(volume.maxTemperature ?? 2200)} K</small>
                    </label>
                  </>}
                  <p>{volume.grid.sourceGridClass} · {volume.grid.sourceValueType} · majorant {volume.grid.maxDensity.toFixed(3)}{volume.grid.temperature ? ` · temperature ${volume.grid.temperature.maxValue.toPrecision(3)}` : ""}</p>
                </div>;
              })}
        </section>
        <RenderPanel
          settings={renderSettings}
          aov={renderAov}
          exposure={renderExposure}
          denoise={renderDenoise}
          jobs={renderQueue.jobs}
          activeJob={(() => {
            const job = renderQueue.jobs.find((entry) => entry.status === "rendering");
            return job ? { id: job.id, progress: job.progress, total: job.settings.samples } : null;
          })()}
          preview={renderPreview}
          onSettings={(changes) => setRenderSettings((current) => ({ ...current, ...changes }))}
          onAov={setRenderAov}
          onExposure={setRenderExposure}
          onDenoise={setRenderDenoise}
          onQueue={queueRender}
          onCancel={(jobId) => {
            renderRef.current = null;
            setRenderQueue((current) => updateJob(current, jobId, { status: "cancelled" }));
            setStatus("Render stopped");
          }}
          onRemove={(jobId) => setRenderQueue((current) => removeJob(current, jobId))}
          onSave={() => {
            if (!renderPreview) return;
            const link = document.createElement("a");
            link.href = renderPreview;
            link.download = `render-${renderAov}.png`;
            link.click();
            setStatus(`Saved the ${renderAov} pass`);
          }}
        />
        <FeatureTreePanel
          features={features}
          activeFeatures={activeFeatures}
          clampedRollback={clampedRollback}
          modelState={modelState}
          exactAudit={kernelAudit}
          entities={entities}
          importedBodies={importedBodies}
          units={units}
          precision={precision}
          selectedFeatureId={selectedFeatureId}
          onAddFeature={addFeature}
          onFeaturesChange={setFeatures}
          onSetRollback={setRollbackTo}
          onSelectFeature={selectFeature}
          onMoveFeature={moveFeature}
          onRemoveFeature={removeFeature}
          onReassignFeatureSource={reassignFeatureSource}
        />
        <LayersPanel
          layers={layers}
          activeLayer={activeLayer}
          onActiveLayerChange={setActiveLayer}
          onLayersChange={setLayers}
        />
        <section className="cad-bom">
          <h3>Bill of materials</h3>
          <div className="cad-bom-head"><span>#</span><span>Item</span><span>Qty</span></div>
          {bomRows.map((row) => <div key={`${row.item}-${row.name}`}><b>{row.item}</b><span>{row.name}<small>{row.source} · {row.material}</small></span><em>{row.quantity}</em></div>)}
        </section>
        </>}
      </div>
    </aside>
    <footer className="cad-timeline-dock">
      <UiResizeHandle axis="y" value={workspaceUi.layout.timelineSize} min={112} max={340} invert onChange={(value) => workspaceUi.update("timelineSize", value)} label="Resize CAD timeline" />
      <TimelinePanel
        animation={animation}
        selectedTarget={selectedMeshId}
        selectedName={selectedMesh?.feature.name ?? null}
        onAnimation={setAnimation}
        onKey={keySelectedTransform}
        onAssignAction={assignSelectedAction}
        onDuplicateAction={duplicateSelectedAction}
      />
    </footer>
  </section>;
}
