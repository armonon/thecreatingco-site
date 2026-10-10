"use client";
import { useCompactInspector } from "./use-compact-workspace";
import { FormLogo } from "./form-logo";
import { CompactPropertiesToggle, CompactPropertiesClose } from "./compact-properties";
import { currentPreviewPixelRatio } from "./mobile-preview";
import { ContextTapGesture } from "./context-tap";
import { ObjectContextMenu, type ObjectMenuAnchor } from "./object-context-menu";
import { useDocumentSafety } from "./use-document-safety";
import { ProjectSaveSession, emptySceneWorkspace, isDefaultSceneWorkspace, stableCameraVector } from "./project-save-session";
import { confirmDocumentAction } from "./confirm-document-action";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { BLENDER_IMPORT_STEPS, SCENE_FRAME, blenderGlb, blenderObjZip } from "./blender-export";
import { offerLocker, useSuiteKit } from "./suite-kit";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { USDZExporter } from "three/examples/jsm/exporters/USDZExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { SSAARenderPass } from "three/examples/jsm/postprocessing/SSAARenderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import * as CANNON from "cannon-es";
import { invoke } from "@tauri-apps/api/core";
import { captureNativeRenderScene, renderNativeAuthoredScene, saveNativeRenderPng } from "./native-render-scene";
import { processRenderQueue, type RenderOutcome } from "./render-queue";
import { createRenderShot, duplicateRenderShot, moveRenderShot, restoreRenderQueue, validateRenderQueue, type RenderShot } from "./render-shot";
import { withoutRenderHelpers } from "./render-visibility";
import CadWorkspace from "./cad-workspace";
import type { AnimationModelSnapshot } from "./animation-handoff";
import { sampleTransform, shouldSampleAnimation, type EasingKind, type TransformKeyframe } from "./animation-engine";
import { AnimationDirector } from "./animation-director";
import { updateLinkedModelInProject } from "./garment-update";
import { editEffectStack } from "./effect-stack";
import { validEffectRecipe, withRecipeEffects } from "./effect-recipe";
import { EffectRecipePreview } from "./effect-recipe-preview";
import { bakeAnimatedCloth, displayClothBake, clearClothDisplay, clothMotionSignature, type ClothBake } from "./animated-cloth";
import { clothScenerySignature } from "./cloth-scenery";
import { recordClothPhysicsObstacles } from "./cloth-physics-recording";
import { cloneClothCharacter } from "./cloth-evaluation";
import { AnimationTimeline } from "./animation-timeline";
import { ANIMATION_SECONDS, createMotionKeys, moveAnimationKey, sampleBonePose, type MotionPreset, type BonePose } from "./animation-workflow";
import { decodeBytes, embedFile, encodeBytes, type EmbeddedAsset } from "./asset-codec";
import {
  colliderFor,
  pointJointAt,
  RAGDOLL_JOINTS,
  RAGDOLL_PARTS,
  VEHICLE_WHEEL_CONNECTIONS,
  type PhysicsMode,
} from "./rig-engine";
import {
  HUMANOID_BONE_NAMES,
  analyzeHumanoid,
  applyAutoRigProfile,
  applyPosePreset,
  autoSkinHumanoid,
  capturePose,
  findRigBones,
  restoreFormRigBoneNames,
  paintSkinWeights,
  setSkeletonVisible,
  setWeightPreview,
  updatePoseCorrectives,
  type AutoRigProfile,
  type HumanoidPosePreset,
  type WeightStroke,
} from "./humanoid-rig";
import {
  analyzeSceneHealth,
  applyMeshEditCommands,
  componentSelectionFromHit,
  createComponentOverlay,
  defaultShaderGraph,
  inferIntentGesture,
  proceduralTexture,
  projectUVs,
  removeComponentOverlay,
  resolveSemanticSelection,
  semanticSelectionFromFace,
  type IntentGesture,
  type MeshEditCommand,
  type MeshEditKind,
  type MeshEditMode,
  type SceneHealth,
  type SemanticSelection,
  type SemanticSelectionRule,
  type ShaderGraphState,
} from "./pro-engine";
import {
  cleanProjectName,
  createFormProject,
  FORM_SCENE_WORKSPACE_SCHEMA,
  formWorkspace,
  parseProject,
  parseProjectWithMigration,
  projectFilename,
  serializeProject,
  updateFormWorkspace,
  type FormProject,
  type FormSceneWorkspace,
} from "./project-format";
import {
  createLumaTextObject,
  createLumaSpatialObject,
  parseLumaFormSpatialAsset,
  parseLumaFormTextAsset,
  returnedLumaTextSource,
  upsertLumaSpatialAsset,
  upsertLumaTextAsset,
  type LumaFormSpatialAsset,
  type LumaFormTextAsset,
} from "./luma-text-bridge";
import {
  branchProjectTransactionHistory,
  commitProjectTransaction,
  createProjectTransactionHistory,
  projectContentsFingerprint,
  redoProjectTransaction,
  undoProjectTransaction,
} from "./project-transactions";
import {
  UiIcon,
  UiResizeHandle,
  WorkspaceUiControls,
  useWorkspaceLayout,
  workspaceLayoutClasses,
  workspaceLayoutStyle,
} from "./workspace-ui";

type Primitive = "box" | "sphere" | "cylinder" | "cone" | "torus" | "plane" | "sketch" | "imported";
type TransformMode = "translate" | "rotate" | "scale";
type AnimationKind = "none" | "spin" | "float" | "bounce";
type ModifierState = { bevel: boolean; mirror: boolean; array: number; bend: number };
type ShapeOperationKind = "pull" | "taper" | "twist" | "inset";
type ShapeOperation = {
  id: string;
  kind: ShapeOperationKind;
  label: string;
  amount: number;
  enabled: boolean;
};
type ModelControl = {
  id: string;
  name: string;
  commandId: string;
  min: number;
  max: number;
};
import { parseFormMesh, type FormMeshAsset } from "./luma-mesh-asset";
import { createFormMesh, formMeshFromObject } from "./luma-mesh-geometry";

type SceneObjectData = {
  id: string;
  name: string;
  type: Primitive;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  roughness: number;
  metalness: number;
  clearcoat: number;
  sheen: number;
  transmission: number;
  thickness: number;
  iridescence: number;
  visible: boolean;
  locked: boolean;
  groupId: string | null;
  parentId: string | null;
  instanceSourceId: string | null;
  animation: AnimationKind;
  modifiers: ModifierState;
  operations: ShapeOperation[];
  constraints: string[];
  sketchPoints: [number, number][];
  keyframes: TransformKeyframe[];
  asset: EmbeddedAsset | null;
  autoRig: AutoRigProfile | null;
  clothBake?: ClothBake | null;
  meshEdits: MeshEditCommand[];
  modelControls: ModelControl[];
  shaderGraph: ShaderGraphState;
  /** Editable typography authority imported from Luma Studio. */
  lumaTextAsset?: LumaFormTextAsset | null;
  lumaSpatialAsset?: LumaFormSpatialAsset | null;
  lumaMeshAsset?: FormMeshAsset | null;
};
type CommentData = {
  id: string;
  author: string;
  body: string;
  object_id: string | null;
  x: number;
  y: number;
  z: number;
  created_at: number;
};
type PresenceData = {
  user_id: string;
  name: string;
  color: string;
  x: number;
  y: number;
};
type SavedVersion = { id: string; label: string; at: number; scene: SceneObjectData[] };
type WebProjectFileHandle = {
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>;
};

type Runtime = {
  scene: THREE.Scene;
  root: THREE.Group;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  renderPass: RenderPass;
  ssaa: SSAARenderPass;
  bloom: UnrealBloomPass;
  bokeh: BokehPass;
  orbit: OrbitControls;
  transform: TransformControls;
  objects: Map<string, THREE.Group>;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  grid: THREE.GridHelper;
  ambient: THREE.HemisphereLight;
  key: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  panelLight: THREE.RectAreaLight;
  selectionHelper: THREE.BoxHelper;
  physicsWorld: CANNON.World;
  physics: Map<string, {
    body: CANNON.Body;
    offset: CANNON.Vec3;
    mode: PhysicsMode;
  }>;
  rigConstraints: CANNON.Constraint[];
  rigAuxBodies: CANNON.Body[];
  vehicles: Map<string, {
    vehicle: CANNON.RaycastVehicle;
    chassisId: string;
    wheelIds: string[];
  }>;
};

const MATERIALS = [
  { name: "Pearl", value: "#dfe8e7" },
  { name: "Moss", value: "#7c9b70" },
  { name: "Cobalt", value: "#5577dc" },
  { name: "Clay", value: "#c67558" },
  { name: "Lilac", value: "#a48ac5" },
  { name: "Ink", value: "#242729" },
];

const SHADER_PRESETS = [
  { name: "Pearl", color: "#e6e0d9", roughness: 0.18, metalness: 0.03, clearcoat: 0.48, sheen: 0.18, transmission: 0, thickness: 0, iridescence: 0.08 },
  { name: "Moss", color: "#718057", roughness: 0.56, metalness: 0.01, clearcoat: 0.08, sheen: 0.58, transmission: 0, thickness: 0, iridescence: 0 },
  { name: "Cobalt", color: "#4f67c8", roughness: 0.3, metalness: 0.04, clearcoat: 0.24, sheen: 0.3, transmission: 0, thickness: 0, iridescence: 0.06 },
  { name: "Chrome", color: "#c9cfce", roughness: 0.12, metalness: 0.92, clearcoat: 0.35, sheen: 0.05, transmission: 0, thickness: 0, iridescence: 0 },
  { name: "Glass", color: "#d8edf1", roughness: 0.08, metalness: 0, clearcoat: 0.72, sheen: 0, transmission: 0.92, thickness: 0.7, iridescence: 0.12 },
  { name: "Wax", color: "#d6a888", roughness: 0.54, metalness: 0, clearcoat: 0.04, sheen: 0.5, transmission: 0.24, thickness: 0.9, iridescence: 0 },
  { name: "Fabric", color: "#8b789c", roughness: 0.92, metalness: 0, clearcoat: 0, sheen: 0.95, transmission: 0, thickness: 0, iridescence: 0 },
];

const PRIMITIVES: { type: Primitive; label: string; glyph: string }[] = [
  { type: "box", label: "Cube", glyph: "□" },
  { type: "sphere", label: "Sphere", glyph: "●" },
  { type: "cylinder", label: "Cylinder", glyph: "▥" },
  { type: "cone", label: "Cone", glyph: "△" },
  { type: "torus", label: "Torus", glyph: "◎" },
  { type: "plane", label: "Plane", glyph: "▱" },
];

const COLOR_WORDS: Record<string, string> = {
  red: "#d95c50", orange: "#e6974e", yellow: "#e6d75b", green: "#78a96b",
  blue: "#5577dc", purple: "#9b78c7", pink: "#d989ae", black: "#242729",
  white: "#f2f2ed", chrome: "#cdd3d4", gold: "#c69a45",
};

const round = (value: number) => Math.round(value * 100) / 100;
const newId = (prefix = "object") => {
  const value = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${value}`;
};
const isDesktopApp = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
/** Desktop, or a static review build (VITE_FORM_HOSTED_CLOUD=off) with no /api backend. */
const isLocalOnly = () => isDesktopApp()
  || (typeof import.meta.env !== "undefined" && (import.meta.env as unknown as Record<string, string | undefined>).VITE_FORM_HOSTED_CLOUD === "off");

function geometryFor(type: Primitive, bevel = false, sketchPoints: [number, number][] = []) {
  if (type === "box" && bevel) return new RoundedBoxGeometry(1.3, 1.3, 1.3, 4, 0.12);
  switch (type) {
    case "sphere": return new THREE.SphereGeometry(0.78, 48, 32);
    case "cylinder": return new THREE.CylinderGeometry(0.58, 0.58, 1.45, 40);
    case "cone": return new THREE.ConeGeometry(0.72, 1.5, 40);
    case "torus": return new THREE.TorusGeometry(0.7, 0.24, 24, 64);
    case "plane": return new THREE.PlaneGeometry(2, 2, 16, 16);
    case "sketch": {
      const points: [number, number][] = sketchPoints.length >= 3
        ? sketchPoints
        : [[-0.6, -0.5], [0.6, -0.5], [0.45, 0.55], [-0.45, 0.55]];
      const shape = new THREE.Shape();
      shape.moveTo(points[0][0], points[0][1]);
      points.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
      shape.closePath();
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: 0.45, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05,
        bevelSegments: 3, curveSegments: 10,
      });
      geometry.center();
      return geometry;
    }
    default: return new THREE.BoxGeometry(1.3, 1.3, 1.3, 4, 4, 4);
  }
}

function primaryMesh(group: THREE.Object3D | null | undefined): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  group?.traverse((child) => {
    if (
      !found
      && child instanceof THREE.Mesh
      && !child.userData.modifierClone
      && !child.userData.autoRigSource
      && !child.userData.autoRigHelper
    ) found = child;
  });
  return found;
}

function materialOf(group: THREE.Object3D) {
  return primaryMesh(group)?.material as THREE.MeshPhysicalMaterial | undefined;
}

function readObject(group: THREE.Group): SceneObjectData {
  const material = materialOf(group);
  return {
    id: group.userData.editorId,
    name: group.name,
    type: group.userData.primitive,
    position: [round(group.position.x), round(group.position.y), round(group.position.z)],
    rotation: [
      round(THREE.MathUtils.radToDeg(group.rotation.x)),
      round(THREE.MathUtils.radToDeg(group.rotation.y)),
      round(THREE.MathUtils.radToDeg(group.rotation.z)),
    ],
    scale: [round(group.scale.x), round(group.scale.y), round(group.scale.z)],
    color: material ? `#${material.color.getHexString()}` : "#dfe8e7",
    roughness: round(material?.roughness ?? 0.38),
    metalness: round(material?.metalness ?? 0.08),
    clearcoat: round(material?.clearcoat ?? 0.2),
    sheen: round(material?.sheen ?? 0.15),
    transmission: round(material?.transmission ?? 0),
    thickness: round(material?.thickness ?? 0),
    iridescence: round(material?.iridescence ?? 0),
    visible: group.visible,
    locked: Boolean(group.userData.locked),
    groupId: group.userData.groupId ?? null,
    parentId: group.userData.parentId ?? null,
    instanceSourceId: group.userData.instanceSourceId ?? null,
    animation: group.userData.animation ?? "none",
    modifiers: {
      bevel: Boolean(group.userData.modifiers?.bevel),
      mirror: Boolean(group.userData.modifiers?.mirror),
      array: Number(group.userData.modifiers?.array ?? 1),
      bend: Number(group.userData.modifiers?.bend ?? 0),
    },
    operations: (group.userData.operations ?? []).map((operation: ShapeOperation) => ({ ...operation })),
    constraints: [...(group.userData.constraints ?? [])],
    sketchPoints: [...(group.userData.sketchPoints ?? [])],
    keyframes: (group.userData.keyframes ?? []).map((keyframe: TransformKeyframe) => ({
      ...keyframe,
      position: [...keyframe.position],
      rotation: [...keyframe.rotation],
      scale: [...keyframe.scale],
      easing: keyframe.easing ?? "ease-in-out",
      ...(keyframe.pose ? { pose: structuredClone(keyframe.pose) } : {}),
    })),
    asset: group.userData.asset ? { ...group.userData.asset } : null,
    clothBake: group.userData.clothBake ?? null,
    autoRig: group.userData.autoRigProfile
      ? { ...structuredClone(group.userData.autoRigProfile as AutoRigProfile), pose: capturePose(group) }
      : null,
    meshEdits: structuredClone((group.userData.meshEdits ?? []) as MeshEditCommand[]),
    modelControls: structuredClone((group.userData.modelControls ?? []) as ModelControl[]),
    shaderGraph: {
      ...defaultShaderGraph(),
      ...structuredClone((group.userData.shaderGraph ?? {}) as Partial<ShaderGraphState>),
    },
    lumaMeshAsset: group.userData.lumaMeshAsset ? snapshotLumaMesh(group) : null,
    lumaTextAsset: group.userData.lumaTextAsset
      ? structuredClone(group.userData.lumaTextAsset as LumaFormTextAsset)
      : null,
    lumaSpatialAsset: group.userData.lumaSpatialAsset
      ? structuredClone(group.userData.lumaSpatialAsset as LumaFormSpatialAsset)
      : null,
  };
}

function readScene(runtime: Runtime) {
  return [...runtime.objects.values()].map(readObject);
}

function snapshotLumaMesh(group: THREE.Group): FormMeshAsset {
  const asset = structuredClone(group.userData.lumaMeshAsset as FormMeshAsset);
  group.children.forEach((child, index) => {
    if (!(child instanceof THREE.Mesh) || !(child.material instanceof THREE.MeshStandardMaterial) || !asset.parts[index]) return;
    asset.parts[index].material = { color: `#${child.material.color.getHexString()}`, roughness: child.material.roughness, metalness: child.material.metalness, opacity: child.material.opacity, side: child.material.side };
    if (child.material instanceof THREE.MeshPhysicalMaterial) Object.assign(asset.parts[index].material, { clearcoat: child.material.clearcoat, clearcoatRoughness: child.material.clearcoatRoughness, sheen: child.material.sheen, sheenColor: `#${child.material.sheenColor.getHexString()}`, sheenRoughness: child.material.sheenRoughness });
  });
  return asset;
}

function dimensionsOf(group: THREE.Object3D | null | undefined): [number, number, number] {
  if (!group) return [0, 0, 0];
  const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
  return [round(size.x), round(size.y), round(size.z)];
}

function downloadBlob(data: BlobPart, name: string, type: string) {
  offerLocker(data, name, type);
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function storeProjectRecovery(contents: string) {
  if (isDesktopApp()) {
    await invoke("autosave_project", { contents, workspace: "rig" });
    return;
  }
  localStorage.setItem("form-project-autosave", contents);
}

function createPrimitive(data: Partial<SceneObjectData> & { type: Primitive; name?: string }) {
  const modifiers: ModifierState = data.modifiers ?? { bevel: false, mirror: false, array: 1, bend: 0 };
  const material = new THREE.MeshPhysicalMaterial({
    color: data.color ?? MATERIALS[Math.floor(Math.random() * MATERIALS.length)].value,
    roughness: data.roughness ?? 0.38,
    metalness: data.metalness ?? 0.08,
    clearcoat: data.clearcoat ?? 0.2,
    clearcoatRoughness: 0.22,
    sheen: data.sheen ?? 0.15,
    sheenRoughness: 0.7,
    sheenColor: data.color ?? "#ffffff",
    transmission: data.transmission ?? 0,
    thickness: data.thickness ?? 0,
    iridescence: data.iridescence ?? 0,
    iridescenceIOR: 1.3,
    ior: 1.48,
    envMapIntensity: 1.25,
    side: data.type === "plane" ? THREE.DoubleSide : THREE.FrontSide,
  });
  const mesh = new THREE.Mesh(geometryFor(data.type, modifiers.bevel, data.sketchPoints), material);
  mesh.name = "Base geometry";
  mesh.castShadow = data.type !== "plane";
  mesh.receiveShadow = true;
  if (data.type === "plane") mesh.rotation.x = -Math.PI / 2;

  const group = new THREE.Group();
  const id = data.id ?? newId();
  group.userData.editorId = id;
  group.userData.primitive = data.type;
  group.userData.locked = data.locked ?? false;
  group.userData.groupId = data.groupId ?? null;
  group.userData.parentId = data.parentId ?? null;
  group.userData.instanceSourceId = data.instanceSourceId ?? null;
  group.userData.animation = data.animation ?? "none";
  group.userData.modifiers = { ...modifiers };
  group.userData.operations = (data.operations ?? []).map((operation) => ({ ...operation }));
  group.userData.constraints = [...(data.constraints ?? [])];
  group.userData.sketchPoints = [...(data.sketchPoints ?? [])];
  group.userData.keyframes = (data.keyframes ?? []).map((keyframe) => ({
    ...structuredClone(keyframe),
    easing: keyframe.easing ?? "ease-in-out",
  }));
  group.userData.asset = data.asset ? { ...data.asset } : null;
  group.userData.meshEdits = structuredClone(data.meshEdits ?? []);
  group.userData.modelControls = structuredClone(data.modelControls ?? []);
  group.userData.shaderGraph = { ...defaultShaderGraph(), ...(data.shaderGraph ?? {}) };
  group.userData.basePosition = [...(data.position ?? [0, 0.7, 0])];
  group.name = data.name ?? `${data.type[0].toUpperCase()}${data.type.slice(1)}`;
  group.position.fromArray(data.position ?? [0, data.type === "torus" ? 0.35 : 0.7, 0]);
  if (data.rotation) {
    group.rotation.set(
      THREE.MathUtils.degToRad(data.rotation[0]),
      THREE.MathUtils.degToRad(data.rotation[1]),
      THREE.MathUtils.degToRad(data.rotation[2])
    );
  }
  group.scale.fromArray(data.scale ?? [1, 1, 1]);
  group.visible = data.visible ?? true;
  group.add(mesh);
  rebuildShapeGeometry(group);
  refreshModifierClones(group);
  applyShaderGraphToGroup(group);
  return group;
}

function createImportedGroup(
  importedScene: THREE.Object3D,
  data: Partial<SceneObjectData> & { name: string; asset: EmbeddedAsset },
  normalize = false
) {
  const wrapper = new THREE.Group();
  wrapper.userData.editorId = data.id ?? newId();
  wrapper.userData.primitive = "imported";
  wrapper.userData.locked = data.locked ?? false;
  wrapper.userData.groupId = data.groupId ?? null;
  wrapper.userData.parentId = data.parentId ?? null;
  wrapper.userData.instanceSourceId = data.instanceSourceId ?? null;
  wrapper.userData.animation = data.animation ?? "none";
  wrapper.userData.modifiers = data.modifiers ?? { bevel: false, mirror: false, array: 1, bend: 0 };
  wrapper.userData.operations = data.operations ?? [];
  wrapper.userData.constraints = data.constraints ?? [];
  wrapper.userData.keyframes = (data.keyframes ?? []).map((keyframe) => ({
    ...structuredClone(keyframe),
    easing: keyframe.easing ?? "ease-in-out",
  }));
  wrapper.userData.sketchPoints = [];
  wrapper.userData.asset = { ...data.asset };
  wrapper.userData.clothBake = data.clothBake ?? null;
  wrapper.userData.autoRigProfile = data.autoRig ? structuredClone(data.autoRig) : null;
  wrapper.userData.meshEdits = structuredClone(data.meshEdits ?? []);
  wrapper.userData.modelControls = structuredClone(data.modelControls ?? []);
  wrapper.userData.shaderGraph = { ...defaultShaderGraph(), ...(data.shaderGraph ?? {}) };
  wrapper.name = data.name;
  importedScene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  wrapper.add(importedScene);
  if (data.position) wrapper.position.fromArray(data.position);
  if (data.rotation) {
    wrapper.rotation.set(
      THREE.MathUtils.degToRad(data.rotation[0]),
      THREE.MathUtils.degToRad(data.rotation[1]),
      THREE.MathUtils.degToRad(data.rotation[2])
    );
  }
  if (data.scale) wrapper.scale.fromArray(data.scale);
  wrapper.visible = data.visible ?? true;
  if (normalize) {
    const bounds = new THREE.Box3().setFromObject(wrapper);
    const size = bounds.getSize(new THREE.Vector3());
    if (size.length() > 8) wrapper.scale.multiplyScalar(6 / size.length());
    bounds.setFromObject(wrapper);
    wrapper.position.y -= bounds.min.y;
  }
  wrapper.userData.basePosition = wrapper.position.toArray();
  applyShaderGraphToGroup(wrapper);
  return wrapper;
}

async function loadImportedGroup(data: SceneObjectData) {
  if (!data.asset) throw new Error("The embedded asset is missing.");
  const bytes = decodeBytes(data.asset.base64);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const gltf = await new GLTFLoader().parseAsync(buffer, "");
  const group = createImportedGroup(gltf.scene, { ...data, asset: data.asset }, false);
  if (data.autoRig?.kind === "humanoid") {
    restoreFormRigBoneNames(group);
    applyAutoRigProfile(group, data.autoRig);
  }
  return group;
}

async function loadAnimationSnapshots(models: AnimationModelSnapshot[]) {
  return Promise.all(models.map(async (model) => {
    const gltf = await new GLTFLoader().parseAsync(model.gltf, "");
    const bytes = new TextEncoder().encode(model.gltf);
    const group = createImportedGroup(gltf.scene, { name: `${model.name} · animation copy`, asset: {
      name: `${model.sourceId}${model.independent ? `:copy:${newId("snapshot")}` : ""}.gltf`, mimeType: "model/gltf+json", byteLength: bytes.byteLength, base64: encodeBytes(bytes),
      sourceLink: { sourceId: model.sourceId, revision: model.sourceRevision ?? "", mode: model.independent ? "independent" : "linked" },
    } });
    if (model.humanoid) {
      restoreFormRigBoneNames(group); autoSkinHumanoid(group);
      group.userData.autoRigProfile = { kind: "humanoid", softness: .42, pose: capturePose(group), strokes: [] };
    }
    return group;
  }));
}

function attachPhysicsBody(
  runtime: Runtime,
  group: THREE.Group,
  mode: PhysicsMode
) {
  const id = group.userData.editorId as string;
  const previous = runtime.physics.get(id);
  if (previous) runtime.physicsWorld.removeBody(previous.body);
  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const offset = center.clone().sub(group.position);
  const colliderSize = size.clone();
  const primitive = group.userData.primitive as Primitive;
  const mesh = primaryMesh(group);
  if (mesh && (primitive === "sphere" || primitive === "cylinder" || primitive === "cone")) {
    mesh.geometry.computeBoundingBox();
    mesh.geometry.boundingBox?.getSize(colliderSize);
    colliderSize.set(
      colliderSize.x * Math.abs(group.scale.x),
      colliderSize.y * Math.abs(group.scale.y),
      colliderSize.z * Math.abs(group.scale.z)
    );
  }
  const material = new CANNON.Material({
    friction: mode === "cloth" ? 0.72 : 0.42,
    restitution: mode === "bounce" ? 0.82 : 0.24,
  });
  const body = new CANNON.Body({
    mass: Math.max(0.2, Math.min(12, size.x * size.y * size.z)),
    material,
    shape: colliderFor(primitive, [colliderSize.x, colliderSize.y, colliderSize.z]),
    linearDamping: mode === "wind" ? 0.08 : 0.22,
    angularDamping: 0.38,
  });
  body.position.set(center.x, center.y, center.z);
  body.quaternion.set(group.quaternion.x, group.quaternion.y, group.quaternion.z, group.quaternion.w);
  if (mode === "wind") body.velocity.set(0.8, 0.15, 0);
  if (mode === "bounce") body.velocity.set(0, 3.5, 0);
  runtime.physicsWorld.addBody(body);
  runtime.physics.set(id, {
    body,
    offset: new CANNON.Vec3(offset.x, offset.y, offset.z),
    mode,
  });
  return runtime.physics.get(id)!;
}

function syncPhysicsBody(runtime: Runtime, group: THREE.Group) {
  const physics = runtime.physics.get(group.userData.editorId as string);
  if (!physics) return;
  physics.body.position.set(
    group.position.x + physics.offset.x,
    group.position.y + physics.offset.y,
    group.position.z + physics.offset.z
  );
  physics.body.quaternion.set(group.quaternion.x, group.quaternion.y, group.quaternion.z, group.quaternion.w);
  physics.body.velocity.setZero();
  physics.body.angularVelocity.setZero();
  physics.body.wakeUp();
}

function refreshModifierClones(group: THREE.Group) {
  [...group.children].forEach((child) => {
    if (child.userData.modifierClone) group.remove(child);
  });
  const base = primaryMesh(group);
  if (!base) return;
  const modifiers = group.userData.modifiers as ModifierState;
  if (modifiers.mirror) {
    const clone = base.clone();
    clone.userData.modifierClone = true;
    clone.position.x = -1.7;
    clone.scale.x = -1;
    group.add(clone);
  }
  for (let i = 1; i < Math.min(modifiers.array, 8); i++) {
    const clone = base.clone();
    clone.userData.modifierClone = true;
    clone.position.x = i * 1.75;
    group.add(clone);
  }
}

function rebuildShapeGeometry(group: THREE.Group) {
  const mesh = primaryMesh(group);
  const type = group.userData.primitive as Primitive;
  if (!mesh) return;
  if (type === "imported" && !group.userData.lumaMeshAsset) return;
  const geometry = type === "imported" ? (() => {
    const part = (group.userData.lumaMeshAsset as FormMeshAsset).parts[0], geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(part.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(part.normals, 3)); geometry.setIndex(part.indices); return geometry;
  })() : geometryFor(type, Boolean(group.userData.modifiers?.bevel), group.userData.sketchPoints ?? []);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const operations = (group.userData.operations ?? []) as ShapeOperation[];
  const bend = Number(group.userData.modifiers?.bend ?? 0);
  const bounds = new THREE.Box3().setFromBufferAttribute(position);
  const maxY = Math.max(Math.abs(bounds.min.y), Math.abs(bounds.max.y), 0.001);
  for (let index = 0; index < position.count; index++) {
    let x = position.getX(index);
    let y = position.getY(index);
    let z = position.getZ(index);
    operations.filter((operation) => operation.enabled).forEach((operation) => {
      const amount = operation.amount;
      if (operation.kind === "pull") y *= 1 + amount * 0.55;
      if (operation.kind === "inset") {
        x *= 1 - amount * 0.24;
        z *= 1 - amount * 0.24;
      }
      if (operation.kind === "taper") {
        const factor = 1 - ((y / maxY + 1) / 2) * amount * 0.42;
        x *= factor;
        z *= factor;
      }
      if (operation.kind === "twist") {
        const angle = (y / maxY) * amount * 0.9;
        const nextX = x * Math.cos(angle) - z * Math.sin(angle);
        z = x * Math.sin(angle) + z * Math.cos(angle);
        x = nextX;
      }
    });
    if (bend) {
      const angle = y * bend * 0.7;
      const nextX = x * Math.cos(angle);
      z += x * Math.sin(angle);
      x = nextX;
    }
    position.setXYZ(index, x, y, z);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  const evaluated = applyMeshEditCommands(geometry, group.userData.meshEdits ?? []);
  if (evaluated !== geometry) geometry.dispose();
  mesh.geometry.dispose();
  projectUVs(evaluated, (group.userData.shaderGraph?.uvProjection ?? "original") as ShaderGraphState["uvProjection"]);
  mesh.geometry = evaluated;
}

function applyShaderGraphToGroup(group: THREE.Group) {
  const graph = {
    ...defaultShaderGraph(),
    ...((group.userData.shaderGraph ?? {}) as Partial<ShaderGraphState>),
  };
  group.userData.shaderGraph = graph;
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (!(material instanceof THREE.MeshStandardMaterial)) return;
      const previous = material.userData.formProceduralTexture as THREE.Texture | undefined;
      if (previous && material.map === previous) material.map = null;
      previous?.dispose();
      const texture = proceduralTexture(graph.procedural, graph.scale, graph.contrast);
      if (texture) {
        material.map = texture;
        material.userData.formProceduralTexture = texture;
      } else {
        delete material.userData.formProceduralTexture;
      }
      material.emissive.copy(material.color);
      material.emissiveIntensity = graph.emission;
      material.envMapIntensity = 1.1 + graph.fresnel * 1.8;
      material.needsUpdate = true;
    });
  });
}

export default function Studio({
  initialPanel = null,
  initialDocument,
  saveSession,
  onClose,
}: {
  initialPanel?: "create" | "scene" | "animate" | "rig" | "lab" | "magic" | "pro" | null;
  initialDocument?: { contents: string; path: string | null; dirty: boolean; models?: AnimationModelSnapshot[] };
  saveSession?: ProjectSaveSession;
  onClose?: (project?: { contents: string; path: string | null; dirty: boolean }) => void;
} = {}) {
  const workspaceUi = useWorkspaceLayout("studio", {
    toolsCollapsed: false,
    inspectorCollapsed: false,
    timelineCollapsed: false,
    inspectorSize: 360,
    timelineSize: 180,
  });
  const viewportRef = useRef<HTMLDivElement>(null);
  const [objectMenu, setObjectMenu] = useState<ObjectMenuAnchor | null>(null);
  const compactUi = useCompactInspector(workspaceUi.layout.inspectorCollapsed, (value) => workspaceUi.update("inspectorCollapsed", value));
  const visibleLayout = { ...workspaceUi.layout, inspectorCollapsed: compactUi.collapsed, toolsCollapsed: compactUi.compact ? false : workspaceUi.layout.toolsCollapsed, timelineCollapsed: compactUi.compact ? false : workspaceUi.layout.timelineCollapsed };
  const initialDocumentRef = useRef(initialDocument);
  const contextRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const textureInputRef = useRef<HTMLInputElement>(null);
  const lumaTextInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const materialCaptureRef = useRef<HTMLInputElement>(null);
  const sketchCanvasRef = useRef<HTMLCanvasElement>(null);
  const sketchingRef = useRef(false);
  const audioReactiveRef = useRef<{ analyser: AnalyserNode; data: Uint8Array; stream: MediaStream; baseScale: THREE.Vector3 } | null>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const selectedRef = useRef<string | null>(null);
  const historyRef = useRef<{ past: SceneObjectData[][]; future: SceneObjectData[][] }>({
    past: [],
    future: [],
  });
  const dragSnapshotRef = useRef<SceneObjectData[] | null>(null);
  const poseGestureRef = useRef(false);
  const playingRef = useRef(false);
  const timeRef = useRef(0);
  const hydratedRef = useRef(false);
  const applyingRemoteRef = useRef(false);
  const lastRemoteRef = useRef(0);
  const remoteRevisionRef = useRef(0);
  const pointerPresenceRef = useRef({ x: 0.5, y: 0.5 });
  const userIdRef = useRef(newId("user"));
  const userColorRef = useRef(MATERIALS[1].value);
  const projectPathRef = useRef<string | null>(null);
  const saveInFlightRef = useRef(false);
  const lumaReturnSavingRef = useRef(false);
  const documentGenerationRef = useRef(0);
  const [projectCreatedAt] = useState(() => Date.now());
  const projectCreatedAtRef = useRef(projectCreatedAt);
  const projectContainerRef = useRef<FormProject<unknown> | null>(null);
  const projectTransactionsRef = useRef(createProjectTransactionHistory());
  const workspaceTransactionStartRef = useRef<string | null>(null);
  const [documentSession] = useState(() => saveSession ?? new ProjectSaveSession());
  const saveBeforeCloseRef = useRef<() => Promise<boolean>>(async () => false);
  const pendingOpenRef = useRef<ReturnType<ProjectSaveSession["checkpoint"]> | null>(null);
  useEffect(() => () => { documentSession.retainHistory("scene", historyRef.current); }, [documentSession]);
  useSyncExternalStore(documentSession.subscribe, documentSession.getSnapshot, documentSession.getSnapshot);
  const webFileHandleRef = useRef<WebProjectFileHandle | null>(null);
  const vehicleInputRef = useRef({ throttle: 0, steering: 0, brake: 0 });
  const activeVehicleRef = useRef<string | null>(null);
  const weightPaintRef = useRef({
    enabled: false,
    bone: "hips",
    radius: 0.24,
    strength: 0.32,
    erase: false,
  });
  const meshEditRef = useRef<{
    mode: MeshEditMode;
    groupId: string | null;
    selected: Set<number>;
    semantic: SemanticSelection | null;
  }>({ mode: "object", groupId: null, selected: new Set(), semantic: null });
  const intentEnabledRef = useRef(true);
  const intentDragRef = useRef<{
    groupId: string;
    startX: number;
    startY: number;
    semantic: SemanticSelection;
    baseCommands: MeshEditCommand[];
    snapshot: SceneObjectData[];
    gesture: IntentGesture | null;
    commandId: string;
  } | null>(null);

  const [selection, setSelection] = useState<SceneObjectData | null>(null);
  const [selectionDimensions, setSelectionDimensions] = useState<[number, number, number]>([0, 0, 0]);
  const [sceneItems, setSceneItems] = useState<SceneObjectData[]>([]);
  const [physicsObjectIds, setPhysicsObjectIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mode, setMode] = useState<TransformMode>("translate");
  const [activePanel, setActivePanel] = useState<"create" | "scene" | "animate" | "rig" | "lab" | "magic" | "pro" | null>(initialPanel);
  const [environment, setEnvironment] = useState("Studio");
  const [gridVisible, setGridVisible] = useState(true);
  const [snap, setSnap] = useState(true);
  const [avoidCollisions, setAvoidCollisions] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [timeline, setTimeline] = useState(0);
  const [animationPage, setAnimationPage] = useState<"motion" | "characters" | "advanced">("motion");
  const [bloom, setBloom] = useState(false);
  const [depthOfField, setDepthOfField] = useState(false);
  const [toast, setToast] = useState("Scene ready");
  const [commandOpen, setCommandOpen] = useState(false);
  const [command, setCommand] = useState("");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [presence, setPresence] = useState<PresenceData[]>([]);
  const [roomId, setRoomId] = useState("");
  const [syncState, setSyncState] = useState<"local" | "saving" | "synced">("local");
  const [versions, setVersions] = useState<SavedVersion[]>([]);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const suiteMenu = useSuiteKit("form");
  const [renderOpen, setRenderOpen] = useState(false);
  const [nativeSceneRenderBusy,setNativeSceneRenderBusy]=useState(false);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [cameraShots, setCameraShots] = useState<{ name: string; position: number[]; target: number[] }[]>([]);
  const [embed, setEmbed] = useState(false);
  const [qualityMode, setQualityMode] = useState<"Fast" | "Studio" | "Final">("Studio");
  const [aiPreview, setAiPreview] = useState<{ before: SceneObjectData[]; after: SceneObjectData[]; label: string } | null>(null);
  const [variations, setVariations] = useState<{ id: string; name: string; scene: SceneObjectData[]; color: string }[]>([]);
  const [assetReport, setAssetReport] = useState<{ name: string; triangles: number; materials: number; status: string } | null>(null);
  const [presentationMode, setPresentationMode] = useState(false);
  const [presentationIndex, setPresentationIndex] = useState(0);
  const [sketchPoints, setSketchPoints] = useState<[number, number][]>([]);
  const [recording, setRecording] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [physicsMode, setPhysicsMode] = useState<"gravity" | "wind" | "attract" | "bounce" | "cloth">("gravity");
  const [branches, setBranches] = useState<SavedVersion[]>([]);
  const [recipes, setRecipes] = useState<{ id: string; name: string; data: SceneObjectData }[]>([]);
  const [recipeName, setRecipeName] = useState("");
  const [recipePreview, setRecipePreview] = useState<{ recipe: { data: SceneObjectData; name: string }; targetId: string; source: string; before: SceneObjectData; after: SceneObjectData } | null>(null);
  const [photoMatched, setPhotoMatched] = useState(false);
  const [audioReactive, setAudioReactive] = useState(false);
  const [cadOpen, setCadOpen] = useState(false);
  const [cadProjectContents, setCadProjectContents] = useState<string | undefined>(undefined);
  const [cadProjectPath, setCadProjectPath] = useState<string | null>(null);
  const [characterHeight, setCharacterHeight] = useState(1700);
  const [characterBuild, setCharacterBuild] = useState(50);
  const [animationImportBusy, setAnimationImportBusy] = useState(Boolean(initialDocument));
  const [clothBakeProgress, setClothBakeProgress] = useState<number | null>(null);
  const [clothBakeSeconds, setClothBakeSeconds] = useState(4);
  const [clothBakeMessage, setClothBakeMessage] = useState<{ id: string; text: string } | null>(null);
  const clothBakeAbortRef = useRef<AbortController | null>(null);
  useEffect(() => () => clothBakeAbortRef.current?.abort(), []);
  const [projectName, setProjectName] = useState("Untitled scene");
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const projectDirty = documentSession.dirty;
  useDocumentSafety("rig", projectDirty || documentSession.saving || documentSession.restoringHistory, !cadOpen,
    () => saveBeforeCloseRef.current(), () => !documentSession.dirty && !documentSession.saving && !documentSession.restoringHistory);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);
  const [keyframeEasing, setKeyframeEasing] = useState<EasingKind>("ease-in-out");
  const [activeVehicleId, setActiveVehicleId] = useState<string | null>(null);
  const [rigStatus, setRigStatus] = useState("Select an object or generate a complete rig");
  const [rigBones, setRigBones] = useState<string[]>([]);
  const [rigBone, setRigBone] = useState<string>("hips");
  const [rigBoneRotation, setRigBoneRotation] = useState<[number, number, number]>([0, 0, 0]);
  const [skeletonVisible, setSkeletonVisibleState] = useState(false);
  const [weightPreview, setWeightPreviewState] = useState(false);
  const [weightPaint, setWeightPaint] = useState(false);
  const [weightErase, setWeightErase] = useState(false);
  const [weightRadius, setWeightRadius] = useState(0.24);
  const [weightStrength, setWeightStrength] = useState(0.32);
  const [rigConfidence, setRigConfidence] = useState<number | null>(null);
  const [meshEditMode, setMeshEditMode] = useState<MeshEditMode>("object");
  const [componentSelectionCount, setComponentSelectionCount] = useState(0);
  const [meshEditAmount, setMeshEditAmount] = useState(0.18);
  const [intentEnabled, setIntentEnabled] = useState(true);
  const [intentPreview, setIntentPreview] = useState<{
    kind: MeshEditKind;
    label: string;
    amount: number;
    commandId: string | null;
    groupId: string | null;
    active: boolean;
  } | null>(null);
  const [controlName, setControlName] = useState("Primary shape");
  const [sceneHealth, setSceneHealth] = useState<SceneHealth | null>(null);
  const [renderQueue, setRenderQueue] = useState<RenderShot[]>([]);
  const renderQueueBusy = useRef(false);
  const [queueRunning, setQueueRunning] = useState(false);
  const queueCancelled = useRef(false);
  useEffect(() => () => { queueCancelled.current = true; }, []);
  const pngRenderBusy = useRef(false);
  const [macroName, setMacroName] = useState("Product finish");
  const [macroScript, setMacroScript] = useState("bevel\nmaterial pearl\nquality final\nrender");
  const [savedMacros, setSavedMacros] = useState<{ id: string; name: string; script: string }[]>([]);

  const announce = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast("Scene ready"), 2200);
  }, []);

  const syncItems = useCallback(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    setSceneItems(readScene(runtime));
    setPhysicsObjectIds([...runtime.physics.keys()]);
  }, []);

  const selectObject = useCallback((group: THREE.Group | null, additive = false) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const nextId = group?.userData.editorId as string | undefined;
    if (
      meshEditRef.current.mode !== "object"
      && meshEditRef.current.groupId
      && meshEditRef.current.groupId !== nextId
    ) {
      const previous = runtime.objects.get(meshEditRef.current.groupId);
      if (previous) removeComponentOverlay(previous);
      meshEditRef.current = { mode: "object", groupId: null, selected: new Set(), semantic: null };
      setMeshEditMode("object");
      setComponentSelectionCount(0);
    }
    runtime.transform.detach();
    runtime.selectionHelper.visible = false;
    selectedRef.current = group?.userData.editorId ?? null;
    setSelectedKeyframeId(null);
    if (!group) {
      setRigBones([]);
      setSelection(null);
      setSelectionDimensions([0, 0, 0]);
      setSelectedIds([]);
      return;
    }
    const id = group.userData.editorId as string;
    setSelectedIds((current) =>
      additive ? (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) : [id]
    );
    setSelection(readObject(group));
    setSelectionDimensions(dimensionsOf(group));
    const bones = findRigBones(group);
    if (bones.size > 0) {
      const available = HUMANOID_BONE_NAMES.filter((name) => bones.has(name));
      const nextBone = available[0] ?? [...bones.keys()][0];
      const bone = bones.get(nextBone);
      setRigBones(available.length ? [...available] : [...bones.keys()]);
      setRigBone(nextBone);
      setRigBoneRotation(bone
        ? [
          THREE.MathUtils.radToDeg(bone.rotation.x),
          THREE.MathUtils.radToDeg(bone.rotation.y),
          THREE.MathUtils.radToDeg(bone.rotation.z),
        ]
        : [0, 0, 0]);
      const profile = group.userData.autoRigProfile as AutoRigProfile | undefined;
      if (profile) setRigStatus(`${group.name} · editable humanoid rig`);
    } else {
      setRigBones([]);
      setRigConfidence(null);
      setWeightPaint(false);
      setWeightPreviewState(false);
      setSkeletonVisibleState(false);
    }
    if (!group.userData.locked) runtime.transform.attach(group);
    runtime.selectionHelper.setFromObject(group);
    runtime.selectionHelper.visible = true;
  }, []);

  const pushHistory = useCallback((snapshot?: SceneObjectData[]) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    historyRef.current.past.push(snapshot ?? readScene(runtime));
    if (historyRef.current.past.length > 60) historyRef.current.past.shift();
    historyRef.current.future = [];
    projectTransactionsRef.current = branchProjectTransactionHistory(projectTransactionsRef.current);
  }, []);

  const restoreScene = useCallback((data: SceneObjectData[], remote = false) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const previouslySelected = selectedRef.current;
    applyingRemoteRef.current = remote;
    meshEditRef.current = { mode: "object", groupId: null, selected: new Set(), semantic: null };
    setMeshEditMode("object");
    setComponentSelectionCount(0);
    runtime.transform.detach();
    runtime.vehicles.forEach(({ vehicle }) => vehicle.removeFromWorld(runtime.physicsWorld));
    runtime.vehicles.clear();
    runtime.rigConstraints.forEach((constraint) => runtime.physicsWorld.removeConstraint(constraint));
    runtime.rigConstraints.length = 0;
    runtime.rigAuxBodies.forEach((body) => runtime.physicsWorld.removeBody(body));
    runtime.rigAuxBodies.length = 0;
    runtime.physics.forEach(({ body }) => runtime.physicsWorld.removeBody(body));
    runtime.physics.clear();
    setPhysicsObjectIds([]);
    runtime.objects.forEach((group) => {
      clearClothDisplay(group);
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      });
      runtime.root.remove(group);
    });
    runtime.objects.clear();
    data.forEach((item) => {
      const group = item.lumaMeshAsset ? createFormMesh(item.lumaMeshAsset) : item.lumaSpatialAsset
        ? createLumaSpatialObject(item.lumaSpatialAsset)
        : item.lumaTextAsset
        ? createLumaTextObject(item.lumaTextAsset)
        : item.type === "imported"
        ? createPrimitive({ ...item, type: "box", name: `${item.name} · loading` })
        : createPrimitive(item);
      group.userData.editorId = item.id;
      group.name = item.name;
      group.userData.locked = item.locked;
      group.userData.groupId = item.groupId;
      group.userData.parentId = item.parentId;
      group.userData.instanceSourceId = item.instanceSourceId;
      group.userData.animation = item.animation;
      group.userData.lastAnimationSampleTime = timeRef.current;
      group.userData.lumaTextAsset = item.lumaTextAsset ? structuredClone(item.lumaTextAsset) : null;
      group.userData.lumaSpatialAsset = item.lumaSpatialAsset ? structuredClone(item.lumaSpatialAsset) : null;
      if (item.lumaMeshAsset) {
        group.userData.lumaMeshAsset = structuredClone(item.lumaMeshAsset); group.userData.primitive = "imported";
        group.userData.meshEdits = structuredClone(item.meshEdits ?? []);
        group.userData.operations = structuredClone(item.operations ?? []); group.userData.modifiers = structuredClone(item.modifiers);
        rebuildShapeGeometry(group);
      }
      group.position.fromArray(item.position);
      group.rotation.set(
        THREE.MathUtils.degToRad(item.rotation[0]),
        THREE.MathUtils.degToRad(item.rotation[1]),
        THREE.MathUtils.degToRad(item.rotation[2]),
      );
      group.scale.fromArray(item.scale);
      group.visible = item.visible;
      if (item.type === "imported") {
        group.name = item.name;
        group.userData.primitive = "imported";
        group.userData.asset = item.asset ? { ...item.asset } : null;
        group.userData.clothBake = item.clothBake ?? null;
      }
      runtime.root.add(group);
      runtime.objects.set(group.userData.editorId, group);
      if (item.type === "imported" && item.asset && !item.lumaTextAsset && !item.lumaSpatialAsset && !item.lumaMeshAsset) {
        void loadImportedGroup(item).then((loaded) => {
          if (runtimeRef.current !== runtime || runtime.objects.get(item.id) !== group) return;
          loaded.userData.lastAnimationSampleTime = timeRef.current;
          runtime.root.remove(group);
          group.traverse((child) => {
            if (child instanceof THREE.Mesh) child.geometry.dispose();
          });
          runtime.root.add(loaded);
          runtime.objects.set(item.id, loaded);
          if (selectedRef.current === item.id) selectObject(loaded);
          setSceneItems(readScene(runtime));
        }).catch(() => {
          group.name = `${item.name} · asset unavailable`;
          setSceneItems(readScene(runtime));
        });
      }
    });
    const nextSelection = previouslySelected
      ? runtime.objects.get(previouslySelected) ?? null
      : runtime.objects.values().next().value ?? null;
    selectObject(nextSelection);
    setSceneItems(readScene(runtime));
    window.setTimeout(() => { applyingRemoteRef.current = false; }, 0);
  }, [selectObject]);

  const undoScene = useCallback(() => {
    const runtime = runtimeRef.current;
    const previous = historyRef.current.past.pop();
    if (!runtime || !previous) return announce("Nothing to undo");
    historyRef.current.future.push(readScene(runtime));
    restoreScene(previous);
    announce("Undone");
  }, [announce, restoreScene]);

  const redoScene = useCallback(() => {
    const runtime = runtimeRef.current;
    const next = historyRef.current.future.pop();
    if (!runtime || !next) return announce("Nothing to redo");
    historyRef.current.past.push(readScene(runtime));
    restoreScene(next);
    announce("Redone");
  }, [announce, restoreScene]);

  const captureProject = useCallback((): FormProject<SceneObjectData> | null => {
    const runtime = runtimeRef.current;
    if (!runtime) return null;
    const now = Date.now();
    const scene = readScene(runtime);
    const base = projectContainerRef.current ?? createFormProject(projectName, projectCreatedAtRef.current);
    const storedScene = formWorkspace<FormSceneWorkspace<unknown>>(base, "scene")?.data;
    const renamed = { ...base, name: cleanProjectName(projectName), createdAt: projectCreatedAtRef.current };
    const sceneData: FormSceneWorkspace<SceneObjectData> = {
        scene,
        workspace: {
          environment,
          gridVisible,
          snap,
          avoidCollisions,
          bloom,
          depthOfField,
          qualityMode,
          timeline,
        },
        camera: {
          position: stableCameraVector(runtime.camera.position.toArray(), storedScene?.camera.position),
          target: stableCameraVector(runtime.orbit.target.toArray(), storedScene?.camera.target),
        },
        cameraShots,
        groups,
        ...(renderQueue.length || storedScene?.renderQueue
          ? { renderQueue } : {}),
      };
    if (!base.workspaces.scene && isDefaultSceneWorkspace(sceneData)) {
      projectContainerRef.current = renamed;
      return renamed as FormProject<SceneObjectData>;
    }
    const next = updateFormWorkspace(renamed, "scene", {
      schema: FORM_SCENE_WORKSPACE_SCHEMA,
      objectIds: scene.map((item) => item.id),
      data: sceneData,
    }, now) as FormProject<SceneObjectData>;
    projectContainerRef.current = next;
    return next;
  }, [
    avoidCollisions,
    bloom,
    cameraShots,
    depthOfField,
    environment,
    gridVisible,
    groups,
    projectName,
    qualityMode,
    renderQueue,
    snap,
    timeline,
  ]);

  const applyProject = useCallback((project: FormProject<unknown>, saved = true, preserveSaveState = false) => {
    const runtime = runtimeRef.current;
    if (!runtime) throw new Error("The 3D workspace is not ready yet.");
    documentGenerationRef.current++;
    queueCancelled.current = true;
    const stored = formWorkspace<FormSceneWorkspace<unknown>>(project, "scene")?.data;
    const sceneWorkspace: FormSceneWorkspace<unknown> = stored ?? emptySceneWorkspace();
    projectContainerRef.current = project;
    restoreScene(sceneWorkspace.scene as SceneObjectData[]);
    setProjectName(cleanProjectName(project.name));
    projectCreatedAtRef.current = project.createdAt || Date.now();
    setEnvironment(sceneWorkspace.workspace.environment || "Studio");
    setGridVisible(sceneWorkspace.workspace.gridVisible);
    setSnap(sceneWorkspace.workspace.snap);
    setAvoidCollisions(sceneWorkspace.workspace.avoidCollisions);
    setBloom(sceneWorkspace.workspace.bloom);
    setDepthOfField(sceneWorkspace.workspace.depthOfField);
    setQualityMode(sceneWorkspace.workspace.qualityMode);
    setTimeline(Math.max(0, Math.min(1, sceneWorkspace.workspace.timeline)));
    setCameraShots(sceneWorkspace.cameraShots ?? []);
    setGroups(sceneWorkspace.groups ?? []);
    setRenderQueue(restoreRenderQueue(sceneWorkspace.renderQueue));
    runtime.camera.position.fromArray(sceneWorkspace.camera.position);
    runtime.orbit.target.fromArray(sceneWorkspace.camera.target);
    runtime.orbit.update();
    historyRef.current = (preserveSaveState ? documentSession.getHistory<typeof historyRef.current>("scene") : undefined) ?? { past: [], future: [] };
    if (!preserveSaveState) documentSession.replace(saved);
    documentSession.observeProject(project);
    setLastSavedAt((current) => saved ? project.updatedAt : current);
  }, [documentSession, restoreScene]);

  const loadProjectContents = useCallback((contents: string, path?: string | null, saved = true, resetTransactions = true) => {
    try {
      const { project, backup } = parseProjectWithMigration(contents);
      const differentProject = projectContainerRef.current?.projectId !== project.projectId;
      if (backup) {
        if (isDesktopApp()) void invoke("autosave_project", { contents: backup.source, workspace: "migration" }).catch(() => undefined);
        else try { localStorage.setItem("form-project-migration-backup", backup.source); } catch { /* explicit file remains untouched */ }
      }
      applyProject(project, saved, !resetTransactions);
      if (resetTransactions || differentProject) webFileHandleRef.current = null;
      if (resetTransactions) projectTransactionsRef.current = createProjectTransactionHistory();
      workspaceTransactionStartRef.current = null;
      projectPathRef.current = path ?? null;
      void storeProjectRecovery(serializeProject(project)).catch(() => announce("Recovery snapshot failed; save the project to a file now"));
      announce(`${project.name} opened`);
      return true;
    } catch (error) {
      announce(error instanceof Error ? error.message : "The project could not be opened");
      return false;
    }
  }, [announce, applyProject]);

  const openCadWorkspace = useCallback(() => {
    const project = captureProject();
    if (!project) {
      announce("The project is still starting. Try FormCAD again in a moment.");
      return;
    }
    const contents = serializeProject(project);
    workspaceTransactionStartRef.current = contents;
    setCadProjectContents(contents);
    setCadProjectPath(projectPathRef.current);
    setCadOpen(true);
  }, [announce, captureProject]);

  const closeCadWorkspace = useCallback((source?: { contents: string; path: string | null }) => {
    const bridge = (window as unknown as { formCAD?: { getProjectFile: () => string; getProjectPath: () => string | null } }).formCAD;
    const contents = source?.contents ?? bridge?.getProjectFile();
    const path = source ? source.path : bridge?.getProjectPath() ?? projectPathRef.current;
    setCadOpen(false);
    if (!contents) return;
    const before = workspaceTransactionStartRef.current;
    workspaceTransactionStartRef.current = null;
    if (before && parseProject(before).projectId === parseProject(contents).projectId) {
      const commit = commitProjectTransaction(projectTransactionsRef.current, {
        label: "CAD and Fabric workspace edit",
        workspace: "cad",
        before,
        after: contents,
      });
      projectTransactionsRef.current = commit.history;
      if (commit.reason === "oversized") announce("Workspace returned safely; this edit is too large for project undo history.");
    } else projectTransactionsRef.current = createProjectTransactionHistory();
    setCadProjectContents(contents);
    setCadProjectPath(path);
    loadProjectContents(contents, path, false, false);
  }, [announce, loadProjectContents]);

  const undo = useCallback(() => {
    if (saveSession) {
      const label = documentSession.undoLabel;
      void documentSession.travelHistory(-1, (contents) => { applyProject(parseProject(contents), false, true); return true; })
        .then((restored) => announce(restored ? `Undid ${label}` : "Nothing to undo"))
        .catch((error) => announce(`Undo failed: ${error instanceof Error ? error.message : "project could not be restored"}`));
      return;
    }
    if (historyRef.current.past.length > 0) return undoScene();
    const transaction = projectTransactionsRef.current.past.at(-1);
    const current = captureProject();
    if (!transaction || !current) return announce("Nothing to undo");
    const currentContents = serializeProject(current);
    if (projectContentsFingerprint(currentContents) !== projectContentsFingerprint(transaction.after)) {
      return announce("Newer local edits must be undone before the workspace transaction.");
    }
    const result = undoProjectTransaction(projectTransactionsRef.current);
    if (!result) return announce("Nothing to undo");
    projectTransactionsRef.current = result.history;
    const project = parseProject(result.contents);
    applyProject(project, false, true);
    setCadProjectContents(result.contents);
    void storeProjectRecovery(result.contents).catch(() => announce("Recovery snapshot failed; save the project to a file now"));
    announce(`Undid ${result.transaction.label}`);
  }, [announce, applyProject, captureProject, documentSession, saveSession, undoScene]);

  const redo = useCallback(() => {
    if (saveSession) {
      const label = documentSession.redoLabel;
      void documentSession.travelHistory(1, (contents) => { applyProject(parseProject(contents), false, true); return true; })
        .then((restored) => announce(restored ? `Redid ${label}` : "Nothing to redo"))
        .catch((error) => announce(`Redo failed: ${error instanceof Error ? error.message : "project could not be restored"}`));
      return;
    }
    if (historyRef.current.future.length > 0) return redoScene();
    const transaction = projectTransactionsRef.current.future.at(-1);
    const current = captureProject();
    if (!transaction || !current) return announce("Nothing to redo");
    const currentContents = serializeProject(current);
    if (projectContentsFingerprint(currentContents) !== projectContentsFingerprint(transaction.before)) {
      return announce("The project changed after undo; the workspace transaction cannot be redone.");
    }
    const result = redoProjectTransaction(projectTransactionsRef.current);
    if (!result) return announce("Nothing to redo");
    projectTransactionsRef.current = result.history;
    const project = parseProject(result.contents);
    applyProject(project, false, true);
    setCadProjectContents(result.contents);
    void storeProjectRecovery(result.contents).catch(() => announce("Recovery snapshot failed; save the project to a file now"));
    announce(`Redid ${result.transaction.label}`);
  }, [announce, applyProject, captureProject, documentSession, saveSession, redoScene]);

  const newProject = useCallback(async () => {
    if (saveInFlightRef.current) return announce("Wait for the current save to finish");
    const checkpoint = documentSession.checkpoint();
    try {
      if (documentSession.dirty && !await confirmDocumentAction("blank")) return;
      if (!documentSession.matches(checkpoint)) return announce("The project changed during confirmation; save your changes and try again");
    } catch { return announce("New project cancelled; confirmation is unavailable"); }
    const now = Date.now();
    documentGenerationRef.current++;
    projectPathRef.current = null;
    webFileHandleRef.current = null;
    projectCreatedAtRef.current = now;
    projectContainerRef.current = createFormProject("Untitled scene", now);
    restoreScene([]);
    setProjectName("Untitled scene");
    setEnvironment("Studio");
    setGridVisible(true);
    setSnap(true);
    setAvoidCollisions(true);
    setBloom(false);
    setDepthOfField(false);
    setQualityMode("Studio");
    setTimeline(0);
    setCameraShots([]);
    setGroups([]);
    historyRef.current = { past: [], future: [] };
    projectTransactionsRef.current = createProjectTransactionHistory();
    workspaceTransactionStartRef.current = null;
    documentSession.replace(false);
    setLastSavedAt(null);
    localStorage.removeItem("form-project-autosave");
    if (isDesktopApp()) void invoke("clear_autosave_project", { workspace: "rig" }).catch(() => undefined);
    announce("New project ready");
  }, [announce, documentSession, restoreScene]);

  const openProject = useCallback(async () => {
    if (saveInFlightRef.current) return announce("Wait for the current save to finish");
    const checkpoint = documentSession.checkpoint();
    try {
      if (documentSession.dirty && !await confirmDocumentAction("open")) return;
      const stillCurrent = () => {
        if (documentSession.matches(checkpoint)) return true;
        announce("The project changed while opening; your newer edits are still here");
        return false;
      };
      if (!stillCurrent()) return;
      if (isDesktopApp()) {
        const result = await invoke<{ path: string; contents: string } | null>("open_project_file");
        if (result && stillCurrent()) loadProjectContents(result.contents, result.path);
        return;
      }
      const pickerWindow = window as Window & {
        showOpenFilePicker?: (options: unknown) => Promise<WebProjectFileHandle[]>;
      };
      if (pickerWindow.showOpenFilePicker) {
        const [handle] = await pickerWindow.showOpenFilePicker({
          types: [{ description: "Form Studio project", accept: { "application/json": [".form"] } }],
          multiple: false,
        });
        if (!handle) return;
        const file = await handle.getFile();
        const contents = await file.text();
        if (stillCurrent() && loadProjectContents(contents, null)) webFileHandleRef.current = handle;
        return;
      }
      pendingOpenRef.current = checkpoint;
      projectInputRef.current?.click();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      announce("The project could not be opened");
    }
  }, [announce, documentSession, loadProjectContents]);

  const saveProject = useCallback(async (saveAs = false) => {
    if (saveInFlightRef.current) return;
    const project = captureProject();
    if (!project) return;
    const contents = serializeProject(project);
    documentSession.observeProject(project);
    const ticket = documentSession.beginSave();
    if (!ticket) return;
    const generation = documentGenerationRef.current;
    saveInFlightRef.current = true;
    try {
      if (isDesktopApp()) {
        let path = projectPathRef.current;
        if (!path || saveAs) {
          path = await invoke<string | null>("save_project_file", {
            contents,
            suggestedName: projectFilename(project.name),
          });
        } else {
          path = await invoke<string>("write_project_file", { path, contents });
        }
        if (!path) return;
        if (generation !== documentGenerationRef.current) return;
        projectPathRef.current = path;
      } else {
        const pickerWindow = window as Window & {
          showSaveFilePicker?: (options: unknown) => Promise<WebProjectFileHandle>;
        };
        let handle = saveAs ? null : webFileHandleRef.current;
        if (!handle && pickerWindow.showSaveFilePicker) {
          handle = await pickerWindow.showSaveFilePicker({
            suggestedName: projectFilename(project.name),
            types: [{ description: "Form Studio project", accept: { "application/json": [".form"] } }],
          });
        }
        if (handle) {
          const writable = await handle.createWritable();
          await writable.write(contents);
          await writable.close();
          if (generation === documentGenerationRef.current) webFileHandleRef.current = handle;
        } else {
          downloadBlob(contents, projectFilename(project.name), "application/json");
        }
      }
      if (generation !== documentGenerationRef.current) return;
      documentSession.finishSave(ticket, true);
      // The dialog can remain open while the scene changes. The normal dirty
      // effect re-evaluates against this saved fingerprint after lastSavedAt.
      setLastSavedAt(project.updatedAt);
      announce(`${project.name} saved`);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      announce("The project could not be saved");
    } finally {
      documentSession.finishSave(ticket, false);
      saveInFlightRef.current = false;
    }
  }, [announce, captureProject, documentSession]);

  useEffect(() => {
    saveBeforeCloseRef.current = async () => {
      if (documentSession.saving || documentSession.restoringHistory) return false;
      const generation = documentSession.checkpoint().generation;
      await saveProject();
      return generation === documentSession.checkpoint().generation && !documentSession.dirty && !documentSession.saving;
    };
  }, [documentSession, saveProject]);

  const addTransformKeyframe = useCallback(() => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!runtime || !group) return announce("Select an object to add a keyframe");
    if (group.userData.locked || playingRef.current || runtime.physics.has(group.userData.editorId)) return announce("Pause playback and unlock the object; clear its physics before recording keys");
    pushHistory();
    const keyframes = [...((group.userData.keyframes ?? []) as TransformKeyframe[])];
    const keyframe: TransformKeyframe = {
      id: newId("key"),
      time: round(timeline),
      position: group.position.toArray().map(round) as [number, number, number],
      rotation: [
        round(THREE.MathUtils.radToDeg(group.rotation.x)),
        round(THREE.MathUtils.radToDeg(group.rotation.y)),
        round(THREE.MathUtils.radToDeg(group.rotation.z)),
      ],
      scale: group.scale.toArray().map(round) as [number, number, number],
      easing: keyframeEasing,
      pose: Object.fromEntries([...findRigBones(group)].map(([name, bone]) => [name, bone.quaternion.toArray()])) as BonePose,
    };
    const nearby = keyframes.findIndex((item) => Math.abs(item.time - keyframe.time) < 0.006);
    if (nearby >= 0) keyframes[nearby] = { ...keyframe, id: keyframes[nearby].id };
    else keyframes.push(keyframe);
    group.userData.keyframes = keyframes.sort((a, b) => a.time - b.time);
    group.userData.animation = "none";
    group.userData.lastAnimationSampleTime = timeline;
    setSelection(readObject(group));
    setSelectedKeyframeId(nearby >= 0 ? keyframes[nearby].id : keyframe.id);
    syncItems();
    announce(`${Object.keys(keyframe.pose ?? {}).length ? "Pose and transform" : "Transform"} recorded at ${(timeline * ANIMATION_SECONDS).toFixed(2)}s`);
  }, [announce, keyframeEasing, pushHistory, syncItems, timeline]);

  const updateSelectedKeyframe = useCallback((action: "delete" | EasingKind) => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!runtime || !group || !selectedKeyframeId) return announce("Select a keyframe in the timeline first");
    const keyframes = [...((group.userData.keyframes ?? []) as TransformKeyframe[])];
    const index = keyframes.findIndex((keyframe) => keyframe.id === selectedKeyframeId);
    if (index < 0) return announce("That keyframe is no longer available");
    if (playingRef.current || group.userData.locked) return announce("Pause and unlock the object to edit keys");
    pushHistory();
    if (action === "delete") {
      keyframes.splice(index, 1);
      setSelectedKeyframeId(null);
      announce("Keyframe deleted");
    } else {
      keyframes[index] = { ...keyframes[index], easing: action };
      setKeyframeEasing(action);
      announce(`${action.replaceAll("-", " ")} curve applied`);
    }
    group.userData.keyframes = keyframes;
    setSelection(readObject(group));
    syncItems();
  }, [announce, pushHistory, selectedKeyframeId, syncItems]);

  const seekAnimation = useCallback((time: number) => {
    if (!Number.isFinite(time)) return;
    const next = Math.max(0, Math.min(1, time));
    playingRef.current = false;
    setPlaying(false);
    timeRef.current = next;
    setTimeline(next);
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.objects.forEach((group) => {
      if (runtime.physics.has(group.userData.editorId)) return;
      const keys = (group.userData.keyframes ?? []) as TransformKeyframe[];
      const sample = sampleTransform(keys, next);
      if (!sample) return;
      group.position.fromArray(sample.position);
      group.scale.fromArray(sample.scale);
      group.rotation.set(...sample.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]);
      const pose = sampleBonePose(keys, next);
      if (pose) findRigBones(group).forEach((bone, name) => { if (pose[name]) bone.quaternion.fromArray(pose[name]); });
      group.userData.lastAnimationSampleTime = next;
    });
    const group = selectedRef.current ? runtime.objects.get(selectedRef.current) : null;
    if (group) {
      setSelection(readObject(group));
      const bone = findRigBones(group).get(rigBone);
      if (bone) setRigBoneRotation([bone.rotation.x, bone.rotation.y, bone.rotation.z].map(THREE.MathUtils.radToDeg) as [number, number, number]);
    }
  }, [rigBone]);

  const toggleAnimationPlayback = useCallback(() => {
    if (playingRef.current) seekAnimation(timeRef.current);
    else { playingRef.current = true; setPlaying(true); }
  }, [seekAnimation]);

  const applyQuickMotion = (preset: MotionPreset, seconds: number, amount: number) => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!group || !runtime || playingRef.current || group.userData.locked || runtime.physics.has(group.userData.editorId)) return;
    pushHistory();
    const current = readObject(group);
    const base = current.keyframes[0] ?? current;
    const pose = Object.fromEntries([...findRigBones(group)].map(([name, bone]) => [name, bone.quaternion.toArray()])) as BonePose;
    try { group.userData.keyframes = createMotionKeys(preset, base, seconds, amount, () => newId("key"), pose); }
    catch (error) { announce(error instanceof Error ? error.message : "Motion could not be generated"); return; }
    group.userData.animation = "none";
    setSelectedKeyframeId(null);
    seekAnimation(0);
    syncItems();
    workspaceUi.update("timelineCollapsed", false);
    announce("Motion added as editable keys · press Space to preview · Undo to restore");
  };

  const bakeSelectedCloth = async () => {
    const runtime = runtimeRef.current, id = selectedRef.current, group = id ? runtime?.objects.get(id) : null;
    if (!runtime || !group || !id || playingRef.current || group.userData.locked || runtime.physics.has(id) || clothBakeAbortRef.current) return;
    const abort = new AbortController(); clothBakeAbortRef.current = abort; setClothBakeProgress(0); setClothBakeMessage(null);
    try {
      if ([...runtime.objects].some(([otherId, other]) => otherId !== id && other.visible && runtime.physics.has(otherId))) throw new Error("Choose Record physics obstacles first, then bake cloth against their recorded motion.");
      const cache = await bakeAnimatedCloth(group, clothBakeSeconds, isDesktopApp(), abort.signal, setClothBakeProgress, [...runtime.objects.values()]);
      if (runtimeRef.current !== runtime || runtime.objects.get(id) !== group || clothMotionSignature(group) !== cache.signature || clothScenerySignature(runtime.objects.values(), group) !== cache.scenerySignature) throw new Error("Character or scenery changed during the solve. Result discarded; rebake the updated scene.");
      pushHistory(); clearClothDisplay(group); group.userData.clothBake = cache; syncItems(); seekAnimation(0);
      setClothBakeMessage({ id, text: `${cache.backend} · ${cache.seconds}s baked. Scrub the timeline to inspect.` });
      announce(`${cache.backend} cloth baked · ${cache.seconds}s · body surface, keyed scenery and surface self-contact · Undo available`);
    } catch (error) { const text = error instanceof Error ? error.message : "Cloth bake failed; previous result kept"; setClothBakeMessage({ id, text }); announce(text); }
    finally { if (clothBakeAbortRef.current === abort) clothBakeAbortRef.current = null; setClothBakeProgress(null); }
  };

  const recordPhysicsObstacles = async () => {
    const runtime = runtimeRef.current, id = selectedRef.current;
    if (!runtime || !id || playingRef.current || clothBakeAbortRef.current) return;
    const abort = new AbortController(); clothBakeAbortRef.current = abort; setClothBakeProgress(0);
    const sceneBefore = JSON.stringify(readScene(runtime));
    try {
      if (runtime.vehicles.size) throw new Error("Vehicle controls require a dedicated vehicle recording; independent rigid props are supported here.");
      if (runtime.physics.has(id)) throw new Error("Select the clothed character, not a physics-driven prop");
      const recordings = await recordClothPhysicsObstacles(runtime.physicsWorld, runtime.physics, runtime.objects, clothBakeSeconds, abort.signal, setClothBakeProgress);
      if (abort.signal.aborted || runtimeRef.current !== runtime) throw new Error("Recording cancelled; scene unchanged");
      if (JSON.stringify(readScene(runtime)) !== sceneBefore) throw new Error("Scene edited during physics recording; result discarded. Record again.");
      const copies = [...recordings].map(([sourceId, keyframes]) => {
        const source = runtime.objects.get(sourceId)!;
        const copy = cloneClothCharacter(source);
        copy.traverse((node) => { if (node instanceof THREE.Mesh) { node.geometry = node.geometry.clone(); node.material = Array.isArray(node.material) ? node.material.map((m) => m.clone()) : node.material.clone(); } });
        copy.userData.editorId = newId("physics-recording"); copy.name = `${source.name} · recorded physics`;
        copy.userData.name = copy.name; copy.userData.keyframes = keyframes; copy.userData.animation = "none"; copy.userData.clothBake = null;
        return { sourceId, source, copy };
      });
      pushHistory();
      for (const { sourceId, source, copy } of copies) {
        // Keep the original geometry as a hidden scene object, and retire its
        // live body so it cannot become an invisible collider after recording.
        source.visible = false;
        const entry = runtime.physics.get(sourceId)!; runtime.physicsWorld.removeBody(entry.body); runtime.physics.delete(sourceId);
        runtime.root.add(copy); runtime.objects.set(copy.userData.editorId, copy);
      }
      setPhysicsObjectIds([...runtime.physics.keys()]); syncItems(); seekAnimation(0);
      setClothBakeMessage({ id, text: `${copies.length} physics props recorded at 120 Hz. Originals kept hidden; live physics replaced by editable copies. Now bake cloth motion.` });
      announce("Physics recorded to editable obstacle copies · originals kept hidden · now bake cloth motion");
    } catch (error) { const text = error instanceof Error ? error.message : "Physics recording failed"; setClothBakeMessage({ id, text }); announce(text); }
    finally { if (clothBakeAbortRef.current === abort) clothBakeAbortRef.current = null; setClothBakeProgress(null); }
  };

  const clearSelectedCloth = () => {
    const group = selectedRef.current ? runtimeRef.current?.objects.get(selectedRef.current) : null;
    if (!group || group.userData.locked || playingRef.current || clothBakeAbortRef.current) return;
    pushHistory(); clearClothDisplay(group); group.userData.clothBake = null; setSelection(readObject(group)); setClothBakeMessage(null); syncItems(); announce("Cloth bake cleared · skin-bound preview restored · Undo available");
  };

  const retimeSelectedKey = (seconds: number) => {
    const group = selectedRef.current ? runtimeRef.current?.objects.get(selectedRef.current) : null;
    if (!group || !selectedKeyframeId || playingRef.current || group.userData.locked) return;
    const keys = group.userData.keyframes as TransformKeyframe[];
    const next = moveAnimationKey(keys, selectedKeyframeId, seconds);
    if (next === keys) return announce("A key already occupies that time");
    pushHistory();
    group.userData.keyframes = next;
    seekAnimation(next.find((key) => key.id === selectedKeyframeId)!.time);
    syncItems();
  };

  const addObject = useCallback((type: Primitive, point?: THREE.Vector3, partial?: Partial<SceneObjectData>) => {
    const runtime = runtimeRef.current;
    if (!runtime) return null;
    pushHistory();
    const baseY = type === "plane" ? 0.02 : type === "torus" ? 0.35 : 0.72;
    const position: [number, number, number] = point
      ? [point.x, Math.max(baseY, point.y), point.z]
      : [0, baseY, 0];
    if (snap) {
      position[0] = Math.round(position[0] * 4) / 4;
      position[2] = Math.round(position[2] * 4) / 4;
    }
    const group = createPrimitive({
      type,
      name: `${type[0].toUpperCase()}${type.slice(1)} ${runtime.objects.size + 1}`,
      position,
      ...partial,
    });
    runtime.root.add(group);
    runtime.objects.set(group.userData.editorId, group);

    if (avoidCollisions) {
      const box = new THREE.Box3().setFromObject(group);
      let tries = 0;
      while (
        [...runtime.objects.values()].some((other) =>
          other !== group && box.intersectsBox(new THREE.Box3().setFromObject(other))
        ) && tries < 12
      ) {
        group.position.x += 0.5;
        box.setFromObject(group);
        tries++;
      }
    }
    syncItems();
    selectObject(group);
    announce(`${group.name} added`);
    return group;
  }, [announce, avoidCollisions, pushHistory, selectObject, snap, syncItems]);

  useEffect(() => {
    const host = viewportRef.current;
    if (!host) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#aeb7b2");
    scene.fog = new THREE.Fog("#aeb7b2", 14, 34);
    const root = new THREE.Group();
    root.name = "Form scene";
    scene.add(root);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.08, 120);
    camera.position.set(7.2, 4.8, 8.4);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(currentPreviewPixelRatio());
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    host.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const environmentTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = environmentTarget.texture;

    const ambient = new THREE.HemisphereLight("#f5f2e9", "#68716c", 1.65);
    const key = new THREE.DirectionalLight("#fff8e9", 4.8);
    key.position.set(4.5, 8.5, 5.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.radius = 5;
    key.shadow.blurSamples = 18;
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -10;
    const fill = new THREE.DirectionalLight("#b7c8ff", 1.2);
    fill.position.set(-5, 3, -4);
    const panelLight = new THREE.RectAreaLight("#fffdf6", 9, 5.5, 4);
    panelLight.position.set(-3.5, 6.5, 4.5);
    panelLight.lookAt(0.2, 0.7, 0);
    scene.add(ambient, key, fill, panelLight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.ShadowMaterial({ color: "#28332f", opacity: 0.22 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.015;
    floor.receiveShadow = true;
    scene.add(floor);
    const grid = new THREE.GridHelper(30, 30, "#7f8b87", "#98a39f");
    (grid.material as THREE.Material).opacity = 0.34;
    (grid.material as THREE.Material).transparent = true;
    scene.add(grid);

    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.07;
    orbit.target.set(0.2, 0.82, 0.25);
    orbit.maxPolarAngle = Math.PI / 2.02;
    orbit.minDistance = 2;
    orbit.maxDistance = 35;
    const transform = new TransformControls(camera, renderer.domElement);
    transform.setSize(0.78);
    scene.add(transform.getHelper());
    const selectionHelper = new THREE.BoxHelper(new THREE.Object3D(), "#d8ff72");
    selectionHelper.visible = false;
    scene.add(selectionHelper);

    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    const ssaa = new SSAARenderPass(scene, camera);
    ssaa.sampleLevel = 2;
    ssaa.unbiased = true;
    ssaa.enabled = false;
    composer.addPass(ssaa);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.75, 0.5, 0.86);
    bloomPass.enabled = false;
    composer.addPass(bloomPass);
    const bokeh = new BokehPass(scene, camera, { focus: 7, aperture: 0.00018, maxblur: 0.008 });
    bokeh.enabled = false;
    composer.addPass(bokeh);
    composer.addPass(new OutputPass());

    const physicsWorld = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    physicsWorld.broadphase = new CANNON.SAPBroadphase(physicsWorld);
    (physicsWorld.solver as CANNON.GSSolver).iterations = 12;
    physicsWorld.defaultContactMaterial.friction = 0.48;
    physicsWorld.defaultContactMaterial.restitution = 0.28;
    const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    physicsWorld.addBody(groundBody);

    const runtime: Runtime = {
      scene, root, camera, renderer, composer, renderPass, ssaa, bloom: bloomPass, bokeh, orbit, transform,
      objects: new Map(), raycaster: new THREE.Raycaster(), pointer: new THREE.Vector2(),
      grid, ambient, key, fill, panelLight, selectionHelper, physicsWorld, physics: new Map(),
      rigConstraints: [], rigAuxBodies: [], vehicles: new Map(),
    };
    runtimeRef.current = runtime;

    const starter = [
      createPrimitive({ type: "sphere", name: "Pearl sphere", color: "#e6e0d9", position: [-1.35, 0.88, 0.72], scale: [1.08, 1.08, 1.08], roughness: 0.18, metalness: 0.03, clearcoat: 0.48, sheen: 0.18 }),
      createPrimitive({ type: "box", name: "Moss cube", color: "#718057", position: [0.35, 0.78, -0.62], rotation: [0, 18, 0], scale: [1.18, 1.18, 1.18], roughness: 0.56, metalness: 0.01, clearcoat: 0.08, sheen: 0.58, modifiers: { bevel: true, mirror: false, array: 1, bend: 0 } }),
      createPrimitive({ type: "torus", name: "Cobalt ring", color: "#4f67c8", position: [1.48, 0.52, 0.98], rotation: [68, 0, -12], scale: [0.9, 0.9, 0.9], roughness: 0.3, metalness: 0.04, clearcoat: 0.24, sheen: 0.3 }),
    ];
    starter.forEach((group) => {
      root.add(group);
      runtime.objects.set(group.userData.editorId, group);
    });
    setSceneItems(readScene(runtime));
    selectObject(starter[1]);

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    transform.addEventListener("dragging-changed", (event) => {
      const dragging = (event as unknown as { value: boolean }).value;
      orbit.enabled = !dragging;
      if (dragging) {
        playingRef.current = false;
        setPlaying(false);
        dragSnapshotRef.current = readScene(runtime);
      }
      if (!dragging && dragSnapshotRef.current) {
        historyRef.current.past.push(dragSnapshotRef.current);
        historyRef.current.future = [];
        dragSnapshotRef.current = null;
        syncItems();
      }
    });
    transform.addEventListener("objectChange", () => {
      const selected = selectedRef.current ? runtime.objects.get(selectedRef.current) : null;
      if (selected) {
        const audio = audioReactiveRef.current;
        if (audio) {
          audio.analyser.getByteFrequencyData(audio.data as Uint8Array<ArrayBuffer>);
          const level = audio.data.reduce((sum, value) => sum + value, 0) / Math.max(audio.data.length * 255, 1);
          selected.scale.copy(audio.baseScale).multiplyScalar(1 + level * 0.14);
          const material = materialOf(selected);
          if (material) {
            material.emissive.copy(material.color);
            material.emissiveIntensity = level * 1.8;
          }
        }
        selectionHelper.setFromObject(selected);
        syncPhysicsBody(runtime, selected);
        setSelection(readObject(selected));
        setSelectionDimensions(dimensionsOf(selected));
      }
    });

    const findEditorGroup = (object: THREE.Object3D | null): THREE.Group | null => {
      let current = object;
      while (current && !current.userData.editorId) current = current.parent;
      return current as THREE.Group | null;
    };
    let down = { x: 0, y: 0 };
    const setRayFromPointer = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      runtime.pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      runtime.raycaster.setFromCamera(runtime.pointer, camera);
    };
    const contextTap = new ContextTapGesture();
    const contextTapMove = (event: PointerEvent) => contextTap.move(event);
    const contextMenu = (event: MouseEvent) => {
      event.preventDefault();
      if (intentDragRef.current || transform.dragging) return;
      setRayFromPointer(event);
      const hit = runtime.raycaster.intersectObjects([...runtime.objects.values()], true)[0];
      const group = findEditorGroup(hit?.object ?? null);
      if (!group) { setObjectMenu(null); return; }
      selectObject(group, false);
      setObjectMenu({ x: event.clientX, y: event.clientY, target: group.userData.editorId });
    };
    const pointerCancel = (event: PointerEvent) => contextTap.cancel(event);
    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      contextTap.down(event);
      down = { x: event.clientX, y: event.clientY };
      const edit = meshEditRef.current;
      if (!intentEnabledRef.current || edit.mode !== "face" || !edit.groupId) return;
      const group = runtime.objects.get(edit.groupId);
      const mesh = primaryMesh(group);
      if (!group || !mesh) return;
      setRayFromPointer(event);
      const componentHit = runtime.raycaster.intersectObject(mesh, false)[0];
      if (!componentHit?.face) return;
      const semantic = semanticSelectionFromFace(mesh.geometry, componentHit.face);
      const selected = new Set(resolveSemanticSelection(mesh.geometry, semantic));
      edit.selected = selected;
      edit.semantic = semantic;
      removeComponentOverlay(group);
      createComponentOverlay(mesh, selected);
      setComponentSelectionCount(selected.size);
      const commandId = newId("intent");
      intentDragRef.current = {
        groupId: edit.groupId,
        startX: event.clientX,
        startY: event.clientY,
        semantic,
        baseCommands: structuredClone((group.userData.meshEdits ?? []) as MeshEditCommand[]),
        snapshot: readScene(runtime),
        gesture: null,
        commandId,
      };
      orbit.enabled = false;
      renderer.domElement.setPointerCapture(event.pointerId);
      setIntentPreview({
        kind: "extrude",
        label: "Drag up to extrude · sideways to inset",
        amount: 0,
        commandId: null,
        groupId: edit.groupId,
        active: true,
      });
    };
    const pointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerPresenceRef.current = {
        x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
      };
      const drag = intentDragRef.current;
      if (!drag) return;
      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      if (Math.hypot(deltaX, deltaY) < 3) return;
      const group = runtime.objects.get(drag.groupId);
      if (!group) return;
      const gesture = inferIntentGesture(deltaX, deltaY, {
        alt: event.altKey,
        shift: event.shiftKey,
      });
      drag.gesture = gesture;
      const command: MeshEditCommand = {
        id: drag.commandId,
        kind: gesture.kind,
        label: gesture.label,
        amount: gesture.amount,
        selected: [...drag.semantic.topologyHint],
        semantic: drag.semantic,
        enabled: true,
      };
      group.userData.meshEdits = [...drag.baseCommands, command];
      removeComponentOverlay(group);
      rebuildShapeGeometry(group);
      refreshModifierClones(group);
      const evaluated = primaryMesh(group);
      if (evaluated) {
        const selected = new Set(resolveSemanticSelection(evaluated.geometry, drag.semantic));
        meshEditRef.current.selected = selected;
        createComponentOverlay(evaluated, selected);
        setComponentSelectionCount(selected.size);
      }
      setIntentPreview({
        kind: gesture.kind,
        label: gesture.label,
        amount: gesture.amount,
        commandId: drag.commandId,
        groupId: drag.groupId,
        active: true,
      });
    };
    const pointerUp = (event: PointerEvent) => {
      const tapped = contextTap.up(event);
      if (event.button !== 0) return;
      const intentDrag = intentDragRef.current;
      if (intentDrag) {
        intentDragRef.current = null;
        orbit.enabled = true;
        if (renderer.domElement.hasPointerCapture(event.pointerId)) {
          renderer.domElement.releasePointerCapture(event.pointerId);
        }
        const group = runtime.objects.get(intentDrag.groupId);
        if (group && intentDrag.gesture) {
          historyRef.current.past.push(intentDrag.snapshot);
          historyRef.current.future = [];
          setSelection(readObject(group));
          setSelectionDimensions(dimensionsOf(group));
          syncItems();
          setIntentPreview({
            kind: intentDrag.gesture.kind,
            label: intentDrag.gesture.label,
            amount: intentDrag.gesture.amount,
            commandId: intentDrag.commandId,
            groupId: intentDrag.groupId,
            active: false,
          });
          announce(`${intentDrag.gesture.label} · ${intentDrag.gesture.amount.toFixed(2)} m`);
        } else {
          setIntentPreview(null);
        }
        return;
      }
      if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 4) return;
      setRayFromPointer(event);
      const hit = runtime.raycaster.intersectObjects([...runtime.objects.values()], true)[0];
      const edit = meshEditRef.current;
      if (edit.mode !== "object" && edit.groupId) {
        const group = runtime.objects.get(edit.groupId);
        const mesh = primaryMesh(group);
        const componentHit = mesh ? runtime.raycaster.intersectObject(mesh, false)[0] : null;
        if (!group || !mesh || !componentHit?.face) return;
        const localPoint = mesh.worldToLocal(componentHit.point.clone());
        const picked = componentSelectionFromHit(
          mesh.geometry,
          componentHit.face,
          localPoint,
          edit.mode,
        );
        if (edit.mode === "face") edit.semantic = semanticSelectionFromFace(mesh.geometry, componentHit.face);
        else edit.semantic = null;
        if (!event.shiftKey) edit.selected.clear();
        picked.forEach((index) => {
          if (event.shiftKey && edit.selected.has(index)) edit.selected.delete(index);
          else edit.selected.add(index);
        });
        removeComponentOverlay(group);
        createComponentOverlay(mesh, edit.selected);
        setComponentSelectionCount(edit.selected.size);
        setRigStatus(`${edit.selected.size} ${edit.mode} component${edit.selected.size === 1 ? "" : "s"} selected`);
        return;
      }
      const paint = weightPaintRef.current;
      if (paint.enabled && hit?.object instanceof THREE.SkinnedMesh) {
        const group = findEditorGroup(hit.object);
        if (!group) return;
        const localPoint = hit.object.worldToLocal(hit.point.clone());
        const changed = paintSkinWeights(
          hit.object,
          localPoint,
          paint.bone,
          paint.radius,
          paint.strength,
          paint.erase,
        );
        if (changed > 0) {
          const profile = group.userData.autoRigProfile as AutoRigProfile | undefined;
          const stroke: WeightStroke = {
            bone: paint.bone,
            point: localPoint.toArray() as [number, number, number],
            radius: paint.radius,
            strength: paint.strength,
            erase: paint.erase,
          };
          if (profile) profile.strokes = [...(profile.strokes ?? []), stroke];
          setWeightPreview(group, paint.bone, true);
          setWeightPreviewState(true);
          setRigStatus(`${paint.erase ? "Softened" : "Painted"} ${changed} vertices for ${paint.bone}`);
          syncItems();
        }
        return;
      }
      const pickedGroup = findEditorGroup(hit?.object ?? null);
      selectObject(pickedGroup, event.shiftKey);
      if (tapped && pickedGroup) setObjectMenu({ x: event.clientX, y: event.clientY, target: pickedGroup.userData.editorId });
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("pointermove", contextTapMove);
    renderer.domElement.addEventListener("pointercancel", pointerCancel);
    renderer.domElement.addEventListener("contextmenu", contextMenu);

    let frame = 0;
    let last = performance.now();
    const render = (now: number) => {
      frame = requestAnimationFrame(render);
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      orbit.update();
      if (playingRef.current) {
        timeRef.current = (timeRef.current + delta / ANIMATION_SECONDS) % 1;
        setTimeline(timeRef.current);
      }
      const t = timeRef.current * Math.PI * 2;
      runtime.vehicles.forEach(({ vehicle }, rigId) => {
        const input = activeVehicleRef.current === rigId
          ? vehicleInputRef.current
          : { throttle: 0, steering: 0, brake: 1 };
        vehicle.applyEngineForce(-input.throttle * 780, 2);
        vehicle.applyEngineForce(-input.throttle * 780, 3);
        vehicle.setSteeringValue(input.steering * 0.5, 0);
        vehicle.setSteeringValue(input.steering * 0.5, 1);
        for (let wheel = 0; wheel < 4; wheel++) vehicle.setBrake(input.brake * 18, wheel);
      });
      runtime.physics.forEach(({ body, mode }) => {
        if (clothBakeAbortRef.current) return;
        if (mode === "wind") body.applyForce(new CANNON.Vec3(7, 0.6, 0));
        if (mode === "attract") {
          const pull = new CANNON.Vec3(-body.position.x, 0.4 - body.position.y, -body.position.z);
          const length = Math.max(pull.length(), 0.001);
          pull.scale(9 / length, pull);
          body.applyForce(pull);
        }
        if (mode === "cloth") {
          body.applyForce(new CANNON.Vec3(Math.sin(now * 0.002 + body.position.x) * 3.5, 1.2, 0));
        }
      });
      if (runtime.physics.size > 0 && !clothBakeAbortRef.current) runtime.physicsWorld.step(1 / 60, delta, 4);
      runtime.objects.forEach((group, id) => {
        const sourceId = group.userData.instanceSourceId as string | null | undefined;
        const source = sourceId ? runtime.objects.get(sourceId) : null;
        if (source) {
          group.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) return;
            const sourceMesh = source.getObjectByName(child.name);
            if (!(sourceMesh instanceof THREE.Mesh)) return;
            child.geometry = sourceMesh.geometry;
            child.material = sourceMesh.material;
          });
        }
        const base = group.userData.basePosition as number[];
        const animation = group.userData.animation as AnimationKind;
        const keyframes = ((group.userData.keyframes ?? []) as TransformKeyframe[]).slice().sort((a, b) => a.time - b.time);
        const sample = sampleTransform(keyframes, timeRef.current);
        if (sample && shouldSampleAnimation(playingRef.current, timeRef.current, group.userData.lastAnimationSampleTime)) {
          group.userData.lastAnimationSampleTime = timeRef.current;
          group.position.fromArray(sample.position);
          group.scale.fromArray(sample.scale);
          group.rotation.set(
            THREE.MathUtils.degToRad(sample.rotation[0]),
            THREE.MathUtils.degToRad(sample.rotation[1]),
            THREE.MathUtils.degToRad(sample.rotation[2])
          );
          const pose = sampleBonePose(keyframes, timeRef.current);
          if (pose) findRigBones(group).forEach((bone, name) => { if (pose[name]) bone.quaternion.fromArray(pose[name]); });
        } else if (!sample && playingRef.current) {
          if (animation === "spin") group.rotation.y += delta * 1.4;
          if (animation === "float") group.position.y = base[1] + Math.sin(t) * 0.45;
          if (animation === "bounce") group.position.y = base[1] + Math.abs(Math.sin(t * 1.5)) * 1.2;
        }
        if ((group.userData.constraints as string[] | undefined)?.includes("Face camera")) {
          group.lookAt(camera.position.x, group.position.y, camera.position.z);
        }
        const body = runtime.physics.get(id);
        if (body) {
          group.position.set(
            body.body.position.x - body.offset.x,
            body.body.position.y - body.offset.y,
            body.body.position.z - body.offset.z
          );
          group.quaternion.set(body.body.quaternion.x, body.body.quaternion.y, body.body.quaternion.z, body.body.quaternion.w);
          group.userData.basePosition = group.position.toArray();
        }
        if (!body) displayClothBake(group, timeRef.current, runtime.objects.values());
        else clearClothDisplay(group);
      });
      runtime.vehicles.forEach(({ vehicle, wheelIds }) => {
        wheelIds.forEach((wheelId, index) => {
          vehicle.updateWheelTransform(index);
          const transform = vehicle.wheelInfos[index].worldTransform;
          const wheel = runtime.objects.get(wheelId);
          if (!wheel) return;
          wheel.position.set(transform.position.x, transform.position.y, transform.position.z);
          wheel.quaternion.set(transform.quaternion.x, transform.quaternion.y, transform.quaternion.z, transform.quaternion.w);
        });
      });
      scene.traverse((object) => {
        if (object instanceof THREE.SkinnedMesh && object.userData.poseCorrectives?.length) {
          updatePoseCorrectives(object);
        }
      });
      const selected = selectedRef.current ? runtime.objects.get(selectedRef.current) : null;
      if (selected) {
        selectionHelper.setFromObject(selected);
        const anchor = new THREE.Box3().setFromObject(selected).getCenter(new THREE.Vector3());
        anchor.project(camera);
        if (contextRef.current) {
          contextRef.current.style.left = `${(anchor.x * 0.5 + 0.5) * host.clientWidth}px`;
          contextRef.current.style.top = `${(-anchor.y * 0.5 + 0.5) * host.clientHeight - 58}px`;
          contextRef.current.style.display = "flex";
        }
      } else if (contextRef.current) {
        contextRef.current.style.display = "none";
      }
      composer.render();
    };
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("pointermove", contextTapMove);
      renderer.domElement.removeEventListener("pointercancel", pointerCancel);
      renderer.domElement.removeEventListener("contextmenu", contextMenu);
      transform.dispose();
      orbit.dispose();
      composer.dispose();
      environmentTarget.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (host.contains(renderer.domElement)) host.removeChild(renderer.domElement);
      runtimeRef.current = null;
    };
  }, [announce, selectObject, syncItems]);

  const focusSelection = useCallback(() => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!runtime || !group) return;
    const bounds = new THREE.Box3().setFromObject(group);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = Math.max(0.12, bounds.getSize(new THREE.Vector3()).length());
    runtime.camera.near = Math.min(0.08, size / 100);
    runtime.camera.updateProjectionMatrix();
    runtime.camera.position.copy(center).add(new THREE.Vector3(1, 0.75, 1).normalize().multiplyScalar(size * 2.6));
    runtime.orbit.target.copy(center);
    runtime.orbit.update();
    announce("Focused selection");
  }, [announce]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      // Load device recipes before either startup branch, including explicit
      // document / Animation handoffs. Corrupt storage cannot abort startup.
      try {
        const saved: unknown = JSON.parse(localStorage.getItem("form-recipes") ?? "[]");
        if (Array.isArray(saved)) setRecipes(saved.filter(r => r && typeof r.id === "string" && typeof r.name === "string" && validEffectRecipe(r.data)).slice(0, 20));
      } catch { /* Keep invalid local data recoverable; do not overwrite it. */ }
      const initial = initialDocumentRef.current;
      if (initial) {
        try {
          const runtime = runtimeRef.current;
          if (!runtime) throw new Error("Animation viewport is not ready");
          const updates = (initial.models ?? []).filter((model) => model.updateExisting);
          const additions = await loadAnimationSnapshots((initial.models ?? []).filter((model) => !model.updateExisting));
          if (cancelled || runtimeRef.current !== runtime) return;
          const original = parseProject(initial.contents);
          applyProject(updates.reduce(updateLinkedModelInProject, original), !initial.dirty && additions.length === 0, Boolean(saveSession));
          if (updates.length) {
            historyRef.current.past.push((formWorkspace<FormSceneWorkspace<SceneObjectData>>(original, "scene")?.data.scene ?? []));
            const refreshed = [...runtime.objects.values()].find((group) => group.userData.asset?.name === `${updates[0].sourceId}.gltf`);
            if (refreshed) selectObject(refreshed);
          }
          projectPathRef.current = initial.path;
          for (const group of additions) { runtime.root.add(group); runtime.objects.set(group.userData.editorId, group); }
          if (additions.length) { selectObject(additions[0]); syncItems(); focusSelection(); }
          announce(updates.length ? "Linked models updated · motion preserved · cloth bake cleared · Undo available" : additions.length ? `${additions.length} animation copies added · CAD originals preserved` : "Animation Studio · same Form project");
        } catch (error) { announce(error instanceof Error ? error.message : "Unable to open animation project"); }
        finally { if (!cancelled) setAnimationImportBusy(false); }
        return; // Explicit document handoffs must never be overwritten by old recovery or room data.
      }
      const query = new URLSearchParams(window.location.search);
      setEmbed(query.get("embed") === "1");
      const id = query.get("room") || localStorage.getItem("form-room-id") || newId("room");
      localStorage.setItem("form-room-id", id);
      setRoomId(id);
      try {
        setVersions(JSON.parse(localStorage.getItem("form-versions") ?? "[]"));
        setCameraShots(JSON.parse(localStorage.getItem("form-cameras") ?? "[]"));
        setGroups(JSON.parse(localStorage.getItem("form-groups") ?? "[]"));
        setBranches(JSON.parse(localStorage.getItem("form-branches") ?? "[]"));
        setSavedMacros(JSON.parse(localStorage.getItem("form-pro-macros") ?? "[]"));
        if (!query.get("room")) {
          if (isDesktopApp()) {
            void invoke<Array<{ contents: string; savedAtMs: number }>>("read_autosave_projects", { workspace: "rig" }).then((autosaves) => {
              if (autosaves[0]?.contents) applyProject(parseProject(autosaves[0].contents), false);
            }).catch(() => undefined);
          } else {
            const autosave = localStorage.getItem("form-project-autosave");
            if (autosave) applyProject(parseProject(autosave), false);
          }
        }
      } catch {
        localStorage.removeItem("form-versions");
      }
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [announce, applyProject, focusSelection, saveSession, selectObject, syncItems]);

  const refreshRoom = useCallback(async (applyScene = false) => {
    if (!roomId) return;
    if (isLocalOnly()) {
      hydratedRef.current = true;
      setSyncState("local");
      return;
    }
    try {
      const response = await fetch(`/api/scenes?room=${encodeURIComponent(roomId)}`);
      if (!response.ok) return;
      const data = await response.json() as {
        scene: { scene_json: string; updated_at: number; revision: number } | null;
        comments: CommentData[];
        presence: PresenceData[];
        me?: { user_id: string };
        revision?: number;
      };
      if (data.me?.user_id) userIdRef.current = data.me.user_id;
      setComments(data.comments ?? []);
      setPresence((data.presence ?? []).filter((item) => item.user_id !== userIdRef.current));
      const incomingRevision = Number(data.scene?.revision ?? data.revision ?? 0);
      if (data.scene && (applyScene || incomingRevision > remoteRevisionRef.current)) {
        lastRemoteRef.current = data.scene.updated_at;
        remoteRevisionRef.current = incomingRevision;
        const incoming = JSON.parse(data.scene.scene_json) as SceneObjectData[];
        if (applyScene || hydratedRef.current) restoreScene(incoming, true);
      }
      hydratedRef.current = true;
      setSyncState("synced");
    } catch {
      hydratedRef.current = true;
      setSyncState("local");
    }
  }, [restoreScene, roomId]);

  useEffect(() => {
    if (!roomId) return;
    const initial = window.setTimeout(() => refreshRoom(true), 0);
    const poll = window.setInterval(() => refreshRoom(false), 5000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(poll);
    };
  }, [refreshRoom, roomId]);

  useEffect(() => {
    if (isLocalOnly() || !roomId || !hydratedRef.current || applyingRemoteRef.current || sceneItems.length === 0) return;
    setSyncState("saving");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/scenes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            roomId, title: projectName || "Untitled scene", scene: sceneItems,
            baseRevision: remoteRevisionRef.current,
          }),
        });
        const data = await response.json() as { updatedAt?: number; revision?: number; error?: string };
        if (response.status === 409) {
          setSyncState("local");
          announce("A collaborator saved first. Their revision was loaded so your local history stays recoverable.");
          await refreshRoom(true);
          return;
        }
        if (!response.ok) throw new Error(data.error ?? "Unable to sync");
        if (data.updatedAt) lastRemoteRef.current = data.updatedAt;
        if (data.revision) remoteRevisionRef.current = data.revision;
        setSyncState("synced");
      } catch {
        setSyncState("local");
      }
    }, 850);
    return () => window.clearTimeout(timer);
  }, [announce, projectName, refreshRoom, roomId, sceneItems]);

  useEffect(() => {
    if (isLocalOnly() || !roomId) return;
    const postPresence = () => {
      fetch("/api/scenes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomId, action: "presence", color: userColorRef.current, ...pointerPresenceRef.current,
        }),
      }).catch(() => undefined);
    };
    postPresence();
    const interval = window.setInterval(postPresence, 3500);
    return () => window.clearInterval(interval);
  }, [roomId]);

  useEffect(() => {
    if (cadOpen || animationImportBusy) return;
    const project = captureProject();
    if (!project) return;
    if (saveSession) documentSession.checkpointProject(project, "Animation", "Animation or scene edit");
    else documentSession.observeProject(project);
    const timer = window.setTimeout(() => {
      const latest = captureProject();
      if (latest) void storeProjectRecovery(serializeProject(latest)).catch(() => announce("Recovery snapshot failed; save the project to a file now"));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [
    cadOpen,
    animationImportBusy,
    documentSession,
    saveSession,
    announce,
    avoidCollisions,
    bloom,
    cameraShots,
    captureProject,
    depthOfField,
    environment,
    gridVisible,
    groups,
    lastSavedAt,
    projectName,
    qualityMode,
    sceneItems,
    snap,
  ]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!projectDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [projectDirty]);

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { activeVehicleRef.current = activeVehicleId; }, [activeVehicleId]);
  useEffect(() => {
    weightPaintRef.current = {
      enabled: weightPaint,
      bone: rigBone,
      radius: weightRadius,
      strength: weightStrength,
      erase: weightErase,
    };
  }, [rigBone, weightErase, weightPaint, weightRadius, weightStrength]);
  useEffect(() => {
    const runtime = runtimeRef.current;
    if (runtime) runtime.transform.setMode(mode);
  }, [mode]);
  useEffect(() => {
    const runtime = runtimeRef.current;
    if (runtime) runtime.grid.visible = gridVisible;
  }, [gridVisible]);
  useEffect(() => {
    const runtime = runtimeRef.current;
    if (runtime) runtime.bloom.enabled = bloom;
  }, [bloom]);
  useEffect(() => {
    const runtime = runtimeRef.current;
    if (runtime) runtime.bokeh.enabled = depthOfField;
  }, [depthOfField]);
  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const ratio = qualityMode === "Fast" ? 1 : compactUi.compact ? currentPreviewPixelRatio() : qualityMode === "Studio" ? Math.min(window.devicePixelRatio, 2) : Math.min(window.devicePixelRatio, 3);
    runtime.renderer.setPixelRatio(ratio);
    runtime.key.shadow.mapSize.set(qualityMode === "Fast" ? 1024 : qualityMode === "Studio" ? 2048 : 4096, qualityMode === "Fast" ? 1024 : qualityMode === "Studio" ? 2048 : 4096);
    runtime.renderPass.enabled = qualityMode !== "Final";
    runtime.ssaa.enabled = qualityMode === "Final";
    runtime.ssaa.sampleLevel = qualityMode === "Final" ? 2 : 1;
    runtime.bloom.enabled = qualityMode === "Final" || bloom;
    runtime.bokeh.enabled = qualityMode === "Final" || depthOfField;
    runtime.grid.visible = qualityMode !== "Final" && gridVisible;
    runtime.renderer.toneMappingExposure = qualityMode === "Final" ? 1.18 : 1.08;
    const host = viewportRef.current;
    if (host) {
      runtime.renderer.setSize(host.clientWidth, host.clientHeight, false);
      runtime.composer.setSize(host.clientWidth, host.clientHeight);
    }
    announce(`${qualityMode} quality enabled`);
  }, [announce, bloom, compactUi.compact, depthOfField, gridVisible, qualityMode]);
  useEffect(() => {
    timeRef.current = timeline;
  }, [timeline]);

  useEffect(() => {
    const canvas = sketchCanvasRef.current;
    if (!canvas) return;
    const width = Math.max(260, canvas.clientWidth);
    const height = 150;
    canvas.width = width * Math.min(window.devicePixelRatio, 2);
    canvas.height = height * Math.min(window.devicePixelRatio, 2);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(Math.min(window.devicePixelRatio, 2), Math.min(window.devicePixelRatio, 2));
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#e9ebe4";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#343a35";
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    if (sketchPoints.length > 0) {
      context.beginPath();
      context.moveTo(sketchPoints[0][0], sketchPoints[0][1]);
      sketchPoints.slice(1).forEach(([x, y]) => context.lineTo(x, y));
      context.stroke();
    }
  }, [activePanel, sketchPoints]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const themes: Record<string, [string, string, string, string, number]> = {
      Studio: ["#aeb8b5", "#f4f6ed", "#fff8e8", "#b9c8ff", 1.05],
      Daylight: ["#b9cde2", "#eff8ff", "#fff1d4", "#d9e8ff", 1.15],
      Dusk: ["#5f6072", "#b9b5d9", "#ffb47b", "#8b78d4", 0.95],
      Midnight: ["#1e2630", "#8ea7c3", "#a8c9ff", "#6954b5", 0.72],
      Product: ["#d9d7cf", "#ffffff", "#ffffff", "#d9efff", 1.25],
    };
    const theme = themes[environment];
    runtime.scene.background = new THREE.Color(theme[0]);
    runtime.scene.fog = new THREE.Fog(theme[0], 15, 38);
    runtime.ambient.color.set(theme[1]);
    runtime.key.color.set(theme[2]);
    runtime.fill.color.set(theme[3]);
    runtime.renderer.toneMappingExposure = theme[4];
  }, [environment]);

  const updateSelection = (field: keyof SceneObjectData, value: unknown, axis?: number) => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!runtime || !group) return;
    if (["position", "rotation", "scale"].includes(field)) { playingRef.current = false; setPlaying(false); }
    pushHistory();
    const material = materialOf(group);
    if (field === "name") group.name = String(value);
    if (field === "color" && material) {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          child.material.color.set(String(value));
        }
      });
    }
    if (field === "roughness" && material) material.roughness = Number(value);
    if (field === "metalness" && material) material.metalness = Number(value);
    if (field === "clearcoat" && material) material.clearcoat = Number(value);
    if (field === "sheen" && material) material.sheen = Number(value);
    if (field === "transmission" && material) material.transmission = Number(value);
    if (field === "thickness" && material) material.thickness = Number(value);
    if (field === "iridescence" && material) material.iridescence = Number(value);
    if (field === "position" && axis !== undefined) {
      group.position.setComponent(axis, Number(value));
      group.userData.basePosition = group.position.toArray();
    }
    if (field === "rotation" && axis !== undefined) {
      const next = [group.rotation.x, group.rotation.y, group.rotation.z];
      next[axis] = THREE.MathUtils.degToRad(Number(value));
      group.rotation.set(next[0], next[1], next[2]);
    }
    if (field === "scale" && axis !== undefined) group.scale.setComponent(axis, Math.max(0.03, Number(value)));
    if (field === "animation") group.userData.animation = value;
    if (field === "visible") group.visible = Boolean(value);
    if (field === "locked") {
      group.userData.locked = Boolean(value);
      if (value) runtime.transform.detach();
      else runtime.transform.attach(group);
    }
    runtime.selectionHelper.setFromObject(group);
    syncPhysicsBody(runtime, group);
    setSelection(readObject(group));
    setSelectionDimensions(dimensionsOf(group));
    syncItems();
  };

  const applyShaderPreset = (preset: (typeof SHADER_PRESETS)[number]) => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!runtime || !group) return;
    pushHistory();
    group.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) return;
      if (child.material instanceof THREE.MeshStandardMaterial && !(child.material instanceof THREE.MeshPhysicalMaterial)) {
        const previous = child.material;
        child.material = new THREE.MeshPhysicalMaterial({
          color: previous.color,
          map: previous.map,
          normalMap: previous.normalMap,
          roughnessMap: previous.roughnessMap,
          metalnessMap: previous.metalnessMap,
          transparent: previous.transparent,
          opacity: previous.opacity,
        });
        previous.dispose();
      }
      if (child.material instanceof THREE.MeshPhysicalMaterial) {
        child.material.color.set(preset.color);
        child.material.sheenColor.set(preset.color);
        child.material.roughness = preset.roughness;
        child.material.metalness = preset.metalness;
        child.material.clearcoat = preset.clearcoat;
        child.material.sheen = preset.sheen;
        child.material.transmission = preset.transmission;
        child.material.thickness = preset.thickness;
        child.material.iridescence = preset.iridescence;
        child.material.needsUpdate = true;
      }
    });
    setSelection(readObject(group));
    syncItems();
    announce(`${preset.name} shader applied`);
  };

  const removeSelected = useCallback(() => {
    const runtime = runtimeRef.current;
    if (!runtime || selectedIds.length === 0) return;
    pushHistory();
    selectedIds.forEach((id) => {
      const vehicleRig = [...runtime.vehicles.entries()].find(([, rig]) =>
        rig.chassisId === id || rig.wheelIds.includes(id)
      );
      if (vehicleRig) {
        const [rigId, rig] = vehicleRig;
        rig.vehicle.removeFromWorld(runtime.physicsWorld);
        runtime.vehicles.delete(rigId);
        runtime.physics.delete(rig.chassisId);
        [rig.chassisId, ...rig.wheelIds].forEach((partId) => {
          const part = runtime.objects.get(partId);
          if (!part) return;
          part.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              if (child.material instanceof THREE.Material) child.material.dispose();
            }
          });
          runtime.root.remove(part);
          runtime.objects.delete(partId);
        });
        if (activeVehicleRef.current === rigId) setActiveVehicleId(null);
        return;
      }
      const group = runtime.objects.get(id);
      if (!group || group.userData.locked) return;
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) child.material.dispose();
        }
      });
      const physics = runtime.physics.get(id);
      if (physics) {
        runtime.rigConstraints = runtime.rigConstraints.filter((constraint) => {
          if (constraint.bodyA !== physics.body && constraint.bodyB !== physics.body) return true;
          runtime.physicsWorld.removeConstraint(constraint);
          return false;
        });
        runtime.physicsWorld.removeBody(physics.body);
        runtime.physics.delete(id);
      }
      runtime.root.remove(group);
      runtime.objects.delete(id);
    });
    selectObject(null);
    syncItems();
    announce("Selection removed");
  }, [announce, pushHistory, selectObject, selectedIds, syncItems]);

  const duplicateSelected = useCallback((count = 1, radial = false) => {
    const runtime = runtimeRef.current;
    const source = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!runtime || !source) return;
    pushHistory();
    let last: THREE.Group | null = null;
    for (let i = 0; i < Math.min(count, 16); i++) {
      const data = readObject(source);
      data.id = newId();
      data.name = `${source.name} copy ${i + 1}`;
      if (radial) {
        const angle = ((i + 1) / count) * Math.PI * 2;
        data.position = [
          round(source.position.x + Math.cos(angle) * 3),
          round(source.position.y),
          round(source.position.z + Math.sin(angle) * 3),
        ];
        data.rotation[1] = round(THREE.MathUtils.radToDeg(-angle));
      } else {
        data.position = [data.position[0] + (i + 1) * 0.55, data.position[1], data.position[2] + (i + 1) * 0.55];
      }
      if (data.type === "imported") {
        last = source.clone(true);
        last.userData = structuredClone(source.userData);
        last.userData.editorId = data.id;
        last.name = data.name;
        last.position.fromArray(data.position);
        last.rotation.set(
          THREE.MathUtils.degToRad(data.rotation[0]),
          THREE.MathUtils.degToRad(data.rotation[1]),
          THREE.MathUtils.degToRad(data.rotation[2])
        );
        last.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry = child.geometry.clone();
            if (Array.isArray(child.material)) child.material = child.material.map((material) => material.clone());
            else child.material = child.material.clone();
          }
        });
      } else {
        last = createPrimitive(data);
      }
      runtime.root.add(last);
      runtime.objects.set(last.userData.editorId, last);
    }
    syncItems();
    if (last) selectObject(last);
    announce(`${count} ${count === 1 ? "copy" : "copies"} created`);
  }, [announce, pushHistory, selectObject, syncItems]);

  const applyModifier = (kind: "bevel" | "mirror" | "array" | "bend" | "cut") => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!runtime || !group) return;
    pushHistory();
    const modifiers = group.userData.modifiers as ModifierState;
    if (kind === "bevel") {
      modifiers.bevel = !modifiers.bevel;
      if (group.userData.primitive !== "box") announce("Round is most visible on cubes");
    }
    if (kind === "mirror") modifiers.mirror = !modifiers.mirror;
    if (kind === "array") modifiers.array = modifiers.array >= 4 ? 1 : modifiers.array + 1;
    if (kind === "bend") {
      modifiers.bend = modifiers.bend >= 0.8 ? 0 : round(modifiers.bend + 0.2);
    }
    if (kind === "cut") {
      const mesh = primaryMesh(group);
      if (mesh) {
        try {
          const base = new Brush(mesh.geometry.clone(), mesh.material);
          const cutter = new Brush(
            new THREE.CylinderGeometry(0.26, 0.26, 3, 32),
            new THREE.MeshStandardMaterial()
          );
          cutter.rotation.x = Math.PI / 2;
          base.updateMatrixWorld();
          cutter.updateMatrixWorld();
          const result = new Evaluator().evaluate(base, cutter, SUBTRACTION);
          mesh.geometry.dispose();
          mesh.geometry = result.geometry;
          announce("Boolean cut applied");
        } catch {
          announce("This shape cannot be cut yet");
        }
      }
    }
    if (kind !== "cut") rebuildShapeGeometry(group);
    refreshModifierClones(group);
    setSelection(readObject(group));
    setSelectionDimensions(dimensionsOf(group));
    syncItems();
  };

  const applyShapeOperation = (kind: ShapeOperationKind) => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!runtime || !group) return announce("Select an editable shape first");
    if (group.userData.primitive === "imported") return announce("Parametric shape tools work on Form primitives");
    pushHistory();
    const labels: Record<ShapeOperationKind, string> = {
      pull: "Pull face",
      taper: "Taper",
      twist: "Twist",
      inset: "Inset",
    };
    const next: ShapeOperation = {
      id: newId("operation"),
      kind,
      label: labels[kind],
      amount: kind === "twist" ? 0.55 : 0.45,
      enabled: true,
    };
    group.userData.operations = [...(group.userData.operations ?? []), next];
    rebuildShapeGeometry(group);
    refreshModifierClones(group);
    setSelection(readObject(group));
    setSelectionDimensions(dimensionsOf(group));
    syncItems();
    announce(`${labels[kind]} added non-destructively`);
  };

  const updateShapeOperation = (id: string, action: "toggle" | "up" | "down" | "remove" | "duplicate", amount?: number) => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!runtime || !group || group.userData.locked) return;
    const before = (group.userData.operations ?? []) as ShapeOperation[];
    let operations: ShapeOperation[];
    try { operations = editEffectStack(before, id, action, () => newId("operation"), amount); }
    catch (error) { return announce((error as Error).message); }
    if (operations === before) return;
    pushHistory();
    group.userData.operations = operations;
    rebuildShapeGeometry(group);
    refreshModifierClones(group);
    setSelection(readObject(group));
    setSelectionDimensions(dimensionsOf(group));
    syncItems();
  };

  const setComponentMode = (nextMode: MeshEditMode) => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!runtime || !group) return announce("Select a Form object first");
    if (group.userData.primitive === "imported") return announce("Convert imported assets before component editing");
    removeComponentOverlay(group);
    meshEditRef.current.selected.clear();
    meshEditRef.current = {
      mode: nextMode,
      groupId: nextMode === "object" ? null : group.userData.editorId,
      selected: new Set(),
      semantic: null,
    };
    setMeshEditMode(nextMode);
    setComponentSelectionCount(0);
    if (nextMode === "object") {
      if (!group.userData.locked) runtime.transform.attach(group);
      runtime.selectionHelper.visible = true;
      setRigStatus("Object mode · transforms and scene relationships");
      return;
    }
    rebuildShapeGeometry(group);
    const mesh = primaryMesh(group);
    if (mesh) createComponentOverlay(mesh, meshEditRef.current.selected);
    runtime.transform.detach();
    runtime.selectionHelper.visible = false;
    setRigStatus(`${nextMode[0].toUpperCase()}${nextMode.slice(1)} mode · click components, Shift-click to add`);
  };

  const applyComponentEdit = (kind: MeshEditKind) => {
    const runtime = runtimeRef.current;
    const session = meshEditRef.current;
    const group = session.groupId ? runtime?.objects.get(session.groupId) : null;
    const mesh = primaryMesh(group);
    if (!runtime || !group || !mesh || session.mode === "object") return announce("Enter a component mode first");
    if (!session.selected.size) return announce(`Select ${session.mode} components in the viewer`);
    if (kind === "extrude" && (session.mode !== "face" || session.selected.size !== 3)) {
      return announce("Select one triangular face to extrude");
    }
    pushHistory();
    const labels: Record<MeshEditKind, string> = {
      extrude: "Extrude face",
      inset: "Inset selection",
      bevel: "Bevel components",
      smooth: "Smooth selection",
      weld: "Weld selection",
    };
    const beforeCount = (mesh.geometry.attributes.position as THREE.BufferAttribute).count;
    const command: MeshEditCommand = {
      id: newId("mesh-edit"),
      kind,
      label: labels[kind],
      amount: kind === "weld" ? 1 : meshEditAmount,
      selected: [...session.selected],
      semantic: session.mode === "face" && session.semantic
        ? structuredClone(session.semantic)
        : undefined,
      enabled: true,
    };
    group.userData.meshEdits = [...(group.userData.meshEdits ?? []), command];
    removeComponentOverlay(group);
    rebuildShapeGeometry(group);
    refreshModifierClones(group);
    const evaluated = primaryMesh(group);
    if (kind === "extrude") session.selected = new Set([beforeCount, beforeCount + 1, beforeCount + 2]);
    else {
      const count = evaluated ? (evaluated.geometry.attributes.position as THREE.BufferAttribute).count : 0;
      session.selected = new Set([...session.selected].filter((index) => index < count));
    }
    meshEditRef.current = session;
    if (evaluated) createComponentOverlay(evaluated, session.selected);
    setComponentSelectionCount(session.selected.size);
    setSelection(readObject(group));
    setSelectionDimensions(dimensionsOf(group));
    syncItems();
    announce(`${labels[kind]} added to the live stack`);
  };

  const selectSemanticRegion = (rule: SemanticSelectionRule) => {
    const runtime = runtimeRef.current;
    const session = meshEditRef.current;
    const group = session.groupId ? runtime?.objects.get(session.groupId) : null;
    const mesh = primaryMesh(group);
    if (!group || !mesh || session.mode !== "face" || !session.semantic) {
      return announce("Pick a face first, then choose a smart region");
    }
    const semantic: SemanticSelection = {
      ...structuredClone(session.semantic),
      id: newId("region"),
      rule,
      label: rule === "picked" ? "Picked face" : `${rule[0].toUpperCase()}${rule.slice(1)} region`,
    };
    const selected = new Set(resolveSemanticSelection(mesh.geometry, semantic));
    session.semantic = semantic;
    session.selected = selected;
    removeComponentOverlay(group);
    createComponentOverlay(mesh, selected);
    setComponentSelectionCount(selected.size);
    announce(`${semantic.label} · ${Math.max(1, Math.round(selected.size / 3))} face${selected.size === 3 ? "" : "s"}`);
  };

  const updateIntentAmount = (amount: number) => {
    const runtime = runtimeRef.current;
    if (!intentPreview?.commandId || !intentPreview.groupId || !runtime) return;
    const group = runtime.objects.get(intentPreview.groupId);
    if (!group) return;
    const commands = structuredClone((group.userData.meshEdits ?? []) as MeshEditCommand[]);
    const command = commands.find((item) => item.id === intentPreview.commandId);
    if (!command) return;
    command.amount = THREE.MathUtils.clamp(amount, -2, 2);
    group.userData.meshEdits = commands;
    removeComponentOverlay(group);
    rebuildShapeGeometry(group);
    refreshModifierClones(group);
    const mesh = primaryMesh(group);
    if (mesh && meshEditRef.current.mode !== "object") {
      const selected = command.semantic
        ? new Set(resolveSemanticSelection(mesh.geometry, command.semantic))
        : new Set(command.selected);
      meshEditRef.current.selected = selected;
      createComponentOverlay(mesh, selected);
      setComponentSelectionCount(selected.size);
    }
    setIntentPreview({ ...intentPreview, amount: command.amount });
    setSelection(readObject(group));
    setSelectionDimensions(dimensionsOf(group));
    syncItems();
  };

  const makeIntentControl = () => {
    const runtime = runtimeRef.current;
    if (!intentPreview?.commandId || !intentPreview.groupId || !runtime) {
      return announce("Complete an Intent Drag first");
    }
    const group = runtime.objects.get(intentPreview.groupId);
    if (!group) return;
    pushHistory();
    const controlId = newId("control");
    const controls = structuredClone((group.userData.modelControls ?? []) as ModelControl[]);
    const existing = controls.find((control) => control.commandId === intentPreview.commandId);
    if (existing) {
      existing.name = controlName.trim() || existing.name;
    } else {
      controls.push({
        id: controlId,
        name: controlName.trim() || intentPreview.label,
        commandId: intentPreview.commandId,
        min: -1,
        max: 1.5,
      });
      const command = (group.userData.meshEdits as MeshEditCommand[])
        .find((item) => item.id === intentPreview.commandId);
      if (command) command.controlId = controlId;
    }
    group.userData.modelControls = controls;
    setSelection(readObject(group));
    syncItems();
    announce("Reusable modeling control created");
  };

  const updateModelControl = (control: ModelControl, amount: number) => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!runtime || !group) return;
    const command = ((group.userData.meshEdits ?? []) as MeshEditCommand[])
      .find((item) => item.id === control.commandId);
    if (!command) return;
    command.amount = amount;
    removeComponentOverlay(group);
    rebuildShapeGeometry(group);
    refreshModifierClones(group);
    setSelection(readObject(group));
    setSelectionDimensions(dimensionsOf(group));
    syncItems();
  };

  const updateMeshEditCommand = (
    id: string,
    action: "toggle" | "up" | "down" | "remove",
  ) => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!runtime || !group) return;
    pushHistory();
    const commands = structuredClone((group.userData.meshEdits ?? []) as MeshEditCommand[]);
    const index = commands.findIndex((command) => command.id === id);
    if (index < 0) return;
    if (action === "toggle") commands[index].enabled = !commands[index].enabled;
    if (action === "remove") commands.splice(index, 1);
    if (action === "up" && index > 0) [commands[index - 1], commands[index]] = [commands[index], commands[index - 1]];
    if (action === "down" && index < commands.length - 1) [commands[index + 1], commands[index]] = [commands[index], commands[index + 1]];
    group.userData.meshEdits = commands;
    removeComponentOverlay(group);
    rebuildShapeGeometry(group);
    const mesh = primaryMesh(group);
    meshEditRef.current.selected.clear();
    if (mesh && meshEditRef.current.mode !== "object") createComponentOverlay(mesh, meshEditRef.current.selected);
    setComponentSelectionCount(0);
    setSelection(readObject(group));
    setSelectionDimensions(dimensionsOf(group));
    syncItems();
  };

  const updateShaderGraph = (field: keyof ShaderGraphState, value: string | number) => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!runtime || !group) return announce("Select an object to shade");
    pushHistory();
    const graph = { ...defaultShaderGraph(), ...(group.userData.shaderGraph ?? {}) } as ShaderGraphState;
    if (field === "procedural") graph.procedural = value as ShaderGraphState["procedural"];
    else if (field === "uvProjection") graph.uvProjection = value as ShaderGraphState["uvProjection"];
    else graph[field] = Number(value) as never;
    group.userData.shaderGraph = graph;
    if (field === "uvProjection" && group.userData.primitive !== "imported") {
      removeComponentOverlay(group);
      rebuildShapeGeometry(group);
      const mesh = primaryMesh(group);
      if (mesh && meshEditRef.current.mode !== "object") createComponentOverlay(mesh, meshEditRef.current.selected);
    }
    applyShaderGraphToGroup(group);
    setSelection(readObject(group));
    syncItems();
  };

  const createLinkedInstance = () => {
    const runtime = runtimeRef.current;
    const source = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!runtime || !source) return announce("Select an object to instance");
    pushHistory();
    const instance = source.clone(true);
    instance.userData = structuredClone(source.userData);
    instance.userData.editorId = newId("instance");
    instance.userData.instanceSourceId = source.userData.editorId;
    instance.name = `${source.name} · instance`;
    instance.position.add(new THREE.Vector3(1.2, 0, 1.2));
    instance.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const sourceMesh = source.getObjectByName(child.name);
      if (sourceMesh instanceof THREE.Mesh) {
        child.geometry = sourceMesh.geometry;
        child.material = sourceMesh.material;
      }
    });
    runtime.root.add(instance);
    runtime.objects.set(instance.userData.editorId, instance);
    syncItems();
    selectObject(instance);
    announce("Linked instance created · geometry and materials stay shared");
  };

  const inspectSceneHealth = () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const report = analyzeSceneHealth(runtime.root);
    setSceneHealth(report);
    announce(`Resource heuristic ${report.score}/100 · professional acceptance not evaluated`);
  };

  const addRenderJob = () => {
    if (renderQueueBusy.current) return;
    if (!isDesktopApp()) return announce("Snapshot rendering requires the desktop native engine");
    const runtime=runtimeRef.current;
    if(!runtime) return;
    if(playing) return announce("Pause on the frame you want to capture before adding a shot");
    if(bloom || depthOfField) return announce("Native shots do not support viewport bloom or depth of field yet. Disable those effects explicitly before capture.");
    try {
      const scene=captureNativeRenderScene(runtime.root,runtime.scene,runtime.camera,runtime.renderer.toneMappingExposure,runtime.renderer);
      const shot=createRenderShot(scene,qualityMode,`Shot ${renderQueue.length+1}`,timeline*ANIMATION_SECONDS,runtime.camera instanceof THREE.PerspectiveCamera?runtime.camera.getFocalLength():null);
      const next=[...renderQueue,shot];validateRenderQueue(next,"storage");setRenderQueue(next);
      announce(`${shot.name} captured · ${shot.settings.width}×${shot.settings.height} · ${shot.settings.samples} samples${scene.warnings.length?` · ${scene.warnings.join(" · ")}`:""}`);
    } catch(error) {announce(error instanceof Error?error.message:"Shot capture failed");}
  };

  const runRenderJobs = async () => {
    if (renderQueueBusy.current || nativeSceneRenderBusy) return;
    if (!isDesktopApp()) return announce("Snapshot rendering requires the desktop native engine");
    if (!renderQueue.some((job) => job.status === "queued")) return announce("The render queue is empty");
    const jobs = renderQueue.filter((job) => job.status === "queued");
    renderQueueBusy.current = true;
    queueCancelled.current = false;setQueueRunning(true);
    const generation=documentGenerationRef.current;
    const cancelled=()=>queueCancelled.current || generation!==documentGenerationRef.current;
    try {
      await processRenderQueue(jobs,
        async job => {
          if(cancelled()) return "cancelled";
          try {
            validateRenderQueue([job]);
            announce(`Rendering saved ${job.name} · ${job.settings.samples} samples`);
            const result=await renderNativeAuthoredScene(job.scene,job.settings);
            if(cancelled()) return "cancelled";
            const path=await saveNativeRenderPng(result.png);
            return path?"complete":"cancelled";
          } catch(error) {
            if(!cancelled()) {
              const message=(error instanceof Error?error.message:"Render failed").slice(0,2000);
              setRenderQueue(current=>current.map(item=>item.id===job.id?{...item,error:message}:item));announce(message);
            }
            return "failed";
          }
        },
        (job, status) => {if(generation===documentGenerationRef.current) setRenderQueue(current => current.map(item => item.id === job.id ? { ...item, status } : item));});
    } finally { renderQueueBusy.current = false;setQueueRunning(false); }
  };

  const duplicateQueuedShot=(shot:RenderShot)=>{
    if(renderQueueBusy.current) return;
    try {const next=[...renderQueue,duplicateRenderShot(shot)];validateRenderQueue(next,"storage");setRenderQueue(next);}
    catch(error){announce(error instanceof Error?error.message:"Cannot duplicate shot");}
  };

  const saveMacro = () => {
    const macro = { id: newId("macro"), name: macroName.trim() || "Untitled macro", script: macroScript };
    const next = [macro, ...savedMacros].slice(0, 12);
    setSavedMacros(next);
    localStorage.setItem("form-pro-macros", JSON.stringify(next));
    announce(`${macro.name} saved`);
  };

  const runMacro = (script = macroScript) => {
    const lines = script.split(/\r?\n/).map((line) => line.trim().toLowerCase()).filter(Boolean);
    lines.forEach((line, index) => {
      window.setTimeout(() => {
        if (line === "bevel") applyModifier("bevel");
        if (line === "mirror") applyModifier("mirror");
        if (line === "array") applyModifier("array");
        if (line === "drop") paintPhysics("gravity");
        if (line === "render") renderPNG();
        if (line.startsWith("duplicate")) duplicateSelected(Number(line.match(/\d+/)?.[0] ?? 1));
        if (line.startsWith("quality")) {
          const value = line.split(/\s+/)[1];
          if (value === "fast" || value === "studio" || value === "final") {
            setQualityMode(`${value[0].toUpperCase()}${value.slice(1)}` as "Fast" | "Studio" | "Final");
          }
        }
        if (line.startsWith("material")) {
          const name = line.split(/\s+/).slice(1).join(" ");
          const preset = SHADER_PRESETS.find((item) => item.name.toLowerCase() === name);
          if (preset) applyShaderPreset(preset);
        }
      }, index * 100);
    });
    announce(`Running ${lines.length} professional actions`);
  };

  const setDimensions = (axis: number, value: number) => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!group) return;
    const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
    const current = size.getComponent(axis);
    if (current <= 0) return;
    updateSelection("scale", group.scale.getComponent(axis) * (value / current), axis);
  };

  const importModel = async (file: File) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    if (!/\.(glb|gltf|obj|stl)$/i.test(file.name)) return announce("Choose a GLB, glTF, OBJ, or STL model");
    pushHistory();
    try {
      const buffer = await file.arrayBuffer();
      let importedScene: THREE.Object3D;
      let asset: EmbeddedAsset;
      if (/\.(glb|gltf)$/i.test(file.name)) {
        const gltf = await new GLTFLoader().parseAsync(buffer, "");
        importedScene = gltf.scene;
        asset = await embedFile(file);
      } else {
        if (/\.obj$/i.test(file.name)) {
          importedScene = new OBJLoader().parse(new TextDecoder().decode(buffer));
        } else {
          const geometry = new STLLoader().parse(buffer);
          geometry.computeVertexNormals();
          importedScene = new THREE.Group();
          importedScene.add(new THREE.Mesh(
            geometry,
            new THREE.MeshPhysicalMaterial({ color: "#dfe8e7", roughness: 0.44, clearcoat: 0.18 }),
          ));
        }
        const converted = await new GLTFExporter().parseAsync(importedScene, { binary: true });
        const bytes = new Uint8Array(converted as ArrayBuffer);
        asset = {
          name: `${file.name.replace(/\.(obj|stl)$/i, "")}.glb`,
          mimeType: "model/gltf-binary",
          byteLength: bytes.byteLength,
          base64: encodeBytes(bytes),
        };
      }
      let triangles = 0;
      const importedMaterials = new Set<THREE.Material>();
      importedScene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          triangles += Math.floor((child.geometry.index?.count ?? child.geometry.attributes.position?.count ?? 0) / 3);
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((material) => importedMaterials.add(material));
        }
      });
      const wrapper = createImportedGroup(importedScene, {
        name: file.name.replace(/\.(glb|gltf|obj|stl)$/i, ""),
        asset,
      }, true);
      runtime.root.add(wrapper);
      runtime.objects.set(wrapper.userData.editorId, wrapper);
      syncItems();
      selectObject(wrapper);
      setAssetReport({
        name: wrapper.name,
        triangles,
        materials: importedMaterials.size,
        status: `${triangles > 250000 ? "Heavy · optimization recommended" : "Ready"} · embedded ${(asset.byteLength / 1_048_576).toFixed(1)} MB`,
      });
      announce(`${wrapper.name} imported, normalized, and packed into the project`);
    } catch {
      announce("That model could not be imported");
    }
  };

  const addAnatomicalCharacter = async (sex: "female" | "male") => {
    const runtime = runtimeRef.current;
    if (!runtime || animationImportBusy) return;
    setAnimationImportBusy(true);
    try {
      const { createAnimationBody } = await import("./animation-body");
      const { bodyMeasurementsForProfile } = await import("./fabric-engine");
      const profile = { sex, build: characterBuild, pose: "neutral" as const };
      const body = createAnimationBody(profile, bodyMeasurementsForProfile(profile, characterHeight));
      const buffer = await new GLTFExporter().parseAsync(body, { binary: true });
      const bytes = new Uint8Array(buffer as ArrayBuffer);
      if (runtimeRef.current !== runtime) return;
      pushHistory();
      const group = createImportedGroup(body, { name: body.name, asset: {
        name: `${sex}-anatomical-character.glb`, mimeType: "model/gltf-binary", byteLength: bytes.byteLength, base64: encodeBytes(bytes),
      } });
      autoSkinHumanoid(group);
      group.userData.autoRigProfile = { kind: "humanoid", softness: 0.42, pose: capturePose(group), strokes: [] };
      runtime.root.add(group); runtime.objects.set(group.userData.editorId, group);
      selectObject(group); syncItems(); focusSelection();
      announce(`${sex === "female" ? "Female" : "Male"} anatomical character added · same surface as Fabric · 17 editable bones`);
    } catch (error) { announce(error instanceof Error ? error.message : "Character could not be added"); }
    finally { setAnimationImportBusy(false); }
  };

  const openAnimationWorkspace = async (project: { contents: string; path: string | null; models?: AnimationModelSnapshot[] }) => {
    if (animationImportBusy) return;
    const runtime = runtimeRef.current;
    if (!runtime) return;
    setAnimationImportBusy(true);
    try {
      // Prepare all assets before closing Model: a failed transfer leaves CAD untouched.
      const updates = (project.models ?? []).filter((model) => model.updateExisting);
      const additions = await loadAnimationSnapshots((project.models ?? []).filter((model) => !model.updateExisting));
      if (runtimeRef.current !== runtime) return;
      const original = parseProject(project.contents);
      closeCadWorkspace({ ...project, contents: serializeProject(updates.reduce(updateLinkedModelInProject, original)) });
      if (updates.length) {
        pushHistory(formWorkspace<FormSceneWorkspace<SceneObjectData>>(original, "scene")?.data.scene ?? []);
        const refreshed = [...runtime.objects.values()].find((group) => group.userData.asset?.name === `${updates[0].sourceId}.gltf`);
        if (refreshed) selectObject(refreshed);
        announce("Linked models updated · motion preserved · cloth bake cleared · Undo available");
      }
      setActivePanel("rig");
      if (additions.length) {
        pushHistory();
        for (const group of additions) { runtime.root.add(group); runtime.objects.set(group.userData.editorId, group); }
        selectObject(additions[0]); syncItems(); focusSelection();
        announce(`${additions.length} model ${additions.length === 1 ? "copy" : "copies"} ready to animate · CAD originals preserved · save the Form project to keep both`);
      }
    } catch (error) { announce(error instanceof Error ? error.message : "Model transfer failed"); }
    finally { setAnimationImportBusy(false); }
  };

  const importLumaAsset = async (file: File) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    if (!/\.lumaform(?:text|mesh)?$/i.test(file.name)) return announce("Choose a .lumaform, .lumaformtext or .lumaformmesh asset");
    try {
      if (/\.lumaformmesh$/i.test(file.name)) {
        if (file.size > 8 * 1024 * 1024) throw new Error("Mesh exchange exceeds 8 MiB");
        const asset = parseFormMesh(await file.text()), group = createFormMesh(asset);
        // A returned mesh becomes a new scene object; never replace newer work by ID.
        group.userData.editorId = crypto.randomUUID(); group.userData.lumaMeshAsset = structuredClone(asset); group.userData.primitive = "imported";
        pushHistory(); runtime.root.add(group); runtime.objects.set(group.userData.editorId, group); syncItems(); selectObject(group);
        announce("Editable mesh imported · static geometry and solid PBR materials · return through Export"); return;
      }
      const isSpatial = /\.lumaform$/i.test(file.name);
      if (file.size > (isSpatial ? 16 : 4) * 1024 * 1024) throw new Error("Luma exchange file exceeds its import size limit");
      const source = await file.text();
      const spatialAsset = isSpatial ? parseLumaFormSpatialAsset(source) : null;
      const textAsset = spatialAsset ? null : parseLumaFormTextAsset(source);
      const assetId = (spatialAsset ?? textAsset)!.id;
      const existing = runtime.objects.get(assetId);
      if (existing && !existing.userData.lumaSpatialAsset && !existing.userData.lumaTextAsset) {
        throw new Error(`An unrelated scene object already uses the Luma id “${assetId}”`);
      }
      const group = spatialAsset ? createLumaSpatialObject(spatialAsset) : createLumaTextObject(textAsset!);
      const bounds = new THREE.Box3().setFromObject(group);
      group.position.y -= bounds.min.y;
      pushHistory();
      if (existing) {
        runtime.transform.detach();
        existing.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          child.geometry.dispose();
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((material) => {
            if ("map" in material && material.map instanceof THREE.Texture) material.map.dispose();
            material.dispose();
          });
        });
        const physics = runtime.physics.get(assetId);
        if (physics) {
          runtime.rigConstraints = runtime.rigConstraints.filter((constraint) => {
            if (constraint.bodyA !== physics.body && constraint.bodyB !== physics.body) return true;
            runtime.physicsWorld.removeConstraint(constraint);
            return false;
          });
          runtime.physicsWorld.removeBody(physics.body);
          runtime.physics.delete(assetId);
        }
        runtime.root.remove(existing);
      }
      runtime.root.add(group);
      runtime.objects.set(group.userData.editorId, group);
      if (projectContainerRef.current) projectContainerRef.current = spatialAsset
        ? upsertLumaSpatialAsset(projectContainerRef.current, spatialAsset)
        : upsertLumaTextAsset(projectContainerRef.current, textAsset!);
      syncItems();
      selectObject(group);
      announce(`${(spatialAsset ?? textAsset)!.name} ${existing ? "updated" : "imported"} as editable Luma ${spatialAsset ? "spatial content" : "typography"}`);
    } catch (error) {
      announce(error instanceof Error ? error.message : "The Luma text asset could not be imported");
    } finally {
      if (lumaTextInputRef.current) lumaTextInputRef.current.value = "";
    }
  };

  const optimizeSelection = () => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!runtime || !group) return announce("Select an asset to optimize");
    pushHistory();
    let triangles = 0;
    const materials = new Set<THREE.Material>();
    group.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.geometry.computeVertexNormals();
      child.geometry.computeBoundingBox();
      child.geometry.computeBoundingSphere();
      child.castShadow = true;
      child.receiveShadow = true;
      triangles += Math.floor((child.geometry.index?.count ?? child.geometry.attributes.position?.count ?? 0) / 3);
      const meshMaterials = Array.isArray(child.material) ? child.material : [child.material];
      meshMaterials.forEach((material) => {
        materials.add(material);
        if (material instanceof THREE.MeshStandardMaterial) {
          material.envMapIntensity = 1.2;
          material.needsUpdate = true;
        }
      });
    });
    const box = new THREE.Box3().setFromObject(group);
    group.position.y -= box.min.y;
    group.userData.basePosition = group.position.toArray();
    setAssetReport({
      name: group.name,
      triangles,
      materials: materials.size,
      status: "Normals repaired · grounded · render-ready",
    });
    setSelectionDimensions(dimensionsOf(group));
    syncItems();
    announce("Asset cleaned and grounded");
  };

  const applyTexture = async (file: File) => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!group) return announce("Select an object first");
    const url = URL.createObjectURL(file);
    const texture = await new THREE.TextureLoader().loadAsync(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        child.material.map = texture;
        child.material.needsUpdate = true;
      }
    });
    URL.revokeObjectURL(url);
    announce("Texture applied");
  };

  const sketchPointer = (event: React.PointerEvent<HTMLCanvasElement>, start = false) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (start) {
      sketchingRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setSketchPoints([]);
    }
    if (!sketchingRef.current) return;
    const point: [number, number] = [event.clientX - rect.left, event.clientY - rect.top];
    setSketchPoints((current) => [...current, point]);
  };

  const createFromSketch = () => {
    const canvas = sketchCanvasRef.current;
    if (!canvas || sketchPoints.length < 6) return announce("Draw a closed outline first");
    const rect = canvas.getBoundingClientRect();
    const sampled = sketchPoints.filter((_, index) => index % Math.max(1, Math.floor(sketchPoints.length / 36)) === 0);
    const normalized: [number, number][] = sampled.map(([x, y]) => [
      ((x / rect.width) - 0.5) * 2.2,
      (0.5 - y / rect.height) * 1.5,
    ]);
    addObject("sketch", undefined, {
      name: `Sketch form ${sceneItems.length + 1}`,
      sketchPoints: normalized,
      position: [0, 0.82, 0],
      color: "#d9d2c5",
      roughness: 0.34,
      clearcoat: 0.24,
    });
    setSketchPoints([]);
    announce("Sketch converted into an editable 3D form");
  };

  const matchPhotoScene = async (file: File) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const url = URL.createObjectURL(file);
    try {
      const texture = await new THREE.TextureLoader().loadAsync(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.mapping = THREE.EquirectangularReflectionMapping;
      runtime.scene.background = texture;
      runtime.camera.fov = 43;
      runtime.camera.updateProjectionMatrix();
      runtime.renderer.toneMappingExposure = 1.05;
      setEnvironment("Product");
      setPhotoMatched(true);
      announce("Photo matched to the scene camera and backdrop");
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
  };

  const captureMaterial = async (file: File) => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!group) return announce("Select an object before capturing a material");
    const url = URL.createObjectURL(file);
    const texture = await new THREE.TextureLoader().loadAsync(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    group.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || !(child.material instanceof THREE.MeshStandardMaterial)) return;
      child.material.map = texture;
      child.material.bumpMap = texture;
      child.material.bumpScale = 0.08;
      child.material.roughness = 0.54;
      child.material.metalness = 0.04;
      child.material.needsUpdate = true;
    });
    setSelection(readObject(group));
    URL.revokeObjectURL(url);
    announce("Photo converted into a tiled surface material");
  };

  const toggleAudioReactive = async () => {
    const group = selectedRef.current ? runtimeRef.current?.objects.get(selectedRef.current) : null;
    if (!group) return announce("Select an object first");
    if (audioReactiveRef.current) {
      audioReactiveRef.current.stream.getTracks().forEach((track) => track.stop());
      group.scale.copy(audioReactiveRef.current.baseScale);
      const material = materialOf(group);
      if (material) material.emissiveIntensity = 0;
      audioReactiveRef.current = null;
      setAudioReactive(false);
      return announce("Audio reaction stopped");
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 128;
      context.createMediaStreamSource(stream).connect(analyser);
      audioReactiveRef.current = {
        analyser,
        data: new Uint8Array(analyser.frequencyBinCount),
        stream,
        baseScale: group.scale.clone(),
      };
      setAudioReactive(true);
      announce("Material is now reacting to sound");
    } catch {
      announce("Microphone permission is needed for audio reaction");
    }
  };

  const startVoiceDirection = () => {
    type Recognition = {
      lang: string;
      interimResults: boolean;
      start: () => void;
      onresult: (event: { results: { 0: { transcript: string } }[] }) => void;
      onend: () => void;
      onerror: () => void;
    };
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;
    if (!SpeechRecognition) return announce("Voice direction is not supported in this browser");
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setCommand(transcript);
      setCommandOpen(true);
      announce("Voice direction captured · preview when ready");
    };
    recognition.onend = () => setVoiceListening(false);
    recognition.onerror = () => { setVoiceListening(false); announce("Voice direction could not start"); };
    setVoiceListening(true);
    recognition.start();
  };

  const exportGLB = async (name = "form-scene.glb") => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    // Named parts, PBR materials, embedded textures; editor-only userData is left out.
    const data = await blenderGlb(runtime.root, { generator: "Form", sourceUnits: "m, Y-up" });
    downloadBlob(data, name, "model/gltf-binary");
    announce("GLB exported · metres, Y-up · opens in Blender via File → Import → glTF 2.0");
  };

  const exportBlenderOBJ = async () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    try {
      const zip = await blenderObjZip([runtime.root], "Form scene", SCENE_FRAME, { app: "Form" });
      downloadBlob(zip.blob, "form-scene-obj.zip", "application/zip");
      announce(`OBJ + MTL ZIP exported · ${zip.parts} parts · metres, Y-up · Blender: File → Import → Wavefront (.obj)`);
    } catch (error) { announce(error instanceof Error ? error.message : "OBJ export failed"); }
  };

  const returnLumaText = async () => {
    if (lumaReturnSavingRef.current) return;
    lumaReturnSavingRef.current = true;
    try {
      if (selectedIds.length !== 1) throw new Error("Select one imported Luma text object");
      const object = runtimeRef.current?.objects.get(selectedIds[0]);
      if (!object?.userData.lumaTextAsset) throw new Error("Select an imported Luma text object");
      const contents = returnedLumaTextSource(object);
      if (isDesktopApp()) {
        const path = await invoke<string | null>("save_luma_text_source", { contents });
        if (!path) return;
      } else downloadBlob(contents, "form-return.lumaformtext", "application/json");
      announce("Luma source returned · text, local rotation and supported materials; scene placement and mesh edits are not included");
    } catch (error) { announce(error instanceof Error ? error.message : "Unable to return Luma text"); }
    finally { lumaReturnSavingRef.current = false; }
  };

  const returnLumaMesh = async () => {
    if (lumaReturnSavingRef.current) return; lumaReturnSavingRef.current = true;
    try {
      if (selectedIds.length !== 1) throw new Error("Select one static mesh object");
      const object = runtimeRef.current?.objects.get(selectedIds[0]); if (!object) throw new Error("Select a mesh object");
      if (object.userData.animation && object.userData.animation !== "none" || object.userData.keyframes?.length) throw new Error("Remove animation before static mesh exchange.");
      const contents = JSON.stringify(formMeshFromObject(object));
      if (isDesktopApp()) { if (!await invoke<string | null>("save_luma_mesh_source", { contents })) return; }
      else downloadBlob(contents, "form-return.lumaformmesh", "application/json");
      announce("Mesh returned · evaluated triangles, world transforms and solid PBR materials; opens as a new Luma document");
    } catch (error) { announce(error instanceof Error ? error.message : "Unable to return mesh"); }
    finally { lumaReturnSavingRef.current = false; }
  };

  const exportOBJ = () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const data = new OBJExporter().parse(runtime.root);
    downloadBlob(data, "form-scene.obj", "text/plain");
    announce("OBJ production model exported");
  };

  const exportSTL = () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const data = new STLExporter().parse(runtime.root, { binary: true });
    downloadBlob(data, "form-print.stl", "model/stl");
    announce("Binary STL exported for fabrication");
  };

  const exportAR = async () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    try {
      const data = await new USDZExporter().parseAsync(runtime.root);
      downloadBlob(data, "form-ar-scene.usdz", "model/vnd.usdz+zip");
      announce("AR-ready USDZ exported");
    } catch {
      announce("AR export needs texture-compatible materials");
    }
  };

  const renderNativeScene = async () => {
    const runtime=runtimeRef.current;
    if(!runtime || nativeSceneRenderBusy || renderQueueBusy.current) return;
    setNativeSceneRenderBusy(true);
    try {
      const scene=captureNativeRenderScene(runtime.root,runtime.scene,runtime.camera,runtime.renderer.toneMappingExposure,runtime.renderer);
      announce("Rendering a captured authored scene on the native GPU…");
      const result=await renderNativeAuthoredScene(scene,{width:640,height:Math.max(128,Math.min(1024,Math.round(640/scene.camera.aspect))),samples:24});
      const path=await saveNativeRenderPng(result.png);
      announce(path?`Native captured scene saved · ${scene.warnings.join(" · ")}`:"Native render completed · PNG save cancelled");
    } catch(error) {announce(error instanceof Error?error.message:"Native scene render failed");}
    finally {setNativeSceneRenderBusy(false);}
  };

  const renderPNG = async (filename = "form-render.png"): Promise<RenderOutcome> => {
    const runtime = runtimeRef.current;
    const host = viewportRef.current;
    if (!runtime || !host || pngRenderBusy.current) return "failed";
    pngRenderBusy.current = true;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const renderScale = Math.min(2.5, 4096 / Math.max(width, height));
    const outputWidth = Math.round(width * renderScale);
    const outputHeight = Math.round(height * renderScale);
    const previousRatio = runtime.renderer.getPixelRatio();
    try {
      announce("Rendering a high-resolution supersampled image…");
      let blob: Blob | null;
      try {
        runtime.renderer.setPixelRatio(1);
        runtime.renderer.setSize(outputWidth, outputHeight, false);
        runtime.composer.setSize(outputWidth, outputHeight);
        blob = await withoutRenderHelpers([runtime.grid, runtime.selectionHelper, runtime.transform.getHelper()], () => {
          runtime.composer.render();
          return new Promise<Blob | null>(resolve => runtime.renderer.domElement.toBlob(resolve, "image/png"));
        });
      } finally {
        runtime.renderer.setPixelRatio(previousRatio);
        runtime.renderer.setSize(width, height, false);
        runtime.composer.setSize(width, height);
      }
      if (!blob) throw new Error("The viewport could not produce a PNG image");
        if(isDesktopApp()) {
          const path=await saveNativeRenderPng(Array.from(new Uint8Array(await blob.arrayBuffer())));
          if(!path) { announce("PNG save cancelled"); return "cancelled"; }
        } else downloadBlob(blob, filename, "image/png");
        announce(`${outputWidth} × ${outputHeight} supersampled render saved`);
        return "complete";
    } catch(error) { announce(error instanceof Error?error.message:"PNG export failed"); return "failed"; }
    finally { pngRenderBusy.current = false; }
  };

  const recordSceneVideo = () => {
    const runtime = runtimeRef.current;
    if (!runtime || recording) return;
    const canvas = runtime.renderer.domElement as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream };
    if (!canvas.captureStream || typeof MediaRecorder === "undefined") return announce("Scene recording is not supported here");
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: "video/webm" });
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      downloadBlob(new Blob(chunks, { type: "video/webm" }), "form-scene.webm", "video/webm");
      setRecording(false);
      setPlaying(false);
      announce("Cinematic scene video saved");
    };
    setRecording(true);
    setPlaying(true);
    recorder.start();
    window.setTimeout(() => recorder.stop(), 7000);
    announce("Recording a 7-second scene story");
  };

  const autoCinematic = () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const bounds = new THREE.Box3().setFromObject(runtime.root);
    const center = bounds.getCenter(new THREE.Vector3());
    const radius = Math.max(4, bounds.getSize(new THREE.Vector3()).length() * 1.3);
    const shots = [
      new THREE.Vector3(1, 0.58, 1).normalize().multiplyScalar(radius).add(center),
      new THREE.Vector3(-1, 0.42, 0.75).normalize().multiplyScalar(radius * 0.9).add(center),
      new THREE.Vector3(0.35, 1.1, -1).normalize().multiplyScalar(radius * 1.05).add(center),
      new THREE.Vector3(0, 0.18, 1).normalize().multiplyScalar(radius * 0.62).add(center),
    ].map((position, index) => ({ name: ["Hero", "Profile", "Overhead", "Detail"][index], position: position.toArray(), target: center.toArray() }));
    setCameraShots(shots);
    localStorage.setItem("form-cameras", JSON.stringify(shots));
    setEnvironment("Product");
    setQualityMode("Final");
    setBloom(true);
    setDepthOfField(true);
    recallCamera(shots[0]);
    announce("Cinematic lighting and four-camera story created");
  };

  const launchAR = async () => {
    const xr = (navigator as Navigator & { xr?: { isSessionSupported: (mode: string) => Promise<boolean> } }).xr;
    const supported = xr ? await xr.isSessionSupported("immersive-ar").catch(() => false) : false;
    await exportAR();
    announce(supported ? "AR-ready scene created for this device" : "AR file downloaded · open it on a supported phone or headset");
  };

  const dropObject = (event: React.DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer.files[0]) {
      importModel(event.dataTransfer.files[0]);
      return;
    }
    const type = event.dataTransfer.getData("primitive") as Primitive;
    if (!PRIMITIVES.some((item) => item.type === type)) return;
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const rect = runtime.renderer.domElement.getBoundingClientRect();
    runtime.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    runtime.raycaster.setFromCamera(runtime.pointer, runtime.camera);
    const surface = runtime.raycaster.intersectObjects([...runtime.objects.values()], true)[0];
    const point = new THREE.Vector3();
    if (surface) {
      point.copy(surface.point);
      const normal = surface.face?.normal.clone().transformDirection(surface.object.matrixWorld);
      if (normal) point.add(normal.multiplyScalar(0.35));
    } else {
      runtime.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), point);
    }
    addObject(type, point);
  };

  const arrange = (modeName: "row" | "circle" | "stack" | "scatter") => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    pushHistory();
    const items = [...runtime.objects.values()].filter((item) => !item.userData.locked);
    items.forEach((item, index) => {
      if (modeName === "row") item.position.set((index - (items.length - 1) / 2) * 2, Math.max(0.7, item.position.y), 0);
      if (modeName === "circle") {
        const angle = (index / items.length) * Math.PI * 2;
        item.position.set(Math.cos(angle) * 3, Math.max(0.7, item.position.y), Math.sin(angle) * 3);
      }
      if (modeName === "stack") item.position.set(0, 0.7 + index * 1.45, 0);
      if (modeName === "scatter") item.position.set((Math.random() - 0.5) * 7, 3 + Math.random() * 4, (Math.random() - 0.5) * 7);
      item.userData.basePosition = item.position.toArray();
      if (modeName === "scatter") attachPhysicsBody(runtime, item, "gravity");
    });
    syncItems();
    announce(`${modeName[0].toUpperCase()}${modeName.slice(1)} arrangement applied`);
  };

  const applyConstraint = (constraint: "Ground" | "Center stage" | "Face camera" | "Equal spacing" | "Attach") => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!runtime || !group) return announce("Select an object first");
    pushHistory();
    if (constraint === "Ground") {
      const box = new THREE.Box3().setFromObject(group);
      group.position.y -= box.min.y;
    }
    if (constraint === "Center stage") {
      group.position.x = 0;
      group.position.z = 0;
    }
    if (constraint === "Face camera") {
      const constraints = (group.userData.constraints ?? []) as string[];
      group.userData.constraints = constraints.includes(constraint)
        ? constraints.filter((item) => item !== constraint)
        : [...constraints, constraint];
    }
    if (constraint === "Equal spacing") {
      const items = selectedIds.map((id) => runtime.objects.get(id)).filter(Boolean) as THREE.Group[];
      const targets = items.length > 1 ? items : [...runtime.objects.values()];
      targets.sort((a, b) => a.position.x - b.position.x);
      const start = -((targets.length - 1) * 1.8) / 2;
      targets.forEach((item, index) => {
        item.position.x = start + index * 1.8;
        item.userData.basePosition = item.position.toArray();
      });
    }
    if (constraint === "Attach") {
      const target = [...runtime.objects.values()].find((item) => item !== group);
      if (target) {
        const targetBox = new THREE.Box3().setFromObject(target);
        const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
        group.position.set(target.position.x, targetBox.max.y + size.y / 2, target.position.z);
      }
    }
    if (constraint !== "Face camera") {
      const constraints = (group.userData.constraints ?? []) as string[];
      if (!constraints.includes(constraint)) group.userData.constraints = [...constraints, constraint];
    }
    group.userData.basePosition = group.position.toArray();
    setSelection(readObject(group));
    setSelectionDimensions(dimensionsOf(group));
    syncItems();
    announce(`${constraint} relationship applied`);
  };

  const addSceneKit = (kit: "Podium" | "Backdrop" | "Light rig") => {
    if (kit === "Podium") {
      addObject("cylinder", new THREE.Vector3(0, 0.28, 0), { name: "Display podium", scale: [2.2, 0.38, 2.2], color: "#dad6cc", roughness: 0.48, clearcoat: 0.2 });
    }
    if (kit === "Backdrop") {
      addObject("plane", new THREE.Vector3(0, 0.02, -2.8), { name: "Sweep backdrop", rotation: [90, 0, 0], scale: [4.5, 4.5, 4.5], color: "#c8cec9", roughness: 0.82 });
    }
    if (kit === "Light rig") {
      setEnvironment("Product");
      setQualityMode("Final");
    }
    announce(`${kit} added`);
  };

  const paintPhysics = (mode: "gravity" | "wind" | "attract" | "bounce" | "cloth") => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const targets = selectedIds.length
      ? selectedIds.map((id) => runtime.objects.get(id)).filter(Boolean) as THREE.Group[]
      : selectedRef.current ? [runtime.objects.get(selectedRef.current)].filter(Boolean) as THREE.Group[] : [];
    if (!targets.length) return announce("Select one or more objects first");
    pushHistory();
    targets.forEach((group) => {
      attachPhysicsBody(runtime, group, mode);
    });
    setPhysicsMode(mode);
    announce(`${mode[0].toUpperCase()}${mode.slice(1)} physics painted onto ${targets.length} object${targets.length === 1 ? "" : "s"}`);
  };

  const autoRigSelection = () => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!runtime || !group) return announce("Select an object to auto-rig");
    attachPhysicsBody(runtime, group, "gravity");
    setRigStatus(`${group.name} has a fitted ${group.userData.primitive} collider`);
    announce(`${group.name} auto-rigged · press Drop to simulate`);
  };

  const autoRigHumanoid = () => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!runtime || !group) return announce("Import and select a character first");
    if (group.userData.primitive !== "imported") return announce("Humanoid skinning works on imported GLB or glTF characters");
    pushHistory();
    try {
      const analysis = analyzeHumanoid(group);
      const profile: AutoRigProfile = group.userData.autoRigProfile ?? {
        kind: "humanoid",
        softness: 0.42,
        pose: {},
        strokes: [],
      };
      const result = autoSkinHumanoid(group, profile.softness);
      profile.pose = capturePose(group);
      group.userData.autoRigProfile = profile;
      const availableBones = HUMANOID_BONE_NAMES.filter((name) => result.bones.has(name));
      const nextBone = availableBones[0] ?? [...result.bones.keys()][0] ?? "hips";
      const bone = result.bones.get(nextBone);
      setRigBones(availableBones.length ? [...availableBones] : [...result.bones.keys()]);
      setRigBone(nextBone);
      setRigBoneRotation(bone
        ? [
          THREE.MathUtils.radToDeg(bone.rotation.x),
          THREE.MathUtils.radToDeg(bone.rotation.y),
          THREE.MathUtils.radToDeg(bone.rotation.z),
        ]
        : [0, 0, 0]);
      setRigConfidence(analysis.confidence);
      setSkeletonVisible(group, true);
      setSkeletonVisibleState(true);
      setRigStatus(
        result.generated
          ? `Humanoid detected · ${Math.round(analysis.confidence * 100)}% · ${result.skeleton.bones.length} bones bound`
          : `Existing skeleton recognized · ${result.skeleton.bones.length} bones ready`,
      );
      setSelection(readObject(group));
      setSelectionDimensions(dimensionsOf(group));
      syncItems();
      announce(result.generated ? "Character skeleton and skin weights created" : "Existing character rig recognized and simplified");
    } catch (error) {
      announce(error instanceof Error ? error.message : "This character could not be auto-rigged");
    }
  };

  const chooseRigBone = (name: string) => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    const bone = group ? findRigBones(group).get(name) : null;
    setRigBone(name);
    setRigBoneRotation(bone
      ? [
        THREE.MathUtils.radToDeg(bone.rotation.x),
        THREE.MathUtils.radToDeg(bone.rotation.y),
        THREE.MathUtils.radToDeg(bone.rotation.z),
      ]
      : [0, 0, 0]);
    if (group && weightPreview) setWeightPreview(group, name, true);
  };

  const rotateRigBone = (axis: number, value: number) => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    const bone = group ? findRigBones(group).get(rigBone) : null;
    if (!group || !bone) return announce("Auto-rig a character first");
    if (playingRef.current || group.userData.locked) return announce("Pause and unlock the character before posing");
    if (!poseGestureRef.current) { pushHistory(); poseGestureRef.current = true; }
    const next = [...rigBoneRotation] as [number, number, number];
    next[axis] = value;
    bone.rotation.set(
      THREE.MathUtils.degToRad(next[0]),
      THREE.MathUtils.degToRad(next[1]),
      THREE.MathUtils.degToRad(next[2]),
    );
    const profile = group.userData.autoRigProfile as AutoRigProfile | undefined;
    if (profile) profile.pose = capturePose(group);
    setRigBoneRotation(next);
    setRigStatus(`Posing ${rigBone} · ${Math.round(value)}°`);
    syncItems();
  };

  const poseCharacter = (preset: HumanoidPosePreset) => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!group || findRigBones(group).size === 0) return announce("Auto-rig a character first");
    if (playingRef.current || group.userData.locked) return announce("Pause and unlock the character before posing");
    pushHistory();
    applyPosePreset(group, preset);
    const profile = group.userData.autoRigProfile as AutoRigProfile | undefined;
    if (profile) profile.pose = capturePose(group);
    chooseRigBone(rigBone);
    syncItems();
    setRigStatus(`${preset[0].toUpperCase()}${preset.slice(1)} pose applied · still fully editable`);
    announce(`${preset} pose applied`);
  };

  const toggleSkeleton = () => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!group || findRigBones(group).size === 0) return announce("Auto-rig a character first");
    const next = !skeletonVisible;
    setSkeletonVisible(group, next);
    setSkeletonVisibleState(next);
  };

  const toggleWeightPreview = () => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!group || findRigBones(group).size === 0) return announce("Auto-rig a character first");
    const next = !weightPreview;
    setWeightPreview(group, rigBone, next);
    setWeightPreviewState(next);
    if (!next) setWeightPaint(false);
  };

  const toggleWeightPainting = () => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!group || findRigBones(group).size === 0) return announce("Auto-rig a character first");
    const next = !weightPaint;
    setWeightPaint(next);
    setWeightPreview(group, rigBone, next || weightPreview);
    setWeightPreviewState(next || weightPreview);
    if (next) runtime?.transform.detach();
    else selectObject(group);
    setRigStatus(next ? `Painting ${rigBone} weights directly in the viewer` : "Weight painting paused");
  };

  const resetCharacterWeights = async () => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    const profile = group?.userData.autoRigProfile as AutoRigProfile | undefined;
    if (!runtime || !group || !profile || !group.userData.asset) return announce("Auto-rig an imported character first");
    pushHistory();
    try {
      const cleanProfile: AutoRigProfile = { ...profile, strokes: [] };
      const data = { ...readObject(group), autoRig: cleanProfile };
      const rebuilt = await loadImportedGroup(data);
      runtime.root.remove(group);
      runtime.root.add(rebuilt);
      runtime.objects.set(data.id, rebuilt);
      selectObject(rebuilt);
      const bones = findRigBones(rebuilt);
      setRigBones(HUMANOID_BONE_NAMES.filter((name) => bones.has(name)));
      setWeightPreviewState(false);
      setWeightPaint(false);
      syncItems();
      setRigStatus("Automatic skin weights restored");
      announce("Skin weights reset to the automatic fit");
    } catch {
      announce("The automatic weights could not be restored");
    }
  };

  const createRagdollRig = () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    pushHistory();
    const rigId = newId("ragdoll");
    const origin = selectedRef.current ? runtime.objects.get(selectedRef.current)?.position ?? new THREE.Vector3() : new THREE.Vector3();
    const parts = new Map<string, THREE.Group>();
    const bodies = new Map<string, CANNON.Body>();
    RAGDOLL_PARTS.forEach((part) => {
      const group = createPrimitive({
        type: part.primitive as Primitive,
        name: `Ragdoll · ${part.role}`,
        position: [part.position[0] + origin.x, part.position[1], part.position[2] + origin.z],
        rotation: part.rotation,
        scale: part.scale,
        color: part.color,
        roughness: 0.46,
        clearcoat: 0.12,
      });
      group.userData.rigId = rigId;
      group.userData.rigRole = part.role;
      runtime.root.add(group);
      runtime.objects.set(group.userData.editorId, group);
      const binding = attachPhysicsBody(runtime, group, "gravity");
      parts.set(part.role, group);
      bodies.set(part.role, binding.body);
    });
    RAGDOLL_JOINTS.forEach((joint) => {
      const bodyA = bodies.get(joint.a);
      const bodyB = bodies.get(joint.b);
      if (!bodyA || !bodyB) return;
      const constraint = pointJointAt(
        bodyA,
        bodyB,
        new CANNON.Vec3(joint.anchor[0] + origin.x, joint.anchor[1], joint.anchor[2] + origin.z)
      );
      runtime.physicsWorld.addConstraint(constraint);
      runtime.rigConstraints.push(constraint);
    });
    const torso = parts.get("torso") ?? null;
    syncItems();
    selectObject(torso);
    setRigStatus("Articulated 11-part ragdoll · 10 live joints");
    announce("Ragdoll generated · grab, throw or apply forces");
  };

  const createHingeRig = () => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!runtime || !group) return announce("Select a door, wheel, sign, or object first");
    const binding = attachPhysicsBody(runtime, group, "gravity");
    const bounds = new THREE.Box3().setFromObject(group);
    const anchor = new CANNON.Vec3(bounds.min.x, bounds.getCenter(new THREE.Vector3()).y, bounds.getCenter(new THREE.Vector3()).z);
    const anchorBody = new CANNON.Body({ mass: 0 });
    anchorBody.position.copy(anchor);
    runtime.physicsWorld.addBody(anchorBody);
    runtime.rigAuxBodies.push(anchorBody);
    const hinge = new CANNON.HingeConstraint(anchorBody, binding.body, {
      pivotA: new CANNON.Vec3(),
      pivotB: binding.body.pointToLocalFrame(anchor),
      axisA: new CANNON.Vec3(0, 1, 0),
      axisB: new CANNON.Vec3(0, 1, 0),
      collideConnected: false,
      maxForce: 1e6,
    });
    runtime.physicsWorld.addConstraint(hinge);
    runtime.rigConstraints.push(hinge);
    setRigStatus(`${group.name} now swings around a fitted side hinge`);
    announce("Smart hinge created · push it with Wind or Attract");
  };

  const createVehicleRig = () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    pushHistory();
    const rigId = newId("vehicle");
    const chassis = createPrimitive({
      type: "box",
      name: "Vehicle · chassis",
      position: [0, 1.25, 0],
      scale: [1.28, 0.38, 2.05],
      color: "#5577dc",
      roughness: 0.24,
      metalness: 0.22,
      clearcoat: 0.68,
      modifiers: { bevel: true, mirror: false, array: 1, bend: 0 },
    });
    chassis.userData.rigId = rigId;
    chassis.userData.rigRole = "chassis";
    runtime.root.add(chassis);
    runtime.objects.set(chassis.userData.editorId, chassis);
    const bounds = new THREE.Box3().setFromObject(chassis);
    const size = bounds.getSize(new THREE.Vector3());
    const body = new CANNON.Body({
      mass: 180,
      shape: colliderFor("box", [size.x, size.y, size.z]),
      position: new CANNON.Vec3(chassis.position.x, chassis.position.y, chassis.position.z),
      linearDamping: 0.08,
      angularDamping: 0.46,
    });
    const vehicle = new CANNON.RaycastVehicle({
      chassisBody: body,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2,
    });
    VEHICLE_WHEEL_CONNECTIONS.forEach((connection, index) => {
      vehicle.addWheel({
        radius: 0.42,
        directionLocal: new CANNON.Vec3(0, -1, 0),
        suspensionStiffness: 34,
        suspensionRestLength: 0.34,
        frictionSlip: 4.8,
        dampingRelaxation: 2.4,
        dampingCompression: 4.4,
        maxSuspensionForce: 100000,
        rollInfluence: 0.08,
        axleLocal: new CANNON.Vec3(-1, 0, 0),
        chassisConnectionPointLocal: new CANNON.Vec3(...connection),
        maxSuspensionTravel: 0.3,
        customSlidingRotationalSpeed: -30,
        useCustomSlidingRotationalSpeed: true,
        isFrontWheel: index < 2,
      });
    });
    vehicle.addToWorld(runtime.physicsWorld);
    const chassisId = chassis.userData.editorId as string;
    runtime.physics.set(chassisId, {
      body,
      offset: new CANNON.Vec3(),
      mode: "gravity",
    });
    const wheelIds = VEHICLE_WHEEL_CONNECTIONS.map((connection, index) => {
      const wheel = createPrimitive({
        type: "cylinder",
        name: `Vehicle · wheel ${index + 1}`,
        position: [connection[0], 0.75, connection[2]],
        scale: [0.68, 0.25, 0.68],
        color: "#242729",
        roughness: 0.68,
        metalness: 0.08,
      });
      const mesh = primaryMesh(wheel);
      if (mesh) mesh.rotation.z = Math.PI / 2;
      wheel.userData.rigId = rigId;
      wheel.userData.rigRole = `wheel-${index}`;
      runtime.root.add(wheel);
      runtime.objects.set(wheel.userData.editorId, wheel);
      return wheel.userData.editorId as string;
    });
    runtime.vehicles.set(rigId, { vehicle, chassisId, wheelIds });
    setActiveVehicleId(rigId);
    vehicleInputRef.current = { throttle: 0, steering: 0, brake: 1 };
    syncItems();
    selectObject(chassis);
    setRigStatus("Drivable 4-wheel suspension rig · use the arrow controls");
    announce("Vehicle rig created · arrow keys drive it");
  };

  const createConstraintSimulation = (kind: "rope" | "soft body" | "cloth") => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    pushHistory();
    const rigId = newId(kind.replace(" ", "-"));
    const nodes: { group: THREE.Group; body: CANNON.Body }[] = [];
    const addNode = (position: [number, number, number], fixed = false, scale = 0.12) => {
      const group = createPrimitive({
        type: "sphere",
        name: `${kind} · node ${nodes.length + 1}`,
        position,
        scale: [scale, scale, scale],
        color: kind === "cloth" ? "#a48ac5" : kind === "rope" ? "#c67558" : "#7c9b70",
        roughness: 0.64,
      });
      group.userData.rigId = rigId;
      group.userData.rigRole = `${kind}-node`;
      runtime.root.add(group);
      runtime.objects.set(group.userData.editorId, group);
      const binding = attachPhysicsBody(runtime, group, "gravity");
      if (fixed) {
        binding.body.mass = 0;
        binding.body.type = CANNON.Body.STATIC;
        binding.body.updateMassProperties();
      }
      nodes.push({ group, body: binding.body });
      return nodes.length - 1;
    };
    const connect = (a: number, b: number, distance: number) => {
      const constraint = new CANNON.DistanceConstraint(nodes[a].body, nodes[b].body, distance, 1e6);
      constraint.collideConnected = false;
      runtime.physicsWorld.addConstraint(constraint);
      runtime.rigConstraints.push(constraint);
    };
    if (kind === "rope") {
      for (let index = 0; index < 12; index++) {
        addNode([-1.7 + index * 0.3, 4.8, 0], index === 0, 0.14);
        if (index > 0) connect(index - 1, index, 0.3);
      }
    }
    if (kind === "soft body") {
      const corners: [number, number, number][] = [
        [-0.5, 1.8, -0.5], [0.5, 1.8, -0.5], [-0.5, 2.8, -0.5], [0.5, 2.8, -0.5],
        [-0.5, 1.8, 0.5], [0.5, 1.8, 0.5], [-0.5, 2.8, 0.5], [0.5, 2.8, 0.5],
      ];
      corners.forEach((position) => addNode(position, false, 0.22));
      for (let a = 0; a < corners.length; a++) {
        for (let b = a + 1; b < corners.length; b++) {
          const distance = new THREE.Vector3(...corners[a]).distanceTo(new THREE.Vector3(...corners[b]));
          if (distance <= 1.45) connect(a, b, distance);
        }
      }
    }
    if (kind === "cloth") {
      const columns = 6;
      const rows = 5;
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const index = addNode(
            [-1.25 + column * 0.5, 4.8 - row * 0.5, 0],
            row === 0 && (column === 0 || column === columns - 1),
            0.1,
          );
          if (column > 0) connect(index - 1, index, 0.5);
          if (row > 0) connect(index - columns, index, 0.5);
        }
      }
    }
    syncItems();
    selectObject(nodes[Math.floor(nodes.length / 2)]?.group ?? null);
    setRigStatus(`${kind} simulation · ${nodes.length} live particles, ${runtime.rigConstraints.length} constraints`);
    announce(`${kind} simulation generated`);
  };

  const clearPhysicsRigs = () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.vehicles.forEach(({ vehicle }) => vehicle.removeFromWorld(runtime.physicsWorld));
    runtime.vehicles.clear();
    runtime.rigConstraints.forEach((constraint) => runtime.physicsWorld.removeConstraint(constraint));
    runtime.rigConstraints.length = 0;
    runtime.rigAuxBodies.forEach((body) => runtime.physicsWorld.removeBody(body));
    runtime.rigAuxBodies.length = 0;
    runtime.physics.forEach(({ body }) => runtime.physicsWorld.removeBody(body));
    runtime.physics.clear();
    setActiveVehicleId(null);
    vehicleInputRef.current = { throttle: 0, steering: 0, brake: 0 };
    setRigStatus("Simulation cleared · scene objects remain editable");
    syncItems();
    announce("Physics and rig constraints cleared");
  };

  const addSmartObject = (kind: "Bottle" | "Stairs" | "Lamp" | "Plant" | "Package") => {
    const base = runtimeRef.current?.objects.size ?? 0;
    if (kind === "Bottle") {
      addObject("cylinder", new THREE.Vector3(0, 0.72, 0), { name: "Smart bottle body", scale: [0.82, 1.45, 0.82], color: "#d8edf1", transmission: 0.42, clearcoat: 0.7 });
      addObject("cylinder", new THREE.Vector3(0, 1.78, 0), { name: "Bottle cap", scale: [0.48, 0.28, 0.48], color: "#c9cfce", metalness: 0.7, roughness: 0.2 });
    }
    if (kind === "Stairs") {
      for (let index = 0; index < 7; index++) addObject("box", new THREE.Vector3(index * 0.72 - 2.1, 0.23 + index * 0.25, 0), { name: `Step ${index + 1}`, scale: [0.52, 0.22 + index * 0.18, 1.3], color: "#d8d3c9", roughness: 0.58 });
    }
    if (kind === "Lamp") {
      addObject("cylinder", new THREE.Vector3(0, 0.38, 0), { name: "Lamp base", scale: [1.1, 0.2, 1.1], color: "#454b47", metalness: 0.7 });
      addObject("cylinder", new THREE.Vector3(0, 1.15, 0), { name: "Lamp stem", scale: [0.16, 1.25, 0.16], color: "#c9cfce", metalness: 0.85 });
      addObject("cone", new THREE.Vector3(0, 2.1, 0), { name: "Lamp shade", scale: [1.25, 0.8, 1.25], color: "#e8ddc8", transmission: 0.18, sheen: 0.5 });
    }
    if (kind === "Plant") {
      addObject("cylinder", new THREE.Vector3(0, 0.45, 0), { name: "Planter", scale: [0.9, 0.55, 0.9], color: "#b87962", roughness: 0.78 });
      for (let index = 0; index < 5; index++) addObject("sphere", new THREE.Vector3(Math.sin(index * 2.1) * 0.45, 1.25 + index * 0.18, Math.cos(index * 2.1) * 0.35), { name: `Leaf ${index + 1}`, scale: [0.28, 0.72, 0.18], color: "#65815b", roughness: 0.7 });
    }
    if (kind === "Package") {
      addObject("box", new THREE.Vector3(0, 0.82, 0), { name: "Smart package", scale: [1.4, 1.25, 0.62], color: "#ece6dc", roughness: 0.62, clearcoat: 0.08, modifiers: { bevel: true, mirror: false, array: 1, bend: 0 } });
    }
    announce(`${kind} smart object created with editable parts · ${base + 1}`);
  };

  const createProductStudio = () => {
    addSceneKit("Podium");
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (group) {
      group.userData.animation = "spin";
      setSelection(readObject(group));
    }
    autoCinematic();
    announce("Complete product studio generated");
  };

  const createBranch = () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const branch: SavedVersion = { id: newId("branch"), label: `Direction ${branches.length + 1}`, at: Date.now(), scene: readScene(runtime) };
    const next = [branch, ...branches].slice(0, 30);
    setBranches(next);
    localStorage.setItem("form-branches", JSON.stringify(next));
    announce("Creative branch saved");
  };

  const saveRecipe = () => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!group) return announce("Select an object to save its recipe");
    const material = materialOf(group);
    if (material?.map && material.map !== material.userData.formProceduralTexture) return announce("Image textures are not portable effect recipes yet. Use an untextured or procedural material.");
    const recipe = { id: newId("recipe"), name: recipeName.trim().slice(0, 100) || `${group.name} recipe`, data: readObject(group) };
    if (!validEffectRecipe(recipe.data)) return announce("These effects contain unsupported values. Correct the object before saving a recipe.");
    const next = [recipe, ...recipes].slice(0, 20);
    setRecipes(next);
    try { localStorage.setItem("form-recipes", JSON.stringify(next)); announce("Reusable effect recipe saved on this device"); }
    catch { announce("Recipe available this session only · device storage is full"); }
  };

  const previewRecipe = (recipe: { data: SceneObjectData; name: string }) => {
    const group = selectedRef.current ? runtimeRef.current?.objects.get(selectedRef.current) : null;
    if (!group || group.userData.locked || group.userData.primitive === "imported") return announce("Select an unlocked Form primitive for this effect recipe");
    const material = materialOf(group);
    if (material?.map && material.map !== material.userData.formProceduralTexture) return announce("This object has an image texture that recipe comparison cannot reproduce yet. Use an untextured or procedural target.");
    if (playing || physicsObjectIds.includes(group.userData.editorId)) return announce("Stop playback and disable this object's physics before reviewing effects");
    try {
      const before = readObject(group);
      const graph = { ...defaultShaderGraph(), ...recipe.data.shaderGraph };
      if (!["none", "noise", "checker", "gradient"].includes(graph.procedural) || !["original", "box", "spherical"].includes(graph.uvProjection) || ![graph.scale, graph.contrast, graph.emission, graph.fresnel].every(Number.isFinite)) throw new Error("This recipe has an invalid shader. Save a fresh recipe.");
      const after = withRecipeEffects(before, recipe.data, graph);
      setRecipePreview({ recipe, targetId: before.id, source: JSON.stringify(before), before, after });
    } catch (error) { announce(error instanceof Error ? error.message : "Unable to preview recipe"); }
  };

  const applyRecipe = () => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!group || group.userData.locked) return announce("Select an unlocked object");
    if (group.userData.primitive === "imported") return announce("Shape recipes require a Form primitive; imported geometry is preserved");
    const currentMaterial = materialOf(group);
    if (currentMaterial?.map && currentMaterial.map !== currentMaterial.userData.formProceduralTexture) { setRecipePreview(null); return announce("Object texture changed; recipe cancelled without replacing it"); }
    if (playing || physicsObjectIds.includes(group.userData.editorId)) return announce("Stop playback and disable this object's physics before applying effects");
    if (!recipePreview || recipePreview.targetId !== group.userData.editorId || recipePreview.source !== JSON.stringify(readObject(group))) { setRecipePreview(null); return announce("Object changed; preview the recipe again"); }
    const candidate = recipePreview.after;
    pushHistory();
    group.userData.operations = structuredClone(candidate.operations);
    group.userData.modifiers = structuredClone(candidate.modifiers);
    // Face-index edits and object constraints are not portable effects. Keep
    // the target's authored topology, placement and animation intact.
    group.userData.shaderGraph = structuredClone(candidate.shaderGraph);
    const material = materialOf(group);
    if (material) {
      material.color.set(candidate.color);
      material.sheenColor.set(candidate.color);
      material.roughness = candidate.roughness;
      material.metalness = candidate.metalness;
      material.clearcoat = candidate.clearcoat;
      material.sheen = candidate.sheen;
      material.transmission = candidate.transmission;
      material.thickness = candidate.thickness;
      material.iridescence = candidate.iridescence;
    }
    rebuildShapeGeometry(group);
    refreshModifierClones(group);
    applyShaderGraphToGroup(group);
    setRecipePreview(null);
    setSelection(readObject(group));
    syncItems();
    announce(`${recipePreview.recipe.name} remixed onto ${group.name} · Undo available`);
  };

  const createVariations = () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const base = readScene(runtime);
    const variants = [
      { name: "Soft minimal", color: "#e7dfd4", environment: "Studio" },
      { name: "Playful color", color: "#d58a72", environment: "Daylight" },
      { name: "Gallery chrome", color: "#c7cfce", environment: "Product" },
      { name: "Midnight glow", color: "#556fd0", environment: "Midnight" },
    ].map((variant, variantIndex) => ({
      id: newId("variation"),
      name: variant.name,
      color: variant.color,
      scene: base.map((item, itemIndex) => ({
        ...structuredClone(item),
        color: itemIndex === variantIndex % Math.max(base.length, 1) ? variant.color : item.color,
        roughness: variantIndex === 2 ? 0.16 : Math.min(0.9, item.roughness + variantIndex * 0.04),
        metalness: variantIndex === 2 ? Math.max(0.7, item.metalness) : item.metalness,
        clearcoat: variantIndex === 0 ? Math.max(0.4, item.clearcoat) : item.clearcoat,
        position: [
          round(item.position[0] + (variantIndex === 1 ? Math.sin(itemIndex * 1.7) * 0.45 : 0)),
          item.position[1],
          round(item.position[2] + (variantIndex === 1 ? Math.cos(itemIndex * 1.7) * 0.35 : 0)),
        ] as [number, number, number],
      })),
      environment: variant.environment,
    }));
    setVariations(variants);
    announce("Four editable scene directions created");
  };

  const applyVariation = (variation: { scene: SceneObjectData[]; name: string }, index: number) => {
    pushHistory();
    restoreScene(variation.scene);
    setEnvironment(["Studio", "Daylight", "Product", "Midnight"][index] ?? "Studio");
    announce(`${variation.name} applied`);
  };

  const stepPresentation = (direction: number) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const next = Math.max(0, presentationIndex + direction);
    setPresentationIndex(next);
    if (cameraShots.length > 0) {
      recallCamera(cameraShots[(next % cameraShots.length + cameraShots.length) % cameraShots.length]);
      return;
    }
    const offset = runtime.camera.position.clone().sub(runtime.orbit.target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), direction * 0.58);
    runtime.camera.position.copy(runtime.orbit.target).add(offset);
    runtime.orbit.update();
  };

  const groupSelected = () => {
    if (selectedIds.length === 0) return announce("Select objects first");
    const group = { id: newId("group"), name: `Collection ${groups.length + 1}` };
    const runtime = runtimeRef.current;
    pushHistory();
    selectedIds.forEach((id) => {
      const object = runtime?.objects.get(id);
      if (object) object.userData.groupId = group.id;
    });
    const next = [...groups, group];
    setGroups(next);
    localStorage.setItem("form-groups", JSON.stringify(next));
    syncItems();
    announce(`${selectedIds.length} objects grouped`);
  };

  const saveVersion = () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const next = [
      { id: newId("version"), label: `Version ${versions.length + 1}`, at: Date.now(), scene: readScene(runtime) },
      ...versions,
    ].slice(0, 12);
    setVersions(next);
    localStorage.setItem("form-versions", JSON.stringify(next));
    setVersionsOpen(true);
    announce("Version checkpoint created");
  };

  const saveCamera = () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const next = [
      ...cameraShots,
      {
        name: `Camera ${cameraShots.length + 1}`,
        position: runtime.camera.position.toArray(),
        target: runtime.orbit.target.toArray(),
      },
    ];
    setCameraShots(next);
    localStorage.setItem("form-cameras", JSON.stringify(next));
    announce("Camera shot saved");
  };

  const recallCamera = (shot: { position: number[]; target: number[] }) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.camera.position.fromArray(shot.position);
    runtime.orbit.target.fromArray(shot.target);
    runtime.orbit.update();
  };

  const shareScene = async (embedMode = false) => {
    const url = new URL(window.location.href);
    url.searchParams.set("room", roomId);
    if (embedMode) url.searchParams.set("embed", "1");
    else url.searchParams.delete("embed");
    await navigator.clipboard.writeText(url.toString());
    announce(embedMode ? "Embed link copied" : "Live collaboration link copied");
  };

  const addComment = async () => {
    const runtime = runtimeRef.current;
    const group = selectedRef.current ? runtime?.objects.get(selectedRef.current) : null;
    if (!commentDraft.trim() || !roomId) return;
    const point = group?.position ?? new THREE.Vector3();
    await fetch("/api/scenes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        roomId, action: "comment", comment: commentDraft,
        objectId: group?.userData.editorId ?? null, x: point.x, y: point.y, z: point.z,
      }),
    });
    setCommentDraft("");
    await refreshRoom(false);
    announce("Comment pinned in 3D");
  };

  const runCommand = (preview = true) => {
    const prompt = command.toLowerCase().trim();
    if (!prompt) return;
    const runtime = runtimeRef.current;
    const before = runtime ? readScene(runtime) : [];
    let acted = false;
    const primitive = PRIMITIVES.find((item) => prompt.includes(item.label.toLowerCase()));
    if (prompt.includes("add") && primitive) { addObject(primitive.type); acted = true; }
    const color = Object.entries(COLOR_WORDS).find(([name]) => prompt.includes(name));
    if (color && selection) {
      updateSelection("color", color[1]);
      if (color[0] === "chrome" || color[0] === "gold") {
        updateSelection("metalness", 0.95);
        updateSelection("roughness", 0.12);
      }
      acted = true;
    }
    if (prompt.includes("matte") && selection) {
      updateSelection("metalness", 0);
      updateSelection("roughness", 0.92);
      acted = true;
    }
    if (prompt.includes("glass") && selection) { applyShaderPreset(SHADER_PRESETS.find((preset) => preset.name === "Glass")!); acted = true; }
    if (prompt.includes("wax") && selection) { applyShaderPreset(SHADER_PRESETS.find((preset) => preset.name === "Wax")!); acted = true; }
    if ((prompt.includes("fabric") || prompt.includes("cloth")) && selection) { applyShaderPreset(SHADER_PRESETS.find((preset) => preset.name === "Fabric")!); acted = true; }
    if (prompt.includes("delete")) { removeSelected(); acted = true; }
    if (prompt.includes("round") || prompt.includes("bevel")) { applyModifier("bevel"); acted = true; }
    if (prompt.includes("mirror")) { applyModifier("mirror"); acted = true; }
    if (prompt.includes("bend")) { applyModifier("bend"); acted = true; }
    if (prompt.includes("hole") || prompt.includes("cut")) { applyModifier("cut"); acted = true; }
    if (prompt.includes("extrude") || prompt.includes("pull")) { applyShapeOperation("pull"); acted = true; }
    if (prompt.includes("taper")) { applyShapeOperation("taper"); acted = true; }
    if (prompt.includes("twist")) { applyShapeOperation("twist"); acted = true; }
    if (prompt.includes("inset")) { applyShapeOperation("inset"); acted = true; }
    const number = Number(prompt.match(/\d+/)?.[0] ?? 1);
    if (prompt.includes("duplicate") || prompt.includes("copies")) {
      duplicateSelected(number, prompt.includes("circle"));
      acted = true;
    }
    if (prompt.includes("arrange") && prompt.includes("row")) { arrange("row"); acted = true; }
    if (prompt.includes("scatter")) { arrange("scatter"); acted = true; }
    if (prompt.includes("dusk")) { setEnvironment("Dusk"); acted = true; }
    if (prompt.includes("midnight")) { setEnvironment("Midnight"); acted = true; }
    if (prompt.includes("product light")) { setEnvironment("Product"); acted = true; }
    if (prompt.includes("dramatic")) { setEnvironment("Dusk"); setBloom(true); acted = true; }
    if (prompt.includes("center")) { applyConstraint("Center stage"); acted = true; }
    if (prompt.includes("ground")) { applyConstraint("Ground"); acted = true; }
    if (prompt.includes("equal spacing")) { applyConstraint("Equal spacing"); acted = true; }
    if (prompt.includes("face camera") || prompt.includes("look at camera")) { applyConstraint("Face camera"); acted = true; }
    if (prompt.includes("variation") || prompt.includes("directions")) { createVariations(); acted = true; }
    if (prompt.includes("final quality") || prompt.includes("final render")) { setQualityMode("Final"); acted = true; }
    if (prompt.includes("presentation")) { setPresentationMode(true); acted = true; }
    if (prompt.includes("cinematic") || prompt.includes("camera story")) { autoCinematic(); acted = true; }
    if (prompt.includes("product studio") || prompt.includes("product shot")) { createProductStudio(); acted = true; }
    if (prompt.includes("gravity")) { paintPhysics("gravity"); acted = true; }
    if (prompt.includes("wind")) { paintPhysics("wind"); acted = true; }
    if (prompt.includes("bounce")) { paintPhysics("bounce"); acted = true; }
    if (prompt.includes("cloth")) { paintPhysics("cloth"); acted = true; }
    if (prompt.includes("bloom")) { setBloom(true); acted = true; }
    if (prompt.includes("spin") && selection) { updateSelection("animation", "spin"); acted = true; }
    if (prompt.includes("float") && selection) { updateSelection("animation", "float"); acted = true; }
    setCommand("");
    setCommandOpen(false);
    if (acted && preview && runtime) {
      const after = readScene(runtime);
      setAiPreview({ before, after, label: prompt });
      announce("Preview ready · accept or undo");
    } else {
      announce(acted ? "Command applied" : "Try: “make it glass and add a twist”");
    }
  };

  useEffect(() => {
    type FormStudioWindow = Window & {
      formStudio?: {
        version: string;
        command: (text: string) => void;
        addPrimitive: (type: Primitive) => void;
        getScene: () => SceneObjectData[];
      };
    };
    const target = window as FormStudioWindow;
    target.formStudio = {
      version: "0.40.0",
      command: (text) => {
        setCommand(text);
        setCommandOpen(true);
      },
      addPrimitive: (type) => {
        if (PRIMITIVES.some((primitive) => primitive.type === type)) addObject(type);
      },
      getScene: () => runtimeRef.current ? readScene(runtimeRef.current) : [],
    };
    return () => { delete target.formStudio; };
  }, [addObject]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (cadOpen || event.defaultPrevented) return;
      if (event.key === "Escape" && recipePreview) { event.preventDefault(); setRecipePreview(null); return; }
      const target = event.target as HTMLElement;
      const editing = target.isContentEditable || target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA";
      if (editing) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveProject(event.shiftKey);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        void openProject();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        newProject();
        return;
      }
      if (editing) return;
      if (event.key.toLowerCase() === "w") setMode("translate");
      if (event.key.toLowerCase() === "e") setMode("rotate");
      if (event.key.toLowerCase() === "r") setMode("scale");
      if (event.key.toLowerCase() === "f") focusSelection();
      if (event.key === " ") { event.preventDefault(); toggleAnimationPlayback(); }
      if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === "k") { event.preventDefault(); addTransformKeyframe(); }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        if (selectedKeyframeId) updateSelectedKeyframe("delete");
        else removeSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addTransformKeyframe, cadOpen, focusSelection, newProject, openProject, recipePreview, redo, removeSelected, saveProject, selectedKeyframeId, toggleAnimationPlayback, undo, updateSelectedKeyframe]);

  useEffect(() => {
    if (!activeVehicleId || cadOpen) return;
    const update = (event: KeyboardEvent, pressed: boolean) => {
      const target = event.target as HTMLElement;
      if (target.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "ArrowUp") vehicleInputRef.current.throttle = pressed ? 1 : 0;
      if (event.key === "ArrowDown") vehicleInputRef.current.throttle = pressed ? -0.62 : 0;
      if (event.key === "ArrowLeft") vehicleInputRef.current.steering = pressed ? 1 : 0;
      if (event.key === "ArrowRight") vehicleInputRef.current.steering = pressed ? -1 : 0;
      vehicleInputRef.current.brake = pressed ? 0 : 0.35;
    };
    const down = (event: KeyboardEvent) => update(event, true);
    const up = (event: KeyboardEvent) => update(event, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      vehicleInputRef.current = { throttle: 0, steering: 0, brake: 0.35 };
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [activeVehicleId, cadOpen]);

  return (
    <main
      className={`studio-shell v2 ${initialPanel === "rig" || activePanel === "rig" || activePanel === "animate" ? "animation-workspace" : ""} ${activePanel === "rig" || activePanel === "animate" ? "rig-workspace" : ""} ${embed ? "embed-mode" : ""} ${presentationMode ? "presentation-mode" : ""} ${workspaceLayoutClasses(visibleLayout)}`}
      data-ui-density={workspaceUi.layout.density}
      style={{ ...workspaceLayoutStyle(visibleLayout, "studio"), ...compactUi.viewport, "--animation-drawer-width": activePanel === "rig" || activePanel === "animate" ? "310px" : "0px", "--animation-timeline-height": workspaceUi.layout.timelineCollapsed ? "0px" : `${workspaceUi.layout.timelineSize}px` } as CSSProperties}
    >
      {objectMenu && selection?.id === objectMenu.target && <ObjectContextMenu anchor={objectMenu} title={selection.name} onClose={() => setObjectMenu(null)} actions={[
        { id: "properties", label: "Edit properties", run: () => compactUi.setCollapsed(false) },
        { id: "frame", label: "Frame object", run: focusSelection },
        { id: "move", label: "Move", disabled: selection.locked, run: () => setMode("translate") },
        { id: "rotate", label: "Rotate", disabled: selection.locked, run: () => setMode("rotate") },
        { id: "scale", label: "Scale", disabled: selection.locked, run: () => setMode("scale") },
        { id: "motion", label: "Animate object", disabled: selection.locked, run: () => { setActivePanel("animate"); setAnimationPage("motion"); } },
        { id: "keyframe", label: "Record transform keyframe", disabled: playing || selection.locked || physicsObjectIds.includes(selection.id), run: addTransformKeyframe },
        { id: "duplicate", label: "Duplicate object", disabled: selection.locked, run: () => duplicateSelected(1) },
        { id: "delete", label: "Delete object", danger: true, disabled: selection.locked, run: removeSelected },
      ]} />}
      <header className="topbar">
        <div className="brand">
          {onClose && <button className="workspace-back" onClick={() => {
            if (saveInFlightRef.current || animationImportBusy) return announce("Wait for the current save or import to finish");
            const project = captureProject();
            if (!project) return announce("The project is not ready to return");
            documentSession.observeProject(project);
            onClose({ contents: serializeProject(project), path: projectPathRef.current, dirty: documentSession.dirty });
          }} title="Back to modeling"><UiIcon name="back" /></button>}
          <button className="menu-button" onClick={() => setProjectMenuOpen((open) => !open)} title="Project menu"><UiIcon name="menu" /></button>
          {projectMenuOpen && (
            <div className="project-menu">
              <div><strong>Project</strong><span>{projectDirty ? "Unsaved changes" : lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Ready"}</span></div>
              <button onClick={() => { setProjectMenuOpen(false); newProject(); }}><span>New project</span><kbd>⌘N</kbd></button>
              <button onClick={() => { setProjectMenuOpen(false); void openProject(); }}><span>Open project…</span><kbd>⌘O</kbd></button>
              <button onClick={() => { setProjectMenuOpen(false); void saveProject(false); }}><span>Save</span><kbd>⌘S</kbd></button>
              <button onClick={() => { setProjectMenuOpen(false); void saveProject(true); }}><span>Save as…</span><kbd>⇧⌘S</kbd></button>
            </div>
          )}
          <FormLogo /><span>FORM STUDIO</span>
          <input
            className="project-name project-title-input"
            value={projectName}
            aria-label="Project name"
            onChange={(event) => setProjectName(event.target.value)}
            onBlur={() => setProjectName((name) => cleanProjectName(name))}
          />
          {projectDirty && <i className="project-dirty-dot" title="Unsaved changes" />}
          <span className="v2-badge">V2</span>
          <input
            ref={projectInputRef}
            hidden
            type="file"
            accept=".form,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              const checkpoint = pendingOpenRef.current;
              pendingOpenRef.current = null;
              if (file && checkpoint) void file.text().then((contents) => {
                if (!documentSession.matches(checkpoint)) return announce("The project changed while opening; your newer edits are still here");
                if (loadProjectContents(contents)) webFileHandleRef.current = null;
              }).catch(() => announce("The project could not be read; your current work is unchanged"));
              event.currentTarget.value = "";
            }}
          />
        </div>
        <div className="topbar-center">
          <strong className="workspace-title">{initialPanel === "rig" || activePanel === "rig" || activePanel === "animate" ? "ANIMATION STUDIO" : "MODEL"}</strong>
          <div className="topbar-toolstrip" aria-label="Transform tools">
            <button className={mode === "translate" ? "active" : ""} onClick={() => setMode("translate")} title="Move (W)"><UiIcon name="move" /></button>
            <button className={mode === "rotate" ? "active" : ""} onClick={() => setMode("rotate")} title="Rotate (E)"><UiIcon name="rotate" /></button>
            <button className={mode === "scale" ? "active" : ""} onClick={() => setMode("scale")} title="Scale (R)"><UiIcon name="scale" /></button>
            <button className={snap ? "active" : ""} onClick={() => setSnap((value) => !value)} title="Smart snap"><UiIcon name="snap" /></button>
            <button className={avoidCollisions ? "active" : ""} onClick={() => setAvoidCollisions((value) => !value)} title="Avoid overlaps"><UiIcon name="overlap" /></button>
            <button onClick={() => setCommandOpen(true)} title="Magic command"><UiIcon name="magic" /></button>
          </div>
          <button className="history-button" disabled={saveSession ? !documentSession.canUndo : undefined} onClick={undo} title="Undo"><UiIcon name="undo" /></button>
          <button className="history-button" disabled={saveSession ? !documentSession.canRedo : undefined} onClick={redo} title="Redo"><UiIcon name="redo" /></button>
          <span className={`save-state ${projectDirty ? "saving" : syncState}`} title="Project save state">
            <i />{documentSession.saving ? "Saving…" : projectDirty ? "Unsaved" : "Saved"}
          </span>
          {documentSession.historyNotice && <span className="save-state saving" role="alert" title={documentSession.historyNotice}>Undo limit reached · Save a version</span>}
          {presence.length > 0 && <span className="live-count">{presence.length + 1} live</span>}
        </div>
        <div className="topbar-actions">
          <CompactPropertiesToggle id="animation-properties" expanded={!compactUi.collapsed} onClick={() => compactUi.setCollapsed(!compactUi.collapsed)} />
          <WorkspaceUiControls
            density={workspaceUi.layout.density}
            onPreset={workspaceUi.applyPreset} onReset={workspaceUi.reset} onFocus={workspaceUi.toggleFocus} focused={workspaceUi.focused}
            onDensity={workspaceUi.cycleDensity}
            toolsCollapsed={workspaceUi.layout.toolsCollapsed}
            onTools={() => workspaceUi.update("toolsCollapsed", !workspaceUi.layout.toolsCollapsed)}
            inspectorCollapsed={compactUi.collapsed}
            onInspector={() => compactUi.setCollapsed(!compactUi.collapsed)}
            timelineCollapsed={workspaceUi.layout.timelineCollapsed}
            onTimeline={() => workspaceUi.update("timelineCollapsed", !workspaceUi.layout.timelineCollapsed)}
          />
          {suiteMenu && <tcc-suite-menu />}
          {suiteMenu && <a className="company-home-link" href="https://thecreatingco.com/" target="_blank" rel="noopener noreferrer" aria-label="The Creating Co. home" title="Visit The Creating Co.">↗</a>}
          <button className="cad-mode-button" onClick={openCadWorkspace}><span>⌗</span>FormCAD</button>
          <button className="text-button" onClick={saveVersion}>Version</button>
          <button className="text-button" onClick={() => setCommentsOpen((value) => !value)}>Comments {comments.length > 0 && <b>{comments.length}</b>}</button>
          <button className="share-button" onClick={() => shareScene(false)}>Share live</button>
          <div className="export-menu-wrap">
            <button className="export-button" onClick={() => setExportOpen((value) => !value)}>Export <span>⌄</span></button>
            {exportOpen && (
              <div className="export-menu">
                <button onClick={() => void saveProject(true)}>Form project <small>.FORM</small></button>
                <button onClick={() => exportGLB()} title={BLENDER_IMPORT_STEPS}>3D model · Blender <small>GLB</small></button>
                <button onClick={() => void exportBlenderOBJ()} title={BLENDER_IMPORT_STEPS}>Blender · older workflows <small>OBJ+MTL</small></button>
                <button onClick={returnLumaText} disabled={selectedIds.length !== 1 || !sceneItems.find((item) => item.id === selectedIds[0])?.lumaTextAsset}>Return Luma text source <small>.LUMAFORMTEXT</small></button>
                <button onClick={returnLumaMesh} disabled={selectedIds.length !== 1}>Return static mesh to Luma <small>.LUMAFORMMESH</small></button>
                <button onClick={exportOBJ}>Pipeline mesh <small>OBJ</small></button>
                <button onClick={exportSTL}>Fabrication <small>STL</small></button>
                <button onClick={exportAR}>AR preview <small>USDZ</small></button>
                <button onClick={() => renderPNG()}>Still image <small>PNG</small></button>
                <button onClick={() => shareScene(true)}>Copy embed link <small>WEB</small></button>
              </div>
            )}
          </div>
          <button className="avatar" aria-label="Desktop profile" onClick={() => setToast("Desktop profile · projects and preferences are stored locally")}>LP</button>
        </div>
      </header>

      <aside className="left-panel compact-rail">
        <nav className="panel-tabs v2-tabs" aria-label="Workspace panels">
          <button title="Create" className={activePanel === "create" ? "active" : ""} onClick={() => setActivePanel((panel) => panel === "create" ? null : "create")}><span><UiIcon name="add" /></span><small>Create</small></button>
          <button title="Scene" className={activePanel === "scene" ? "active" : ""} onClick={() => setActivePanel((panel) => panel === "scene" ? null : "scene")}><span><UiIcon name="scene" /></span><small>Scene</small></button>
          <button title="Motion" className={activePanel === "animate" ? "active" : ""} onClick={() => setActivePanel((panel) => panel === "animate" ? null : "animate")}><span><UiIcon name="motion" /></span><small>Motion</small></button>
          <button title="Materials" onClick={() => { setActivePanel(null); compactUi.setCollapsed(false); if (selection) document.querySelector(".inspector")?.scrollTo({ top: 330, behavior: "smooth" }); }}><span><UiIcon name="material" /></span><small>Shade</small></button>
          <button title="Lighting" onClick={() => setRenderOpen((value) => !value)}><span><UiIcon name="light" /></span><small>Light</small></button>
          <button title="Camera" onClick={saveCamera}><span><UiIcon name="camera" /></span><small>Camera</small></button>
          <button title="Animation Studio · characters and rigs" className={activePanel === "rig" ? "active" : ""} onClick={() => setActivePanel((panel) => panel === "rig" ? null : "rig")}><span><UiIcon name="rig" /></span><small>Animate</small></button>
          <button title="Form Lab" className={activePanel === "lab" ? "active" : ""} onClick={() => setActivePanel((panel) => panel === "lab" ? null : "lab")}><span><UiIcon name="magic" /></span><small>Lab</small></button>
          <button title="Professional workspace" className={activePanel === "pro" ? "active" : ""} onClick={() => setActivePanel((panel) => panel === "pro" ? null : "pro")}><span><UiIcon name="pro" /></span><small>Pro</small></button>
          <button title="Magic Studio" className={activePanel === "magic" ? "active" : ""} onClick={() => setActivePanel((panel) => panel === "magic" ? null : "magic")}><span><UiIcon name="command" /></span><small>Magic</small></button>
        </nav>
        {activePanel === "create" && (
          <div className="panel-scroll rail-drawer">
            <button className="rail-drawer-close" onClick={() => setActivePanel(null)}>×</button>
            <div className="panel-heading"><p>Add to scene</p><span>Drag or click</span></div>
            <div className="primitive-grid">
              {PRIMITIVES.map((item) => (
                <button
                  key={item.type} draggable
                  onDragStart={(event) => event.dataTransfer.setData("primitive", item.type)}
                  onClick={() => addObject(item.type)}
                ><span className={`primitive-icon ${item.type}`}>{item.glyph}</span>{item.label}</button>
              ))}
            </div>
            <button className="import-card" onClick={() => fileInputRef.current?.click()}>
              <span>⇧</span><div><strong>Import model</strong><small>GLB, glTF, OBJ or STL</small></div>
            </button>
            <button className="import-card" onClick={() => lumaTextInputRef.current?.click()}>
              <span>3D</span><div><strong>Import from Luma</strong><small>Type, vectors, images and editable static meshes</small></div>
            </button>
            <input ref={fileInputRef} hidden type="file" accept=".glb,.gltf,.obj,.stl" onChange={(event) => event.target.files?.[0] && importModel(event.target.files[0])} />
            <input ref={lumaTextInputRef} hidden type="file" accept=".lumaform,.lumaformtext,.lumaformmesh,application/vnd.luma-form.spatial+json,application/vnd.luma-form.text+json,application/vnd.luma-form.mesh+json" onChange={(event) => event.target.files?.[0] && void importLumaAsset(event.target.files[0])} />
            <input ref={textureInputRef} hidden type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && applyTexture(event.target.files[0])} />
            <div className="section-label">Materials</div>
            <div className="material-list">
              {MATERIALS.map((material) => (
                <button key={material.name} onClick={() => selection && updateSelection("color", material.value)}>
                  <span style={{ background: material.value }} />{material.name}
                </button>
              ))}
            </div>
            <button className="texture-button" onClick={() => textureInputRef.current?.click()}>＋ Add image texture</button>
            <div className="tip-card command-tip" onClick={() => setCommandOpen(true)}>
              <span>MAGIC COMMAND</span><p>Press ⌘K and type “make it chrome, duplicate 6 times in a circle.”</p>
            </div>
          </div>
        )}
        {activePanel === "scene" && (
          <div className="scene-panel rail-drawer">
            <button className="rail-drawer-close" onClick={() => setActivePanel(null)}>×</button>
            <div className="panel-heading"><p>Scene hierarchy</p><button onClick={groupSelected}>＋ Group</button></div>
            {groups.map((group) => (
              <div className="collection" key={group.id}>
                <strong>⌄ {group.name}</strong>
                {sceneItems.filter((item) => item.groupId === group.id).map((item) => (
                  <SceneRow key={item.id} item={item} selected={selectedIds.includes(item.id)} onSelect={(additive) => {
                    const object = runtimeRef.current?.objects.get(item.id);
                    if (object) selectObject(object, additive);
                  }} onToggle={(field) => updateObjectById(item.id, field)} />
                ))}
              </div>
            ))}
            {sceneItems.filter((item) => !item.groupId).map((item) => (
              <SceneRow key={item.id} item={item} selected={selectedIds.includes(item.id)} onSelect={(additive) => {
                const object = runtimeRef.current?.objects.get(item.id);
                if (object) selectObject(object, additive);
              }} onToggle={(field) => updateObjectById(item.id, field)} />
            ))}
          </div>
        )}
        {(activePanel === "rig" || activePanel === "animate") && (
          <div className="panel-scroll rail-drawer rig-studio animation-workbench">
            <button className="rail-drawer-close" aria-label="Close animation tools" onClick={() => setActivePanel(null)}>×</button>
            <div className="panel-heading"><p>Animation</p><span>Make your scene move.</span></div>
            <div className="animation-pages" aria-label="Animation tools">{([['motion', 'Motion'], ['characters', 'Characters'], ['advanced', 'More']] as const).map(([page, label]) => <button key={page} aria-pressed={animationPage === page} onClick={() => setAnimationPage(page)}>{label}</button>)}</div>
            {animationPage === "motion" && <AnimationDirector selection={selection} items={sceneItems} time={timeline} playing={playing} bones={rigBones.length} selectedKey={selectedKeyframeId} blocked={Boolean(selection && physicsObjectIds.includes(selection.id))}
              onSelect={(id) => { const object = runtimeRef.current?.objects.get(id); if (object) selectObject(object); }} onSeek={seekAnimation} onKey={addTransformKeyframe} onPlay={toggleAnimationPlayback} onFocus={focusSelection} onPreset={applyQuickMotion} onKeyTime={retimeSelectedKey} onKeyEdit={updateSelectedKeyframe} />}
            {animationPage === "motion" && selection?.asset?.name.startsWith("garment:") && <section className="rig-section animation-director animated-cloth-panel" aria-label="Animated garment cloth">
              <h3>Cloth motion <small>Experimental</small></h3>
              <p>Authored stitches and neckline/waist attachments travel with your garment. Bake contact with the posed body, bone-animated obstacles and recorded physics props.</p>
              <div className="animation-parameters"><label>Duration · seconds<input aria-label="Cloth bake duration" type="number" min="1" max="10" step="1" value={clothBakeSeconds} disabled={clothBakeProgress !== null} onChange={(e) => setClothBakeSeconds(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} /></label></div>
              <div className="rig-inline-actions"><button disabled={playing || selection.locked || clothBakeProgress !== null || physicsObjectIds.includes(selection.id)} onClick={() => void bakeSelectedCloth()}>{selection.clothBake ? "Rebake cloth motion" : "Bake cloth motion"}</button><button disabled={!selection.clothBake || playing || selection.locked || clothBakeProgress !== null} onClick={clearSelectedCloth}>Clear cloth bake</button></div>
              {physicsObjectIds.length > 0 && <button disabled={playing || clothBakeProgress !== null || selection.locked} onClick={() => void recordPhysicsObstacles()}>Record physics obstacles</button>}
              {clothBakeProgress !== null && <div role="status">Baking cloth · {clothBakeProgress}% <button onClick={() => clothBakeAbortRef.current?.abort()}>Cancel cloth bake</button></div>}
              {clothBakeMessage?.id === selection.id && <p role="status">{clothBakeMessage.text}</p>}
              {selection.clothBake && <p>{selection.clothBake.backend} · {selection.clothBake.seconds}s cached. Changing motion, editing scenery or refreshing from Fabric requires a new bake.</p>}
              <p>30 fps cache · adaptive 120 Hz+ motion samples · up to 12,000 cloth vertices / 32 MB. Record physics creates editable copies and hides originals. Independent rigid props are supported; vehicles, constraints and live two-way cloth/rigid coupling are not. Contact is sampled, not guaranteed intersection-free. Scene edits require rebaking; outside the cache, skin-bound preview returns. Not a fit certification.</p>
              <p>To refresh: open Fabric, edit/refit in Neutral, then choose “Update from Fabric · keep animation”.</p>
            </section>}
            {animationPage === "characters" && <>
            <details className="rig-section animation-library" open={rigBones.length ? undefined : true}>
              <summary>Add a character <small>Shared with Fabric</small></summary>
              <label className="rig-bone-select"><span>Height · mm</span><input aria-label="Character height" type="number" min="1300" max="2200" step="10" value={characterHeight} onChange={(event) => setCharacterHeight(Math.max(1300, Math.min(2200, Number(event.target.value) || 1700)))} /></label>
              <label className="rig-bone-select"><span>Build · {characterBuild}</span><input aria-label="Character build" type="range" min="0" max="100" value={characterBuild} onChange={(event) => setCharacterBuild(Number(event.target.value))} /></label>
              <div className="rig-inline-actions"><button disabled={animationImportBusy} onClick={() => void addAnatomicalCharacter("female")}>＋ Female</button><button disabled={animationImportBusy} onClick={() => void addAnatomicalCharacter("male")}>＋ Male</button></div>
              <p className="tip-text">Set proportions before adding. To use your own object, choose “Animate model” in Model.</p>
            </details>
            <div className="rig-section character-rig">
              <div className="lab-title"><span>{selection?.name ?? "Choose a character"}</span><small>{rigConfidence === null ? `${rigBones.length} bones` : `${Math.round(rigConfidence * 100)}% match`}</small></div>
              {!rigBones.length && <button className="rig-primary character" disabled={!selection || playing} onClick={autoRigHumanoid}><b>人</b><span><strong>Rig selected character</strong><small>Build a starting skeleton and skin weights</small></span></button>}
              {rigBones.length > 0 && (
                <>
                  <div className="rig-inline-actions">
                    <button aria-pressed={skeletonVisible} className={skeletonVisible ? "active" : ""} onClick={toggleSkeleton}>Show bones</button>
                    <button onClick={focusSelection}>Frame character</button>
                  </div>
                  <label className="rig-bone-select">
                    <span>Pose bone</span>
                    <select value={rigBone} onChange={(event) => chooseRigBone(event.target.value)}>
                      {rigBones.map((bone) => <option key={bone} value={bone}>{bone.replace(".", " · ")}</option>)}
                    </select>
                  </label>
                  <div className="rig-axis-sliders">
                    {(["X", "Y", "Z"] as const).map((axis, index) => (
                      <label key={axis}>
                        <span>{axis}<b>{Math.round(rigBoneRotation[index])}°</b></span>
                        <input aria-label={`Bone ${axis} rotation`} disabled={playing || selection?.locked} type="range" min="-140" max="140" value={rigBoneRotation[index]} onPointerUp={() => { poseGestureRef.current = false; }} onKeyUp={() => { poseGestureRef.current = false; }} onBlur={() => { poseGestureRef.current = false; }} onChange={(event) => rotateRigBone(index, Number(event.target.value))} />
                      </label>
                    ))}
                  </div>
                  <div className="rig-pose-grid">
                    {(["rest", "hero", "run", "wave"] as HumanoidPosePreset[]).map((pose) => (
                      <button key={pose} disabled={playing || selection?.locked} onClick={() => poseCharacter(pose)}>{pose}</button>
                    ))}
                  </div>
                  <button className="animation-record" disabled={playing || selection?.locked} onClick={addTransformKeyframe}>Record this pose<span>{(timeline * ANIMATION_SECONDS).toFixed(2)} s · K</span></button>
                  <p className="tip-text">Record a pose, move the playhead, pose again and record. Press Space to see the transition.</p>
                  <details className="animation-disclosure"><summary>Skin weights & rig setup</summary>
                  <div className="rig-inline-actions"><button aria-pressed={weightPreview} onClick={toggleWeightPreview}>Weight map</button><button aria-pressed={weightPaint} onClick={toggleWeightPainting}>{weightPaint ? "Stop paint" : "Paint weights"}</button></div>
                  <div className={`weight-brush ${weightPaint ? "active" : ""}`}>
                    <div><strong>{weightErase ? "Erase influence" : "Add influence"}</strong><small>Click directly on the character</small></div>
                    <div className="rig-inline-actions">
                      <button className={!weightErase ? "active" : ""} onClick={() => setWeightErase(false)}>Add</button>
                      <button className={weightErase ? "active" : ""} onClick={() => setWeightErase(true)}>Erase</button>
                      <button onClick={resetCharacterWeights}>Reset</button>
                    </div>
                    <label><span>Brush size <b>{weightRadius.toFixed(2)}</b></span><input type="range" min="0.05" max="0.8" step="0.01" value={weightRadius} onChange={(event) => setWeightRadius(Number(event.target.value))} /></label>
                    <label><span>Strength <b>{Math.round(weightStrength * 100)}%</b></span><input type="range" min="0.05" max="0.9" step="0.01" value={weightStrength} onChange={(event) => setWeightStrength(Number(event.target.value))} /></label>
                  </div></details>
                </>
              )}
            </div>
            </>}
            {animationPage === "advanced" && <>
            <p className="tip-text">Physics and keyframes are separate workflows. Clear simulation constraints before recording an object’s motion.</p>
            <div className="rig-section">
              <div className="lab-title"><span>Selected object</span><small>One click</small></div>
              <button className="rig-primary" onClick={autoRigSelection}><b>◎</b><span><strong>Auto-rig selected</strong><small>Fits a collider from its actual shape</small></span></button>
              <button className="rig-secondary" onClick={createHingeRig}><b>↻</b><span><strong>Smart hinge</strong><small>Doors, wheels, signs and pendulums</small></span></button>
            </div>
            <div className="rig-section">
              <div className="lab-title"><span>Instant rigs</span><small>Generated complete</small></div>
              <button className="rig-primary ragdoll" onClick={createRagdollRig}><b>人</b><span><strong>Create ragdoll</strong><small>11 bodies, 10 articulated joints</small></span></button>
              <button className="rig-primary vehicle" onClick={createVehicleRig}><b>▰</b><span><strong>Create drivable vehicle</strong><small>Suspension, steering and four wheels</small></span></button>
            </div>
            <div className="rig-section">
              <div className="lab-title"><span>Forces</span><small>Apply to selection</small></div>
              <div className="physics-palette compact">
                {(["gravity", "wind", "attract", "bounce", "cloth"] as const).map((physics) => (
                  <button key={physics} onClick={() => paintPhysics(physics)}>{physics}</button>
                ))}
              </div>
            </div>
            <button className="rig-clear" onClick={clearPhysicsRigs}>Clear simulation constraints</button>
            <div className="rig-section"><div className="lab-title"><span>Camera bookmarks</span></div><button className="wide-action" onClick={saveCamera}>Save current view</button>{cameraShots.map((shot) => <button className="camera-row" key={shot.name} onClick={() => recallCamera(shot)}>{shot.name}</button>)}</div>
            <details className="animation-disclosure"><summary>Legacy looping motion</summary><p className="tip-text">Procedural previews; new Quick motions create editable keys instead.</p>{(["spin", "float", "bounce", "none"] as AnimationKind[]).map((animation) => <button className="wide-action" disabled={!selection || !!selection.keyframes.length} key={animation} onClick={() => updateSelection("animation", animation)}>{animation === "none" ? "Remove loop" : animation}</button>)}</details>
            <p className="tip-text" role="status">{rigStatus}</p>
            </>}
          </div>
        )}
        {activePanel === "pro" && (
          <div className="panel-scroll rail-drawer pro-studio">
            <button className="rail-drawer-close" onClick={() => setActivePanel(null)}>×</button>
            <div className="panel-heading"><p>Professional Workspace</p><span>Form Studio 0.40.0</span></div>
            <div className="pro-hero">
              <span>INTENT MODELING</span>
              <strong>Touch a surface, drag what you mean, and keep every decision editable.</strong>
              <small>{selection ? `${selection.name} selected` : "Select an object to begin"}</small>
            </div>

            <section className="pro-section intent-section">
              <div className="lab-title"><span>Intent Drag</span><small>{intentEnabled ? "Live" : "Paused"}</small></div>
              <button className={`intent-toggle ${intentEnabled ? "active" : ""}`} onClick={() => {
                const next = !intentEnabled;
                intentEnabledRef.current = next;
                setIntentEnabled(next);
              }}>
                <b>{intentEnabled ? "●" : "○"}</b>
                <span><strong>{intentEnabled ? "Gesture inference on" : "Gesture inference off"}</strong><small>Face mode · drag up to extrude · sideways to inset · ⌥ bevel · ⇧ smooth</small></span>
              </button>
              {intentPreview && !intentPreview.active && (
                <div className="intent-result">
                  <div><span>{intentPreview.label}</span><small>Exact amount</small></div>
                  <input type="number" min="-2" max="2" step="0.01" value={intentPreview.amount} onChange={(event) => updateIntentAmount(Number(event.target.value))} />
                  <input aria-label="Control name" value={controlName} onChange={(event) => setControlName(event.target.value)} />
                  <button onClick={makeIntentControl}>Make control</button>
                </div>
              )}
            </section>

            <section className="pro-section">
              <div className="lab-title"><span>Component modeling</span><small>{componentSelectionCount} selected</small></div>
              <div className="component-mode-switch">
                {(["object", "vertex", "edge", "face"] as MeshEditMode[]).map((item) => (
                  <button className={meshEditMode === item ? "active" : ""} key={item} onClick={() => setComponentMode(item)}>{item}</button>
                ))}
              </div>
              <label className="pro-range"><span>Operation amount <b>{meshEditAmount.toFixed(2)}</b></span><input type="range" min="-0.6" max="0.8" step="0.01" value={meshEditAmount} onChange={(event) => setMeshEditAmount(Number(event.target.value))} /></label>
              <div className="component-tools">
                {([
                  ["extrude", "↥", "Extrude"],
                  ["inset", "▣", "Inset"],
                  ["bevel", "◠", "Bevel"],
                  ["smooth", "≈", "Smooth"],
                  ["weld", "⌁", "Weld"],
                ] as [MeshEditKind, string, string][]).map(([kind, glyph, label]) => (
                  <button key={kind} onClick={() => applyComponentEdit(kind)}><b>{glyph}</b>{label}</button>
                ))}
              </div>
              {meshEditMode === "face" && (
                <div className="semantic-tools">
                  <span>Smart region</span>
                  {(["picked", "coplanar", "similar", "symmetry"] as SemanticSelectionRule[]).map((rule) => (
                    <button key={rule} onClick={() => selectSemanticRegion(rule)}>{rule}</button>
                  ))}
                </div>
              )}
              <div className="pro-stack">
                {(selection?.meshEdits ?? []).map((command, index) => (
                  <div className={!command.enabled ? "muted" : ""} key={command.id}>
                    <b>{index + 1}</b><span>{command.label}<small>{command.selected.length} components · {command.amount.toFixed(2)}</small></span>
                    <button onClick={() => updateMeshEditCommand(command.id, "toggle")}>{command.enabled ? "●" : "○"}</button>
                    <button onClick={() => updateMeshEditCommand(command.id, "up")}>↑</button>
                    <button onClick={() => updateMeshEditCommand(command.id, "down")}>↓</button>
                    <button onClick={() => updateMeshEditCommand(command.id, "remove")}>×</button>
                  </div>
                ))}
                {(selection?.meshEdits?.length ?? 0) === 0 && <p>Component operations remain editable and reorderable here.</p>}
              </div>
              {(selection?.modelControls?.length ?? 0) > 0 && (
                <div className="model-controls">
                  <div className="lab-title compact"><span>Design controls</span><small>Reusable intent</small></div>
                  {selection?.modelControls.map((control) => {
                    const command = selection.meshEdits.find((item) => item.id === control.commandId);
                    return (
                      <label key={control.id}>
                        <span>{control.name}<b>{command?.amount.toFixed(2) ?? "—"}</b></span>
                        <input type="range" min={control.min} max={control.max} step="0.01" value={command?.amount ?? 0} onChange={(event) => updateModelControl(control, Number(event.target.value))} />
                      </label>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="pro-section">
              <div className="lab-title"><span>Surface graph</span><small>Procedural + PBR</small></div>
              <div className="shader-node-map">
                <div><b>Pattern</b><small>{selection?.shaderGraph.procedural ?? "none"}</small></div><i>→</i>
                <div><b>Principled</b><small>PBR surface</small></div><i>→</i>
                <div className="output"><b>Output</b><small>Viewport</small></div>
              </div>
              <div className="procedural-grid">
                {(["none", "noise", "checker", "gradient"] as const).map((kind) => (
                  <button className={selection?.shaderGraph.procedural === kind ? "active" : ""} key={kind} onClick={() => updateShaderGraph("procedural", kind)}>{kind}</button>
                ))}
              </div>
              <div className="lab-title compact"><span>Automatic UVs</span><small>{selection?.shaderGraph.uvProjection ?? "original"}</small></div>
              <div className="procedural-grid thirds">
                {(["original", "box", "spherical"] as const).map((projection) => (
                  <button className={selection?.shaderGraph.uvProjection === projection ? "active" : ""} key={projection} onClick={() => updateShaderGraph("uvProjection", projection)}>{projection}</button>
                ))}
              </div>
              <label className="pro-range"><span>Pattern scale <b>{selection?.shaderGraph.scale.toFixed(1) ?? "5.0"}</b></span><input type="range" min="1" max="18" step="0.5" value={selection?.shaderGraph.scale ?? 5} onChange={(event) => updateShaderGraph("scale", Number(event.target.value))} /></label>
              <label className="pro-range"><span>Contrast <b>{Math.round((selection?.shaderGraph.contrast ?? 0.5) * 100)}%</b></span><input type="range" min="0" max="1" step="0.01" value={selection?.shaderGraph.contrast ?? 0.5} onChange={(event) => updateShaderGraph("contrast", Number(event.target.value))} /></label>
              <label className="pro-range"><span>Emission <b>{(selection?.shaderGraph.emission ?? 0).toFixed(1)}</b></span><input type="range" min="0" max="3" step="0.05" value={selection?.shaderGraph.emission ?? 0} onChange={(event) => updateShaderGraph("emission", Number(event.target.value))} /></label>
              <label className="pro-range"><span>Edge response <b>{Math.round((selection?.shaderGraph.fresnel ?? 0) * 100)}%</b></span><input type="range" min="0" max="1" step="0.01" value={selection?.shaderGraph.fresnel ?? 0} onChange={(event) => updateShaderGraph("fresnel", Number(event.target.value))} /></label>
            </section>

            <section className="pro-section">
              <div className="lab-title"><span>Animation curves</span><small>{selection?.keyframes.length ?? 0} keys</small></div>
              <div className="curve-preview" aria-label="Animation curve preview">
                <i /><i /><i /><i /><span />
              </div>
              <button className="pro-primary" onClick={addTransformKeyframe}>＋ Key transform at {(timeline * 10).toFixed(1)}s</button>
              <div className="procedural-grid">
                {(["linear", "ease-in", "ease-out", "ease-in-out", "hold", "spring"] as EasingKind[]).map((curve) => (
                  <button className={keyframeEasing === curve ? "active" : ""} key={curve} onClick={() => {
                    setKeyframeEasing(curve);
                    if (selectedKeyframeId) updateSelectedKeyframe(curve);
                  }}>{curve.replaceAll("-", " ")}</button>
                ))}
              </div>
            </section>

            <section className="pro-section">
              <div className="lab-title"><span>Scene system</span><small>Hierarchy + instances</small></div>
              <div className="pro-action-grid">
                <button onClick={createLinkedInstance}><b>⧉</b><span>Linked instance<small>Shared geometry and material</small></span></button>
                <button onClick={groupSelected}><b>◇</b><span>Collection<small>Organize selected objects</small></span></button>
                <button onClick={saveVersion}><b>◷</b><span>Checkpoint<small>Recover a project state</small></span></button>
                <button onClick={inspectSceneHealth}><b>✓</b><span>Scene health<small>Geometry and memory audit</small></span></button>
              </div>
              {sceneHealth && (
                <div className="health-report">
                  <strong title="Resource complexity heuristic, not release qualification">{sceneHealth.score}<small>/100 resource heuristic</small></strong>
                  <div><span>{sceneHealth.triangles.toLocaleString()} triangles · {sceneHealth.meshes} meshes</span><span>{sceneHealth.materials} materials · {sceneHealth.textures} textures</span></div>
                  {sceneHealth.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                  {sceneHealth.warnings.length === 0 && <p>No resource warnings found by this limited check.</p>}
                  <p>Geometry counts do not qualify rendering, interchange, deformation or professional acceptance.</p>
                </div>
              )}
            </section>

            <section className="pro-section">
              <div className="lab-title"><span>Simulation lab</span><small>Constraint solver</small></div>
              <div className="simulation-grid">
                <button onClick={() => createConstraintSimulation("rope")}><b>⌇</b>Rope</button>
                <button onClick={() => createConstraintSimulation("soft body")}><b>⬡</b>Soft body</button>
                <button onClick={() => createConstraintSimulation("cloth")}><b>▦</b>Cloth</button>
              </div>
            </section>

            <section className="pro-section">
              <div className="lab-title"><span>Render queue</span><small>{renderQueue.filter((job) => job.status === "complete").length}/{renderQueue.length} complete</small></div>
              <div className="render-queue-list">
                {renderQueue.map((job,index) => <div key={job.id}><i className={job.status} /><span>{job.name}<small>{job.quality} · {job.settings.width}×{job.settings.height} · {job.settings.samples} spp · {job.timeSeconds.toFixed(2)}s</small>{job.error && <small role="status">{job.error}</small>}<details><summary>Snapshot details & limits</summary><small>{job.scene.warnings.join(" · ")}</small><small>{job.createdAt} · {job.scene.indices.length/3} triangles · {job.settings.maxBounces} bounces</small></details><span className="shot-actions"><button aria-label={`Move ${job.name} earlier`} disabled={queueRunning || index===0} onClick={()=>setRenderQueue(current=>moveRenderShot(current,job.id,-1))}>↑</button><button aria-label={`Move ${job.name} later`} disabled={queueRunning || index===renderQueue.length-1} onClick={()=>setRenderQueue(current=>moveRenderShot(current,job.id,1))}>↓</button><button disabled={queueRunning} onClick={()=>duplicateQueuedShot(job)}>Duplicate</button>{["failed","cancelled"].includes(job.status) && <button disabled={queueRunning} onClick={()=>setRenderQueue(current=>current.map(item=>item.id===job.id?{...item,status:"queued",error:undefined}:item))}>Retry</button>}<button disabled={queueRunning} onClick={()=>setRenderQueue(current=>current.filter(item=>item.id!==job.id))}>Remove</button></span></span><em>{job.status}</em></div>)}
                {renderQueue.length === 0 && <p>Capture immutable camera, evaluated geometry, materials and lighting. Desktop native engine required.</p>}
              </div>
              <p>Native beta · up to 8 shots / 32 MB. Final: 1024px, 128 samples—not a production-quality guarantee. Large textures may exceed project snapshot limits.</p>
              <div className="pro-inline"><button disabled={queueRunning || !isDesktopApp()} onClick={addRenderJob}>＋ Capture shot</button><button disabled={queueRunning || nativeSceneRenderBusy || !isDesktopApp()} className="primary" onClick={runRenderJobs}>Render queued</button>{queueRunning && <button onClick={()=>{queueCancelled.current=true;announce("Stopping after the active GPU call; its unsaved output will be discarded");}}>Stop queue</button>}</div>
            </section>

            <section className="pro-section">
              <div className="lab-title"><span>Macro Lab</span><small>Safe extension actions</small></div>
              <input className="macro-name" value={macroName} onChange={(event) => setMacroName(event.target.value)} aria-label="Macro name" />
              <textarea className="macro-script" value={macroScript} onChange={(event) => setMacroScript(event.target.value)} aria-label="Macro actions" />
              <div className="pro-inline"><button onClick={saveMacro}>Save macro</button><button className="primary" onClick={() => runMacro()}>Run actions</button></div>
              {savedMacros.map((macro) => <button className="saved-macro" key={macro.id} onClick={() => runMacro(macro.script)}><b>▶</b><span>{macro.name}<small>{macro.script.split(/\r?\n/).length} actions</small></span></button>)}
            </section>

            <section className="pro-section pipeline-strip">
              <div className="lab-title"><span>Production delivery</span><small>Interchange formats</small></div>
              <button onClick={() => exportGLB()}>GLB</button><button onClick={exportOBJ}>OBJ</button><button onClick={exportSTL}>STL</button><button onClick={exportAR}>USDZ</button>
            </section>
          </div>
        )}
        {activePanel === "lab" && (
          <div className="panel-scroll rail-drawer form-lab">
            <button className="rail-drawer-close" onClick={() => setActivePanel(null)}>×</button>
            <div className="panel-heading"><p>Form Lab</p><span>Advanced, still intuitive</span></div>

            <div className="lab-section">
              <div className="lab-title"><span>Direct shape</span><small>Non-destructive</small></div>
              <div className="direct-tool-grid">
                <button onClick={() => applyShapeOperation("pull")}><b>↥</b>Pull</button>
                <button onClick={() => applyShapeOperation("inset")}><b>▣</b>Inset</button>
                <button onClick={() => applyShapeOperation("taper")}><b>△</b>Taper</button>
                <button onClick={() => applyShapeOperation("twist")}><b>↻</b>Twist</button>
              </div>
              {selection?.operations.length ? (
                <div className="operation-stack">
                  {selection.operations.map((operation, index) => (
                    <div className={!operation.enabled ? "disabled" : ""} key={operation.id}>
                      <button aria-label={`Toggle ${operation.label}`} aria-pressed={operation.enabled} onClick={() => updateShapeOperation(operation.id, "toggle")}>{operation.enabled ? "●" : "○"}</button>
                      <span><b>{index + 1}</b>{operation.label}</span>
                      <button aria-label={`Move ${operation.label} up`} disabled={index === 0} onClick={() => updateShapeOperation(operation.id, "up")}>↑</button>
                      <button aria-label={`Move ${operation.label} down`} disabled={index === selection.operations.length - 1} onClick={() => updateShapeOperation(operation.id, "down")}>↓</button>
                      <button aria-label={`Remove ${operation.label}`} onClick={() => updateShapeOperation(operation.id, "remove")}>×</button>
                      <label className="operation-amount">Amount<input aria-label={`${operation.label} amount`} key={`${operation.id}:${operation.amount}`} type="number" min="-5" max="5" step="0.05" defaultValue={operation.amount} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}} onBlur={e=>{const v=Number(e.target.value);if(e.target.value.trim() && v!==operation.amount)updateShapeOperation(operation.id,"toggle",v);}} /></label>
                      <button className="operation-duplicate" aria-label={`Duplicate ${operation.label}`} onClick={()=>updateShapeOperation(operation.id,"duplicate")}>Duplicate</button>
                    </div>
                  ))}
                </div>
              ) : <p className="lab-empty">Select a Form primitive, then pull or reshape it. Every operation stays editable.</p>}
            </div>

            <div className="lab-section">
              <div className="lab-title"><span>Effect recipes</span><small>Preview and remix</small></div>
              <label className="effect-recipe-name">Recipe name<input aria-label="Effect recipe name" maxLength={100} value={recipeName} onChange={e=>setRecipeName(e.target.value)} placeholder="My effects" /></label>
              <div className="magic-row">
                <button onClick={createBranch}>＋ Save branch</button>
                <button className="primary" disabled={!selection} onClick={saveRecipe}>Save recipe</button>
              </div>
              {branches.length > 0 && <div className="branch-list">
                {branches.slice(0, 5).map((branch) => <button key={branch.id} onClick={() => restoreScene(branch.scene)}><span>◇</span><b>{branch.label}</b><small>{new Date(branch.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></button>)}
              </div>}
              {recipes.length > 0 && <div className="recipe-list">
                {recipes.map((recipe) => <button key={recipe.id} onClick={() => previewRecipe(recipe)}><i style={{ background: recipe.data.color }} /><span>{recipe.name}</span><em>Preview</em></button>)}
              </div>}
              {recipePreview && <EffectRecipePreview before={recipePreview.before} after={recipePreview.after} createObject={createPrimitive} name={recipePreview.recipe.name} targetName={recipePreview.before.name} stale={!selection || selection.id !== recipePreview.targetId || JSON.stringify(selection) !== recipePreview.source || playing || physicsObjectIds.includes(recipePreview.targetId)} onApply={applyRecipe} onCancel={() => setRecipePreview(null)} />}
            </div>

            <div className="lab-section">
              <div className="lab-title"><span>Smart relationships</span><small>Scene-aware</small></div>
              <div className="chip-grid">
                {(["Ground", "Center stage", "Face camera", "Equal spacing", "Attach"] as const).map((constraint) => (
                  <button className={selection?.constraints.includes(constraint) ? "active" : ""} key={constraint} onClick={() => applyConstraint(constraint)}>{constraint}</button>
                ))}
              </div>
            </div>

            <div className="lab-section">
              <div className="lab-title"><span>Design variations</span><small>Editable directions</small></div>
              <button className="lab-primary" onClick={createVariations}>✦ Generate four directions</button>
              {variations.length > 0 && <div className="variation-grid">
                {variations.map((variation, index) => (
                  <button key={variation.id} onClick={() => applyVariation(variation, index)}>
                    <i style={{ "--variation-color": variation.color } as CSSProperties} /><span>{variation.name}</span>
                  </button>
                ))}
              </div>}
            </div>

            <div className="lab-section">
              <div className="lab-title"><span>Scene kits</span><small>Drag-ready building blocks</small></div>
              <div className="chip-grid thirds">
                {(["Podium", "Backdrop", "Light rig"] as const).map((kit) => <button key={kit} onClick={() => addSceneKit(kit)}>{kit}</button>)}
              </div>
            </div>

            <div className="lab-section">
              <div className="lab-title"><span>Lighting & camera</span><small>Subject-aware</small></div>
              <div className="chip-grid">
                <button onClick={() => setEnvironment("Product")}>Softbox</button>
                <button onClick={() => setEnvironment("Dusk")}>Sunset</button>
                <button onClick={() => { focusSelection(); setDepthOfField(true); }}>Hero close-up</button>
                <button onClick={saveCamera}>Save shot</button>
              </div>
            </div>

            <div className="lab-section">
              <div className="lab-title"><span>Asset intelligence</span><small>Automatic cleanup</small></div>
              {assetReport ? <div className="asset-report">
                <strong>{assetReport.name}</strong><span>{assetReport.triangles.toLocaleString()} triangles · {assetReport.materials} materials</span><em>{assetReport.status}</em>
              </div> : <p className="lab-empty">Import a GLB to inspect scale, geometry, materials, and web readiness.</p>}
              <button className="lab-secondary" onClick={optimizeSelection}>Repair, ground & optimize</button>
            </div>

            <div className="lab-section">
              <div className="lab-title"><span>Presentation</span><small>Interactive story</small></div>
              <button className="lab-primary dark" onClick={() => { setPresentationIndex(0); setPresentationMode(true); }}>▶ Present this scene</button>
              <button className="lab-secondary" onClick={() => shareScene(true)}>Copy interactive embed</button>
            </div>
          </div>
        )}
        {activePanel === "magic" && (
          <div className="panel-scroll rail-drawer form-lab magic-studio">
            <button className="rail-drawer-close" onClick={() => setActivePanel(null)}>×</button>
            <div className="panel-heading"><p>Magic Studio</p><span>From idea to experience</span></div>

            <div className="magic-hero">
              <span>WOW WORKFLOWS</span>
              <strong>Make the impossible feel like one move.</strong>
            </div>

            <div className="lab-section sketch-lab">
              <div className="lab-title"><span>Sketch to 3D</span><small>Draw any outline</small></div>
              <canvas
                ref={sketchCanvasRef}
                onPointerDown={(event) => sketchPointer(event, true)}
                onPointerMove={(event) => sketchPointer(event)}
                onPointerUp={() => { sketchingRef.current = false; }}
                onPointerCancel={() => { sketchingRef.current = false; }}
              />
              <div className="magic-row">
                <button onClick={() => setSketchPoints([])}>Clear</button>
                <button className="primary" onClick={createFromSketch}>Create 3D form</button>
              </div>
            </div>

            <div className="lab-section">
              <div className="lab-title"><span>Image intelligence</span><small>Camera + surface capture</small></div>
              <div className="magic-action-list">
                <button onClick={() => photoInputRef.current?.click()}><b>▧</b><span><strong>Match photo to scene</strong><small>Camera, backdrop and exposure</small></span><em>{photoMatched ? "Matched" : "Choose"}</em></button>
                <button onClick={() => materialCaptureRef.current?.click()}><b>◉</b><span><strong>Capture a material</strong><small>Tile, depth and surface response</small></span><em>Choose</em></button>
              </div>
              <input ref={photoInputRef} hidden type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && matchPhotoScene(event.target.files[0])} />
              <input ref={materialCaptureRef} hidden type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && captureMaterial(event.target.files[0])} />
            </div>

            <div className="lab-section">
              <div className="lab-title"><span>Creative director</span><small>Preview-first automation</small></div>
              <div className="magic-director-grid">
                <button className={voiceListening ? "active" : ""} onClick={startVoiceDirection}><b>◉</b>Voice direct</button>
                <button onClick={autoCinematic}><b>◫</b>Cinematic</button>
                <button onClick={createProductStudio}><b>◇</b>Product studio</button>
                <button className={recording ? "active recording" : ""} onClick={recordSceneVideo}><b>●</b>{recording ? "Recording…" : "Scene video"}</button>
                <button onClick={launchAR}><b>⌁</b>AR handoff</button>
                <button className={audioReactive ? "active" : ""} onClick={toggleAudioReactive}><b>≋</b>Audio material</button>
              </div>
            </div>

            <div className="lab-section">
              <div className="lab-title"><span>Physics brush</span><small>Paint behavior</small></div>
              <div className="physics-palette">
                {(["gravity", "wind", "attract", "bounce", "cloth"] as const).map((physics) => (
                  <button className={physicsMode === physics ? "active" : ""} key={physics} onClick={() => paintPhysics(physics)}><i>{physics === "gravity" ? "↓" : physics === "wind" ? "→" : physics === "attract" ? "◎" : physics === "bounce" ? "⌁" : "≋"}</i>{physics}</button>
                ))}
              </div>
            </div>

            <div className="lab-section">
              <div className="lab-title"><span>Procedural smart objects</span><small>Editable assemblies</small></div>
              <div className="smart-object-grid">
                {(["Bottle", "Stairs", "Lamp", "Plant", "Package"] as const).map((kind) => <button key={kind} onClick={() => addSmartObject(kind)}><i>{kind.slice(0, 1)}</i>{kind}</button>)}
              </div>
            </div>

            <div className="lab-section">
              <div className="lab-title"><span>Invisible optimization</span><small>Publish-ready assets</small></div>
              <button className="lab-primary dark" onClick={optimizeSelection}>Repair, audit and prepare selected</button>
              <p className="lab-empty">Form repairs normals, grounds assets, refreshes bounds, tunes materials, and prepares efficient GLB export automatically.</p>
            </div>
          </div>
        )}
      </aside>

      <section className="viewport-wrap">
        <div className="viewport" ref={viewportRef} onDragOver={(event) => event.preventDefault()} onDrop={dropObject} />
        <div className="viewport-top">
          <div className="view-cluster">
            <button onClick={() => setView("perspective")} title="Perspective">◇</button>
            <button onClick={() => setView("front")} title="Front">▦</button>
            <button onClick={() => setView("top")} title="Top">⌗</button>
            <button onClick={saveCamera} title="Save camera">＋</button>
          </div>
          <div className="viewport-top-right">
            <div className="environment-pill"><span className="sun-dot">☼</span>
              <select value={environment} onChange={(event) => setEnvironment(event.target.value)}>
                <option>Studio</option><option>Daylight</option><option>Dusk</option><option>Midnight</option><option>Product</option>
              </select>
            </div>
            <button className="render-settings-button" onClick={() => setRenderOpen((value) => !value)}>◐</button>
            {renderOpen && (
              <div className="render-popover">
                <div className="quality-switch">
                  {(["Fast", "Studio", "Final"] as const).map((quality) => <button className={qualityMode === quality ? "active" : ""} key={quality} onClick={() => setQualityMode(quality)}>{quality}</button>)}
                </div>
                <label><span>Bloom</span><input type="checkbox" aria-label="Bloom" checked={bloom} onChange={(event) => setBloom(event.target.checked)} /></label>
                <label><span>Depth of field</span><input type="checkbox" aria-label="Depth of field" checked={depthOfField} onChange={(event) => setDepthOfField(event.target.checked)} /></label>
                <label><span>Grid</span><input type="checkbox" aria-label="Viewport grid" checked={gridVisible} onChange={(event) => setGridVisible(event.target.checked)} /></label>
                <button onClick={() => renderPNG()}>Render PNG</button>
                {isDesktopApp() && <button disabled={nativeSceneRenderBusy} onClick={()=>void renderNativeScene()}>{nativeSceneRenderBusy?"Native render running…":"Native GPU scene (beta)"}</button>}
              </div>
            )}
          </div>
        </div>

        {selection && (
          <div className="direct-edit-strip">
            <span><i />Direct edit</span>
            <button onClick={() => applyShapeOperation("pull")}>↥ Pull</button>
            <button onClick={() => applyShapeOperation("inset")}>▣ Inset</button>
            <button onClick={() => applyShapeOperation("taper")}>△ Taper</button>
            <button onClick={() => applyShapeOperation("twist")}>↻ Twist</button>
          </div>
        )}

        {intentPreview?.active && (
          <div className="intent-hud">
            <span>INTENT</span>
            <strong>{intentPreview.label}</strong>
            <b>{intentPreview.amount >= 0 ? "+" : ""}{intentPreview.amount.toFixed(2)} m</b>
            <small>Release to commit · exact value remains editable</small>
          </div>
        )}

        <div className="context-toolbar" ref={contextRef}>
          <button onClick={() => duplicateSelected(1)} title="Duplicate">⧉</button>
          <button onClick={() => applyModifier("bevel")} title="Round edges">◠</button>
          <button onClick={() => selection && updateSelection("color", MATERIALS[(MATERIALS.findIndex((m) => m.value.toLowerCase() === selection.color.toLowerCase()) + 1) % MATERIALS.length].value)} title="Next material">◉</button>
          <button className="danger" onClick={removeSelected} title="Delete">×</button>
        </div>

        {activeVehicleId && (
          <div className="vehicle-controls">
            <span><i />VEHICLE LIVE</span>
            <div>
              <button
                onPointerDown={() => { vehicleInputRef.current.throttle = 1; vehicleInputRef.current.brake = 0; }}
                onPointerUp={() => { vehicleInputRef.current.throttle = 0; vehicleInputRef.current.brake = 0.35; }}
                onPointerLeave={() => { vehicleInputRef.current.throttle = 0; }}
              >↑</button>
              <button
                onPointerDown={() => { vehicleInputRef.current.steering = 1; vehicleInputRef.current.brake = 0; }}
                onPointerUp={() => { vehicleInputRef.current.steering = 0; }}
                onPointerLeave={() => { vehicleInputRef.current.steering = 0; }}
              >←</button>
              <button
                onPointerDown={() => { vehicleInputRef.current.brake = 1; vehicleInputRef.current.throttle = 0; }}
                onPointerUp={() => { vehicleInputRef.current.brake = 0.35; }}
              >■</button>
              <button
                onPointerDown={() => { vehicleInputRef.current.steering = -1; vehicleInputRef.current.brake = 0; }}
                onPointerUp={() => { vehicleInputRef.current.steering = 0; }}
                onPointerLeave={() => { vehicleInputRef.current.steering = 0; }}
              >→</button>
              <button
                onPointerDown={() => { vehicleInputRef.current.throttle = -0.62; vehicleInputRef.current.brake = 0; }}
                onPointerUp={() => { vehicleInputRef.current.throttle = 0; vehicleInputRef.current.brake = 0.35; }}
                onPointerLeave={() => { vehicleInputRef.current.throttle = 0; }}
              >↓</button>
            </div>
            <small>Arrow keys also drive</small>
          </div>
        )}

        {presence.map((person) => (
          <div className="remote-cursor" key={person.user_id} style={{ left: `${person.x / 10}%`, top: `${person.y / 10}%`, color: person.color }}>
            <span>◆</span><em style={{ background: person.color }}>{person.name}</em>
          </div>
        ))}

        <div className="mode-toolbar command-dock" aria-label="Magic command">
          <button onClick={() => setCommandOpen(true)} className="magic-tool"><span>⌕</span><em>Describe a change…</em><kbd>⌘K</kbd></button>
        </div>

        <div className="timeline-bar">
          <UiResizeHandle axis="y" value={workspaceUi.layout.timelineSize} min={112} max={340} invert onChange={(value) => workspaceUi.update("timelineSize", value)} label="Resize motion timeline" />
          <AnimationTimeline items={sceneItems} selectedId={selection?.id ?? null} selectedKeyId={selectedKeyframeId} time={timeline} playing={playing} canRecord={Boolean(selection && !selection.locked && !physicsObjectIds.includes(selection.id))}
            onSelect={(id) => { const object = runtimeRef.current?.objects.get(id); if (object) selectObject(object); }} onSeek={seekAnimation} onPlay={toggleAnimationPlayback} onRecord={addTransformKeyframe}
            onKeySelect={(id, key) => { const object = runtimeRef.current?.objects.get(id); if (object) selectObject(object); seekAnimation(key.time); setSelectedKeyframeId(key.id); setKeyframeEasing(key.easing); setAnimationPage("motion"); setActivePanel("animate"); }} />
        </div>
        <div className="viewport-footer">
          <span><i className="green-dot" />{toast}</span>
          <span>{sceneItems.length} objects · Smart snap {snap ? "on" : "off"} · {qualityMode} renderer</span>
        </div>

        {aiPreview && (
          <div className="ai-preview-bar">
            <div><span>AI CHANGE PREVIEW</span><strong>{aiPreview.label}</strong></div>
            <button onClick={() => { restoreScene(aiPreview.before); setAiPreview(null); announce("AI change discarded"); }}>Discard</button>
            <button className="accept" onClick={() => { setAiPreview(null); announce("AI change accepted"); }}>Accept change</button>
          </div>
        )}
      </section>

      <aside id="animation-properties" className="inspector" aria-label="Animation properties">
        <CompactPropertiesClose id="animation-properties" onClick={() => compactUi.setCollapsed(true)} />
        <UiResizeHandle axis="x" value={workspaceUi.layout.inspectorSize} min={300} max={560} invert onChange={(value) => workspaceUi.update("inspectorSize", value)} label="Resize Studio inspector" />
        <div className="inspector-title">
          <div><span>Inspector</span><strong>{selection?.name ?? "Nothing selected"}</strong></div>
          <button onClick={() => setVersionsOpen((value) => !value)}>◷</button>
        </div>
        {selection ? (
          <div className="inspector-content">
            <label className="name-field"><span>Name</span><input value={selection.name} onChange={(event) => updateSelection("name", event.target.value)} /></label>
            <InspectorGroup title="Transform">
              <VectorField label="Position" values={selection.position} onChange={(axis, value) => updateSelection("position", value, axis)} />
              <VectorField label="Rotation" values={selection.rotation} suffix="°" onChange={(axis, value) => updateSelection("rotation", value, axis)} />
              <VectorField label="Scale" values={selection.scale} onChange={(axis, value) => updateSelection("scale", value, axis)} />
              <VectorField label="Dimensions" values={selectionDimensions} suffix="m" onChange={setDimensions} />
            </InspectorGroup>
            <details className="animation-disclosure animation-appearance" open={initialPanel !== "rig" && activePanel !== "rig" && activePanel !== "animate" ? true : undefined}><summary>Appearance & modeling</summary>
            <div className="studio-light-card">
              <label><span>Studio light</span><select value={environment} onChange={(event) => setEnvironment(event.target.value)}><option>Studio</option><option>Daylight</option><option>Dusk</option><option>Midnight</option><option>Product</option></select></label>
            </div>
            <InspectorGroup title="Material">
              <div className="material-layer-map"><span>BASE</span><i>→</i><span>SURFACE</span><i>→</i><span>COAT</span><i>→</i><span>FX</span></div>
              <div className="shader-presets">
                {SHADER_PRESETS.map((preset) => (
                  <button key={preset.name} className={selection.color.toLowerCase() === preset.color.toLowerCase() ? "active" : ""} onClick={() => applyShaderPreset(preset)} title={`${preset.name} shader`}>
                    <i style={{ "--shader-color": preset.color } as CSSProperties} /><span>{preset.name}</span>
                  </button>
                ))}
              </div>
              <div className="material-control"><span>Base color</span><label className="color-control">
                <input type="color" value={selection.color} onChange={(event) => updateSelection("color", event.target.value)} /><code>{selection.color.toUpperCase()}</code>
              </label></div>
              <RangeField label="Roughness" value={selection.roughness} onChange={(value) => updateSelection("roughness", value)} />
              <RangeField label="Metallic" value={selection.metalness} onChange={(value) => updateSelection("metalness", value)} />
              <RangeField label="Clearcoat" value={selection.clearcoat} onChange={(value) => updateSelection("clearcoat", value)} />
              <RangeField label="Soft sheen" value={selection.sheen} onChange={(value) => updateSelection("sheen", value)} />
              <RangeField label="Transmission" value={selection.transmission} onChange={(value) => updateSelection("transmission", value)} />
              <RangeField label="Volume" value={selection.thickness} onChange={(value) => updateSelection("thickness", value)} />
              <RangeField label="Iridescence" value={selection.iridescence} onChange={(value) => updateSelection("iridescence", value)} />
              <button className="wide-action" onClick={() => textureInputRef.current?.click()}>Choose image texture</button>
            </InspectorGroup>
            <InspectorGroup title={`Shape history · ${selection.operations.length}`}>
              <div className="history-stack-mini">
                {selection.operations.map((operation, index) => <button className={!operation.enabled ? "disabled" : ""} key={operation.id} onClick={() => updateShapeOperation(operation.id, "toggle")}><b>{index + 1}</b><span>{operation.label}</span><em>{operation.enabled ? "Live" : "Muted"}</em></button>)}
                {selection.operations.length === 0 && <p>Shape operations appear here and can always be muted or reordered in Form Lab.</p>}
              </div>
            </InspectorGroup>
            <InspectorGroup title="Smart modifiers">
              <div className="modifier-grid">
                <button className={selection.modifiers.bevel ? "active" : ""} onClick={() => applyModifier("bevel")}><span>◠</span>Round</button>
                <button className={selection.modifiers.mirror ? "active" : ""} onClick={() => applyModifier("mirror")}><span>◐</span>Mirror</button>
                <button className={selection.modifiers.array > 1 ? "active" : ""} onClick={() => applyModifier("array")}><span>⧉</span>Repeat ×{selection.modifiers.array}</button>
                <button className={selection.modifiers.bend > 0 ? "active" : ""} onClick={() => applyModifier("bend")}><span>⌒</span>Bend</button>
                <button onClick={() => applyModifier("cut")}><span>◉</span>Cut hole</button>
              </div>
            </InspectorGroup>
            <InspectorGroup title="Arrange">
              <div className="action-grid arrange-grid">
                <button onClick={() => arrange("row")}>Row</button><button onClick={() => arrange("circle")}>Circle</button>
                <button onClick={() => arrange("stack")}>Stack</button><button onClick={() => arrange("scatter")}>Scatter</button>
              </div>
            </InspectorGroup>
            <InspectorGroup title="Actions">
              <div className="action-grid">
                <button onClick={() => duplicateSelected(1)}>Duplicate</button><button onClick={groupSelected}>Group</button>
                <button onClick={() => setCommentsOpen(true)}>Comment</button><button onClick={focusSelection}>Focus</button>
                <button className="danger" onClick={removeSelected}>Delete</button>
              </div>
            </InspectorGroup>
            </details>
            <div className="animation-inspector-help"><strong>Make a move. Keep the moment.</strong><p>Position your object, then press K to record. Move the playhead and change it again.</p><button className="wide-action" onClick={() => updateSelection("locked", !selection.locked)}>{selection.locked ? "Unlock object" : "Lock object"}</button></div>
          </div>
        ) : (
          <div className="empty-inspector">
            <div className="empty-inspector-art" aria-hidden="true"><i /><i /><i /></div>
            <strong>Ready when you are</strong>
            <p>Select an object to reveal precise transforms, materials, modifiers, and animation controls.</p>
            <div className="empty-inspector-shortcuts">
              <span><kbd>Click</kbd> inspect</span>
              <span><kbd>⇧ Click</kbd> multi-select</span>
              <span><kbd>⌘ K</kbd> command</span>
            </div>
          </div>
        )}
      </aside>

      {commandOpen && (
        <div className="command-overlay" onMouseDown={() => setCommandOpen(false)}>
          <div className="command-palette" onMouseDown={(event) => event.stopPropagation()}>
            <div className="command-input"><span>✦</span><input autoFocus value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => event.key === "Enter" && runCommand()} placeholder="Describe what you want to change…" /><button onClick={() => runCommand()}>Preview</button></div>
            <div className="command-examples"><span>Try</span>
              <button onClick={() => setCommand("make it glass, twist it and add bloom")}>make it glass, twist it and add bloom</button>
              <button onClick={() => setCommand("create four design variations")}>create four design variations</button>
              <button onClick={() => setCommand("center it, ground it and use dramatic lighting")}>center it, ground it and use dramatic lighting</button>
            </div>
          </div>
        </div>
      )}

      {commentsOpen && (
        <aside className="comments-drawer">
          <div className="drawer-title"><div><span>3D comments</span><strong>{comments.length} pins</strong></div><button onClick={() => setCommentsOpen(false)}>×</button></div>
          <div className="comment-compose"><textarea value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder={selection ? `Comment on ${selection.name}` : "Comment on the scene"} /><button onClick={addComment}>Pin comment</button></div>
          <div className="comments-list">
            {comments.map((comment) => (
              <button key={comment.id} onClick={() => {
                const object = comment.object_id ? runtimeRef.current?.objects.get(comment.object_id) : null;
                if (object) selectObject(object);
              }}>
                <span className="comment-avatar">{comment.author.slice(0, 2).toUpperCase()}</span>
                <div><strong>{comment.author}</strong><p>{comment.body}</p><small>{new Date(comment.created_at).toLocaleString()}</small></div>
              </button>
            ))}
            {comments.length === 0 && <p className="empty-comments">Pin feedback to an object so collaborators always know exactly what you mean.</p>}
          </div>
        </aside>
      )}

      {versionsOpen && (
        <aside className="versions-drawer">
          <div className="drawer-title"><div><span>Version history</span><strong>Local checkpoints</strong></div><button onClick={() => setVersionsOpen(false)}>×</button></div>
          <button className="new-version" onClick={saveVersion}>＋ Create checkpoint</button>
          {versions.map((version) => (
            <button className="version-row" key={version.id} onClick={() => restoreScene(version.scene)}>
              <span>◷</span><div><strong>{version.label}</strong><small>{new Date(version.at).toLocaleString()}</small></div>
            </button>
          ))}
        </aside>
      )}

      {presentationMode && (
        <div className="presentation-hud">
          <div className="presentation-brand"><span>FORM</span><strong>Interactive scene</strong></div>
          <div className="presentation-hotspots">
            {sceneItems.map((item, index) => <button key={item.id} onClick={() => {
              const object = runtimeRef.current?.objects.get(item.id);
              if (object) { selectObject(object); focusSelection(); }
            }}><i style={{ background: item.color }} />{index + 1}. {item.name}</button>)}
          </div>
          <div className="presentation-controls">
            <button onClick={() => stepPresentation(-1)}>←</button>
            <span>{cameraShots.length > 0 ? `Shot ${(presentationIndex % cameraShots.length) + 1} / ${cameraShots.length}` : "Orbit story"}</span>
            <button onClick={() => stepPresentation(1)}>→</button>
          </div>
          <div className="presentation-actions">
            <button onClick={() => shareScene(true)}>Share</button>
            <button className="close" onClick={() => setPresentationMode(false)}>Exit presentation</button>
          </div>
        </div>
      )}

      {cadOpen && <CadWorkspace
        saveSession={documentSession}
        onClose={() => closeCadWorkspace()}
        onOpenRigLab={(project) => { void openAnimationWorkspace(project); }}
        initialProjectContents={cadProjectContents}
        initialProjectPath={cadProjectPath}
      />}
    </main>
  );

  function updateObjectById(id: string, field: "visible" | "locked") {
    const runtime = runtimeRef.current;
    const object = runtime?.objects.get(id);
    if (!object) return;
    pushHistory();
    if (field === "visible") object.visible = !object.visible;
    if (field === "locked") object.userData.locked = !object.userData.locked;
    if (selectedRef.current === id) {
      setSelection(readObject(object));
      if (object.userData.locked) runtime?.transform.detach();
    }
    syncItems();
  }

  function setView(view: "perspective" | "front" | "top") {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const target = selectedRef.current
      ? runtime.objects.get(selectedRef.current)?.position.clone() ?? new THREE.Vector3(0, 0.8, 0)
      : new THREE.Vector3(0, 0.8, 0);
    runtime.orbit.target.copy(target);
    runtime.camera.position.copy(
      view === "front" ? target.clone().add(new THREE.Vector3(0, 0, 8))
        : view === "top" ? target.clone().add(new THREE.Vector3(0, 8, 0.01))
          : target.clone().add(new THREE.Vector3(6, 4.5, 7))
    );
    runtime.camera.lookAt(target);
    runtime.orbit.update();
  }
}

function SceneRow({
  item, selected, onSelect, onToggle,
}: {
  item: SceneObjectData;
  selected: boolean;
  onSelect: (additive: boolean) => void;
  onToggle: (field: "visible" | "locked") => void;
}) {
  return (
    <div className={`scene-row-v2 ${selected ? "selected" : ""}`}>
      <button className="scene-main" onClick={(event) => onSelect(event.shiftKey)}><span>◇</span>{item.name}</button>
      <button className={!item.visible ? "off" : ""} onClick={() => onToggle("visible")} title="Show or hide">{item.visible ? "◉" : "○"}</button>
      <button className={item.locked ? "on" : ""} onClick={() => onToggle("locked")} title="Lock">{item.locked ? "●" : "◌"}</button>
    </div>
  );
}

function InspectorGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return <section className="inspector-group">
    <button className="group-title" onClick={() => setOpen((value) => !value)}><span>{open ? "⌄" : "›"}</span>{title}</button>
    {open && <div className="group-body">{children}</div>}
  </section>;
}

function VectorField({
  label, values, suffix = "", onChange,
}: {
  label: string;
  values: [number, number, number];
  suffix?: string;
  onChange: (axis: number, value: number) => void;
}) {
  return <div className="vector-field"><span>{label}</span><div>
    {(["X", "Y", "Z"] as const).map((axis, index) => (
      <label key={axis}><small className={axis.toLowerCase()}>{axis}</small>
        <input type="number" step="0.1" value={values[index]} onChange={(event) => onChange(index, Number(event.target.value))} />
        {suffix && <em>{suffix}</em>}
      </label>
    ))}
  </div></div>;
}

function RangeField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="range-field"><span>{label}</span><div>
    <input type="range" min="0" max="1" step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    <code>{value.toFixed(2)}</code>
  </div></label>;
}
