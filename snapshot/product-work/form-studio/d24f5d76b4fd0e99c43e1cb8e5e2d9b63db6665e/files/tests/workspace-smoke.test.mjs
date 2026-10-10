// Integration smoke tests that mount the real CadWorkspace component.
//
// The component is a .tsx module that pulls in three.js, a web worker and a
// WebGL viewport, none of which node or jsdom can run. Rather than editing the
// component, this file installs three pieces of test-side scaffolding before
// importing it:
//   1. a synchronous module hook that transpiles the app's .ts/.tsx sources
//      (node strips types but cannot compile JSX) and resolves the app's
//      extensionless relative imports,
//   2. a shim module for "three" that re-exports the real library with only
//      WebGLRenderer and PMREM generation swapped for headless stand-ins,
//   3. jsdom plus stubs for the browser globals jsdom lacks (Worker,
//      ResizeObserver, fetch).
// Everything else — state, effects, event handlers, markup — is the real thing.
import assert from "node:assert/strict";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { JSDOM, VirtualConsole } from "jsdom";

const APP_DIR = new URL("../app/", import.meta.url).href;
// A URL inside the repo so bare specifiers still resolve from node_modules.
// The file is never written to disk; the load hook serves its source.
const THREE_SHIM = new URL("./__three-shim__.mjs", import.meta.url).href;

const THREE_SHIM_SOURCE = `
export * from "three";
import { Color, Texture } from "three";
export class PMREMGenerator {
  fromScene() { return { texture: new Texture(), dispose() {} }; }
  dispose() {}
}
// three's WebGLRenderer needs a real GL context. The component only uses the
// handful of members below, so a headless stand-in keeps the viewport effect
// on its real code path without a GPU.
export class WebGLRenderer {
  constructor() {
    this.domElement = document.createElement("canvas");
    this.domElement.dataset.testRenderer = "stub";
    this.renderCount = 0;
    this.disposed = false;
    this.shadowMap = {};
    this.renderTarget = null;
    this.clearColor = new Color();
    this.clearAlpha = 1;
    this.autoClear = true;
    this.failRender = globalThis.__failPreviewRender ?? false;
    globalThis.__cadRenderers.push(this);
  }
  setPixelRatio() {}
  forceContextLoss() {}
  getPixelRatio() { return 1; }
  getSize(target) { return target.set(800, 600); }
  // Preserve the state contract used by the real postprocessing passes;
  // this exercises their wiring, not their GPU output.
  getRenderTarget() { return this.renderTarget; }
  setRenderTarget(target) { this.renderTarget = target; }
  getClearColor(target) { return target.copy(this.clearColor); }
  setClearColor(color, alpha) {
    this.clearColor.set(color);
    if (alpha !== undefined) this.clearAlpha = alpha;
  }
  getClearAlpha() { return this.clearAlpha; }
  setClearAlpha(alpha) { this.clearAlpha = alpha; }
  clear() {}
  clearDepth() {}
  setSize() {}
  render(scene) {
    if (this.failRender) throw new Error("Graphics preview test failure");
    this.renderCount += 1;
    this.lastRenderedMeshes = 0;
    this.lastGarmentVisibility = [];
    this.lastSketches = [];
    this.lastExactBodies = [];
    this.lastPhotoTextures = [];
    scene?.traverse((object) => { if (object.isMesh && object.material?.map?.isDataTexture) this.lastPhotoTextures.push(object); });
    scene?.traverse((object) => { if (object.isMesh) this.lastRenderedMeshes += 1; });
    scene?.traverse((object) => { if (object.name === "Fitted garment") this.lastFittedGarment = object; });
    scene?.traverse((object) => { if (object.userData.formGarmentPreview) this.lastGarmentVisibility.push(object.visible); });
    scene?.traverse((object) => {
      if (object.userData.sketchPreview) this.lastSketches.push(object);
      if (object.userData.appearance === "exact") this.lastExactBodies.push(object);
    });
  }
  dispose() { this.disposed = true; }
}
`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    const parent = context.parentURL ?? "";
    if (specifier === "three" && parent.startsWith(APP_DIR)) {
      return { url: THREE_SHIM, shortCircuit: true };
    }
    // App sources import siblings without a file extension.
    if (specifier.startsWith(".") && parent.startsWith(APP_DIR) && !/\.[a-z]+$/i.test(specifier)) {
      for (const extension of [".tsx", ".ts"]) {
        const candidate = new URL(specifier + extension, parent);
        if (existsSync(fileURLToPath(candidate))) {
          return { url: candidate.href, format: "module", shortCircuit: true };
        }
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === THREE_SHIM) {
      return { format: "module", source: THREE_SHIM_SOURCE, shortCircuit: true };
    }
    if (url.startsWith(APP_DIR) && /\.tsx?$/.test(url)) {
      const source = readFileSync(fileURLToPath(url), "utf8");
      const compiled = ts.transpileModule(source, {
        fileName: fileURLToPath(url),
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.ReactJSX,
          verbatimModuleSyntax: false,
        },
      });
      return { format: "module", source: compiled.outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

// The 2D sketch canvas asks for a drawing context every render and the
// component already handles the null jsdom returns; drop only that noise.
const virtualConsole = new VirtualConsole();
for (const level of ["error", "warn", "info", "log"]) {
  virtualConsole.on(level, (...args) => console[level](...args));
}
virtualConsole.on("jsdomError", (error) => {
  if (!/Not implemented/.test(error.message)) console.error(error);
});

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
  virtualConsole,
});

globalThis.__cadRenderers = [];
globalThis.window = dom.window;
globalThis.document = dom.window.document;
dom.window.matchMedia = query => ({ media: query, matches: false, addEventListener() {}, removeEventListener() {} });
for (const key of Object.getOwnPropertyNames(dom.window)) {
  if (key.startsWith("_") || key in globalThis) continue;
  try {
    globalThis[key] = dom.window[key];
  } catch {
    // Some window properties are getter-only; the component does not use them.
  }
}
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });

// jsdom ships none of these; the component constructs all three on mount.
class WorkerStub {
  constructor(url, options) {
    this.url = String(url);
    this.options = options;
    this.messages = [];
    this.terminated = false;
    globalThis.__cadWorkers.push(this);
  }
  postMessage(message) { this.messages.push(message); }
  terminate() { this.terminated = true; }
  addEventListener() {}
  removeEventListener() {}
}
globalThis.__cadWorkers = [];
globalThis.Worker = WorkerStub;
dom.window.Worker = WorkerStub;

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub;
dom.window.ResizeObserver = ResizeObserverStub;

// Autosave polls a relative URL, which node's fetch cannot parse.
globalThis.fetch = async () => new dom.window.Response("{}", { status: 503 });

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { createElement } = await import("react");
const { act, cleanup, fireEvent, render, waitFor, within } = await import("@testing-library/react");
const { default: CadWorkspace } = await import("../app/cad-workspace.tsx");
const { ProjectSaveSession, emptySceneWorkspace } = await import("../app/project-save-session.ts");
const { UiResizeHandle } = await import("../app/workspace-ui.tsx");
const { default: CadProductCenter } = await import("../app/cad-product-center.tsx");
const { DEFAULT_SHORTCUTS } = await import("../app/product-polish.ts");
const { parseCadProject, sealCadProject } = await import("../app/cad-project.ts");
const { restorePaintTexture } = await import("../app/paint-texture-project.ts");
const {
  FORM_SCENE_WORKSPACE_SCHEMA,
  createFormProject,
  formWorkspace,
  parseProject,
  serializeProject,
  updateFormWorkspace,
} = await import("../app/project-format.ts");

async function mount({ firstLaunch = false, ...props } = {}) {
  // Each mount represents a fresh project. Autosave is intentionally real in
  // these tests, so isolate it from edits made by earlier test cases.
  dom.window.localStorage.clear();
  // Onboarding intentionally claims focus on the next animation frame. Normal
  // workflow cases represent a returning user; first-launch behavior has its
  // own test below. Otherwise its delayed dialog races unrelated keyboard tests.
  if (!firstLaunch) dom.window.localStorage.setItem("form-onboarding-v1", "complete");
  globalThis.__cadRenderers = [];
  globalThis.__cadWorkers = [];
  let utils;
  await act(async () => {
    utils = render(createElement(CadWorkspace, { onClose: () => {}, ...props }));
  });
  return utils;
}

test("workspace presets, focus and reset preserve the document and modeling history", async (t) => {
  t.after(cleanup);
  const utils = await mount({ initialView:"model" });
  const shell = utils.container.querySelector(".cad-shell");
  const title = utils.container.querySelector(".cad-brand em").textContent;
  const undo = utils.getByTitle("Undo").disabled;
  const menu = utils.container.querySelector(".workspace-layout-menu");
  await act(async () => { fireEvent.click(menu.querySelector("summary")); });
  await act(async () => { fireEvent.click(within(menu).getByRole("button",{name:/^Inspect/})); });
  assert.equal(shell.style.getPropertyValue("--cad-inspector-width"),"440px");
  assert.equal(menu.open,false);
  await act(async () => { fireEvent.click(utils.getByRole("button",{name:"Focus on canvas"})); });
  assert.ok(shell.classList.contains("ui-inspector-collapsed"));
  assert.ok(shell.classList.contains("ui-tools-collapsed"));
  assert.equal(JSON.parse(localStorage.getItem("form-ui-layout-cad-v1")).inspectorCollapsed,false,"focus isn't saved as the next launch layout");
  await act(async () => { fireEvent.click(utils.getByRole("button",{name:"Restore panels"})); });
  assert.equal(shell.style.getPropertyValue("--cad-inspector-width"),"440px");
  assert.equal(shell.classList.contains("ui-inspector-collapsed"),false);
  await act(async () => { fireEvent.click(menu.querySelector("summary")); });
  await act(async () => { fireEvent.click(within(menu).getByRole("button",{name:"Restore default layout"})); });
  assert.equal(shell.style.getPropertyValue("--cad-inspector-width"),"370px");
  assert.equal(utils.container.querySelector(".cad-brand em").textContent,title);
  assert.equal(utils.getByTitle("Undo").disabled,undo);
});

test("layout menu dismisses with Escape and outside pointer without stealing focus", async (t) => {
  t.after(cleanup);
  const utils = await mount();
  const menu = utils.container.querySelector(".workspace-layout-menu");
  const summary = menu.querySelector("summary");
  await act(async () => { fireEvent.click(summary); });
  assert.equal(menu.open,true);
  await act(async () => { fireEvent.keyDown(menu,{key:"Escape"}); });
  assert.equal(menu.open,false);
  assert.ok(document.activeElement === summary, `Escape should return focus to the workspace summary; got ${document.activeElement?.tagName}`);
  await act(async () => { fireEvent.click(summary); fireEvent.pointerDown(document.body); });
  assert.equal(menu.open,false);
});

test("resize is coalesced, ignores other pointers, cancels and cleans up on unmount", async (t) => {
  t.after(cleanup);
  const frames = new Map(); let id=0;
  const raf = globalThis.requestAnimationFrame, caf = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = callback => { frames.set(++id,callback); return id; };
  globalThis.cancelAnimationFrame = token => frames.delete(token);
  t.after(() => { globalThis.requestAnimationFrame=raf; globalThis.cancelAnimationFrame=caf; });
  const values = [];
  const utils = render(createElement(UiResizeHandle,{axis:"x",value:370,min:300,max:560,invert:true,onChange:v=>values.push(v),label:"Resize test"}));
  const handle = utils.getByRole("separator");
  const pointer = (target,type,props) => {
    const event = new window.Event(type,{bubbles:true,cancelable:true});
    Object.assign(event,{button:0,pointerId:1,clientX:400,clientY:0,...props});
    fireEvent(target,event);
  };
  await act(async () => { pointer(handle,"pointerdown"); pointer(window,"pointermove",{clientX:350}); pointer(window,"pointermove",{clientX:300}); pointer(window,"pointermove",{pointerId:2,clientX:1}); });
  assert.equal(frames.size,1); assert.equal(values.length,0);
  await act(async () => { const callbacks=[...frames.values()]; frames.clear(); callbacks.forEach(cb=>cb()); });
  assert.deepEqual(values,[470]);
  await act(async () => { fireEvent.keyDown(window,{key:"Escape"}); });
  assert.equal(values.at(-1),370); assert.equal(document.documentElement.classList.contains("ui-resizing-x"),false);
  await act(async () => { pointer(handle,"pointerdown"); pointer(window,"pointermove",{clientX:250}); pointer(window,"pointerup"); });
  assert.equal(values.at(-1),520); assert.equal(frames.size,0);
  await act(async () => { pointer(handle,"pointerdown"); pointer(window,"pointercancel"); });
  assert.equal(values.at(-1),370);
  await act(async () => { pointer(handle,"pointerdown"); pointer(window,"pointermove",{clientX:10}); utils.unmount(); });
  assert.equal(frames.size,0); assert.equal(document.documentElement.classList.contains("ui-resizing-x"),false);
});

test("command center supports keyboard navigation, execution, focus containment and restoration", async (t) => {
  t.after(cleanup);
  const launcher = document.createElement("button"); document.body.append(launcher); launcher.focus();
  t.after(() => launcher.remove());
  const commands = []; let closes=0, backgroundKeys=0;
  const globalKey = () => { backgroundKeys++; };
  window.addEventListener("keydown",globalKey); t.after(() => window.removeEventListener("keydown",globalKey));
  const props = { open:true,tab:"commands",context:"model",shortcuts:DEFAULT_SHORTCUTS,onClose:()=>closes++,onTabChange:()=>{},onCommand:id=>commands.push(id),onTemplate:()=>{},onShortcutsChange:()=>{} };
  const utils = render(createElement(CadProductCenter,props));
  const search = utils.getByRole("combobox",{name:"Search commands"});
  await waitFor(() => assert.ok(document.activeElement === search, "command search receives initial focus"));
  // jsdom does not lay out elements; only the real scroll API is stubbed.
  const options = utils.getAllByRole("option"); options.forEach(el=>{el.scrollIntoView=()=>{};});
  assert.equal(options[0].getAttribute("aria-selected"),"true");
  await act(async () => { fireEvent.keyDown(search,{key:"ArrowDown"}); });
  assert.equal(options[1].getAttribute("aria-selected"),"true");
  assert.equal(search.getAttribute("aria-activedescendant"),options[1].id);
  await act(async () => { fireEvent.keyDown(search,{key:"Enter"}); });
  assert.equal(commands.length,1);
  assert.equal(backgroundKeys,0);
  const first = utils.getByRole("button",{name:"start"}), last = utils.getByRole("button",{name:"Edit shortcuts"});
  first.focus(); await act(async () => fireEvent.keyDown(first,{key:"Tab",shiftKey:true})); assert.ok(document.activeElement === last, `Shift+Tab wraps to last control; got ${document.activeElement?.outerHTML.slice(0,250)}`);
  await act(async () => fireEvent.keyDown(last,{key:"Tab"})); assert.ok(document.activeElement === first, "Tab wraps to first control");
  await act(async () => fireEvent.change(search,{target:{value:"zzzz-no-such-tool"}}));
  assert.equal(search.getAttribute("aria-activedescendant"),null);
  await act(async () => fireEvent.keyDown(search,{key:"Enter"})); assert.equal(commands.length,1);
  await act(async () => fireEvent.keyDown(search,{key:"Escape"})); assert.equal(closes,1);
  utils.rerender(createElement(CadProductCenter,{...props,open:false})); assert.ok(document.activeElement === launcher, "focus returns to launcher");
});

function viewButton(utils, label) {
  return utils.getByRole("button", { name: label });
}

async function openFabricWorkspace(utils) {
  const details = utils.container.querySelector(".cad-project-menu");
  await act(async () => fireEvent.click(details.querySelector("summary")));
  const menu = within(details).getByRole("menu", { name: "Project and workspace actions" });
  await act(async () => fireEvent.click(within(menu).getByRole("menuitem", { name: "Open Fabric Studio" })));
}

test("mounts the real workspace with its sketch view active", async (t) => {
  t.after(cleanup);
  const utils = await mount();

  assert.ok(utils.getAllByText("FORM STUDIO").length >= 1, "brand chrome rendered");
  const sketch = viewButton(utils, "1 Sketch");
  const model = viewButton(utils, "2 Model");
  const document3 = viewButton(utils, "3 Document");
  assert.equal(sketch.className, "active");
  assert.equal(model.className, "");
  assert.equal(document3.className, "cad-specialist-tab");

  // The viewport effect ran to completion against the stub renderer.
  const viewport = utils.container.querySelector(".cad-3d");
  assert.ok(viewport, "3D viewport container rendered");
  assert.equal(viewport.querySelectorAll("canvas").length, 1, "renderer canvas attached");
  assert.equal(globalThis.__cadRenderers.length, 1);
  assert.ok(globalThis.__cadRenderers[0].renderCount > 0, "render loop ran at least one frame");

  // The exact-kernel worker is created once and torn down on unmount.
  assert.equal(globalThis.__cadWorkers.length, 1);
  assert.match(globalThis.__cadWorkers[0].url, /cad-kernel\.worker/);
  assert.equal(globalThis.__cadWorkers[0].terminated, false);
});

test("phone properties start closed, toggle independently, and restore close focus", async (t) => {
  const original = window.matchMedia;
  window.matchMedia = query => ({ media: query, matches: query.includes("max-width: 1100px"), addEventListener() {}, removeEventListener() {} });
  t.after(() => { cleanup(); window.matchMedia = original; });
  const utils = await mount();
  const shell = utils.container.querySelector(".cad-shell");
  assert.ok(shell.classList.contains("ui-inspector-collapsed"));
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Show properties", exact: true })));
  assert.ok(!shell.classList.contains("ui-inspector-collapsed"));
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Close properties", exact: true })));
  assert.ok(shell.classList.contains("ui-inspector-collapsed"));
  assert.equal(document.activeElement.getAttribute("aria-label"), "Show properties");
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Show properties", exact: true })));
  await act(async () => fireEvent.keyDown(utils.container.querySelector("#cad-properties"), { key: "Escape" }));
  assert.ok(shell.classList.contains("ui-inspector-collapsed"));
});

test("mobile Sketch navigation changes the view without changing the project", async (t) => {
  const original = window.matchMedia;
  window.matchMedia = query => ({ media: query, matches: query.includes("max-width: 1100px"), addEventListener() {}, removeEventListener() {} });
  t.after(() => { cleanup(); window.matchMedia = original; });
  const utils = await mount();
  const before = window.formCAD.getProjectFile();
  const pan = utils.getByRole("button", { name: "Pan", exact: true });
  await act(async () => fireEvent.click(pan));
  assert.equal(pan.getAttribute("aria-pressed"), "true");
  const canvas = utils.getByLabelText("Sketch canvas");
  let captured = null;
  canvas.setPointerCapture = (id) => { captured = id; };
  const pointer = (type, x, y) => fireEvent(canvas, Object.assign(new window.MouseEvent(type, { bubbles: true, clientX: x, clientY: y }), { pointerId: 1 }));
  await act(async () => pointer("pointerdown", 100, 100));
  assert.equal(captured, 1);
  await act(async () => pointer("pointermove", 150, 150));
  await act(async () => pointer("pointercancel", 150, 150));
  await act(async () => fireEvent.click(pan));
  assert.equal(pan.getAttribute("aria-pressed"), "false");
  assert.equal(window.formCAD.getProjectFile(), before, "navigation must not edit or dirty document geometry");
});

test("mobile Fabric keeps pattern editing, drape and properties reachable", async (t) => {
  const original = window.matchMedia;
  window.matchMedia = query => ({ media: query, matches: query.includes("max-width: 1100px"), addEventListener() {}, removeEventListener() {} });
  t.after(() => { cleanup(); window.matchMedia = original; });
  const utils = await mount();
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Fabric", exact: true })));
  await waitFor(() => assert.ok(utils.container.querySelector(".fabric-shell")));
  const shell = utils.container.querySelector(".fabric-shell");
  assert.equal(shell.dataset.fabricStage, "pattern");
  assert.ok(shell.classList.contains("ui-inspector-collapsed"));
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "drape", exact: true })));
  assert.equal(shell.dataset.fabricStage, "drape");
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Show properties", exact: true })));
  assert.ok(!shell.classList.contains("ui-inspector-collapsed"));
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Close properties", exact: true })));
  assert.ok(shell.classList.contains("ui-inspector-collapsed"));
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "sew", exact: true })));
  assert.equal(shell.dataset.fabricStage, "sew");
  assert.ok(shell.querySelector(".fabric-pattern-board canvas"));
});

test("mobile Sketch resizes its backing canvas when the device rotates", async (t) => {
  t.after(cleanup);
  const utils = await mount();
  const canvas = utils.getByLabelText("Sketch canvas");
  const original = canvas.getBoundingClientRect;
  canvas.getBoundingClientRect = () => ({ width: 792, height: 338, top: 0, left: 0, right: 792, bottom: 338, x: 0, y: 0, toJSON() {} });
  t.after(() => { canvas.getBoundingClientRect = original; });
  await act(async () => fireEvent(window, new window.Event("resize")));
  const ratio = Math.min(window.devicePixelRatio, 2);
  assert.equal(canvas.width, Math.floor(792 * ratio));
  assert.equal(canvas.height, Math.floor(338 * ratio));
});

test("workspace header exposes the shared Form Studio vector logo", async (t) => {
  t.after(cleanup);
  const utils = await mount();
  const logo = utils.getByRole("img", {name:"Form Studio",exact:true});
  assert.equal(logo.tagName.toLowerCase(), "svg");
  assert.equal(logo.getAttribute("viewBox"), "0 0 40 40");
  assert.ok(logo.closest(".cad-brand"));
  assert.ok(utils.getByRole("button",{name:"Back",exact:true}));
});

test("object options select the right-clicked sketch and reuse duplicate with undo", async (t) => {
  t.after(cleanup);
  const utils = await mount();
  const canvas = utils.getByLabelText("Sketch canvas");
  canvas.getBoundingClientRect = () => ({ width:400,height:400,left:0,top:0,right:400,bottom:400,x:0,y:0,toJSON(){} });
  const before = window.formCAD.getProject().entities.length;
  await act(async () => fireEvent.contextMenu(canvas, {clientX:95,clientY:200,button:2}));
  const menu = utils.getByRole("menu", {name:"rectangle selection options"});
  assert.ok(within(menu).getByRole("menuitem", {name:"Make 3D"}));
  await act(async () => fireEvent.keyDown(document.activeElement, {key:"ArrowDown"}));
  assert.equal(document.activeElement.textContent, "Edit properties");
  await act(async () => fireEvent.keyDown(document.activeElement, {key:"End"}));
  assert.equal(document.activeElement.textContent, "Delete selection");
  await act(async () => fireEvent.click(within(menu).getByRole("menuitem", {name:"Duplicate",exact:true})));
  assert.equal(utils.queryByRole("menu", {name:"rectangle selection options"}), null);
  assert.equal(window.formCAD.getProject().entities.length, before + 1);
  await act(async () => fireEvent.click(utils.getByTitle("Undo")));
  assert.equal(window.formCAD.getProject().entities.length, before);
  await act(async () => fireEvent.contextMenu(canvas, {clientX:95,clientY:200,button:2}));
  await act(async () => fireEvent.pointerDown(document.body));
  assert.equal(utils.queryByRole("menu", {name:"rectangle selection options"}), null);
  await act(async () => fireEvent.contextMenu(canvas, {clientX:399,clientY:399,button:2}));
  assert.equal(utils.queryByRole("menu", {name:"rectangle selection options"}), null);
});

test("object options open on touch selection, dismiss with Escape and ignore drags", async (t) => {
  t.after(cleanup);
  const utils = await mount();
  await act(async () => fireEvent.click(utils.getByRole("button", {name:"Select",exact:true})));
  const canvas = utils.getByLabelText("Sketch canvas");
  canvas.getBoundingClientRect = () => ({width:400,height:400,left:0,top:0,right:400,bottom:400,x:0,y:0,toJSON(){}});
  canvas.setPointerCapture = () => {};
  const touch = (type,x=95,y=200) => fireEvent(canvas,Object.assign(new window.MouseEvent(type,{bubbles:true,clientX:x,clientY:y,button:0}),{pointerId:1,pointerType:"touch"}));
  await act(async () => touch("pointerdown"));
  await act(async () => touch("pointerup"));
  assert.ok(utils.getByRole("menu",{name:"rectangle selection options"}));
  await act(async () => fireEvent.keyDown(document.activeElement,{key:"Escape"}));
  assert.equal(utils.queryByRole("menu",{name:"rectangle selection options"}),null);
  await act(async () => touch("pointerdown"));
  await act(async () => touch("pointermove",125,200));
  await act(async () => touch("pointerup",125,200));
  assert.equal(utils.queryByRole("menu",{name:"rectangle selection options"}),null);
});

test("sculpt toolbox exposes eight brushes, remembers paused settings and leaves geometry untouched until a stroke", async (t) => {
  t.after(cleanup);
  const utils = await mount({ initialView: "model" });
  await act(async () => fireEvent.click(utils.getByRole("button", { name:"Sculpt", exact:true })));
  let shelf = within(utils.getByRole("region", { name:"Sculpt toolbox features" }));
  assert.ok(shelf.getByRole("button", { name:"Sculpt a creative copy" }).disabled);
  await act(async () => fireEvent.click(shelf.getByRole("button", { name:"Add sculpt block" })));
  shelf = within(utils.getByRole("region", { name:"Sculpt toolbox features" }));
  assert.equal(shelf.getByRole("group", {name:"Sculpt brushes"}).querySelectorAll("button").length, 8);
  const before = window.formCAD.getProjectFile();
  await act(async () => fireEvent.click(shelf.getByRole("button", {name:"Inflate brush"})));
  await act(async () => fireEvent.change(shelf.getByLabelText("Sculpt brush strength"), {target:{value:"0.73"}}));
  await act(async () => fireEvent.click(shelf.getByRole("button", {name:"Sculpt symmetry X"})));
  await act(async () => fireEvent.click(shelf.getByRole("button", {name:"Pause brush"})));
  assert.ok(shelf.getByText(/Brush paused/));
  await act(async () => fireEvent.click(shelf.getByRole("button", {name:"Start sculpting"})));
  assert.equal(shelf.getByRole("button", {name:"Inflate brush"}).getAttribute("aria-pressed"), "true");
  assert.equal(shelf.getByLabelText("Sculpt brush strength").value, "0.73");
  assert.equal(shelf.getByRole("button", {name:"Sculpt symmetry X"}).getAttribute("aria-pressed"), "true");
  assert.equal(window.formCAD.getProjectFile(), before, "brush settings must not create geometry edits");
  await act(async () => fireEvent.click(utils.getByRole("button", {name:"Select",exact:true})));
  assert.equal(utils.queryByRole("region", {name:"Sculpt toolbox features"}), null);
  await act(async () => fireEvent.click(utils.getByRole("button", {name:"Sculpt",exact:true})));
  shelf = within(utils.getByRole("region", {name:"Sculpt toolbox features"}));
  assert.equal(shelf.getByLabelText("Sculpt brush strength").value, "0.73");
  await act(async () => fireEvent.click(shelf.getByRole("button", {name:"Add sculpt layer"})));
  assert.ok(shelf.getByLabelText("Sculpt adaptive detail").disabled);
  assert.equal(parseCadProject(window.formCAD.getProjectFile()).meshFeatures[0].sculptLayers.length,1);
  await act(async () => fireEvent.change(shelf.getByLabelText("Sculpt stroke layer"),{target:{value:""}}));
  assert.equal(shelf.getByLabelText("Sculpt adaptive detail").disabled,false);
  await act(async () => fireEvent.click(utils.getByTitle("Undo")));
  assert.equal(parseCadProject(window.formCAD.getProjectFile()).meshFeatures[0].sculptLayers?.length ?? 0,0);
});

test("sculpt strokes target only the active mesh and undo as one edit", async (t) => {
  const THREE = await import("three");
  const intersect = THREE.Raycaster.prototype.intersectObjects;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  t.after(() => { THREE.Raycaster.prototype.intersectObjects=intersect; cleanup();mesh.geometry.dispose();mesh.material.dispose(); });
  const utils = await mount({initialView:"model"});
  await act(async () => fireEvent.click(utils.getByRole("button", {name:"Sculpt",exact:true})));
  await act(async () => fireEvent.click(utils.getByRole("button", {name:"Add sculpt block"})));
  const target = parseCadProject(window.formCAD.getProjectFile()).meshFeatures[0].id;
  const shelf=within(utils.getByRole("region",{name:"Sculpt toolbox features"}));
  await act(async () => fireEvent.change(shelf.getByLabelText("Sculpt adaptive detail"),{target:{value:"0"}}));
  const canvas=globalThis.__cadRenderers.at(-1).domElement;
  canvas.getBoundingClientRect=()=>({width:400,height:400,left:0,top:0,right:400,bottom:400,x:0,y:0,toJSON(){}});
  canvas.setPointerCapture=()=>{};canvas.releasePointerCapture=()=>{};canvas.hasPointerCapture=()=>true;
  mesh.userData.meshFeatureId="another-mesh";
  THREE.Raycaster.prototype.intersectObjects=()=>[{object:mesh,point:new THREE.Vector3(20,20,20),face:{normal:new THREE.Vector3(0,0,1)},faceIndex:0}];
  const pointer=(type)=>fireEvent(canvas,Object.assign(new window.MouseEvent(type,{bubbles:true,clientX:180,clientY:180,button:0,buttons:type==="pointerdown"?1:0}),{pointerId:1,pointerType:"mouse"}));
  await act(async()=>pointer("pointerdown"));
  // Cancel instead of selecting the nonexistent test object on release.
  await act(async()=>pointer("pointercancel"));
  assert.equal(parseCadProject(window.formCAD.getProjectFile()).meshFeatures[0].edits.length,0);
  mesh.userData.meshFeatureId=target;
  await act(async()=>pointer("pointerdown"));
  await act(async()=>pointer("pointerup"));
  assert.equal(parseCadProject(window.formCAD.getProjectFile()).meshFeatures[0].edits.length,1);
  await act(async()=>fireEvent.click(utils.getByTitle("Undo")));
  assert.equal(parseCadProject(window.formCAD.getProjectFile()).meshFeatures[0].edits.length,0);
});

test("sculpt presets, exact radius, falloff and layer-aware detail update the actual brush settings", async (t) => {
  t.after(cleanup);
  const { SculptToolbox } = await import("../app/sculpt-toolbox.tsx");
  const { DEFAULT_BRUSH } = await import("../app/sculpt-brush.ts");
  let settings = {...DEFAULT_BRUSH, symmetry:[0]}, brush = settings;
  let utils;
  const props = () => ({brush,settings,unit:"mm",precision:2,targetName:"Test mesh",onChange(next){brush=next;if(next)settings=next;utils.rerender(createElement(SculptToolbox,props()));}});
  await act(async () => {utils=render(createElement(SculptToolbox,props()));});
  for (const [label, kind] of [["Soft clay","draw"],["Polish","smooth"],["Sharp ridge","crease"]]) {
    await act(async () => fireEvent.click(utils.getByRole("button",{name:label,exact:true})));
    assert.equal(settings.kind,kind); assert.deepEqual(settings.symmetry,[0]);
  }
  const radius=utils.getByLabelText("Sculpt brush radius");
  await act(async () => {fireEvent.change(radius,{target:{value:"1 in"}});fireEvent.blur(radius);});
  assert.equal(settings.radius,25.4);
  await act(async () => fireEvent.change(utils.getByLabelText("Sculpt falloff"),{target:{value:"linear"}}));
  assert.equal(settings.falloff,"linear");
  await act(async () => fireEvent.change(utils.getByLabelText("Sculpt stroke spacing"),{target:{value:"0.25"}}));
  assert.equal(settings.spacing,.25);
  await act(async () => utils.rerender(createElement(SculptToolbox,{...props(),layered:true})));
  assert.ok(utils.getByLabelText("Sculpt adaptive detail").disabled);
  await act(async () => fireEvent.click(utils.getByRole("button",{name:"Reset brush settings"})));
  assert.deepEqual(settings,DEFAULT_BRUSH);
});

test("drawing scale commits one valid edit and Undo never restores half-typed ratios", async (t) => {
  t.after(cleanup);
  const utils = await mount({ initialView: "drawing", saveSession: new ProjectSaveSession() });
  const scale = utils.getByLabelText("Drawing scale");
  for (const value of ["", "2", "2:", "2:1"]) {
    await act(async () => fireEvent.change(scale, { target: { value } }));
    assert.equal(parseCadProject(window.formCAD.getProjectFile()).drawingScale, "1:1");
  }
  await act(async () => fireEvent.blur(scale));
  await waitFor(() => assert.equal(scale.value, "2:1"));
  assert.equal(parseCadProject(window.formCAD.getProjectFile()).drawingBook.sheets[0].scale, "2:1");
  await act(async () => { fireEvent.change(scale, { target: { value: "0:0" } }); fireEvent.blur(scale); });
  assert.equal(parseCadProject(window.formCAD.getProjectFile()).drawingBook.sheets[0].scale, "2:1");
  assert.match(utils.getByRole("alert").textContent, /previous scale was kept/);
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Undo", exact: true })));
  await waitFor(() => assert.equal(utils.getByLabelText("Drawing scale").value, "1:1"));
  assert.equal(parseCadProject(window.formCAD.getProjectFile()).drawingScale, "1:1");
});

test("Document honors independent CAD sheet scales through edit, undo and reopen", async (t) => {
  t.after(cleanup);
  const { createSheetLayout } = await import('../app/cad-sheet-layout.ts');
  const sheets = [createSheetLayout('production', 'Assembly'), createSheetLayout('detail', 'Enlarged detail')];
  sheets[0].scale = '1:2'; sheets[1].scale = '2:1';
  const utils = await mount({ initialView: 'drawing', initialProjectContents: JSON.stringify({
    entities: [], features: [], drawingScale: '1:4', drawingBook: { schema: 'form-drawing-book-v1', sheets },
  }) });
  assert.equal(utils.getByLabelText('Drawing scale').value, '1:2');
  const selectSheet = async (title) => act(async () => fireEvent.click(within(utils.getByRole('complementary', { name: 'Drawing sheets' })).getByRole('button', { name: new RegExp(title) })));
  await selectSheet('Enlarged detail');
  assert.equal(utils.getByLabelText('Drawing scale').value, '2:1');
  await act(async () => fireEvent.change(utils.getByLabelText('Drawing scale'), { target: { value: '4:1' } }));
  await act(async () => fireEvent.blur(utils.getByLabelText('Drawing scale')));
  let cad = parseCadProject(window.formCAD.getProjectFile());
  assert.deepEqual(cad.drawingBook.sheets.map(s => s.scale), ['1:2', '4:1']);
  assert.equal(cad.drawingScale, '1:4', 'legacy default must not change other sheets');
  await act(async () => fireEvent.click(utils.getByTitle('Undo')));
  await waitFor(() => assert.equal(utils.getByLabelText('Drawing scale').value, '2:1'));
  await act(async () => fireEvent.click(utils.getByTitle('Redo')));
  await waitFor(() => assert.equal(utils.getByLabelText('Drawing scale').value, '4:1'));
  await selectSheet('Assembly');
  assert.equal(utils.getByLabelText('Drawing scale').value, '1:2');
  const saved = window.formCAD.getProjectFile();
  cleanup();
  const reopened = await mount({ initialView: 'drawing', initialProjectContents: saved });
  assert.equal(reopened.getByLabelText('Drawing scale').value, '1:2');
  assert.deepEqual(parseCadProject(window.formCAD.getProjectFile()).drawingBook.sheets.map(s => s.scale), ['1:2', '4:1']);
});

test("precision inspector edits respect fixed geometry and preserve rejected edits", async (t) => {
  t.after(cleanup);
  const utils = await mount();
  const panel = within(utils.container.querySelector("#inspector-geometry"));
  assert.equal(panel.queryByTitle("Remove 80.00 mm constraint"), null, "legacy descriptive text must not appear as a solver constraint");
  assert.ok(panel.getByText(/No driving constraints/));
  const original = parseCadProject(window.formCAD.getProjectFile()).entities.find(e => e.id === "base-profile");
  await act(async () => fireEvent.click(panel.getByRole("button", { name: /Fix geometry/ })));
  const width = panel.getByLabelText("Width");
  await act(async () => { fireEvent.change(width, { target: { value: "5 in" } }); fireEvent.keyDown(width, { key: "Enter" }); });
  const fixed = parseCadProject(window.formCAD.getProjectFile()).entities.find(e => e.id === "base-profile");
  assert.deepEqual(fixed.a, original.a); assert.deepEqual(fixed.b, original.b);
  assert.equal(width.value, "80.00 mm", "rejected drafts must not masquerade as accepted dimensions");
  assert.ok(utils.getAllByText(/Edit not applied/).length);
  await act(async () => fireEvent.click(panel.getByTitle("Remove Fixed constraint")));
  await act(async () => { fireEvent.change(width, { target: { value: "5 in" } }); fireEvent.keyDown(width, { key: "Enter" }); });
  const updated = parseCadProject(window.formCAD.getProjectFile()).entities.find(e => e.id === "base-profile");
  assert.ok(Math.abs(updated.b.x - updated.a.x - 127) < 1e-8);
  await waitFor(() => assert.equal(width.value, "127.00 mm"));
  assert.ok(panel.getByText(/No driving constraints/));
  assert.equal(panel.queryByTitle("Remove Fixed constraint"), null);
});

test("the constrained-window project menu keeps every critical action reachable", async (t) => {
  t.after(cleanup);
  let rigOpened = false;
  const utils = await mount({ onOpenRigLab: () => { rigOpened = true; } });
  const details = utils.container.querySelector(".cad-project-menu");
  assert.ok(details, "responsive project menu rendered");

  await act(async () => fireEvent.click(details.querySelector("summary")));
  assert.equal(details.open, true);
  const menu = within(details).getByRole("menu", { name: "Project and workspace actions" });
  for (const name of [
    "Start center", "Search commands", "Drape as garment", "Open Animation Studio", "Open Fabric Studio",
    "Open project…", "Save project", "Import DXF…", "Export DXF", "Export STEP",
  ]) assert.ok(within(menu).getByRole("menuitem", { name }), `${name} remains reachable`);

  await act(async () => fireEvent.click(within(menu).getByRole("menuitem", { name: "Open Animation Studio" })));
  assert.equal(rigOpened, true);
  assert.equal(details.open, false, "choosing an action closes the menu");
  assert.ok(utils.getByRole("checkbox", { name: "Automatic mounting cut" }), "technical toggles expose explicit names");
});

test("CAD and Fabric persist in one versioned Form project container", async (t) => {
  t.after(cleanup);
  const utils = await mount();

  const initialContents = window.formCAD.getProjectFile();
  const initialContainer = parseProject(initialContents);
  assert.ok(formWorkspace(initialContainer, "cad"), "CAD is stored as a workspace in the shared container");
  assert.equal(formWorkspace(initialContainer, "fabric"), undefined);
  assert.equal(parseCadProject(initialContents).entities.length, 2, "the exact CAD parser opens the container directly");

  await openFabricWorkspace(utils);
  await waitFor(() => assert.ok(utils.getByText("Patterns & measurements")));
  await waitFor(() => {
    const next = parseProject(window.formCAD.getProjectFile());
    assert.ok(formWorkspace(next, "cad"));
    assert.ok(formWorkspace(next, "fabric"), "Fabric is added without replacing CAD");
    assert.equal(next.projectId, initialContainer.projectId, "workspace handoff preserves project identity");
  });
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Back" })));
  assert.ok(utils.getAllByText("FORM STUDIO").length >= 1);
  const reopened = parseProject(window.formCAD.getProjectFile());
  assert.ok(formWorkspace(reopened, "cad"));
  assert.ok(formWorkspace(reopened, "fabric"));
});

test("CAD hydrates an in-memory desktop handoff without dropping the scene or file path", async (t) => {
  t.after(cleanup);
  await mount();
  const cadContainer = parseProject(window.formCAD.getProjectFile());
  cleanup();
  const handedOff = updateFormWorkspace(cadContainer, "scene", {
    schema: FORM_SCENE_WORKSPACE_SCHEMA,
    objectIds: ["scene-cube"],
    data: {
      scene: [{ id: "scene-cube", type: "box" }],
      workspace: { environment: "Studio", gridVisible: true, snap: true, avoidCollisions: true, bloom: false, depthOfField: false, qualityMode: "Studio", timeline: 0 },
      camera: { position: [7, 4, 8], target: [0, 1, 0] },
      cameraShots: [],
      groups: [],
    },
  }, 500);

  await mount({ initialProjectContents: serializeProject(handedOff), initialProjectPath: "/projects/product.form" });
  await waitFor(() => assert.equal(window.formCAD.getProjectPath(), "/projects/product.form"));
  const reopened = parseProject(window.formCAD.getProjectFile());
  assert.equal(reopened.projectId, handedOff.projectId);
  assert.equal(formWorkspace(reopened, "scene").data.scene[0].id, "scene-cube");
  assert.ok(formWorkspace(reopened, "cad"));
});

test("first launch exposes guided starters, searchable commands, and editable shortcuts", async (t) => {
  t.after(cleanup);
  const utils = await mount({ firstLaunch: true });

  const center = await waitFor(() => utils.getByRole("dialog", { name: "Form Studio product center" }));
  assert.ok(within(center).getByText("Build the idea. Keep the precision."));
  assert.equal(center.querySelectorAll(".cad-template-grid em").length, 8);

  fireEvent.click(within(center).getByRole("button", { name: "commands" }));
  const search = within(center).getByLabelText("Search commands");
  fireEvent.change(search, { target: { value: "STEP" } });
  assert.ok(within(center).getByRole("option", { name: /Export STEP/ }));
  assert.equal(within(center).queryByRole("option", { name: /Open Fabric Studio/ }), null);

  fireEvent.click(within(center).getByRole("button", { name: "shortcuts" }));
  const commandShortcut = within(center).getByRole("button", { name: "⌘K" });
  fireEvent.click(commandShortcut);
  fireEvent.keyDown(commandShortcut, { key: "j", metaKey: true });
  assert.ok(within(center).getByRole("button", { name: "⌘J" }));

  fireEvent.click(within(center).getByRole("button", { name: "Reset all" }));
  assert.ok(within(center).getByRole("button", { name: "⌘K" }));
});

test("the redesigned desktop shell keeps placement, inspector jumps and workspace access wired", async (t) => {
  t.after(cleanup);
  let rigOpened = false;
  const utils = await mount({ initialView: "model", onOpenRigLab: () => { rigOpened = true; } });
  const placement = utils.getByRole("region", { name: "Exact body placement" });
  assert.ok(placement.closest(".cad-inspector"), "placement is docked instead of covering the model");
  const navigation = utils.getByRole("navigation", { name: "Inspector categories" });
  const geometry = utils.container.querySelector("#inspector-geometry");
  assert.ok(within(geometry).getByRole("heading", { name: "Exact geometry" }));
  const scroller = navigation.closest(".cad-scroll");
  let scrollRequest;
  scroller.scrollTo = (options) => { scrollRequest = options; };
  await act(async () => fireEvent.change(within(navigation).getByRole("combobox", { name: "Property section" }), { target: { value: "geometry" } }));
  assert.ok(Number.isFinite(scrollRequest.top), "category navigation scrolls only the inspector");
  const inspector = navigation.closest(".cad-inspector");
  assert.equal(inspector.dataset.propertyScope, "focused");
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Show all properties" })));
  assert.equal(inspector.dataset.propertyScope, "all");
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Use focused properties" })));
  await act(async () => fireEvent.change(within(navigation).getByRole("combobox", { name: "Property section" }), { target: { value: "constraints" } }));
  assert.equal(inspector.dataset.propertyScope, "all", "category links reveal their advanced controls");
  const workspaces = utils.getByRole("navigation", { name: "Workspaces" });
  assert.ok(within(workspaces).getByRole("button", { name: "Fabric", exact: true }));
  await act(async () => fireEvent.click(within(workspaces).getByRole("button", { name: "Animation", exact: true })));
  assert.equal(rigOpened, true);
  await act(async () => fireEvent.click(viewButton(utils, "3 Document")));
  // Document has its own inspector; the earlier navigation reference is now
  // detached, not a live Model inspector with a disabled appearance option.
  assert.equal(navigation.isConnected, false);
  assert.ok(utils.getByRole("navigation", { name: "Document properties" }));
  assert.equal(utils.queryByRole("navigation", { name: "Inspector categories" }), null);
  await act(async () => fireEvent.click(viewButton(utils, "2 Model")));
  const restoredNavigation = utils.getByRole("navigation", { name: "Inspector categories" });
  assert.equal(within(restoredNavigation).getByRole("option", { name: "Appearance" }).disabled, false);
});

test("sketch cancellation restores geometry and constraints instead of leaving hidden edits", async (t) => {
  t.after(cleanup);
  const utils = await mount({ initialView: "model" });
  const before = parseCadProject(window.formCAD.getProjectFile());
  await act(async () => fireEvent.click(viewButton(utils, "1 Sketch")));
  const embedded = utils.getByRole("region", { name: "Embedded Sketch Mode" });
  await act(async () => fireEvent.click(within(embedded).getByRole("button", { name: "Centered Ø16" })));
  assert.ok(parseCadProject(window.formCAD.getProjectFile()).entities.length > before.entities.length);
  await act(async () => fireEvent.click(within(embedded).getByRole("button", { name: "Cancel", exact: true })));
  const after = parseCadProject(window.formCAD.getProjectFile());
  assert.deepEqual(after.entities, before.entities);
  assert.deepEqual(after.geometricConstraints, before.geometricConstraints);
  assert.equal(viewButton(utils, "2 Model").className, "active");
});

test("completed sketches accept imperial depth and reopen as editable solids", async (t) => {
  t.after(cleanup);
  const utils = await mount({ initialView: "model" });
  await act(async () => fireEvent.click(viewButton(utils, "1 Sketch")));
  const embedded = utils.getByRole("region", { name: "Embedded Sketch Mode" });
  await act(async () => fireEvent.click(within(embedded).getByRole("button", { name: "Centered Ø16" })));
  await act(async () => fireEvent.click(within(embedded).getByRole("button", { name: "Finish Sketch" })));
  const region = utils.getByRole("region", { name: "Closed sketch region actions" });
  const depth = within(region).getByLabelText("Sketch extrusion depth");
  await act(async () => {
    fireEvent.change(depth, { target: { value: "0.5 in" } });
    fireEvent.keyDown(depth, { key: "Enter" });
  });
  await act(async () => fireEvent.click(within(region).getByRole("button", { name: "Extrude", exact: true })));
  const source = window.formCAD.getProjectFile();
  assert.equal(parseCadProject(source).features.at(-1).value, 12.7);
  cleanup();
  await mount({ initialView: "model", initialProjectContents: source });
  assert.equal(parseCadProject(window.formCAD.getProjectFile()).features.at(-1).value, 12.7);
});

test("Make 3D rejects an open selection without extruding unrelated closed profiles", async (t) => {
  t.after(cleanup);
  await mount();
  const base = window.formCAD.getProject();
  const open = { id: "open-path", type: "line", a: { x: 100, y: 0 }, b: { x: 110, y: 5 }, rotation: 0, layer: "model", constraints: [] };
  cleanup();
  const utils = await mount({ initialView: "sketch", initialProjectContents: JSON.stringify(sealCadProject({ ...base, entities: [open, ...base.entities] })) });
  const before = parseCadProject(window.formCAD.getProjectFile()).features;
  const make3d = within(utils.getByRole("region", { name: "Sketch and vector tools" })).getByRole("button", { name: "Make 3D", exact: true });
  assert.equal(make3d.disabled, true, "open-path selection cannot extrude unrelated closed profiles");
  await act(async () => fireEvent.click(make3d));
  assert.deepEqual(parseCadProject(window.formCAD.getProjectFile()).features, before);
});

test("SVG workbench imports, selects whole outlines, resizes and extrudes only the selection with undo", async (t) => {
  t.after(cleanup);
  const utils = await mount({ initialView: "sketch" });
  const base = parseCadProject(window.formCAD.getProjectFile());
  const file = { name: "two-shapes.svg", size: 200, text: async () => '<svg xmlns="http://www.w3.org/2000/svg" width="100mm" viewBox="0 0 100 50"><rect x="5" y="5" width="20" height="20"/><rect x="50" y="5" width="30" height="20"/></svg>' };
  await act(async () => fireEvent.change(utils.getByLabelText("Import SVG file"), { target: { files: [file] } }));
  await waitFor(() => assert.equal(parseCadProject(window.formCAD.getProjectFile()).entities.length, base.entities.length + 8));
  const workbench = utils.getByRole("region", { name: "Sketch and vector tools" });
  const list = within(workbench).getByRole("group", { name: "Sketch objects" });
  const outlines = within(list).getAllByRole("button").filter((button) => button.textContent.includes("Outline"));
  assert.equal(outlines.length, 2); assert.ok(outlines.every((b) => b.getAttribute("aria-pressed") === "true"));
  await act(async () => fireEvent.click(outlines[0]));
  const width = within(workbench).getByLabelText("Sketch selection width");
  await act(async () => { fireEvent.change(width, { target: { value: "2 in" } }); fireEvent.keyDown(width, { key: "Enter" }); });
  const resized = parseCadProject(window.formCAD.getProjectFile());
  const vectors = resized.entities.filter((e) => e.id.startsWith("vector-"));
  const first = vectors.slice(0, 4);
  assert.ok(Math.abs(Math.max(...first.flatMap((e) => [e.a.x, e.b.x])) - Math.min(...first.flatMap((e) => [e.a.x, e.b.x])) - 50.8) < 1e-6);
  const depth = within(workbench).getByLabelText("Quick extrusion depth");
  await act(async () => { fireEvent.change(depth, { target: { value: "1/2 in" } }); fireEvent.keyDown(depth, { key: "Enter" }); });
  await act(async () => fireEvent.click(within(workbench).getByRole("button", { name: "Make 3D", exact: true })));
  const extruded = parseCadProject(window.formCAD.getProjectFile());
  assert.equal(extruded.features.length, base.features.length + 1);
  assert.equal(extruded.features.at(-1).value, 12.7);
  assert.ok(first.some((e) => e.id === extruded.features.at(-1).sourceEntityId));
  assert.deepEqual(extruded.entities, resized.entities, "extrusion keeps the editable SVG geometry");
  assert.equal(utils.queryByText("Extrude: source removed"), null, "history recognizes closed SVG wire sources");
  await act(async () => fireEvent.click(utils.getByTitle("Undo")));
  assert.equal(parseCadProject(window.formCAD.getProjectFile()).features.length, base.features.length);
});

test("SVG workbench rejects unsupported artwork without changing the current sketch", async (t) => {
  t.after(cleanup); const utils = await mount({ initialView: "sketch" });
  const before = window.formCAD.getProjectFile();
  await act(async () => fireEvent.change(utils.getByLabelText("Import SVG file"), { target: { files: [{ name: "text.svg", size: 80, text: async () => '<svg xmlns="http://www.w3.org/2000/svg"><text>Logo</text></svg>' }] } }));
  assert.match(utils.getByRole("status", { name: "Workspace status" }).textContent, /Convert text and symbols to outlines/);
  assert.deepEqual(parseCadProject(window.formCAD.getProjectFile()).entities, parseCadProject(before).entities);
});

test("SVG workbench shift-selection batch extrusion survives project reopen", async (t) => {
  t.after(cleanup);
  const utils = await mount({ initialView: "sketch" });
  const base = parseCadProject(window.formCAD.getProjectFile());
  await act(async () => fireEvent.change(utils.getByLabelText("Import SVG file"), { target: { files: [{ name: "batch.svg", size: 180, text: async () => '<svg xmlns="http://www.w3.org/2000/svg" width="100mm" viewBox="0 0 100 50"><rect width="20" height="20"/><rect x="50" width="20" height="20"/></svg>' }] } }));
  const workbench = utils.getByRole("region", { name: "Sketch and vector tools" });
  const outlines = within(within(workbench).getByRole("group", { name: "Sketch objects" })).getAllByRole("button").filter((b) => b.textContent.includes("Outline"));
  await act(async () => fireEvent.click(outlines[0]));
  await act(async () => fireEvent.click(outlines[1], { shiftKey: true }));
  assert.ok(outlines.every((b) => b.getAttribute("aria-pressed") === "true"));
  await act(async () => fireEvent.click(within(workbench).getByRole("button", { name: "Make 3D", exact: true })));
  const saved = window.formCAD.getProjectFile(), expected = parseCadProject(saved);
  assert.equal(expected.features.length, base.features.length + 2);
  cleanup();
  await mount({ initialView: "model", initialProjectContents: saved });
  const reopened = parseCadProject(window.formCAD.getProjectFile());
  assert.deepEqual(reopened.features, expected.features);
  assert.deepEqual(reopened.entities, expected.entities);
});

test("acceptance projects build a buckle, enclosure and garment and preserve real editable data", async (t) => {
  t.after(cleanup);
  for (const [name, command] of [["buckle", "make a buckle 38 mm wide"], ["enclosure", "enclosure 80 x 50 x 25 mm with 2 mm wall"], ["garment", "create a size M jersey T-shirt with overlock seams"]]) {
    await mount();
    const base = window.formCAD.getProject();
    cleanup();
    const empty = JSON.stringify(sealCadProject({ ...base, entities: [], features: [], geometricConstraints: [], importedBodies: [], meshFeatures: [] }));
    const utils = await mount({ initialView: "model", initialProjectContents: empty });
    const input = utils.getByLabelText("Precision CAD command");
    await act(async () => {
      fireEvent.change(input, { target: { value: command } });
      fireEvent.keyDown(input, { key: "Enter" });
    });
    const preview = utils.getByRole("dialog", { name: "Design Copilot editable plan" });
    await act(async () => fireEvent.click(within(preview).getByRole("button", { name: "Apply design" })));
    if (name === "garment") {
      await waitFor(() => assert.ok(utils.getByText("Patterns & measurements")));
      await act(async () => fireEvent.click(utils.getByRole("button", { name: "Back", exact: true })));
    }
    const source = window.formCAD.getProjectFile();
    const model = parseCadProject(source);
    if (name === "garment") assert.ok(formWorkspace(parseProject(source), "fabric"));
    else {
      assert.ok(model.entities.length > 0);
      assert.ok(model.features.length > 0);
      await waitFor(() => assert.equal(utils.getByTitle("Undo").disabled, false));
      await act(async () => fireEvent.click(utils.getByTitle("Undo")));
      await waitFor(() => assert.equal(utils.getByTitle("Redo").disabled, false));
      await act(async () => fireEvent.click(utils.getByTitle("Redo")));
      assert.deepEqual(parseCadProject(window.formCAD.getProjectFile()).entities, model.entities);
    }
    if (process.env.FORM_ACCEPTANCE_DIR) {
      mkdirSync(process.env.FORM_ACCEPTANCE_DIR, { recursive: true });
      writeFileSync(process.env.FORM_ACCEPTANCE_DIR + "/" + name + ".form", source);
    }
    cleanup();
    await mount({ initialView: "model", initialProjectContents: source });
    assert.equal(document.querySelector('button[title="Undo"]').disabled, true, "opening a project does not expose the previous document through Undo");
    assert.deepEqual(parseCadProject(window.formCAD.getProjectFile()).entities, model.entities);
    assert.deepEqual(parseCadProject(window.formCAD.getProjectFile()).features, model.features);
    if (name === "garment") {
      // Serialization refreshes save timestamps; compare all persistent design data.
      const designData = (contents) => JSON.parse(JSON.stringify(formWorkspace(parseProject(contents), "fabric"), (key, value) => key === "updatedAt" ? undefined : value));
      assert.deepEqual(designData(window.formCAD.getProjectFile()), designData(source));
    }
    cleanup();
  }
});

test("the sketch workspace exposes freehand, SVG, raster trace, and one-click exact 3D", async (t) => {
  t.after(cleanup);
  const utils = await mount();
  const dock = utils.getByRole("region", { name: "Sketch and vector tools" });
  assert.ok(dock.closest(".cad-inspector"), "vector tools are docked, not covering artwork");
  assert.ok(within(dock).getByRole("button", { name: "Import SVG" }));
  assert.ok(within(dock).getByRole("button", { name: "Trace image" }));
  assert.equal(utils.container.querySelector('input[accept*="image/svg+xml"]')?.type, "file");
  assert.equal(utils.container.querySelector('input[accept*="image/png"]')?.type, "file");

  const pen = utils.getByTitle("Pen");
  const pencil = utils.getByTitle("Pencil");
  await act(async () => fireEvent.click(pen));
  assert.match(pen.className, /active/);
  await act(async () => fireEvent.click(pencil));
  assert.match(pencil.className, /active/);
  assert.doesNotMatch(pen.className, /active/);

  await act(async () => fireEvent.click(within(dock).getByRole("button", { name: "Make 3D" })));
  assert.equal(viewButton(utils, "2 Model").className, "active");
  assert.equal(utils.container.querySelector(".cad-vector-dock"), null, "vector dock closes in Model view");
});

test("Fabric opens an empty project safely and creates a measured garment block", async (t) => {
  t.after(cleanup);
  const utils = await mount();
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "3 Document", exact: true })));
  assert.match(utils.getByRole("button", { name: "3 Document", exact: true }).className, /active/);
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Fabric", exact: true })));
  await waitFor(() => assert.ok(utils.getByText("Patterns & measurements")));
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Blank garment" })));
  assert.match(utils.container.querySelector(".fabric-audit").textContent, /Marker0%/i);
  assert.match(utils.container.querySelector(".fabric-viewport-title").textContent, /0 pieces · 0 seams/i);
  await act(async () => fireEvent.click(utils.getByText("T-shirt", { exact: true })));
  assert.match(utils.container.querySelector(".fabric-viewport-title").textContent, /4 pieces · 14 seams/i);
  assert.ok(utils.getByRole("button", { name: "Simulate cloth" }));
});

test("Fabric quota failure keeps edits available and hands patterns to Document", async (t) => {
  t.after(cleanup);
  const utils = await mount();
  const prototype = Object.getPrototypeOf(dom.window.localStorage), original = prototype.setItem;
  prototype.setItem = function(key, value) { if (key === "form-fabric-project") throw new Error("QuotaExceededError"); return original.call(this, key, value); };
  t.after(() => { prototype.setItem = original; });
  await openFabricWorkspace(utils);
  await waitFor(() => assert.match(utils.getByRole("alert").textContent, /local cache is full/));
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "5 · Measured pattern sheets" })));
  await waitFor(() => assert.ok(utils.getByRole("button", { name: "Fabric" })));
  assert.ok(formWorkspace(parseProject(window.formCAD.getProjectFile()), "fabric").data.pieces.length > 0);
});

test("Fabric renders populated geometry even when animation frames are suspended", async (t) => {
  const raf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 0;
  t.after(() => { cleanup(); globalThis.requestAnimationFrame = raf; });
  const utils = await mount();
  await openFabricWorkspace(utils);
  await waitFor(() => assert.ok(utils.getByText("Patterns & measurements")));
  const renderer = globalThis.__cadRenderers.at(-1);
  assert.ok(renderer.lastRenderedMeshes > 0, "avatar and garment are drawn without waiting for rAF");
  const before = renderer.renderCount;
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Blank garment" })));
  assert.ok(renderer.renderCount > before, "scene edits synchronously refresh the preview");
});

test("Fabric anatomical body controls preserve patterns and support body-only inspection", async (t) => {
  t.after(cleanup);
  const utils = await mount();
  await openFabricWorkspace(utils);
  await act(async () => fireEvent.click(utils.getByText("T-shirt", { exact: true })));
  const patterns = utils.container.querySelector(".fabric-pattern-board").textContent;
  await act(async () => fireEvent.click(utils.getByRole("button", { name: /^Male\s*Adjustable fit model$/, exact: true })));
  assert.match(utils.container.querySelector(".fabric-drape-view .fabric-viewport-title").textContent, /Male/);
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Body only", exact: true })));
  assert.equal(utils.getByRole("button", { name: "Body only", exact: true }).getAttribute("aria-pressed"), "true");
  assert.ok(globalThis.__cadRenderers.at(-1).lastGarmentVisibility.every((visible) => !visible));
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Reach", exact: true })));
  assert.equal(utils.container.querySelector(".fabric-pattern-board").textContent, patterns);
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Body only", exact: true })));
  assert.equal(utils.getByRole("button", { name: "Body only", exact: true }).getAttribute("aria-pressed"), "false");
  assert.ok(globalThis.__cadRenderers.at(-1).lastGarmentVisibility.every(Boolean));
});

test("Fabric sends anatomical surface collision to the cloth worker", async (t) => {
  t.after(cleanup);
  const utils = await mount();
  await openFabricWorkspace(utils);
  await act(async () => fireEvent.click(utils.getByText("T-shirt", { exact: true })));
  const worker = globalThis.__cadWorkers.findLast((item) => item.url.includes("fabric-solver"));
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Simulate cloth", exact: true })));
  await waitFor(() => assert.ok(worker.messages.some((message) => message.type === "init")), { timeout: 30000 });
  const message = worker.messages.find((message) => message.type === "init");
  assert.ok(message.meshCollider.values.length > 1000, "worker gets the new body surface, not just legacy capsules");
  assert.ok(utils.getByRole("button", { name: "Pause physics", exact: true }));
  assert.match(utils.container.querySelector(".fabric-audit").textContent,/Not evaluated/);
  const stats={particles:message.positions.length/3,constraints:10,collisions:0,selfCollisions:0,maxStretch:.04,kineticEnergy:0,substeps:1};
  await act(async()=>{
    for(let frame=1;frame<=120;frame++) worker.onmessage({data:{type:"frame",runId:message.runId,positions:message.positions.slice(),stats:{...stats,frame}}});
  });
  assert.match(utils.container.querySelector(".fabric-audit").textContent,/Current simulation.*tracked settling/s);
  await act(async()=>fireEvent.click(utils.getByRole("button",{name:"Blank garment",exact:true})));
  assert.match(utils.container.querySelector(".fabric-audit").textContent,/Stale/);
  await act(async()=>worker.onmessage({data:{type:"frame",runId:message.runId,positions:message.positions.slice(),stats:{...stats,frame:124}}}));
  assert.match(utils.container.querySelector(".fabric-audit").textContent,/Stale/);
  assert.doesNotMatch(utils.container.querySelector(".fabric-audit").textContent,/Current simulation · tracked settling/);
});

test("Fabric stock wardrobe preserves the selected mannequin and supports undo", async (t) => {
  t.after(cleanup);
  const utils = await mount();
  await openFabricWorkspace(utils);
  await act(async () => fireEvent.click(utils.getByRole("button", { name: /^Male\s*Adjustable fit model$/ })));
  for (const [label, pieces, seams] of [["Hoodie", 6, 22], ["Pants", 4, 12], ["Shorts", 4, 12], ["Dress", 4, 14], ["Skirt", 2, 4], ["T-shirt", 4, 14]]) {
    await act(async () => fireEvent.click(utils.getByText(label, { exact: true })));
    assert.match(utils.container.querySelector(".fabric-drape-view .fabric-viewport-title").textContent, /Male/);
    assert.match(utils.container.querySelector(".fabric-pattern-board .fabric-viewport-title").textContent, new RegExp(`${pieces} pieces · ${seams} seams`));
  }
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Undo", exact: true })));
  assert.match(utils.container.querySelector(".fabric-pattern-board .fabric-viewport-title").textContent, /2 pieces · 4 seams/);
});

test("Fabric repairs a legacy closed hood opening with undo and preserves pattern data", async (t) => {
  t.after(cleanup);
  const { default: FabricStudio } = await import("../app/fabric-studio.tsx");
  const { createGarmentTemplate, bindPatternEdges, closedHoodOpeningSeams } = await import("../app/fabric-engine.ts");
  const stock = createGarmentTemplate("hoodie");
  const hoods = stock.pieces.filter(p => p.edgeNames.includes("opening"));
  const legacy = bindPatternEdges(stock, ...hoods.map(p => ({ pieceId: p.id, edgeIndex: p.edgeNames.indexOf("opening") })));
  let current = legacy, utils;
  await act(async () => { utils = render(createElement(FabricStudio, { onClose() {}, initialProject: legacy, onProjectChange(project) { current = project; } })); });
  assert.ok(utils.getByText("Hood opening needs repair"));
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Open hood face", exact: true })));
  assert.equal(closedHoodOpeningSeams(current).length, 0);
  assert.deepEqual(current.pieces, legacy.pieces);
  assert.equal(utils.queryByRole("button", { name: "Open hood face", exact: true }), null);
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Undo", exact: true })));
  assert.equal(closedHoodOpeningSeams(current).length, 1);
  assert.ok(utils.getByRole("button", { name: "Open hood face", exact: true }));
});

test("Fabric native Single step updates geometry, Reset restores exactly, and quality changes rebuild", async (t) => {
  const raf = window.requestAnimationFrame, caf = window.cancelAnimationFrame;
  const tauri = globalThis.isTauri, internals = window.__TAURI_INTERNALS__;
  const commands = []; let initial = [], frame = 0;
  window.requestAnimationFrame = () => 1; window.cancelAnimationFrame = () => {};
  globalThis.isTauri = true;
  window.__TAURI_INTERNALS__ = { invoke: async (command, args) => {
    commands.push({ command, args });
    if (command === "native_engine_info") return { available: true };
    if (command === "native_cloth_create") {
      initial = args.request.positions.slice();
      return { sessionId: "test-session", contactVersion: 9, vertexCount: initial.length / 3, constraintCount: args.request.constraints.length, backend: "test" };
    }
    if (command === "native_cloth_step") {
      const positions = initial.slice(); positions[0] += .01;
      return { positions, frame: ++frame, collisions: 3, selfCollisions: 0, maxStretch: .025, substeps: 3, constraintCount: 10 };
    }
    if (command === "native_cloth_reset" || command === "native_cloth_drop") return;
    throw new Error(`Unexpected native command ${command}`);
  } };
  t.after(() => { cleanup(); globalThis.isTauri = tauri; window.__TAURI_INTERNALS__ = internals; window.requestAnimationFrame = raf; window.cancelAnimationFrame = caf; });
  const { default: FabricStudio } = await import("../app/fabric-studio.tsx");
  const { createGarmentTemplate } = await import("../app/fabric-engine.ts");
  let utils;
  await act(async () => { utils = render(createElement(FabricStudio, { onClose() {}, initialProject: createGarmentTemplate("tshirt") })); });
  await waitFor(() => assert.ok(utils.getByLabelText(/Wind \(browser only\)/).disabled));
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Simulate cloth", exact: true })));
  await waitFor(() => assert.ok(utils.getByRole("button", { name: "Pause physics", exact: true })), { timeout: 30000 });
  const request = commands.find((c) => c.command === "native_cloth_create").args.request;
  assert.ok(request.triangles.length > 0, "native solver receives triangle contact topology");
  assert.ok(request.inverseMass.some(mass => mass === 0), "dressing support reaches the native solver");
  assert.ok(utils.getByRole("checkbox", { name: "Hold collar and waistband during fitting" }).disabled);
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Pause physics", exact: true })));
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Single step", exact: true })));
  const mesh = globalThis.__cadRenderers.at(-1).lastFittedGarment;
  assert.ok(mesh); assert.ok(Math.abs(mesh.geometry.attributes.position.array[0] - initial[0] - .01) < 1e-6);
  assert.match(utils.container.querySelector(".fabric-solver-metrics").textContent, /2.5%/);
  await act(async () => fireEvent.click(utils.getAllByRole("button", { name: "Reset", exact: true })[0]));
  await waitFor(() => assert.ok(utils.getByRole("button", { name: "Resume physics", exact: true })));
  assert.deepEqual(Array.from(mesh.geometry.attributes.position.array), initial);
  assert.equal(commands.filter((c) => c.command === "native_cloth_step").length, 1, "reset must not simulate another frame");
  await act(async () => fireEvent.change(utils.getByLabelText(/Constraint quality/), { target: { value: "12" } }));
  await waitFor(() => assert.ok(utils.getByRole("button", { name: "Simulate cloth", exact: true })));
  assert.ok(utils.getByRole("button", { name: "Single step", exact: true }).disabled);
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Simulate cloth", exact: true })));
  await waitFor(() => assert.equal(commands.filter((c) => c.command === "native_cloth_create").length, 2));
  assert.equal(commands.filter((c) => c.command === "native_cloth_create").at(-1).args.request.config.iterations, 12);
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Pause physics", exact: true })));
  await act(async () => fireEvent.click(utils.getByRole("checkbox", { name: "Hold collar and waistband during fitting" })));
  await waitFor(() => assert.ok(utils.getByRole("button", { name: "Simulate cloth", exact: true })));
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Simulate cloth", exact: true })));
  await waitFor(() => assert.equal(commands.filter((c) => c.command === "native_cloth_create").length, 3));
  assert.ok(commands.filter((c) => c.command === "native_cloth_create").at(-1).args.request.inverseMass.every(mass => mass > 0), "turning support off rebuilds a genuinely free-drape solve");
});

test("Fabric Animation transfer requires review and supports independent snapshots", async (t) => {
  const priorReader=globalThis.FileReader;
  globalThis.FileReader=class { readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});} readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result=`data:application/octet-stream;base64,${Buffer.from(result).toString("base64")}`;this.onloadend?.();});} };
  t.after(()=>{cleanup();globalThis.FileReader=priorReader;});
  const {default:FabricStudio}=await import("../app/fabric-studio.tsx");const {createGarmentTemplate}=await import("../app/fabric-engine.ts");
  const transfers=[];let utils;
  await act(async()=>{utils=render(createElement(FabricStudio,{onClose(){},initialProject:createGarmentTemplate("tshirt"),onAnimate:(p,s)=>transfers.push(s)}));});
  await act(async()=>fireEvent.click(utils.getByRole("button",{name:"4 · Animate clothed model"})));
  await waitFor(()=>assert.ok(utils.getByRole("region",{name:"Review Animation transfer"})),{timeout:15000});assert.equal(transfers.length,0);
  await act(async()=>fireEvent.change(utils.getByLabelText("Animation connection"),{target:{value:"independent"}}));
  await act(async()=>fireEvent.click(utils.getByRole("button",{name:"Confirm Animation transfer"})));
  assert.equal(transfers.length,1);assert.equal(transfers[0].independent,true);assert.match(transfers[0].sourceRevision,/garment-/);
});

test("Fabric graphics failure is recoverable without losing the pattern editor", async (t) => {
  t.after(() => { cleanup(); delete globalThis.__failPreviewRender; });
  const utils = await mount();
  globalThis.__failPreviewRender = true;
  await openFabricWorkspace(utils);
  await waitFor(() => assert.match(utils.getByRole("alert").textContent, /3D preview unavailable/));
  assert.ok(utils.container.querySelector(".fabric-pattern-board canvas"));
  const patterns = utils.container.querySelector(".fabric-viewport-title").textContent;
  globalThis.__failPreviewRender = false;
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Retry 3D preview" })));
  await waitFor(() => assert.equal(utils.queryByRole("alert"), null));
  assert.equal(utils.container.querySelector(".fabric-viewport-title").textContent, patterns);
  const renderer = globalThis.__cadRenderers.at(-1);
  assert.ok(renderer.lastRenderedMeshes > 0);
  const lost = new window.Event("webglcontextlost", { cancelable: true });
  await act(async () => renderer.domElement.dispatchEvent(lost));
  assert.equal(lost.defaultPrevented, true);
  assert.match(utils.getByRole("alert").textContent, /graphics context was lost/i);
  assert.equal(utils.container.querySelector(".fabric-viewport-title").textContent, patterns);
});

test("CAD renders model edits even when native animation frames are suspended", async (t) => {
  const raf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 0;
  t.after(() => { cleanup(); globalThis.requestAnimationFrame = raf; });
  const utils = await mount({ initialView: 'model' });
  const renderer = globalThis.__cadRenderers.at(-1);
  assert.ok(renderer.lastRenderedMeshes > 0);
  const before = renderer.renderCount;
  await act(async () => fireEvent.click(within(utils.container.querySelector('.cad-sculpt-section')).getByRole('button', { name: 'Box' })));
  assert.ok(renderer.renderCount > before, 'an edit refreshes the native viewport without rAF');
  assert.ok(renderer.lastRenderedMeshes > 0);
});

test("Space opens an adaptive tool shelf and a tap pins it", async (t) => {
  t.after(cleanup);
  const utils = await mount();

  await act(async () => fireEvent.keyDown(window, { key: " ", code: "Space" }));
  const selectShelf = utils.getByRole("region", { name: "Select tool features" });
  assert.equal(selectShelf.dataset.pinned, "false", "keydown first exposes a transient shelf");
  assert.match(selectShelf.className, /compact/);
  assert.ok(within(selectShelf).getByRole("button", { name: /Snap/i }));

  await act(async () => fireEvent.keyUp(window, { key: " ", code: "Space" }));
  assert.equal(selectShelf.dataset.pinned, "true", "a quick Space tap keeps the shelf on screen");

  await act(async () => fireEvent.click(utils.getByTitle("Pen")));
  const penShelf = utils.getByRole("region", { name: "Pen tool features" });
  assert.match(penShelf.className, /medium/, "the shelf expands for a tool with more features");
  assert.ok(within(penShelf).getByRole("button", { name: /Import SVG/i }));
  assert.ok(within(penShelf).getByRole("button", { name: /Trace image/i }));
  assert.ok(within(penShelf).getByRole("button", { name: /Make 3D/i }));

  await act(async () => fireEvent.keyDown(window, { key: " ", code: "Space" }));
  assert.equal(utils.queryByRole("region", { name: "Pen tool features" }), null, "Space toggles a pinned shelf closed");
  await act(async () => fireEvent.keyUp(window, { key: " ", code: "Space" }));
});

test("the Space shelf becomes a complete mesh-selection toolset in Model view", async (t) => {
  t.after(cleanup);
  const utils = await mount();
  await act(async () => fireEvent.click(viewButton(utils, "2 Model")));
  const sculpt = utils.container.querySelector(".cad-sculpt-section");
  await act(async () => fireEvent.click(within(sculpt).getByRole("button", { name: "Box" })));

  await act(async () => fireEvent.keyDown(window, { key: " ", code: "Space" }));
  await act(async () => fireEvent.keyUp(window, { key: " ", code: "Space" }));
  const shelf = utils.getByRole("region", { name: "Face selection features" });
  assert.match(shelf.className, /wide/);
  for (const label of ["vertex", "edge", "face"]) {
    assert.ok(within(shelf).getByText(label, { selector: "span" }).closest("button"), `${label} mode exposed`);
  }
  for (const label of ["Select all", "Marquee", "Lasso", "Grow", "Shrink", "Extrude selection", "Inset selection"]) {
    assert.ok(within(shelf).getByRole("button", { name: new RegExp(`^${label}`, "i") }), `${label} exposed`);
  }
});

test("smart actions follow the live selection and execute the existing modeling engine", async (t) => {
  t.after(cleanup);
  const utils = await mount({ initialView: "model" });
  const sculpt = utils.container.querySelector(".cad-sculpt-section");
  await act(async () => fireEvent.click(within(sculpt).getByRole("button", { name: "Box" })));

  const hud = utils.getByRole("region", { name: "Smart actions" });
  assert.match(hud.textContent, /Select faces/i, "an untouched creative body recommends component selection first");
  assert.ok(within(hud).getByTitle(/^Bend ·/), "the same surface exposes a non-destructive creative action");

  await act(async () => fireEvent.click(within(hud).getByTitle(/^Bend ·/)));
  let saved = parseCadProject(window.formCAD.getProjectFile());
  assert.ok(saved.meshFeatures.at(-1).modifiers.some((modifier) => modifier.kind === "bend"), "recommended actions change the persisted model");

  await act(async () => fireEvent.keyDown(window, { key: " ", code: "Space" }));
  await act(async () => fireEvent.keyUp(window, { key: " ", code: "Space" }));
  const shelf = utils.getByRole("region", { name: "Face selection features" });
  const recommendations = within(shelf).getByLabelText("Recommended smart actions");
  assert.match(recommendations.textContent, /Select faces.*Bend.*Twist/i, "Space uses the same ranked recommendations as the viewport");
});

test("project reopen restores creative meshes, nodes, graphs, viewport and animation", async (t) => {
  t.after(cleanup);
  const utils = await mount({ initialView: "model" });
  const sculpt = utils.container.querySelector(".cad-sculpt-section");
  await act(async () => fireEvent.click(within(sculpt).getByRole("button", { name: "Box" })));
  const source = window.formCAD.getProjectFile();
  const before = parseCadProject(source);
  assert.equal(before.meshFeatures.length, 1);
  cleanup();
  await mount({ initialView: "model", initialProjectContents: source });
  const after = parseCadProject(window.formCAD.getProjectFile());
  for (const key of ["meshFeatures", "sceneNodes", "geometryGraph", "materialGraph", "viewport", "animation"]) {
    assert.deepEqual(after[key], before[key], `${key} survives an actual workspace remount`);
  }
});

test("Open cancellation and malformed files preserve the current document; accepted Open clears old meshes", async (t) => {
  t.after(cleanup);
  const previousConfirm = window.confirm;
  t.after(() => { window.confirm = previousConfirm; });
  const utils = await mount({ initialView: "model" });
  const empty = window.formCAD.getProjectFile();
  await act(async () => fireEvent.click(within(utils.container.querySelector(".cad-sculpt-section")).getByRole("button", { name: "Box" })));
  const input = utils.container.querySelector('input[accept=".form,.formcad,.json"]');
  const open = async (contents) => act(async () => {
    fireEvent.change(input, { target: { files: [{ text: async () => contents }] } });
  });
  window.confirm = () => false;
  await open(empty);
  assert.equal(window.formCAD.getProject().meshFeatures.length, 1, 'cancel preserves edits');
  window.confirm = () => true;
  await open('{broken json');
  assert.equal(window.formCAD.getProject().meshFeatures.length, 1, 'malformed open is atomic');
  assert.match(utils.getByRole('status', { name: 'Workspace status' }).textContent, /could not be opened/);
  await open(empty);
  assert.equal(window.formCAD.getProject().meshFeatures.length, 0, 'new document owns its mesh state');
  assert.equal(utils.getByTitle('Undo').disabled, true);
  assert.ok(utils.getByRole('menuitem', { name: 'Save project as…', hidden: true }));
});

test("native Open requires explicit confirmation and rejects intervening edits", async (t) => {
  t.after(cleanup);
  t.after(() => { delete globalThis.isTauri; delete window.__TAURI_INTERNALS__; });
  const utils = await mount({ initialView: 'model' });
  const empty = window.formCAD.getProjectFile();
  const add = () => fireEvent.click(within(utils.container.querySelector('.cad-sculpt-section')).getByRole('button', { name: 'Box' }));
  await act(async () => add());
  let answer = false;
  window.__TAURI_INTERNALS__ = { invoke: async (command, args) => {
    if (command === 'open_project_file') return { path: '/tmp/native-open.form', contents: empty };
    if (command === 'confirm_document_action') {
      assert.equal(args.action, 'open');
      if (answer instanceof Error) throw answer;
      return typeof answer === 'function' ? answer() : answer;
    }
    return null;
  } };
  globalThis.isTauri = true;
  const open = () => fireEvent.click(utils.getByRole('menuitem', { name: 'Open project…', hidden: true }));
  await act(async () => open());
  await waitFor(() => assert.match(utils.getByRole('status', { name: 'Workspace status' }).textContent, /Open cancelled/));
  assert.equal(window.formCAD.getProject().meshFeatures.length, 1);
  answer = new Error('Dialog unavailable');
  await act(async () => open());
  await waitFor(() => assert.match(utils.getByRole('status', { name: 'Workspace status' }).textContent, /could not be opened.*Dialog unavailable/));
  assert.equal(window.formCAD.getProject().meshFeatures.length, 1);
  let finish;
  answer = () => new Promise(resolve => { finish = resolve; });
  await act(async () => open());
  await waitFor(() => assert.equal(typeof finish, 'function'));
  globalThis.isTauri = false;
  await act(async () => add());
  await act(async () => finish(true));
  await waitFor(() => assert.match(utils.getByRole('status', { name: 'Workspace status' }).textContent, /document changed during confirmation/));
  assert.equal(window.formCAD.getProject().meshFeatures.length, 2);
  globalThis.isTauri = true;
  answer = true;
  await act(async () => open());
  await waitFor(() => assert.equal(window.formCAD.getProject().meshFeatures.length, 0));
  assert.match(utils.getByRole('status', { name: 'Workspace status' }).textContent, /Project opened/);
});

test("native Save As handles cancel, failure, duplicate clicks and edits made during the dialog", async (t) => {
  t.after(cleanup);
  t.after(() => { delete globalThis.isTauri; delete window.__TAURI_INTERNALS__; });
  const utils = await mount({ initialView: "model" });
  const save = utils.getByRole('button', { name: 'Save', exact: true });
  let answer = null;
  let calls = 0;
  window.__TAURI_INTERNALS__ = { invoke: async (command) => {
    if (command === 'save_project_file' || command === 'write_project_file') {
      calls++;
      if (answer instanceof Error) throw answer;
      return typeof answer === 'function' ? answer() : answer;
    }
    return null;
  } };
  globalThis.isTauri = true;
  await act(async () => fireEvent.click(save));
  await waitFor(() => assert.match(utils.getByRole('status', { name: 'Workspace status' }).textContent, /Save cancelled/));
  answer = new Error('Permission denied');
  await act(async () => fireEvent.click(save));
  await waitFor(() => assert.match(utils.getByRole('status', { name: 'Workspace status' }).textContent, /Save failed.*Permission denied/));
  let finish;
  answer = () => new Promise((resolve) => { finish = resolve; });
  await act(async () => { fireEvent.click(save); fireEvent.click(save); });
  await waitFor(() => assert.equal(typeof finish, 'function'));
  assert.equal(calls, 3, 'a pending native dialog cannot be duplicated');
  globalThis.isTauri = false;
  await act(async () => fireEvent.click(within(utils.container.querySelector('.cad-sculpt-section')).getByRole('button', { name: 'Box' })));
  await act(async () => finish('/tmp/release-test.form'));
  await waitFor(() => assert.match(utils.getByRole('status', { name: 'Workspace status' }).textContent, /newer edits remain unsaved/));
  assert.ok(utils.getByTitle('Unsaved project changes'));
  assert.equal(window.formCAD.getProject().meshFeatures.length, 1);
});

test("baked texture pixels and UV ownership survive saving and reopening the real workspace", async (t) => {
  t.after(cleanup);
  const utils = await mount({ initialView: "model" });
  await act(async () => fireEvent.click(within(utils.container.querySelector('.cad-sculpt-section')).getByRole('button', { name: 'Box' })));
  await act(async () => fireEvent.click(utils.getByRole('button', { name: 'Bake', exact: true })));
  const source = window.formCAD.getProjectFile();
  const original = parseCadProject(source).paintTexture;
  assert.equal(original.pixels, undefined, "new projects use the bounded base64 archive");
  assert.ok(original.pixelsBase64.length > 0);
  const restored = restorePaintTexture(original);
  assert.equal(restored.texture.pixels.length, original.size * original.size * 4);
  assert.equal(original.meshId, window.formCAD.getProject().meshFeatures[0].id);
  cleanup();
  const reopened = await mount({ initialView: 'model', initialProjectContents: source });
  const reopenedTexture = parseCadProject(window.formCAD.getProjectFile()).paintTexture;
  assert.deepEqual(reopenedTexture, original);
  assert.deepEqual(restorePaintTexture(reopenedTexture), restored);
  assert.equal(reopened.getByRole('button', { name: 'Paint', exact: true }).disabled, false);
});

test("Rig handoff captures immediate edits and restores the CAD filename and unsaved state", async (t) => {
  t.after(cleanup);
  await mount();
  const source = window.formCAD.getProjectFile();
  cleanup();
  let handoff;
  const utils = await mount({ initialView: 'model', initialProjectContents: source, initialProjectPath: '/tmp/original.form', onOpenRigLab: (project) => { handoff = project; } });
  await act(async () => fireEvent.click(within(utils.container.querySelector('.cad-sculpt-section')).getByRole('button', { name: 'Box' })));
  await act(async () => fireEvent.click(utils.getByRole('button', { name: 'Animation', exact: true })));
  assert.equal(handoff.path, '/tmp/original.form');
  assert.equal(handoff.dirty, true);
  assert.equal(parseCadProject(handoff.contents).meshFeatures.length, 1);
  handoff = null;
  await act(async () => fireEvent.click(utils.getByRole('button', { name: 'Animate model', exact: true })));
  assert.equal(handoff, null, 'review does not send or mutate the target');
  await act(async () => fireEvent.click(utils.getByRole('button', { name: 'Confirm model transfer', exact: true })));
  assert.equal(handoff.models.length, 1, 'selected Model mesh is handed off explicitly');
  assert.ok(JSON.parse(handoff.models[0].gltf).meshes.length > 0);
  assert.equal(parseCadProject(handoff.contents).meshFeatures.length, 1, 'CAD source stays editable');
  cleanup();
  const reopened = await mount({ initialView: 'model', initialProjectContents: handoff.contents, initialProjectPath: handoff.path, initialProjectDirty: handoff.dirty });
  assert.equal(window.formCAD.getProjectPath(), '/tmp/original.form');
  assert.equal(window.formCAD.getProject().meshFeatures.length, 1);
  assert.ok(reopened.getByTitle('Unsaved project changes'));
});

test("explicit native rebuild cannot apply a late result over a newer geometry edit", async t => {
  const oldTauri = globalThis.isTauri, oldInternals = window.__TAURI_INTERNALS__, oldEvents = window.__TAURI_EVENT_PLUGIN_INTERNALS__;
  const pending = [];
  globalThis.isTauri = true;
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
  window.__TAURI_INTERNALS__ = { transformCallback: () => 1, invoke: async command => {
    if (command === 'native_engine_info') return { available: true, workerThreads: 1, physicsBackend: 'test' };
    if (command === 'native_jobs' || command === 'read_autosave_projects') return [];
    if (command === 'native_rebuild_cad') return new Promise(resolve => pending.push(resolve));
    return null;
  } };
  t.after(async () => { await act(async () => cleanup()); globalThis.isTauri = oldTauri; window.__TAURI_INTERNALS__ = oldInternals; window.__TAURI_EVENT_PLUGIN_INTERNALS__ = oldEvents; });
  const utils = await mount({ initialView: 'model', saveSession: new ProjectSaveSession() });
  const result = volume => ({ meshes: [], topology: [], bodyMetrics: [], assemblyChecks: [], bodyCount: 1, audit: { valid: true, healed: false, solid: true, volume, surfaceArea: 10, centerOfMass: { x: 0, y: 0, z: 0 }, bounds: { xmin: 0, ymin: 0, zmin: 0, xmax: 10, ymax: 10, zmax: 10 }, topology: { solids: 1, faces: 6, edges: 12, vertices: 8 }, appliedFeatures: [], warnings: [] } });
  await waitFor(() => assert.equal(pending.length, 1));
  await act(async () => pending.shift()(result(100)));
  await act(async () => fireEvent.click(utils.getByRole('button', { name: 'Validate + heal', hidden: true })));
  await waitFor(() => assert.equal(pending.length, 1));
  const stale = pending.shift();
  const width = within(utils.container.querySelector('#inspector-geometry')).getByLabelText('Width');
  await act(async () => { fireEvent.change(width, { target: { value: '123 mm' } }); fireEvent.keyDown(width, { key: 'Enter' }); });
  await act(async () => stale(result(99999)));
  assert.doesNotMatch(utils.container.querySelector('.cad-audit').textContent, /99999/);
  assert.match(utils.getByRole('status', { name: 'Workspace status' }).textContent, /Dimension updated/);
  const entity = parseCadProject(window.formCAD.getProjectFile()).entities.find(e => e.id === 'base-profile');
  assert.equal(entity.b.x - entity.a.x, 123);
});

test("native save-and-close event runs the real CAD save path and refuses dialog cancellation", async (t) => {
  const oldTauri = globalThis.isTauri, oldInternals = window.__TAURI_INTERNALS__, oldEvents = window.__TAURI_EVENT_PLUGIN_INTERNALS__;
  const callbacks = new Map(), listeners = new Map(), acknowledgements = [], flags = [];
  let next = 1, cancelled = true, saved;
  globalThis.isTauri = true;
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: (event) => listeners.delete(event) };
  window.__TAURI_INTERNALS__ = {
    transformCallback: callback => { const key = next++; callbacks.set(key, callback); return key; },
    invoke: async (command, args) => {
      if (command === 'native_engine_info') return { available: false };
      if (command === 'read_autosave_projects' || command === 'native_jobs') return [];
      if (command === 'plugin:event|listen') { listeners.set(args.event, callbacks.get(args.handler)); return args.handler; }
      if (command === 'save_project_file') { if (cancelled) return null; saved = args.contents; return '/tmp/event-save.form'; }
      if (command === 'complete_document_close') { acknowledgements.push(args); return args.success; }
      if (command === 'set_document_dirty') flags.push(args);
      return null;
    },
  };
  t.after(async () => { await act(async () => cleanup()); globalThis.isTauri = oldTauri; window.__TAURI_INTERNALS__ = oldInternals; window.__TAURI_EVENT_PLUGIN_INTERNALS__ = oldEvents; });
  const session = new ProjectSaveSession();
  const utils = await mount({ initialView: 'model', saveSession: session });
  await waitFor(() => assert.ok(listeners.has('form-save-and-close')));
  const width = within(utils.container.querySelector('#inspector-geometry')).getByLabelText('Width');
  await act(async () => { fireEvent.change(width, { target: { value: '111 mm' } }); fireEvent.keyDown(width, { key: 'Enter' }); });
  await act(async () => listeners.get('form-save-and-close')({ payload: 7 }));
  assert.deepEqual(acknowledgements.at(-1), { requestId: 7, success: false });
  assert.equal(session.dirty, true);
  cancelled = false;
  await act(async () => listeners.get('form-save-and-close')({ payload: 8 }));
  assert.deepEqual(acknowledgements.at(-1), { requestId: 8, success: true });
  assert.equal(session.dirty, false);
  const entity = parseCadProject(saved).entities.find(e => e.id === 'base-profile');
  assert.equal(entity.b.x - entity.a.x, 111);
  assert.ok(flags.some(entry => entry.owner === 'cad' && !entry.dirty));
  assert.ok(flags.some(entry => entry.owner === 'rig' && !entry.dirty));
});

test("canonical save state: real CAD Save As, undo to saved content and redo", async (t) => {
  t.after(cleanup);
  t.after(() => { delete globalThis.isTauri; delete window.__TAURI_INTERNALS__; });
  const session = new ProjectSaveSession();
  const files = new Map();
  const utils = await mount({ initialView: 'model', saveSession: session });
  window.__TAURI_INTERNALS__ = { invoke: async (command, args) => {
    if (command === 'save_project_file' || command === 'write_project_file') { files.set('/tmp/different-filename.form', args.contents); return '/tmp/different-filename.form'; }
    return null;
  } };
  globalThis.isTauri = true;
  await act(async () => fireEvent.click(utils.getByRole('button', { name: 'Save', exact: true })));
  await waitFor(() => assert.ok(utils.getByTitle('Project saved')));
  assert.equal(session.dirty, false);
  assert.equal(parseProject(files.get('/tmp/different-filename.form')).name, parseProject(window.formCAD.getProjectFile()).name, 'Save As does not rename content after writing it');
  await act(async () => fireEvent.click(within(utils.container.querySelector('.cad-sculpt-section')).getByRole('button', { name: 'Box' })));
  assert.equal(session.dirty, true);
  await act(async () => fireEvent.click(utils.getByTitle('Undo')));
  assert.equal(session.dirty, false, 'returning to saved authoring content is clean');
  assert.ok(utils.getByTitle('Project saved'));
  await act(async () => fireEvent.click(utils.getByTitle('Redo')));
  assert.equal(session.dirty, true);
  assert.ok(utils.getByTitle('Unsaved project changes'));
});

test("scene-only native Open preserves cancellation, routes to Animation and visits empty Model without changing the file", async (t) => {
  const raf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 0;
  t.after(() => { cleanup(); globalThis.requestAnimationFrame = raf; delete globalThis.isTauri; delete window.__TAURI_INTERNALS__; });
  localStorage.clear(); localStorage.setItem('form-onboarding-v1', 'complete');
  const project = updateFormWorkspace(createFormProject('Scene-only delivery'), 'scene', {
    schema: FORM_SCENE_WORKSPACE_SCHEMA, objectIds: [], data: emptySceneWorkspace(),
  });
  const contents = serializeProject(project);
  let answer = false, saved, savedPath;
  window.__TAURI_INTERNALS__ = { invoke: async (command, args) => {
    if (command === 'native_engine_info') return { available: false };
    if (command === 'read_autosave_projects') return [];
    if (command === 'open_project_file') return { contents, path: '/tmp/scene-only.form' };
    if (command === 'confirm_document_action') return answer;
    if (command === 'write_project_file') { saved = args.contents; savedPath = args.path; return args.path; }
    return null;
  } }; globalThis.isTauri = true;
  const { default: StudioEntry } = await import('../app/studio-entry.tsx');
  let utils; await act(async () => { utils = render(createElement(StudioEntry)); });
  await act(async () => fireEvent.click(within(utils.container.querySelector('.cad-sculpt-section')).getByRole('button', { name: 'Box' })));
  const open = () => fireEvent.click(utils.getByRole('menuitem', { name: 'Open project…', hidden: true }));
  await act(async () => open());
  assert.match(utils.getByRole('status', { name: 'Workspace status' }).textContent, /Open cancelled/);
  assert.equal(window.formCAD.getProject().meshFeatures.length, 1);
  answer = true;
  await act(async () => open());
  await waitFor(() => assert.ok(utils.getByTitle('Back to modeling')), { timeout: 15000 });
  await act(async () => new Promise(resolve => setTimeout(resolve, 600)));
  assert.equal(utils.getByLabelText('Project name').value, project.name);
  const openedSaveState = utils.getByTitle('Project save state').textContent;
  await act(async () => fireEvent.keyDown(window, { key: 's', metaKey: true }));
  assert.equal(savedPath, '/tmp/scene-only.form');
  assert.deepEqual(parseProject(saved).workspaces.scene.data, project.workspaces.scene.data);
  assert.match(openedSaveState, /^Saved$/);
  assert.equal(parseProject(saved).workspaces.cad, undefined);
  await act(async () => fireEvent.click(utils.getByTitle('Back to modeling')));
  await waitFor(() => assert.ok(utils.getByTitle('Project saved')));
  assert.equal(window.formCAD.getProject().entities.length, 0);
  assert.equal(window.formCAD.getProject().features.length, 0);
  assert.equal(window.formCAD.getProject().meshFeatures.length, 0);
  assert.equal(parseProject(window.formCAD.getProjectFile()).workspaces.cad, undefined);
  await act(async () => fireEvent.click(within(utils.container.querySelector('.cad-sculpt-section')).getByRole('button', { name: 'Box' })));
  assert.ok(utils.getByTitle('Unsaved project changes'));
  await act(async () => fireEvent.click(utils.getByRole('button', { name: 'Save', exact: true })));
  assert.equal(savedPath, '/tmp/scene-only.form');
  assert.equal(parseCadProject(saved).meshFeatures.length, 1);
  assert.deepEqual(parseProject(saved).workspaces.scene.data, project.workspaces.scene.data);
});

test("canonical save state: real Model to empty Animation to Model never acknowledges unsaved work", async (t) => {
  const raf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 0;
  t.after(() => { cleanup(); globalThis.requestAnimationFrame = raf; });
  localStorage.clear(); localStorage.setItem('form-onboarding-v1', 'complete');
  const { default: StudioEntry } = await import('../app/studio-entry.tsx');
  let utils;
  await act(async () => { utils = render(createElement(StudioEntry)); });
  await act(async () => fireEvent.click(within(utils.container.querySelector('.cad-sculpt-section')).getByRole('button', { name: 'Box' })));
  for (let i = 0; i < 2; i++) {
    assert.ok(utils.getByTitle('Unsaved project changes'));
    await act(async () => fireEvent.click(utils.getByRole('button', { name: 'Animation', exact: true })));
    await waitFor(() => assert.ok(utils.getByTitle('Back to modeling')), { timeout: 15000 });
    await act(async () => new Promise(resolve => setTimeout(resolve, 600)));
    assert.match(utils.getByTitle('Project save state').textContent, /Unsaved/);
    await act(async () => fireEvent.click(utils.getByTitle('Back to modeling')));
    await waitFor(() => assert.ok(utils.getByTitle('Unsaved project changes')));
    assert.equal(window.formCAD.getProject().meshFeatures.length, 1);
  }
  assert.equal(utils.getByTitle('Undo').disabled, false, 'CAD history survives workspace remounts');
  await act(async () => fireEvent.click(utils.getByTitle('Undo')));
  assert.equal(window.formCAD.getProject().meshFeatures.length, 0);
});

test("canonical save state: clean navigation, empty-scene metadata, failed save and save from Animation", async (t) => {
  const raf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 0;
  t.after(() => { cleanup(); globalThis.requestAnimationFrame = raf; delete globalThis.isTauri; delete window.__TAURI_INTERNALS__; });
  localStorage.clear(); localStorage.setItem('form-onboarding-v1', 'complete');
  let saved, failure=false;
  const guards = new Map();
  window.__TAURI_INTERNALS__ = { invoke: async (command, args) => {
    if (command === 'native_engine_info') return { available: false };
    if (command === 'set_document_dirty') { guards.set(args.owner, args.dirty); return; }
    if (command === 'save_project_file' || command === 'write_project_file') {
      if (failure) throw new Error('Read-only disk');
      saved=args.contents; return '/tmp/canonical-session.form';
    }
    if (command === 'read_autosave_projects') return [];
    return null;
  } }; globalThis.isTauri = true;
  const { default: StudioEntry } = await import('../app/studio-entry.tsx');
  let utils;
  await act(async () => { utils=render(createElement(StudioEntry)); });
  await act(async () => fireEvent.click(utils.getByRole('button',{name:'Save',exact:true})));
  await waitFor(()=>assert.ok(utils.getByTitle('Project saved')));
  await act(async () => fireEvent.click(utils.getByRole('button',{name:'Animation',exact:true})));
  await waitFor(()=>assert.ok(utils.getByTitle('Back to modeling')),{timeout:15000});
  await act(async()=>new Promise(resolve=>setTimeout(resolve,600)));
  assert.match(utils.getByTitle('Project save state').textContent,/^Saved$/);
  await act(async()=>fireEvent.change(utils.getByLabelText('Project name'),{target:{value:'Metadata without objects'}}));
  assert.match(utils.getByTitle('Project save state').textContent,/Unsaved/);
  failure=true;
  await act(async()=>fireEvent.keyDown(window,{key:'s',metaKey:true}));
  assert.match(utils.getByTitle('Project save state').textContent,/Unsaved/);
  assert.notEqual(parseProject(saved).name,'Metadata without objects');
  failure=false;
  await act(async()=>fireEvent.keyDown(window,{key:'s',metaKey:true}));
  await waitFor(()=>assert.match(utils.getByTitle('Project save state').textContent,/^Saved$/));
  assert.equal(parseProject(saved).name,'Metadata without objects');
  await waitFor(()=>assert.deepEqual([...guards.values()],[false,false]));
  await act(async()=>fireEvent.click(utils.getByTitle('Back to modeling')));
  await waitFor(()=>assert.ok(utils.getByTitle('Project saved')));
  assert.equal(parseProject(window.formCAD.getProjectFile()).name,'Metadata without objects');
});

test("global history restores edits chronologically across Model and Animation and preserves Save", async (t) => {
  const raf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 0;
  t.after(() => { cleanup(); globalThis.requestAnimationFrame = raf; delete globalThis.isTauri; delete window.__TAURI_INTERNALS__; });
  localStorage.clear(); localStorage.setItem('form-onboarding-v1', 'complete');
  let saved;
  window.__TAURI_INTERNALS__ = { invoke: async (command,args) => {
    if(command==='native_engine_info') return {available:false};
    if(command==='read_autosave_projects') return [];
    if(command==='save_project_file'||command==='write_project_file') { saved=args.contents; return '/tmp/global-history.form'; }
    return null;
  } }; globalThis.isTauri=true;
  const { default: StudioEntry } = await import('../app/studio-entry.tsx');
  let utils; await act(async()=>{utils=render(createElement(StudioEntry));});
  const click=async title=>act(async()=>fireEvent.click(utils.getByTitle(title)));
  const add=async shape=>act(async()=>fireEvent.click(within(utils.container.querySelector('.cad-sculpt-section')).getByRole('button',{name:shape})));
  const animation=async()=>{
    await act(async()=>fireEvent.click(utils.getByRole('button',{name:'Animation',exact:true})));
    await waitFor(()=>assert.ok(utils.getByTitle('Back to modeling')),{timeout:15000});
    await act(async()=>new Promise(resolve=>setTimeout(resolve,600)));
  };
  await act(async()=>fireEvent.click(utils.getByRole('button',{name:'Save',exact:true})));
  const baselineName=parseProject(saved).name;
  await add('Box'); await animation();
  await act(async()=>fireEvent.change(utils.getByLabelText('Project name'),{target:{value:'Scene revision'}}));
  await click('Back to modeling'); await add('Cylinder');
  assert.equal(window.formCAD.getProject().meshFeatures.length,2);
  await click('Undo'); assert.equal(window.formCAD.getProject().meshFeatures.length,1);
  assert.equal(parseProject(window.formCAD.getProjectFile()).name,'Scene revision');
  await click('Undo'); assert.equal(parseProject(window.formCAD.getProjectFile()).name,baselineName);
  assert.equal(window.formCAD.getProject().meshFeatures.length,1,'undoing the Animation edit must not undo older CAD geometry');
  await animation(); await click('Undo');
  assert.match(utils.getByTitle('Project save state').textContent,/^Saved$/);
  await click('Back to modeling'); assert.equal(window.formCAD.getProject().meshFeatures.length,0);
  assert.equal(utils.getByTitle('Undo').disabled,true);
  await click('Redo'); assert.equal(window.formCAD.getProject().meshFeatures.length,1);
  await animation(); await click('Redo');
  assert.equal(utils.getByLabelText('Project name').value,'Scene revision');
  await click('Back to modeling'); await click('Redo');
  assert.equal(window.formCAD.getProject().meshFeatures.length,2);
  assert.ok(utils.getByTitle('Unsaved project changes'));
  await act(async()=>fireEvent.click(utils.getByRole('button',{name:'Save',exact:true})));
  assert.equal(parseProject(saved).name,'Scene revision');
  assert.equal(parseCadProject(saved).meshFeatures.length,2);
  cleanup(); const reopened=await mount({initialView:'model',initialProjectContents:saved,saveSession:new ProjectSaveSession()});
  assert.equal(window.formCAD.getProject().meshFeatures.length,2);
  // This isolated component has not received an explicit saved baseline from
  // StudioEntry; file contents, not its standalone baseline, are checked here.
  assert.ok(reopened.getByTitle('Undo').disabled);
});

test("canonical save state: native recovery restores as unsaved with no overwrite target", async (t) => {
  t.after(cleanup);
  t.after(() => { delete globalThis.isTauri; delete window.__TAURI_INTERNALS__; });
  await mount(); const recovery=window.formCAD.getProjectFile(); cleanup();
  let releaseRecovery;
  window.__TAURI_INTERNALS__ = { invoke: async command => {
    if(command==='native_engine_info') return {available:false};
    if(command==='read_autosave_projects') return new Promise(resolve=>{releaseRecovery=resolve;});
    if(command==='confirm_document_action') return true;
    return null;
  } }; globalThis.isTauri=true;
  const utils=await mount({initialView:'model',initialProjectContents:recovery,initialProjectPath:'/tmp/original.form'});
  await waitFor(()=>assert.equal(typeof releaseRecovery,'function'));
  await act(async()=>releaseRecovery([{contents:recovery,savedAtMs:Date.now()}]));
  await act(async()=>fireEvent.click(utils.container.querySelector('.cad-project-menu summary')));
  await waitFor(()=>assert.ok(utils.getByRole('menuitem',{name:'Recover autosave'})));
  await act(async()=>fireEvent.click(utils.getByRole('menuitem',{name:'Recover autosave'})));
  await waitFor(()=>assert.ok(utils.getByTitle('Unsaved project changes')));
  assert.equal(window.formCAD.getProjectPath(),null);
  assert.match(utils.getByRole('status', { name: 'Workspace status' }).textContent,/Recovered unsaved snapshot/);
});

test("creative graphs, animation and baked textures participate in Undo and Redo", async (t) => {
  t.after(cleanup);
  const utils = await mount({ initialView: 'model' });
  const roundTrip = async (field, edit) => {
    const before = structuredClone(window.formCAD.getProject()[field]);
    await act(edit);
    const after = structuredClone(window.formCAD.getProject()[field]);
    assert.notDeepEqual(after, before, `${field} changed`);
    await act(async () => fireEvent.click(utils.getByTitle('Undo')));
    assert.deepEqual(window.formCAD.getProject()[field], before, `${field} undo`);
    await act(async () => fireEvent.click(utils.getByTitle('Redo')));
    assert.deepEqual(window.formCAD.getProject()[field], after, `${field} redo`);
  };
  for (const [field, label] of [['geometryGraph', 'Add a geometry node'], ['materialGraph', 'Add a material node']]) {
    const select = utils.getByLabelText(label);
    await roundTrip(field, async () => fireEvent.change(select, { target: { value: select.options[1].value } }));
  }
  await roundTrip('animation', async () => fireEvent.change(utils.getByLabelText('Frames per second'), { target: { value: '48' } }));
  await act(async () => fireEvent.click(within(utils.container.querySelector('.cad-sculpt-section')).getByRole('button', { name: 'Box' })));
  await act(async () => fireEvent.click(utils.getByRole('button', { name: 'Bake', exact: true })));
  const baked = parseCadProject(window.formCAD.getProjectFile()).paintTexture;
  await act(async () => fireEvent.click(utils.getByTitle('Undo')));
  assert.ok(!parseCadProject(window.formCAD.getProjectFile()).paintTexture);
  await act(async () => fireEvent.click(utils.getByTitle('Redo')));
  assert.deepEqual(parseCadProject(window.formCAD.getProjectFile()).paintTexture, baked);
});

test("scrubbing and playback do not dirty a saved document or consume Undo", async (t) => {
  t.after(cleanup);
  await mount();
  const source = window.formCAD.getProjectFile();
  cleanup();
  const utils = await mount({ initialView: 'model', initialProjectContents: source });
  const before = window.formCAD.getProject().animation;
  await act(async () => fireEvent.click(utils.getByTitle('Step on one frame')));
  // Pause before waiting for act to drain. An active RAF loop can otherwise
  // keep async act busy forever on a loaded host, preventing the test from
  // reaching its Pause event even though the application remains responsive.
  await act(async () => {
    fireEvent.click(utils.getByTitle('Play'));
    await new Promise((resolve) => setTimeout(resolve, 80));
    fireEvent.click(utils.getByTitle('Pause'));
  });
  assert.deepEqual(window.formCAD.getProject().animation, before);
  assert.equal(utils.getByTitle('Undo').disabled, true);
  assert.equal(utils.queryByTitle('Unsaved project changes'), null);
});

test("animation curve dragging commits once and cancellation commits nothing", async (t) => {
  t.after(cleanup);
  const { GraphEditorPanel } = await import('../app/graph-editor-panel.tsx');
  const { createCurve, createKey } = await import('../app/animation-curve.ts');
  const curves = [createCurve('c', 'position.x', [createKey('a', 0, 0), createKey('b', 20, 10)])];
  const commits = [];
  const utils = render(createElement(GraphEditorPanel, { curves, playhead: 0, onCurves: (change) => commits.push(change(curves)) }));
  const surface = utils.getByLabelText('Animation curves');
  surface.getBoundingClientRect = () => ({ left: 0, top: 0, width: 520, height: 240 });
  surface.setPointerCapture = () => {};
  const start = async () => {
    const key = surface.querySelector('.cad-graph-key');
    const x = Number(key.getAttribute('x')) + 3.5, y = Number(key.getAttribute('y')) + 3.5;
    await act(async () => fireEvent.pointerDown(surface, { pointerId: 1, clientX: x, clientY: y }));
    await act(async () => fireEvent.pointerMove(surface, { pointerId: 1, clientX: x + 30, clientY: y - 15 }));
    await act(async () => fireEvent.pointerMove(surface, { pointerId: 1, clientX: x + 50, clientY: y - 20 }));
  };
  await start();
  assert.equal(commits.length, 0);
  await act(async () => fireEvent.pointerUp(surface, { pointerId: 1 }));
  assert.equal(commits.length, 1);
  assert.notDeepEqual(commits[0], curves);
  await start();
  await act(async () => fireEvent.pointerCancel(surface, { pointerId: 1 }));
  assert.equal(commits.length, 1);
});

test("Paint mode prepares a surface automatically; a stroke is one Undo and interruption restores pixels", async (t) => {
  t.after(cleanup);
  const THREE = await import('three');
  const originalRaycast = THREE.Raycaster.prototype.intersectObjects;
  t.after(() => { THREE.Raycaster.prototype.intersectObjects = originalRaycast; });
  const utils = await mount({ initialView: 'model' });
  await act(async () => fireEvent.click(within(utils.container.querySelector('.cad-sculpt-section')).getByRole('button', { name: 'Box' })));
  await act(async () => fireEvent.click(utils.getByRole('button', { name: 'Paint mode', exact: true })));
  await act(async () => fireEvent.click(utils.getByRole('button', { name: 'Start painting', exact: true })));
  assert.ok(utils.getByRole('button', { name: 'Pause painting', exact: true }));
  await act(async () => fireEvent.change(utils.getByLabelText('Surface paint color'), { target: { value: '#ff0000' } }));
  await act(async () => fireEvent.change(utils.getByLabelText('Surface paint strength'), { target: { value: '1' } }));
  const canvas = globalThis.__cadRenderers.at(-1).domElement;
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
  const captures = new Set();
  canvas.setPointerCapture = (id) => captures.add(id);
  canvas.hasPointerCapture = (id) => captures.has(id);
  canvas.releasePointerCapture = (id) => captures.delete(id);
  // Only hit testing is stubbed; all gesture handlers, paint and history are real.
  THREE.Raycaster.prototype.intersectObjects = (objects) => objects.length ? [{ object: objects[0], uv: { x: 0.5, y: 0.5 } }] : [];
  const pointer = async (type, pointerId = 1) => act(async () => {
    const event = new dom.window.MouseEvent(type, { clientX: 50, clientY: 50, button: 0, bubbles: true });
    Object.defineProperty(event, 'pointerId', { value: pointerId });
    canvas.dispatchEvent(event);
  });
  const pixels = () => Array.from(restorePaintTexture(parseCadProject(window.formCAD.getProjectFile()).paintTexture).texture.pixels);
  const before = pixels();
  await pointer('pointerdown'); await pointer('pointermove'); await pointer('pointermove');
  assert.notDeepEqual(pixels(), before);
  await pointer('pointerup', 2);
  assert.equal(captures.size, 1, 'a second pointer cannot end the stroke');
  await pointer('pointerup');
  const painted = pixels();
  await act(async () => fireEvent.click(utils.getByTitle('Undo')));
  assert.deepEqual(pixels(), before, 'one Undo removes every dab');
  await act(async () => fireEvent.click(utils.getByTitle('Redo')));
  assert.deepEqual(pixels(), painted);
  await act(async () => fireEvent.change(utils.getByLabelText('Surface paint color'), { target: { value: '#00ff00' } }));
  for (const cancel of ['pointercancel', 'lostpointercapture', 'Escape', 'blur']) {
    await pointer('pointerdown'); await pointer('pointermove');
    if (cancel === 'Escape') await act(async () => fireEvent.keyDown(window, { key: 'Escape' }));
    else if (cancel === 'blur') await act(async () => fireEvent.blur(window));
    else await pointer(cancel);
    assert.deepEqual(pixels(), painted, `${cancel} restores the previous pixels`);
    assert.equal(captures.size, 0);
  }
  const saved = window.formCAD.getProjectFile();
  await act(async () => fireEvent.click(utils.getByRole('button', { name: 'Pause painting', exact: true })));
  await act(async () => fireEvent.click(utils.getByRole('button', { name: 'Resume painting', exact: true })));
  assert.deepEqual(pixels(), painted, 'resuming must not rebake or erase paint');
  await act(async () => fireEvent.click(utils.getByTitle('Select bodies, faces, edges or vertices')));
  const unchanged = pixels();
  await pointer('pointerdown'); await pointer('pointerup');
  assert.deepEqual(pixels(), unchanged, 'Select mode no longer paints');
  cleanup();
  await mount({ initialView: 'model', initialProjectContents: saved });
  assert.deepEqual(pixels(), painted, 'paint survives reopening the FORM file');
});

test("Paint toolbox protects another mesh's texture and offers an exact-body copy", async (t) => {
  t.after(cleanup);
  const utils = await mount({ initialView: 'model' });
  await act(async () => fireEvent.click(utils.getByRole('button', { name: 'Paint mode', exact: true })));
  assert.ok(utils.getByRole('button', { name: 'Make paintable copy', exact: true }));
  await act(async () => fireEvent.click(utils.getByRole('button', { name: 'Add paintable block', exact: true })));
  await act(async () => fireEvent.click(utils.getByRole('button', { name: 'Start painting', exact: true })));
  const before = parseCadProject(window.formCAD.getProjectFile()).paintTexture;
  await act(async () => fireEvent.click(within(utils.container.querySelector('.cad-sculpt-section')).getByRole('button', { name: 'Box', exact: true })));
  const start = utils.getByRole('button', { name: 'Start painting', exact: true });
  assert.equal(start.disabled, true);
  assert.deepEqual(parseCadProject(window.formCAD.getProjectFile()).paintTexture, before);
});

test("Ghost image import reviews before adding and commits one undoable, saved mesh", async (t) => {
  t.after(cleanup);
  const utils = await mount({ initialView: 'model' });
  const before = parseCadProject(window.formCAD.getProjectFile());
  await act(async () => fireEvent.click(utils.getByRole('button', {name:'Import image to Model'})));
  assert.ok(utils.getByRole('dialog', {name:'Ghost Studio image import'}));
  await act(async () => fireEvent.keyDown(utils.getByRole('dialog'), {key:'Escape'}));
  assert.equal(utils.queryByRole('dialog', {name:'Ghost Studio image import'}), null);
  assert.deepEqual(parseCadProject(window.formCAD.getProjectFile()).meshFeatures, before.meshFeatures);
  const originalImage = globalThis.Image, originalContext = dom.window.HTMLCanvasElement.prototype.getContext;
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  const revoked = [];
  t.after(() => { globalThis.Image = originalImage; dom.window.HTMLCanvasElement.prototype.getContext = originalContext; URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; });
  globalThis.Image = class { width=12; height=12; async decode() {} };
  URL.createObjectURL = () => 'blob:ghost-test'; URL.revokeObjectURL = (url) => revoked.push(url);
  const data = new Uint8ClampedArray(12*12*4).fill(255);
  for (let y=3;y<9;y++) for(let x=3;x<9;x++) for(let c=0;c<3;c++) data[(y*12+x)*4+c]=0;
  dom.window.HTMLCanvasElement.prototype.getContext = function(...args) {
    return this.width===12 && this.height===12 ? {drawImage(){},getImageData(){return {data,width:12,height:12};}} : originalContext.apply(this,args);
  };
  await act(async () => fireEvent.click(utils.getByRole('button', {name:'Import image to Model'})));
  await act(async () => fireEvent.change(utils.getByLabelText('Choose model image'), {target:{files:[new File(['photo'],'badge.png',{type:'image/png'})]}}));
  assert.deepEqual(parseCadProject(window.formCAD.getProjectFile()).meshFeatures, before.meshFeatures, 'preview cannot mutate the document');
  await act(async () => fireEvent.click(utils.getByRole('button', {name:'Adjust silhouette →'})));
  await act(async () => fireEvent.change(utils.getByLabelText('Image model depth'), {target:{value:'12'}}));
  await act(async () => fireEvent.click(utils.getByRole('button', {name:'Review model →'})));
  await act(async () => fireEvent.click(utils.getByRole('button', {name:'Add to Model →'})));
  const saved = window.formCAD.getProjectFile();
  const model = parseCadProject(saved).meshFeatures.at(-1);
  assert.match(model.name,/badge.*silhouette/);
  assert.equal(Math.max(...model.primitive.positions.map(p=>p[2])),12);
  assert.ok(revoked.includes('blob:ghost-test'));
  await act(async () => fireEvent.click(utils.getByTitle('Undo')));
  assert.deepEqual(parseCadProject(window.formCAD.getProjectFile()).meshFeatures, before.meshFeatures);
  await act(async () => fireEvent.click(utils.getByTitle('Redo')));
  assert.deepEqual(parseCadProject(window.formCAD.getProjectFile()).meshFeatures.at(-1),model);
  cleanup();
  await mount({initialView:'model',initialProjectContents:saved});
  assert.deepEqual(parseCadProject(window.formCAD.getProjectFile()).meshFeatures.at(-1),model);
});

test("photo reconstruction requires cloud consent and reviews native results before committing", async (t) => {
  const nativeFlag = globalThis.isTauri, internals = window.__TAURI_INTERNALS__;
  const { ImageModelStudio } = await import('../app/image-model-studio.tsx');
  const Reader = globalThis.FileReader;
  const calls = [], added = [];
  let configured = false;
  globalThis.isTauri = true;
  globalThis.FileReader = class { readAsDataURL() {this.result='data:image/png;base64,iVBORw0KGgo='; this.onload();} };
  window.__TAURI_INTERNALS__ = {invoke:async(command,args)=>{
    calls.push({command,args});
    if(command==='photo_capabilities') return {localScan:true,aiConfigured:configured};
    if(command==='photo_ai_set_key'){ configured=!!args.key; return; }
    if(command==='photo_ai_start') return 'test-task-123';
    if(command==='photo_ai_status') return {id:'test-task-123',status:'SUCCEEDED',progress:100};
    if(command==='photo_scan_status') return {phase:'complete',progress:1,message:'Ready',output:'/test/model',skipped:0};
    if(command==='photo_scan_result'||command==='photo_ai_result') return {obj:'v 0 0 0\nv 1 0 0\nv 0 1 0\nv 0 0 1\nf 1 2 3\nf 1 4 2\nf 1 3 4\nf 2 4 3',textures:[]};
    throw new Error(`Unexpected ${command}`);
  }};
  localStorage.removeItem('form-photo-ai-task');
  t.after(()=>{cleanup(); globalThis.isTauri=nativeFlag;window.__TAURI_INTERNALS__=internals;globalThis.FileReader=Reader;localStorage.removeItem('form-photo-ai-task');});
  let utils;
  await act(async()=>{utils=render(createElement(ImageModelStudio,{onClose(){},onAdd:value=>added.push(value)}));});
  await act(async()=>fireEvent.click(utils.getByRole('button',{name:'AI generation',exact:true})));
  await act(async()=>fireEvent.change(utils.getByLabelText('Meshy API key'),{target:{value:'test-not-a-real-api-key'}}));
  await act(async()=>fireEvent.click(utils.getByRole('button',{name:'Connect for this session'})));
  await act(async()=>fireEvent.change(utils.getByLabelText('AI source photo'),{target:{files:[new File(['photo'],'object.png',{type:'image/png'})]}}));
  const generate=utils.getByRole('button',{name:'Upload & generate 3D'});
  assert.equal(generate.disabled,true);
  assert.equal(calls.filter(c=>c.command==='photo_ai_start').length,0);
  await act(async()=>fireEvent.click(utils.getByRole('checkbox',{name:/I agree to upload/})));
  await act(async()=>fireEvent.click(generate));
  assert.equal(calls.filter(c=>c.command==='photo_ai_start').length,1);
  assert.equal(calls.find(c=>c.command==='photo_ai_start').args.consent,true);
  assert.equal(localStorage.getItem('form-photo-ai-task'),'test-task-123');
  assert.equal(JSON.stringify(Object.entries(localStorage)).includes('test-not-a-real-api-key'),false);
  assert.equal(added.length,0);
  await act(async()=>fireEvent.click(utils.getByRole('button',{name:'Load model for review'})));
  assert.equal(added.length,0);
  await act(async()=>fireEvent.click(utils.getByRole('button',{name:'Add reconstructed model'})));
  assert.equal(added[0].source,'ai');
  assert.equal(added[0].mesh.faces.length,4);
  await act(async()=>fireEvent.click(utils.getByRole('button',{name:'Local scan',exact:true})));
  await act(async()=>fireEvent.click(utils.getByRole('button',{name:'Load model for review'})));
  await act(async()=>fireEvent.click(utils.getByRole('button',{name:'Add reconstructed model'})));
  assert.equal(added[1].source,'local-scan');
});

test("photo colors reach preview, Model, undo, project reopen and surface painting", async (t) => {
  const nativeFlag = globalThis.isTauri, internals = window.__TAURI_INTERNALS__;
  const OriginalImage = globalThis.Image, originalContext = dom.window.HTMLCanvasElement.prototype.getContext;
  t.after(()=>{cleanup();globalThis.isTauri=nativeFlag;window.__TAURI_INTERNALS__=internals;globalThis.Image=OriginalImage;dom.window.HTMLCanvasElement.prototype.getContext=originalContext;});
  globalThis.Image = class { naturalWidth=2; naturalHeight=2; async decode() {} };
  // Distinct rows expose accidental vertical flips; actual canvas resampling is browser QA.
  const pixels = new Uint8ClampedArray(1024*1024*4);
  for(let y=0;y<1024;y++) for(let x=0;x<1024;x++) { const p=(y*1024+x)*4; pixels[p]=y<512?240:20; pixels[p+2]=y<512?20:240; pixels[p+3]=255; }
  dom.window.HTMLCanvasElement.prototype.getContext=function(...args){return this.width===1024 && this.height===1024 && args[0]==='2d' ? {drawImage(){},getImageData(){return {data:pixels};}} : originalContext.apply(this,args);};
  const obj='v 0 0 0\nv 1 0 0\nv 0 1 0\nvt 0 0\nvt 1 0\nvt 0 1\nusemtl color\nf 1/1 2/2 3/3';
  window.__TAURI_INTERNALS__={invoke:async(command)=>{
    if(command==='photo_capabilities') return {localScan:true,aiConfigured:false};
    if(command==='photo_scan_status') return {phase:'complete',progress:1,message:'Ready',output:'/test/model',skipped:0};
    if(command==='photo_scan_result') return {obj,textures:[{material:'color',dataUrl:'data:image/png;base64,iVBORw0KGgo='}]};
    throw new Error(`Unexpected native command ${command}`);
  }};
  let utils=await mount({initialView:'model'});
  const before=parseCadProject(window.formCAD.getProjectFile()).meshFeatures.length;
  globalThis.isTauri=true;
  await act(async()=>fireEvent.click(utils.getByRole('button',{name:'Import image to Model'})));
  await act(async()=>fireEvent.click(utils.getByRole('button',{name:'Local scan',exact:true})));
  await act(async()=>fireEvent.click(utils.getByRole('button',{name:'Load model for review'})));
  assert.ok(utils.getByText('Photo colors embedded · 1024 px atlas'));
  assert.ok(globalThis.__cadRenderers.some(r=>!r.disposed && r.lastPhotoTextures?.length),'preview has a real material map');
  assert.equal(parseCadProject(window.formCAD.getProjectFile()).meshFeatures.length,before);
  globalThis.isTauri=false;
  await act(async()=>fireEvent.click(utils.getByRole('button',{name:'Add reconstructed model'})));
  const saved=window.formCAD.getProjectFile(), imported=parseCadProject(saved).meshFeatures.at(-1);
  assert.equal(imported.photoTexture.size,1024);
  assert.ok(globalThis.__cadRenderers.some(r=>!r.disposed && r.lastPhotoTextures?.length),'Model has the embedded color map');
  await act(async()=>fireEvent.click(utils.getByTitle('Undo')));
  assert.equal(parseCadProject(window.formCAD.getProjectFile()).meshFeatures.length,before);
  await act(async()=>fireEvent.click(utils.getByTitle('Redo')));
  assert.deepEqual(parseCadProject(window.formCAD.getProjectFile()).meshFeatures.at(-1).photoTexture,imported.photoTexture);
  // Select the imported model by scene row after reopening if selection is not persisted.
  cleanup(); utils=await mount({initialView:'model',initialProjectContents:saved});
  assert.deepEqual(parseCadProject(window.formCAD.getProjectFile()).meshFeatures.at(-1).photoTexture,imported.photoTexture);
  assert.ok(globalThis.__cadRenderers.some(r=>!r.disposed && r.lastPhotoTextures?.length));
  const { restoredPhotoTexture }=await import('../app/photo-texture.ts');
  const recovered=restoredPhotoTexture(imported.photoTexture, imported.primitive);
  assert.equal(recovered.texture.pixels[0],20,'bottom scanline is first in GPU/paint storage');
  assert.equal(recovered.texture.pixels.at(-4),240,'top scanline is last');
  await act(async()=>fireEvent.click(within(utils.container.querySelector('.cad-sculpt-section')).getByText(imported.name)));
  await act(async()=>fireEvent.click(utils.getByRole('button',{name:'Paint mode',exact:true})));
  await act(async()=>fireEvent.click(utils.getByRole('button',{name:'Start painting',exact:true})));
  const { restorePaintTexture }=await import('../app/paint-texture-project.ts');
  const painted=restorePaintTexture(parseCadProject(window.formCAD.getProjectFile()).paintTexture);
  assert.deepEqual(painted.texture.pixels,recovered.texture.pixels,'painting starts from the photo, never blank gray');
  assert.deepEqual(painted.mapping.unwrap.uvOfCorner,recovered.uvOfCorner);
});

test("typed creative intent previews exact values and persists editable locks", async (t) => {
  t.after(cleanup);
  const utils = await mount({ initialView: "model" });
  const sculpt = utils.container.querySelector(".cad-sculpt-section");
  await act(async () => fireEvent.click(within(sculpt).getByRole("button", { name: "Box" })));
  const command = utils.getByLabelText("Precision CAD command");

  await act(async () => {
    fireEvent.change(command, { target: { value: "twist 90 degrees around Y and preserve volume" } });
    fireEvent.keyDown(command, { key: "Enter" });
  });
  const preview = utils.getByRole("dialog", { name: "Design Copilot editable plan" });
  assert.match(preview.textContent, /Twist.*90°.*Y axis/i, "the local command keeps its exact operation, angle and axis");
  assert.match(preview.textContent, /preserve volume/i, "the intent lock is explicit before application");
  await act(async () => fireEvent.click(within(preview).getByRole("button", { name: "Apply design" })));

  let saved = parseCadProject(window.formCAD.getProjectFile());
  const twist = saved.meshFeatures.at(-1).modifiers.findLast((modifier) => modifier.kind === "twist");
  assert.equal(twist.angle, 90);
  assert.equal(twist.axis, 1);
  assert.equal(twist.locks.preserveVolume, true);

  await act(async () => {
    fireEvent.change(command, { target: { value: "unlock lower end" } });
    fireEvent.keyDown(command, { key: "Enter" });
  });
  await act(async () => fireEvent.click(within(utils.getByRole("dialog", { name: "Design Copilot editable plan" })).getByRole("button", { name: "Apply design" })));
  saved = parseCadProject(window.formCAD.getProjectFile());
  assert.equal(saved.meshFeatures.at(-1).modifiers.findLast((modifier) => modifier.kind === "twist").locks.anchorStart, false);
});

test("direct modeling exposes smart Offset and exact face Push / Pull workflows", async (t) => {
  t.after(cleanup);
  const utils = await mount();

  const offset = utils.getByTitle("Offset");
  await act(async () => fireEvent.click(offset));
  assert.match(offset.className, /active/);
  await act(async () => fireEvent.keyDown(window, { key: " ", code: "Space" }));
  await act(async () => fireEvent.keyUp(window, { key: " ", code: "Space" }));
  const offsetShelf = utils.getByRole("region", { name: "Offset tool features" });
  assert.ok(within(offsetShelf).getByRole("button", { name: /OffsetParallel profile/i }));
  assert.ok(within(offsetShelf).getByText("Parallel profile"));

  await act(async () => fireEvent.click(viewButton(utils, "2 Model")));
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Modify" })));
  const modelShelf = utils.getByRole("region", { name: "Modify tools features" });
  const pushPull = within(modelShelf).getByRole("button", { name: /Push \/ Pull/i });
  assert.equal(pushPull.disabled, false);
  await act(async () => fireEvent.click(pushPull));
  assert.match(utils.getByRole("status", { name: "Workspace status" }).textContent, /Push\/Pull.*click an exact face/i);
  assert.match(utils.getByRole("button", { name: "Face" }).className, /active/);
  assert.ok(utils.getByRole("button", { name: "Marquee" }), "exact-body marquee is exposed beside the topology filters");
});

test("the inspector defaults to a core workflow and reveals specialist systems on demand", async (t) => {
  t.after(cleanup);
  const utils = await mount({ initialView: "model" });
  const inspector = utils.container.querySelector(".cad-inspector");
  assert.match(inspector.className, /core-mode/);
  assert.match(utils.getByRole("button", { name: /CoreModel · Sketch · Document/i }).className, /active/);
  await act(async () => fireEvent.click(utils.getByRole("button", { name: /SpecialistBIM · engineering · recipes/i })));
  assert.match(inspector.className, /specialist-mode/);
  assert.match(utils.getByRole("button", { name: /SpecialistBIM · engineering · recipes/i }).className, /active/);
});

test("Model-first creation completes a constrained embedded sketch and exact cut", async (t) => {
  t.after(cleanup);
  const utils = await mount({ initialView: "model" });
  assert.equal(viewButton(utils, "2 Model").className, "active");
  for (const label of ["Select", "Create", "Sketch", "Modify", "Measure"]) {
    assert.ok(utils.getByRole("button", { name: label }), `${label} is a primary model tool`);
  }

  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Create" })));
  const createShelf = utils.getByRole("region", { name: "Create tools features" });
  await act(async () => fireEvent.click(within(createShelf).getByRole("button", { name: /Box.*80 × 50 × 24 mm/ })));
  assert.match(utils.getByRole("status", { name: "Workspace status" }).textContent, /Box created · 80 × 50 × 24 mm/);
  assert.equal(utils.getByTitle("Undo").disabled, false);

  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Sketch" })));
  const sketchShelf = utils.getByRole("region", { name: "Sketch tools features" });
  await act(async () => fireEvent.click(within(sketchShelf).getByRole("button", { name: /World plane/ })));
  const embedded = utils.getByRole("region", { name: "Embedded Sketch Mode" });
  assert.ok(within(embedded).getByRole("button", { name: "Finish Sketch" }));
  assert.match(utils.container.querySelector(".cad-canvas-wrap").className, /embedded-sketch/);
  assert.equal(utils.container.querySelector(".cad-3d").style.display, "block", "the solid remains visible behind the sketch");

  await act(async () => fireEvent.click(within(embedded).getByRole("button", { name: "Centered Ø16" })));
  assert.match(utils.getByRole("status", { name: "Workspace status" }).textContent, /fully constrained/i);
  await act(async () => fireEvent.click(within(embedded).getByRole("button", { name: "Finish Sketch" })));
  const regionActions = utils.getByRole("region", { name: "Closed sketch region actions" });
  await act(async () => fireEvent.click(within(regionActions).getByRole("button", { name: "Cut through" })));
  assert.equal(viewButton(utils, "2 Model").className, "active");
  assert.equal(utils.queryByRole("region", { name: "Embedded Sketch Mode" }), null);
  assert.match(utils.getByRole("status", { name: "Workspace status" }).textContent, /Cut through body/i);

  await waitFor(() => assert.equal(utils.getByTitle("Undo").disabled, false));
  await act(async () => fireEvent.click(utils.getByTitle("Undo")));
  assert.match(utils.getByRole("status", { name: "Workspace status" }).textContent, /Undo/i);
  await waitFor(() => assert.equal(utils.getByTitle("Redo").disabled, false));
  await act(async () => fireEvent.click(utils.getByTitle("Redo")));
  assert.match(utils.getByRole("status", { name: "Workspace status" }).textContent, /Redo/i);

  const saved = window.formCAD.getProjectFile();
  assert.ok(parseCadProject(saved).features.some((feature) => feature.type === "Cut"), "the exact cut is serialized");
  cleanup();
  const reopened = await mount({ initialView: "model", initialProjectContents: saved });
  assert.equal(viewButton(reopened, "2 Model").className, "active");
  assert.ok(parseCadProject(window.formCAD.getProjectFile()).features.some((feature) => feature.type === "Cut"), "the cut survives reopen");
});

test("exact bodies support numeric XYZ placement and a guarded multi-body union", async (t) => {
  t.after(cleanup);
  const utils = await mount({ initialView: "model" });

  const placement = utils.getByRole("region", { name: "Exact body placement" });
  assert.match(placement.textContent, /Drag the XYZ gizmo or type an exact position/);
  const z = within(placement).getByLabelText("Body position Z");
  await act(async () => {
    fireEvent.change(z, { target: { value: "12 mm" } });
    fireEvent.keyDown(z, { key: "Enter" });
  });
  await waitFor(() => assert.match(utils.getByRole("status", { name: "Workspace status" }).textContent, /Moved 1 exact body.*12\.00 mm/i));
  assert.deepEqual(parseCadProject(window.formCAD.getProjectFile()).assemblyInstances.at(-1).position, [0, 0, 12]);

  await act(async () => fireEvent.keyDown(window, { key: " ", code: "Space" }));
  await act(async () => fireEvent.keyUp(window, { key: " ", code: "Space" }));
  const selectShelf = utils.getByRole("region", { name: "Select tools features" });
  await act(async () => fireEvent.click(within(selectShelf).getByRole("button", { name: "Select all bodies" })));
  assert.match(utils.getByRole("status", { name: "Workspace status" }).textContent, /2 exact bodies selected/i);

  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Modify" })));
  const modifyShelf = utils.getByRole("region", { name: "Modify tools features" });
  const union = within(modifyShelf).getByRole("button", { name: /Union.*2 selected bodies/i });
  assert.equal(union.disabled, false);
  await act(async () => fireEvent.click(union));
  assert.match(utils.getByRole("status", { name: "Workspace status" }).textContent, /Union committed.*2 sources/i);
  const saved = parseCadProject(window.formCAD.getProjectFile());
  assert.equal(saved.features.at(-1).type, "Fuse");
  assert.equal(saved.features.at(-1).sourceEntityIds.length, 2);
});

test("failed exact history exposes the actual failing feature and suppresses only that feature", async (t) => {
  t.after(cleanup);
  const utils = await mount({ initialView: "model" });
  const worker = globalThis.__cadWorkers.at(-1);
  await waitFor(() => assert.ok(worker.messages.length));
  const request = worker.messages.at(-1);
  const failed = request.features.find(feature => feature.type === "Fillet");
  assert.ok(failed);
  const before = parseCadProject(window.formCAD.getProjectFile());
  await act(async () => worker.onmessage({ data: {
    token: request.token, ok: true,
    result: { meshes: [], topology: [], bodyMetrics: [], assemblyChecks: [], audit: {
      valid: false, healed: false, solid: true, volume: 1000, surfaceArea: 600,
      centerOfMass: { x: 0, y: 0, z: 0 }, bounds: { xmin: 0, ymin: 0, zmin: 0, xmax: 10, ymax: 10, zmax: 10 },
      topology: { solids: 1, faces: 6, edges: 12, vertices: 8 }, appliedFeatures: ["Extrude"],
      warnings: ["Selected fillet could not be applied"],
      failedFeatures: [{ id: failed.id, type: "Fillet", message: "Selected fillet could not be applied" }],
    } },
  } }));
  const recovery = utils.getByRole("alert", { name: "Exact operation recovery" });
  assert.match(recovery.textContent, /Selected fillet could not be applied/);
  await act(async () => fireEvent.click(within(recovery).getByRole("button", { name: "Suppress failing feature" })));
  const after = parseCadProject(window.formCAD.getProjectFile());
  assert.equal(after.features.find(feature => feature.id === failed.id).enabled, false);
  assert.deepEqual(after.features.filter(feature => feature.id !== failed.id), before.features.filter(feature => feature.id !== failed.id));
});

test("native export cancellation and failure cannot acknowledge or cancel a pending viewport rebuild", async (t) => {
  const raf=globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame=()=>0;
  const {WEB_ENGINE_INFO}=await import('../app/native-engine.ts');
  let finishRebuild,exportError=false;
  globalThis.isTauri=true;
  window.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async command=>{
    if(command==='native_engine_info') return {...WEB_ENGINE_INFO,available:true};
    if(command==='native_jobs'||command==='read_autosave_projects') return [];
    if(command==='native_rebuild_cad') return new Promise(resolve=>{finishRebuild=resolve;});
    if(command==='native_export_cad') { if(exportError) throw Error('Read-only export destination'); return null; }
    return null;
  }};
  t.after(()=>{cleanup();globalThis.requestAnimationFrame=raf;delete globalThis.isTauri;delete window.__TAURI_INTERNALS__;});
  const utils=await mount({initialView:'model'});
  await waitFor(()=>assert.equal(typeof finishRebuild,'function'));
  const before=window.formCAD.getProjectFile();
  const exportStep=()=>fireEvent.click(utils.getByRole('menuitem',{name:'Export STEP',hidden:true}));
  await act(async()=>exportStep());
  assert.match(utils.getByRole('status', { name: 'Workspace status' }).textContent,/Native export cancelled/);
  assert.match(utils.container.querySelector('.cad-exact-state').textContent,/Rebuilding/);
  exportError=true;
  await act(async()=>exportStep());
  assert.match(utils.getByRole('status', { name: 'Workspace status' }).textContent,/Native export failed.*Read-only/);
  assert.match(utils.container.querySelector('.cad-exact-state').textContent,/Rebuilding/);
  assert.equal(window.formCAD.getProjectFile(),before);
  await act(async()=>finishRebuild({meshes:[],topology:[],bodyMetrics:[],assemblyChecks:[],bodyCount:1,
    audit:{valid:true,solid:true,healed:false,volume:1000,surfaceArea:600,centerOfMass:{x:5,y:5,z:5},bounds:{xmin:0,ymin:0,zmin:0,xmax:10,ymax:10,zmax:10},
      topology:{solids:1,faces:6,edges:12,vertices:8},appliedFeatures:[],warnings:[]}}));
  assert.ok(utils.container.querySelector('.cad-exact-state').classList.contains('ready'),'pending rebuild response still owns its token');
});

test("invalid generic exact audits preserve the displayed body and block current-output claims", async (t) => {
  const raf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 0;
  t.after(() => { cleanup(); globalThis.requestAnimationFrame = raf; });
  const utils = await mount({ initialView: "model" });
  const worker = globalThis.__cadWorkers.at(-1);
  await waitFor(() => assert.ok(worker.messages.length));
  const request = worker.messages.at(-1);
  const mesh = { sourceId:"base-profile", positions:new Float32Array([0,0,0, 10,0,0, 0,10,0]),
    indices:new Uint32Array([0,1,2]), normals:new Float32Array([0,0,1,0,0,1,0,0,1]),
    faceGroups:new Int32Array([1]),faceTopologyIds:[],edgePositions:new Float32Array(),edgeGroups:new Int32Array(),edgeTopologyIds:[] };
  const audit = {valid:true,solid:true,healed:false,volume:1000,surfaceArea:600,centerOfMass:{x:5,y:5,z:5},
    bounds:{xmin:0,ymin:0,zmin:0,xmax:10,ymax:10,zmax:10},topology:{solids:1,faces:6,edges:12,vertices:8},appliedFeatures:[],warnings:[]};
  const deliver = result => act(async () => worker.onmessage({data:{token:request.token,ok:true,result}}));
  await deliver({meshes:[mesh],topology:[],bodyMetrics:[],assemblyChecks:[],audit});
  const visible = () => globalThis.__cadRenderers.flatMap(r=>r.disposed?[]:r.lastExactBodies??[]).map(m=>Array.from(m.geometry.attributes.position.array));
  await waitFor(()=>assert.ok(visible().length));
  const before=visible();
  for (const invalid of [{...audit,valid:false,warnings:["Invalid shell without feature diagnostics"]},{...audit,volume:NaN}]) {
    await deliver({meshes:[],topology:[],bodyMetrics:[],assemblyChecks:[],audit:invalid});
    assert.match(utils.getByRole("alert",{name:"Exact operation recovery"}).textContent,/Invalid shell|invalid measurements/);
    assert.equal(within(utils.getByRole("alert",{name:"Exact operation recovery"})).queryByRole("button",{name:"Suppress failing feature"}),null,"an unlocalized failure must not suppress a guessed feature");
    assert.match(utils.getByRole("status", { name: "Workspace status" }).textContent,/last valid body remains visible/);
    assert.deepEqual(visible(),before,"invalid response must not clear the displayed last valid mesh");
  }
  await deliver({meshes:[mesh],topology:[],bodyMetrics:[],assemblyChecks:[],audit});
  assert.equal(utils.queryByRole("alert",{name:"Exact operation recovery"}),null,"a valid retry clears recovery");
});

test("an exact body becomes a persistent linked creative copy with live modifiers", async (t) => {
  t.after(cleanup);
  const utils = await mount({ initialView: "model" });
  const worker = globalThis.__cadWorkers.at(-1);
  await waitFor(() => assert.ok(worker.messages.length > 0));
  const request = worker.messages.at(-1);
  const positions = new Float32Array([
    -5, -5, -5, 5, -5, -5, 5, 5, -5, -5, 5, -5,
    -5, -5, 5, 5, -5, 5, 5, 5, 5, -5, 5, 5,
  ]);
  const indices = new Uint32Array([
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7,
    0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5,
    2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7,
  ]);
  await act(async () => worker.onmessage({ data: {
    token: request.token,
    ok: true,
    result: {
      meshes: [{ sourceId: "base-profile", positions, indices, normals: new Float32Array(positions.length), faceGroups: new Int32Array(indices.length / 3), faceTopologyIds: [], edgePositions: new Float32Array(), edgeGroups: new Int32Array(), edgeTopologyIds: [] }],
      topology: [], bodyMetrics: [], assemblyChecks: [],
      audit: { valid: true, healed: false, solid: true, volume: 1000, surfaceArea: 600, centerOfMass: { x: 0, y: 0, z: 0 }, bounds: { xmin: -5, ymin: -5, zmin: -5, xmax: 5, ymax: 5, zmax: 5 }, topology: { solids: 1, faces: 6, edges: 12, vertices: 8 }, appliedFeatures: [], warnings: [] },
    },
  } }));

  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Modify" })));
  const modifyShelf = utils.getByRole("region", { name: "Modify tools features" });
  const creative = within(modifyShelf).getByRole("button", { name: /Creative copy.*Preserve exact source/i });
  assert.equal(creative.disabled, false);
  await act(async () => fireEvent.click(creative));
  assert.match(utils.getByRole("status", { name: "Workspace status" }).textContent, /Creative copy ready.*exact source preserved/i);
  assert.match(utils.getByText(/Linked creative copy/).textContent, /Linked creative copy/);

  const addModifier = utils.getByLabelText("Add a modifier");
  await act(async () => fireEvent.change(addModifier, { target: { value: "bend" } }));
  assert.equal(utils.getByText("HYBRID").textContent, "HYBRID");
  const saved = parseCadProject(window.formCAD.getProjectFile());
  assert.equal(saved.meshFeatures.length, 1);
  assert.equal(saved.meshFeatures[0].sourceExactEntityId, "base-profile");
  assert.ok(saved.meshFeatures[0].modifiers.some((modifier) => modifier.kind === "bend"));
});

test("Design Copilot previews supported products and clearly declines out-of-scope prompts", async (t) => {
  t.after(cleanup);
  const utils = await mount();
  const command = utils.getByLabelText("Precision CAD command");

  await act(async () => {
    fireEvent.change(command, { target: { value: "make me a dinosaur" } });
    fireEvent.keyDown(command, { key: "Enter" });
  });
  assert.match(utils.getByRole("status", { name: "Workspace status" }).textContent, /outside the verified product-design catalog|cannot yet meet/i);
  assert.equal(utils.queryByRole("dialog", { name: "Design Copilot editable plan" }), null);

  await act(async () => fireEvent.click(utils.getByText("Generators")));
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Exact part" })));
  const preview = utils.getByRole("dialog", { name: "Design Copilot editable plan" });
  assert.match(preview.textContent, /Exact .*model|constrained sketch/i);
  assert.ok(within(preview).getByRole("button", { name: "Apply design" }));

  await act(async () => fireEvent.click(within(preview).getByRole("button", { name: "Apply design" })));
  assert.equal(viewButton(utils, "2 Model").className, "active");
  assert.equal(utils.queryByRole("dialog", { name: "Design Copilot editable plan" }), null);
});

test("switching views moves the active view and swaps the visible viewport", async (t) => {
  t.after(cleanup);
  const utils = await mount();
  const canvas = utils.container.querySelector(".cad-canvas-wrap canvas");
  const viewport = utils.container.querySelector(".cad-3d");
  assert.equal(canvas.style.display, "block");
  assert.equal(viewport.style.display, "none");

  await act(async () => { fireEvent.click(viewButton(utils, "2 Model")); });
  assert.equal(viewButton(utils, "2 Model").className, "active");
  assert.equal(viewButton(utils, "1 Sketch").className, "");
  assert.equal(canvas.style.display, "none");
  assert.equal(viewport.style.display, "block");

  await act(async () => { fireEvent.click(viewButton(utils, "3 Document")); });
  assert.equal(viewButton(utils, "3 Document").className, "cad-specialist-tab active");
  assert.equal(viewButton(utils, "2 Model").className, "");
  assert.equal(canvas.style.display, "none", "Document has a dedicated sheet viewer rather than duplicated sketch projections");
  assert.equal(viewport.style.display, "none");
  const sheetActions = utils.getByRole("region", { name: "Document sheet actions" });
  assert.ok(within(sheetActions).getByRole("button", { name: "Export", exact: true }));
  let scrolledToSettings = false;
  utils.container.querySelector("#inspector-drafting").scrollIntoView = () => { scrolledToSettings = true; };
  await act(async () => fireEvent.click(within(sheetActions).getByRole("button", { name: "Sheet", exact: true })));
  await waitFor(() => assert.equal(scrolledToSettings, true));
});

test("new sketch linework appears in Model alongside exact bodies and follows Undo/Redo", async (t) => {
  const raf = globalThis.requestAnimationFrame;
  const pointerEvent = window.PointerEvent;
  globalThis.requestAnimationFrame = () => 0;
  window.PointerEvent = window.MouseEvent;
  t.after(() => { cleanup(); globalThis.requestAnimationFrame = raf; window.PointerEvent = pointerEvent; });
  const utils = await mount();
  const renderer = globalThis.__cadRenderers.at(-1);
  const worker = globalThis.__cadWorkers.find((item) => item.url.includes("cad-kernel"));
  await waitFor(() => assert.ok(worker.messages.length));
  const request = worker.messages.at(-1);
  await act(async () => worker.onmessage({ data: {
    token: request.token, ok: true,
    result: {
      meshes: [{ sourceId: "base-profile", positions: new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0]), indices: new Uint32Array([0, 1, 2]), normals: new Float32Array(9), faceGroups: new Int32Array(), faceTopologyIds: [], edgePositions: new Float32Array(), edgeGroups: new Int32Array(), edgeTopologyIds: [] }],
      topology: [], bodyMetrics: [], assemblyChecks: [],
      audit: { valid: true, healed: false, solid: true, volume: 1000, surfaceArea: 600, centerOfMass: { x: 0, y: 0, z: 0 }, bounds: { xmin: 0, ymin: 0, zmin: 0, xmax: 10, ymax: 10, zmax: 10 }, topology: { solids: 1, faces: 6, edges: 12, vertices: 8 }, appliedFeatures: [], warnings: [] },
    },
  } }));
  const before = parseCadProject(window.formCAD.getProjectFile());
  const canvas = utils.container.querySelector(".cad-canvas-wrap canvas");
  canvas.setPointerCapture = () => {};
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
  await act(async () => fireEvent.click(utils.getByTitle("Line")));
  await act(async () => fireEvent.pointerDown(canvas, { clientX: 500, clientY: 150, button: 0 }));
  await act(async () => fireEvent.pointerMove(canvas, { clientX: 650, clientY: 150, buttons: 1 }));
  await act(async () => fireEvent.pointerUp(canvas, { clientX: 650, clientY: 150 }));
  const after = parseCadProject(window.formCAD.getProjectFile());
  const added = after.entities.find((entity) => !before.entities.some((item) => item.id === entity.id));
  assert.ok(added, "pointer sketch creates a persisted entity");
  assert.deepEqual(after.features, before.features, "viewing a sketch does not create an extrusion");
  await act(async () => fireEvent.click(viewButton(utils, "2 Model")));
  assert.ok(renderer.lastExactBodies.length, "existing exact bodies remain visible");
  assert.ok(renderer.lastSketches.some((line) => line.userData.sourceEntityId === added.id), "new line is visible without waiting for the kernel or rAF");
  await waitFor(() => assert.equal(utils.getByTitle("Undo").disabled, false));
  await act(async () => fireEvent.click(utils.getByTitle("Undo")));
  assert.ok(!renderer.lastSketches.some((line) => line.userData.sourceEntityId === added.id));
  await act(async () => fireEvent.click(utils.getByTitle("Redo")));
  assert.ok(renderer.lastSketches.some((line) => line.userData.sourceEntityId === added.id));
});

test("Document view turns exact HLR and section output into a validated production sheet", async (t) => {
  t.after(cleanup);
  const raf = globalThis.requestAnimationFrame, pointerEvent = window.PointerEvent;
  globalThis.requestAnimationFrame = () => 0;
  window.PointerEvent = window.MouseEvent;
  t.after(() => { globalThis.requestAnimationFrame = raf; window.PointerEvent = pointerEvent; });
  const utils = await mount({ initialView: "sketch" });
  await act(async () => fireEvent.click(within(utils.getByRole("region", { name: "Sketch and vector tools" })).getByRole("button", { name: "Make 3D" })));
  await act(async () => fireEvent.click(viewButton(utils, "3 Document")));
  const worker = globalThis.__cadWorkers.at(-1);
  await waitFor(() => assert.ok(worker.messages.some((message) => message.format === "svg")));
  const request = worker.messages.findLast((message) => message.format === "svg");
  const orthographic = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" data-units-per-mm="1">${["Front", "Top", "Right", "Iso"].map((name) => `<g transform="translate(0 0)"><text>${name}</text><path d="M0 0L10 0L10 6L0 6L0 0"/></g>`).join("")}</svg>`;
  const section = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" data-units-per-mm="1"><text>Section A-A</text><path d="M0 0L8 0L8 6L0 6L0 0"/></svg>`;
  await act(async () => worker.onmessage({ data: {
    token: request.token,
    ok: true,
    result: {
      meshes: [], topology: [], bodyMetrics: [], assemblyChecks: [], data: orthographic, sectionSvg: section,
      audit: {
        valid: true, healed: false, solid: true, volume: 10, surfaceArea: 20,
        centerOfMass: { x: 5, y: 4, z: 3 },
        bounds: { xmin: 0, ymin: 0, zmin: 0, xmax: 10, ymax: 8, zmax: 6 },
        topology: { solids: 1, faces: 6, edges: 12, vertices: 8 },
        appliedFeatures: ["Extrude 6.000 mm"], warnings: [],
      },
    },
  } }));
  await waitFor(() => assert.ok(utils.container.querySelector(".form-document-paper")));
  const drawingRequestCount = worker.messages.length;
  await act(async () => new Promise((resolve) => setTimeout(resolve, 300)));
  assert.equal(worker.messages.length, drawingRequestCount, "a delayed mesh request cannot supersede the completed SVG request");
  assert.ok(utils.getByRole("button", { name: "Rebuild views" }), "completed views do not get stuck in Updating");
  const drawingText = utils.container.querySelector(".form-document-review-strip").title;
  assert.match(drawingText, /Structure passed/);
  assert.match(drawingText, /Review required/);
  assert.match(drawingText, /External approval required/);
  assert.doesNotMatch(drawingText, /PRODUCTION DRAWING QA PASSED/);
  assert.match(utils.container.querySelector(".form-document-paper svg").outerHTML, /data-form-drawing-version="2"/);
  await act(async () => fireEvent.keyDown(window, { key: " ", code: "Space" }));
  await act(async () => fireEvent.keyUp(window, { key: " ", code: "Space" }));
  assert.ok(within(utils.container.querySelector(".cad-tool-shelf")).getByRole("button", { name: /Export sheet/i }));
  await act(async () => fireEvent.click(within(utils.getByRole("region", { name: "Document sheet actions" })).getByRole("button", { name: "Export", exact: true })));
  assert.equal(within(utils.container.querySelector(".form-document-exports")).getByRole("button", { name: /Export sheet.*SVG/ }).disabled, false);
  const oldNativeFlag = globalThis.isTauri, oldNativeInternals = window.__TAURI_INTERNALS__;
  const nativeExports = [];
  let exportFailure = false;
  const projectBeforeExport = window.formCAD.getProjectFile();
  globalThis.isTauri = true;
  window.__TAURI_INTERNALS__ = { invoke: async (command, args) => {
    if (command === "save_drawing_export") {
      nativeExports.push(args);
      if (exportFailure) throw new Error("Disk full");
      return null;
    }
    return null;
  } };
  try {
    await act(async () => fireEvent.click(within(utils.container.querySelector(".form-document-exports")).getByRole("button", { name: /Export sheet.*SVG/ })));
    await waitFor(() => assert.ok(utils.getByText("Drawing export cancelled · project unchanged")));
    assert.match(nativeExports[0].contents, /data-form-drawing-version="2"/);
    assert.match(nativeExports[0].suggestedName, /production-rev-.*\.svg$/);
    exportFailure = true;
    await act(async () => fireEvent.click(within(utils.container.querySelector(".form-document-exports")).getByRole("button", { name: /Export sheet.*SVG/ })));
    await waitFor(() => assert.ok(utils.getByText("Drawing export failed · Disk full · project unchanged")));
    assert.equal(window.formCAD.getProjectFile(), projectBeforeExport, "cancelled/failed exports never dirty or alter the project");
  } finally { globalThis.isTauri = oldNativeFlag; window.__TAURI_INTERNALS__ = oldNativeInternals; }
  await act(async () => fireEvent.click(within(utils.getByRole("navigation", { name: "Document properties" })).getByRole("button", { name: "Annotate", exact: true })));
  // Place a view-linked note directly on paper. The exported SVG is the same SVG shown here.
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Place note" })));
  const paper = utils.container.querySelector(".form-document-paper");
  paper.getBoundingClientRect = () => ({ left: 0, top: 0, width: 420, height: 297 });
  await act(async () => fireEvent.pointerDown(paper, { button: 0, clientX: 110, clientY: 190 }));
  const book = parseCadProject(window.formCAD.getProjectFile()).drawingBook;
  assert.equal(book.sheets[0].annotations.length, 1);
  const note = book.sheets[0].annotations[0];
  assert.equal(note.view, "Front");
  await act(async () => fireEvent.change(utils.getByLabelText(`Note text ${note.id}`), { target: { value: "Deburr all edges" } }));
  assert.match(paper.querySelector("svg").outerHTML, /Deburr all edges/);
  const beforePaperUndo = worker.messages.length;
  await act(async () => fireEvent.click(utils.getByTitle("Undo")));
  assert.match(paper.querySelector("svg").outerHTML, /New note/);
  await act(async () => fireEvent.click(utils.getByTitle("Redo")));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 300)));
  assert.equal(worker.messages.length, beforePaperUndo, "paper-only Undo/Redo never rebuilds model geometry");
  assert.match(paper.querySelector("svg").outerHTML, /Deburr all edges/);
  await act(async () => fireEvent.click(within(utils.getByRole("navigation", { name: "Document properties" })).getByRole("button", { name: "Sheet", exact: true })));
  await act(async () => fireEvent.change(utils.getByLabelText("View X (mm)"), { target: { value: "100" } }));
  assert.match(paper.querySelector('[data-sheet-annotation]').innerHTML, /x="120" y="190"/);
  await act(async () => fireEvent.change(utils.getByLabelText("Paper size"), { target: { value: "A4" } }));
  assert.equal(paper.querySelector("svg").getAttribute("width"), "297mm");
  await act(async () => fireEvent.click(utils.getByText("Templates & sheet management")));
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Duplicate sheet" })));
  assert.equal(parseCadProject(window.formCAD.getProjectFile()).drawingBook.sheets.length, 2);
  await act(async () => fireEvent.click(utils.getByTitle("Undo")));
  assert.equal(parseCadProject(window.formCAD.getProjectFile()).drawingBook.sheets.length, 1);
  await act(async () => fireEvent.click(utils.getByTitle("Redo")));
  const savedBook = parseCadProject(window.formCAD.getProjectFile()).drawingBook;
  assert.equal(savedBook.sheets.length, 2);
  const scaleField = utils.getByLabelText("Drawing scale");
  const originalMetadata = JSON.parse(paper.querySelector("svg metadata").textContent);
  const originalViewWidth = Number(paper.querySelector('[data-sheet-view="Front"] rect').getAttribute("width"));
  await act(async () => fireEvent.change(scaleField, { target: { value: "2:1" } }));
  await act(async () => fireEvent.blur(scaleField));
  assert.equal(JSON.parse(paper.querySelector("svg metadata").textContent).metadata.scale, "2:1");
  const originalRatio = originalMetadata.metadata.scale.split(":").map(Number).reduce((a, b) => a / b);
  assert.ok(Math.abs(Number(paper.querySelector('[data-sheet-view="Front"] rect').getAttribute("width")) - 8 - (originalViewWidth - 8) * 2 / originalRatio) < 1e-8, "display/export geometry uses the selected sheet scale, not just the title block");
  await act(async () => fireEvent.click(utils.getByTitle("Undo")));
  assert.equal(JSON.parse(paper.querySelector("svg metadata").textContent).metadata.scale, originalMetadata.metadata.scale);
  assert.equal(Number(paper.querySelector('[data-sheet-view="Front"] rect').getAttribute("width")), originalViewWidth);
  await act(async () => fireEvent.click(within(utils.getByRole("navigation", { name: "Document properties" })).getByRole("button", { name: "Annotate", exact: true })));
  utils.container.querySelector(".form-sheet-legacy").open = true;
  assert.ok(utils.getAllByRole("button", { name: /Shop review|independent shop review/i }).length >= 1);
  assert.ok(utils.getByRole("button", { name: "New A3 paper-space layout" }));
  const saved = window.formCAD.getProjectFile();
  cleanup();
  const reopened = await mount({ initialView: "drawing", initialProjectContents: saved });
  assert.deepEqual(parseCadProject(window.formCAD.getProjectFile()).drawingBook, savedBook);
  assert.equal(reopened.getByLabelText("Paper size").value, "A4");
});

test("Clothing Lab links all and selected patterns to Document, updates live and survives project reopen", async (t) => {
  const raf = globalThis.requestAnimationFrame; globalThis.requestAnimationFrame = () => 0;
  t.after(() => { cleanup(); globalThis.requestAnimationFrame = raf; });
  const utils = await mount();
  await openFabricWorkspace(utils);
  await waitFor(() => assert.ok(utils.getByText("Patterns & measurements")));
  await act(async () => fireEvent.click(utils.getByText("T-shirt", { exact: true })));
  await act(async () => fireEvent.click(utils.getByLabelText("Send patterns to Document")));
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Send all patterns to Document" })));
  await waitFor(() => assert.ok(utils.container.querySelector(".form-document-paper svg")));
  let project = parseCadProject(window.formCAD.getProjectFile());
  assert.equal(project.drawingBook.sheets.length, 2);
  assert.equal(project.drawingBook.sheets[1].source.kind, "fabric");
  assert.match(utils.container.querySelector(".form-document-paper").textContent, /CUT 1/);
  assert.equal(utils.getByLabelText("Linked drawing scale").value, project.drawingBook.sheets[1].scale);
  await openFabricWorkspace(utils);
  await waitFor(() => assert.ok(utils.getByText("Patterns & measurements")));
  await act(async () => fireEvent.change(within(utils.getByText("Selected pattern piece").closest("section")).getByLabelText("Name", { exact: true }), { target: { value: "Revised front" } }));
  await act(async () => fireEvent.click(utils.getByLabelText("Send patterns to Document")));
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Send all patterns to Document" })));
  assert.match(utils.container.querySelector(".form-document-paper").textContent, /Revised front/);
  assert.equal(parseCadProject(window.formCAD.getProjectFile()).drawingBook.sheets.length, 2, "relink selects the existing authored sheet");
  const garment = formWorkspace(parseProject(window.formCAD.getProjectFile()), "fabric").data;
  await act(async () => fireEvent.change(utils.getByLabelText("Add linked content"), { target: { value: JSON.stringify({ kind: "fabric", id: garment.id, itemId: garment.pieces[0].id }) } }));
  assert.equal(parseCadProject(window.formCAD.getProjectFile()).drawingBook.sheets.length, 3);
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Undo", exact: true })));
  assert.equal(parseCadProject(window.formCAD.getProjectFile()).drawingBook.sheets.length, 2);
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Redo", exact: true })));
  const saved = window.formCAD.getProjectFile(); project = parseCadProject(saved);
  assert.equal(project.drawingBook.sheets.length, 3);
  cleanup();
  const reopened = await mount({ initialView: "drawing", initialProjectContents: saved });
  assert.deepEqual(parseCadProject(window.formCAD.getProjectFile()).drawingBook, project.drawingBook);
  await act(async () => fireEvent.change(reopened.getByLabelText("Add linked content"), { target: { value: JSON.stringify({ kind: "fabric", id: garment.id, itemId: garment.pieces[0].id }) } }));
  assert.match(reopened.container.querySelector(".form-document-paper").textContent, /Revised front/);
  cleanup();
  window.localStorage.setItem("form-cad-project", saved);
  let resumed;
  await act(async () => { resumed = render(createElement(CadWorkspace, { onClose: () => {}, initialView: "drawing" })); });
  assert.equal(formWorkspace(parseProject(window.formCAD.getProjectFile()), "fabric").data.id, garment.id, "local restart restores the linked garment, not just CAD");
  assert.equal(parseProject(window.formCAD.getProjectFile()).projectId, parseProject(saved).projectId);
  await act(async () => fireEvent.change(resumed.getByLabelText("Add linked content"), { target: { value: JSON.stringify({ kind: "fabric", id: garment.id, itemId: garment.pieces[0].id }) } }));
  assert.match(resumed.container.querySelector(".form-document-paper").textContent, /Revised front/);
});

test("Document links a sketch without an exact solid and preserves it through undo", async (t) => {
  const raf = globalThis.requestAnimationFrame; globalThis.requestAnimationFrame = () => 0;
  t.after(() => { cleanup(); globalThis.requestAnimationFrame = raf; });
  const utils = await mount({ initialView: "drawing" });
  await act(async () => fireEvent.change(utils.getByLabelText("Add linked content"), { target: { value: JSON.stringify({ kind: "sketch", id: "world-xy" }) } }));
  assert.match(utils.container.querySelector(".form-document-paper").textContent, /LIVE SKETCH/);
  assert.equal(parseCadProject(window.formCAD.getProjectFile()).drawingBook.sheets.length, 2);
  await act(async () => fireEvent.click(within(utils.getByRole("region", { name: "Document sheet actions" })).getByRole("button", { name: "Export", exact: true })));
  assert.equal(within(utils.container.querySelector(".form-document-exports")).getByRole("button", { name: /Export sheet.*SVG/ }).disabled, false);
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Undo", exact: true })));
  assert.equal(parseCadProject(window.formCAD.getProjectFile()).drawingBook.sheets.length, 1);
});

test("Document properties edit sheet metadata without exposing modeling controls", async (t) => {
  t.after(cleanup);
  const raf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 0;
  t.after(() => { globalThis.requestAnimationFrame = raf; });
  const utils = await mount({ initialView: "drawing" });
  const before = parseCadProject(window.formCAD.getProjectFile());
  const errors = [];
  const onError = (event) => errors.push(event.error);
  window.addEventListener("error", onError);
  t.after(() => window.removeEventListener("error", onError));
  assert.equal(utils.container.querySelector("#inspector-geometry"), null);
  await act(async () => fireEvent.keyDown(window, { key: "Delete" }));
  assert.deepEqual(errors, [], "window-targeted keyboard events must not throw");
  assert.deepEqual(parseCadProject(window.formCAD.getProjectFile()).entities, before.entities, "Delete in Document must not remove a hidden model selection");
  assert.equal(utils.queryByRole("heading", { name: "Feature history" }), null);
  assert.equal(utils.queryByText("Select a body to move it, or switch to Face to push and pull."), null);
  await act(async () => fireEvent.change(utils.getByLabelText("Drawing revision"), { target: { value: "b" } }));
  const revised = parseCadProject(window.formCAD.getProjectFile());
  assert.equal(revised.drawingRevision, "B");
  assert.deepEqual(revised.entities, before.entities);
  assert.deepEqual(revised.features, before.features);
  await waitFor(() => assert.equal(utils.getByTitle("Undo").disabled, false));
  await act(async () => fireEvent.click(utils.getByTitle("Undo")));
  assert.equal(utils.getByLabelText("Drawing revision").value, before.drawingRevision);
  const nav = utils.getByRole("navigation", { name: "Document properties" });
  await act(async () => fireEvent.click(within(nav).getByRole("button", { name: "Review", exact: true })));
  assert.ok(utils.getByRole("heading", { name: "Review before release" }));
  assert.equal(utils.getByRole("button", { name: "Export shop review" }).disabled, true);
  await act(async () => fireEvent.click(within(nav).getByRole("button", { name: "Annotate", exact: true })));
  utils.container.querySelector(".form-sheet-legacy").open = true;
  assert.ok(utils.getByLabelText("Annotation source"));
  assert.match(utils.getByText(/Model-space XY notes, linear dimensions/).textContent, /can sync/);
});

test("Document sheet navigation, zoom, fit and output act on the active drawing", async (t) => {
  t.after(cleanup);
  const pointerEvent = window.PointerEvent;
  window.PointerEvent = window.MouseEvent;
  t.after(() => { window.PointerEvent = pointerEvent; });
  const { default: CadDocumentWorkspace } = await import("../app/cad-document-workspace.tsx");
  const { useState } = await import("react");
  const calls = [];
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 297"><rect width="420" height="297" fill="white"/><g data-sheet-view="Front"><rect width="10" height="10"/></g></svg>';
  function Harness() {
    const [activeId, setActiveId] = useState("production");
    return createElement(CadDocumentWorkspace, {
      sheets: [{ id: "production", title: "Production drawing", detail: "A3", svg }, { id: "plan", title: "Ground plan", detail: "Floor plan", svg }],
      activeId, onSelect: setActiveId, onPanel: (panel) => calls.push(panel), onPrint: () => calls.push(`print:${activeId}`), onExport: () => calls.push(`export:${activeId}`),
      onRebuild: () => calls.push("rebuild"), building: false, error: false, empty: false, review: "External review required",
      placement: "move", onMove: (view, dx, dy) => calls.push([view, dx, dy]), onPlace: (x, y) => calls.push([x, y]),
    });
  }
  const utils = render(createElement(Harness));
  const paper = utils.container.querySelector(".form-document-paper");
  const fitWidth = paper.style.width;
  await act(async () => fireEvent.change(utils.getByLabelText("Sheet zoom level"), { target: { value: "150" } }));
  assert.equal(paper.style.width, "1680px");
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Fit sheet" })));
  assert.equal(paper.style.width, fitWidth);
  await act(async () => fireEvent.click(utils.getByRole("button", { name: /Ground plan/ })));
  assert.equal(utils.getByRole("button", { name: /Ground plan/ }).getAttribute("aria-current"), "page");
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Export", exact: true })));
  // Output format selection lives in the parent document inspector.
  assert.deepEqual(calls, ["export"]);
  paper.getBoundingClientRect = () => ({ left: 0, top: 0, width: 840, height: 594 });
  await act(async () => fireEvent.pointerDown(paper.querySelector('[data-sheet-view] rect'), { button: 0, pointerId: 1, clientX: 10, clientY: 10 }));
  await act(async () => fireEvent.pointerMove(paper, { pointerId: 1, clientX: 50, clientY: 30 }));
  await act(async () => fireEvent.pointerUp(paper, { pointerId: 1, clientX: 50, clientY: 30 }));
  assert.deepEqual(calls.at(-1), ["Front", 20, 10], "drag uses paper millimeters and commits once on release");
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Toggle sheets", exact: true })));
  assert.equal(utils.queryByRole("complementary", { name: "Drawing sheets" }), null);
});

test("the shipping model view exposes persistent PBR appearance controls", async (t) => {
  t.after(cleanup);
  const utils = await mount();
  await act(async () => fireEvent.click(viewButton(utils, "2 Model")));

  assert.ok(utils.getByText("Appearance Studio"));
  const brass = utils.getByRole("button", { name: "Polished brass" });
  assert.equal(brass.getAttribute("aria-pressed"), "false");
  await act(async () => fireEvent.click(brass));
  assert.equal(brass.getAttribute("aria-pressed"), "true");
  assert.match(utils.getByRole("status", { name: "Workspace status" }).textContent, /Polished brass applied/i);
  assert.ok(utils.getAllByRole("button", { name: "Render PNG" }).length >= 1);
});

test("the desktop render workspace exposes official OpenVDB density and fire import", async (t) => {
  t.after(cleanup);
  const utils = await mount();
  await act(async () => fireEvent.click(viewButton(utils, "2 Model")));

  const panel = utils.container.querySelector(".cad-volume-panel");
  assert.ok(panel, "sparse volume panel rendered");
  assert.match(panel.textContent, /Sparse volumes/i);
  assert.ok(within(panel).getByRole("button", { name: "Import .vdb" }));
  assert.equal(utils.container.querySelector('input[accept*=".vdb"]')?.type, "file");
  assert.match(panel.textContent, /Official native OpenVDB · density \+ fire temperature/);
});

test("the desktop performance workflow exposes native rigid and deformable solvers honestly", async (t) => {
  t.after(cleanup);
  const utils = await mount();
  await act(async () => fireEvent.click(utils.getByRole("tab", { name: /Scale/i })));
  const deformable = utils.getByRole("button", { name: "Deformables require desktop app" });
  const rigid = utils.getByRole("button", { name: "Native engine available in desktop app" });
  const material = utils.getByLabelText("Deformable material");
  const resolution = utils.getByLabelText("Deformable lattice resolution");
  await act(async () => { fireEvent.change(material, { target: { value: "gel" } }); fireEvent.change(resolution, { target: { value: "4" } }); });
  assert.equal(material.value, "gel");
  assert.match(utils.container.querySelector(".cad-deformable-controls").textContent, /125 particles · 384 tetrahedra/);
  assert.equal(deformable.disabled, false, "web users can click for an explanatory status instead of seeing a fake solve");
  assert.equal(rigid.disabled, false);
  await act(async () => fireEvent.click(deformable));
  assert.match(utils.getByRole("status", { name: "Workspace status" }).textContent, /Native deformable simulation is available in the standalone application/i);
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Run production CAD self-test" })));
  await waitFor(() => assert.match(utils.getByLabelText("Production CAD benchmark result").textContent, /PRODUCTION GATE PASSED/), { timeout: 5_000 });
});

test("spoken component selection, marquee, and selection extrusion are wired into the workspace", async (t) => {
  t.after(cleanup);
  const utils = await mount();
  await act(async () => fireEvent.click(viewButton(utils, "2 Model")));

  const sculpt = utils.container.querySelector(".cad-sculpt-section");
  assert.ok(sculpt, "sculpt panel rendered");
  await act(async () => fireEvent.click(within(sculpt).getByRole("button", { name: "Box" })));

  const command = utils.getByLabelText("Precision CAD command");
  await act(async () => fireEvent.change(command, { target: { value: "select all edges" } }));
  await act(async () => fireEvent.keyDown(command, { key: "Enter" }));
  assert.match(utils.getByRole("status", { name: "Workspace status" }).textContent, /\d+ edges selected/i);

  const marquee = utils.getByRole("button", { name: "Marquee select" });
  assert.equal(marquee.disabled, false);
  await act(async () => fireEvent.click(marquee));
  assert.match(marquee.className, /active/);
  assert.match(utils.getByRole("status", { name: "Workspace status" }).textContent, /Marquee select.*drag/i);
  await act(async () => fireEvent.keyUp(window, { key: "Escape" }));
  assert.doesNotMatch(marquee.className, /active/);

  await act(async () => fireEvent.change(command, { target: { value: "extrude all in selection by 6 mm" } }));
  const beforePreview = window.formCAD.getProjectFile();
  await act(async () => fireEvent.keyDown(command, { key: "Enter" }));
  assert.match(utils.getByRole("status", { name: "Workspace status" }).textContent, /Preview extrude/);
  assert.deepEqual(parseCadProject(window.formCAD.getProjectFile()).meshFeatures, parseCadProject(beforePreview).meshFeatures, "preview never changes saved geometry");
  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Apply mesh edit" })));
  assert.match(utils.getByRole("status", { name: "Workspace status" }).textContent, /Pushed 6 cage face\(s\) by 6/i);
});

test("selection-first controls apply a saved weighted modifier and Undo removes it", async (t) => {
  const prototype = dom.window.HTMLCanvasElement.prototype;
  const oldWidth = Object.getOwnPropertyDescriptor(prototype, "clientWidth");
  const oldHeight = Object.getOwnPropertyDescriptor(prototype, "clientHeight");
  Object.defineProperty(prototype, "clientWidth", { configurable: true, get: () => 1000 });
  Object.defineProperty(prototype, "clientHeight", { configurable: true, get: () => 700 });
  t.after(() => {
    cleanup();
    if (oldWidth) Object.defineProperty(prototype, "clientWidth", oldWidth); else delete prototype.clientWidth;
    if (oldHeight) Object.defineProperty(prototype, "clientHeight", oldHeight); else delete prototype.clientHeight;
  });
  const utils = await mount({ initialView: "model" });
  await act(async () => fireEvent.click(within(utils.container.querySelector(".cad-sculpt-section")).getByRole("button", { name: "Box" })));
  const toolbar = within(utils.getByRole("navigation", { name: "Creative selection tools" }));
  await act(async () => fireEvent.click(toolbar.getByRole("button", { name: "Ellipse" })));
  assert.match(utils.getByRole("status", { name: "Workspace status" }).textContent, /Ellipse select/);
  await act(async () => fireEvent.keyUp(window, { key: "Escape" }));
  await act(async () => fireEvent.click(toolbar.getByRole("button", { name: "Brush", exact: true })));
  assert.ok(utils.container.querySelector(".form-selection-brush-cursor"));
  await waitFor(() => assert.ok(utils.getByLabelText("Selection brush radius")));
  await act(async () => fireEvent.change(utils.getByLabelText("Selection brush radius"), { target: { value: "80" } }));
  assert.equal(utils.getByLabelText("Selection brush radius").value, "80");
  const command = utils.getByLabelText("Precision CAD command");
  await act(async () => { fireEvent.change(command, { target: { value: "select all vertices" } }); });
  await act(async () => fireEvent.keyDown(command, { key: "Enter" }));
  const hud = within(utils.getByRole("region", { name: "Selection manipulation" }));
  await act(async () => fireEvent.click(hud.getByRole("button", { name: "move", exact: true })));
  await act(async () => fireEvent.click(hud.getByRole("button", { name: "Apply move" })));
  await waitFor(() => {
    const feature = parseCadProject(window.formCAD.getProjectFile()).meshFeatures[0];
    assert.equal(feature.modifiers.at(-1).kind, "selection");
    assert.equal(feature.modifiers.at(-1).operation, "move");
    assert.ok(feature.modifiers.at(-1).weights.some((w) => w === 1));
  });
  await act(async () => fireEvent.click(utils.getByTitle("Undo")));
  await waitFor(() => assert.ok(!parseCadProject(window.formCAD.getProjectFile()).meshFeatures[0].modifiers.some((m) => m.kind === "selection")));
  await act(async () => fireEvent.click(utils.getByTitle("Redo")));
  await waitFor(() => assert.equal(parseCadProject(window.formCAD.getProjectFile()).meshFeatures[0].modifiers.at(-1).kind, "selection"));
});

test("selection brush pointer cancellation restores the mask and wheel changes settings", async (t) => {
  const { installSelectionBrush } = await import("../app/viewport-selection-brush.ts");
  const THREE = await import("three");
  const host = document.createElement("div");
  const canvas = document.createElement("canvas"); host.appendChild(canvas); document.body.appendChild(host);
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
  const captures = new Set();
  canvas.setPointerCapture = (id) => captures.add(id);
  canvas.hasPointerCapture = (id) => captures.has(id);
  canvas.releasePointerCapture = (id) => captures.delete(id);
  const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100); camera.position.z = 10; camera.updateMatrixWorld();
  const orbit = { enabled: true };
  const input = { brush: { radius: 50, strength: 0.5, falloff: 0.5, through: true }, target: { meshId: "test", surface: { positions: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], faces: [[0, 1, 2]] }, worldMatrix: new THREE.Matrix4().toArray() }, weights: [], onChange: (weights) => { input.weights = weights; }, onSettings: (brush) => { input.brush = brush; } };
  const dispose = installSelectionBrush(canvas, () => input, () => camera, () => [], orbit, () => false);
  t.after(() => { dispose(); host.remove(); });
  const pointer = (type) => { const event = new dom.window.MouseEvent(type, { clientX: 50, clientY: 50, button: 0, bubbles: true }); Object.defineProperty(event, "pointerId", { value: 1 }); canvas.dispatchEvent(event); };
  pointer("pointerdown");
  assert.equal(orbit.enabled, false);
  assert.ok(input.weights.some((w) => w > 0));
  pointer("pointercancel");
  assert.deepEqual(input.weights, []);
  assert.equal(orbit.enabled, true);
  assert.equal(captures.size, 0);
  canvas.dispatchEvent(new dom.window.WheelEvent("wheel", { deltaY: -1, cancelable: true }));
  assert.equal(input.brush.radius, 54);
  pointer("pointerdown"); pointer("pointerup");
  assert.equal(orbit.enabled, true);
  assert.ok(input.weights.some((w) => w > 0));
});

test("the feature tree lists the model's features and reacts to edits", async (t) => {
  t.after(cleanup);
  const utils = await mount();
  const list = utils.container.querySelector(".cad-feature-list");
  assert.ok(list, "feature history list rendered");

  const featureNames = () => [...list.querySelectorAll(":scope > div > span")].map((node) => node.textContent);
  assert.deepEqual(featureNames(), ["Extrude", "Fillet", "Cut"]);
  assert.match(utils.container.querySelector(".cad-feature-summary").textContent, /3 active \/ 3/);

  const cutRow = [...list.querySelectorAll(":scope > div")]
    .find((row) => row.querySelector("span")?.textContent === "Cut");
  await act(async () => {
    fireEvent.click(within(cutRow).getByTitle("Delete"));
  });
  assert.deepEqual(featureNames(), ["Extrude", "Fillet"]);
  assert.match(utils.container.querySelector(".cad-feature-summary").textContent, /2 active \/ 2/);
});

test("undo is disabled until the model changes, then restores the previous state", async (t) => {
  t.after(cleanup);
  const utils = await mount();
  const undo = utils.getByTitle("Undo");
  const redo = utils.getByTitle("Redo");
  assert.equal(undo.disabled, true, "no history yet");
  assert.equal(redo.disabled, true);

  const list = utils.container.querySelector(".cad-feature-list");
  const featureCount = () => list.querySelectorAll(":scope > div").length;
  assert.equal(featureCount(), 3);

  await act(async () => {
    fireEvent.click(within(utils.container.querySelector(".cad-feature-buttons")).getByText("Revolve"));
  });
  assert.equal(featureCount(), 4);
  assert.equal(utils.getByTitle("Undo").disabled, false, "undo enabled after an edit");

  await act(async () => { fireEvent.click(utils.getByTitle("Undo")); });
  assert.equal(featureCount(), 3);
  assert.equal(utils.getByTitle("Redo").disabled, false, "redo available after undoing");

  await act(async () => { fireEvent.click(utils.getByTitle("Redo")); });
  assert.equal(featureCount(), 4);
});

test("the BIM workspace edits a connected graph and opens coordinated documents", async (t) => {
  t.after(cleanup);
  const utils = await mount();
  await act(async () => { fireEvent.click(within(utils.container.querySelector(".cad-pro-tabs")).getByRole("tab", { name: /BIM/ })); });
  assert.match(utils.container.querySelector(".cad-bim-audit").textContent, /0 errors/);
  assert.match(utils.container.querySelector(".cad-bim-summary").textContent, /1\s*levels/);
  assert.match(utils.container.querySelector(".cad-bim-readiness").textContent, /Ready for IFC4 export/);
  assert.match(utils.container.querySelector(".cad-bim-readiness").textContent, /100% geometry/);
  assert.equal(utils.getByRole("button", { name: "Export IFC4" }).disabled, false);

  await act(async () => { fireEvent.click(utils.getByRole("button", { name: "Add level" })); });
  assert.match(utils.container.querySelector(".cad-bim-summary").textContent, /2\s*levels/);
  assert.equal(utils.container.querySelectorAll(".cad-bim-documents > button").length, 4);

  await act(async () => { fireEvent.click(utils.container.querySelector(".cad-bim-documents > button")); });
  assert.ok(utils.container.querySelector(".form-document-paper"), "generated plan opens in editable Document view");
  assert.match(utils.container.querySelector(".form-document-paper").textContent, /COORDINATION ONLY/);
  await act(async () => fireEvent.change(utils.getByLabelText("Paper size"), { target: { value: "A2" } }));
  await act(async () => fireEvent.change(utils.getByLabelText("BIM drawing scale"), { target: { value: "1:50" } }));
  const authored = parseCadProject(window.formCAD.getProjectFile()).drawingBook.sheets.find((s) => s.source);
  assert.equal(authored.paper, "A2"); assert.equal(authored.scale, "1:50");

  await act(async () => { fireEvent.click(viewButton(utils, "3 Document")); });
  assert.equal(utils.queryByLabelText("BIM drawing scale"), null, "top-level Document button returns to the production drawing");
  assert.equal(viewButton(utils, "3 Document").className, "cad-specialist-tab active");
});

test("unmounting tears down the worker and the renderer", async (t) => {
  t.after(cleanup);
  const utils = await mount();
  const renderer = globalThis.__cadRenderers.at(-1);
  const worker = globalThis.__cadWorkers.at(-1);
  await act(async () => { utils.unmount(); });
  assert.equal(worker.terminated, true, "kernel worker terminated on unmount");
  assert.equal(renderer.disposed, true, "renderer disposed on unmount");
});

const viewportBar = (utils) => utils.container.querySelector(".cad-viewport-bar");
const shadingButton = (utils, label) => [...utils.container.querySelectorAll(".cad-shading-switch button")]
  .find((button) => button.textContent === label);

test("the viewport dial is only offered in the model view", async (t) => {
  t.after(cleanup);
  const utils = await mount();
  assert.equal(viewportBar(utils), null, "no viewport dial while sketching");

  await act(async () => { fireEvent.click(viewButton(utils, "2 Model")); });
  assert.ok(viewportBar(utils), "the model view exposes the dial");
  assert.equal(utils.container.querySelectorAll(".cad-standard-views button").length, 7);

  await act(async () => { fireEvent.click(viewButton(utils, "3 Document")); });
  assert.equal(viewportBar(utils), null, "no viewport dial in the drawing view");
});

test("shading runs technical to rendered, and drives the projection with it", async (t) => {
  t.after(cleanup);
  const utils = await mount();
  await act(async () => { fireEvent.click(viewButton(utils, "2 Model")); });

  const projection = () => utils.container.querySelector(".cad-projection-toggle");
  // Shaded is the default working mode and is perspective.
  assert.equal(shadingButton(utils, "Shaded").className, "active");
  assert.equal(projection().textContent, "Persp");

  // Technical is the CAD end of the dial: it swings the camera to orthographic.
  await act(async () => { fireEvent.click(shadingButton(utils, "Technical")); });
  assert.equal(shadingButton(utils, "Technical").className, "active");
  assert.equal(shadingButton(utils, "Shaded").className, "");
  assert.equal(projection().textContent, "Ortho");

  // Rendered is the DCC end and returns to perspective.
  await act(async () => { fireEvent.click(shadingButton(utils, "Rendered")); });
  assert.equal(projection().textContent, "Persp");
});

test("pinning the projection keeps it across a shading change", async (t) => {
  t.after(cleanup);
  const utils = await mount();
  await act(async () => { fireEvent.click(viewButton(utils, "2 Model")); });

  const projection = () => utils.container.querySelector(".cad-projection-toggle");
  assert.ok(!projection().className.includes("pinned"), "projection starts unpinned");

  await act(async () => { fireEvent.click(projection()); });
  assert.equal(projection().textContent, "Ortho");
  assert.ok(projection().className.includes("pinned"));

  // Rendered would normally be perspective; the pin must win.
  await act(async () => { fireEvent.click(shadingButton(utils, "Rendered")); });
  assert.equal(projection().textContent, "Ortho", "a pinned projection survives the mode change");
});

test("standard views can be driven by click and by number key", async (t) => {
  t.after(cleanup);
  const utils = await mount();
  await act(async () => { fireEvent.click(viewButton(utils, "2 Model")); });
  const status = () => utils.container.querySelector(".cad-status").textContent;

  const topButton = [...utils.container.querySelectorAll(".cad-standard-views button")]
    .find((button) => button.title.startsWith("Top"));
  await act(async () => { fireEvent.click(topButton); });
  assert.match(status(), /Top view/);

  // The same framing is reachable from the keyboard, as in CAD and DCC tools.
  await act(async () => { fireEvent.keyDown(window, { key: "1" }); });
  assert.match(status(), /Front view/);
});

test("typing a number into a field does not reframe the camera", async (t) => {
  t.after(cleanup);
  const utils = await mount();
  await act(async () => { fireEvent.click(viewButton(utils, "2 Model")); });
  await act(async () => { fireEvent.keyDown(window, { key: "5" }); });
  assert.match(utils.container.querySelector(".cad-status").textContent, /Top view/);

  const field = utils.container.querySelector("input");
  assert.ok(field, "expected an input to type into");
  await act(async () => { fireEvent.keyDown(field, { key: "1" }); });
  assert.match(
    utils.container.querySelector(".cad-status").textContent,
    /Top view/,
    "a keystroke inside an input must not be read as a view shortcut",
  );
});

test("Cast checks a selected mesh and an opened STL without editing the project, and exports a binary STL", async (t) => {
  t.after(cleanup);
  const { castMeshFromBuffers, writeBinaryStl } = await import("../app/cast-mesh.ts");
  const { ringInnerDiameter } = await import("../app/cad-jewelry.ts");
  const utils = await mount({ initialView: "model" });
  await act(async () => fireEvent.click(within(utils.container.querySelector(".cad-sculpt-section")).getByRole("button", { name: "Box" })));
  const before = window.formCAD.getProjectFile();

  await act(async () => fireEvent.click(utils.getByRole("button", { name: "Open Cast print and cast prep" })));
  const dialog = within(utils.getByRole("dialog", { name: "Cast print and cast prep" }));
  assert.match(dialog.getByLabelText("Model to check").selectedOptions[0].textContent, /mesh$/);
  await act(async () => fireEvent.click(dialog.getByRole("button", { name: "Mesh health" })));
  assert.ok(dialog.getByText("Closed and consistently wound"));
  assert.ok(dialog.getByText(/Sterling silver/, { selector: "th" }));

  // A US 7 band, 1.6 mm wall, as a binary STL from disk.
  const r = ringInnerDiameter("US", 7) / 2, segments = 128, positions = [], indices = [];
  for (let k = 0; k < segments; k += 1) {
    const a = (k / segments) * Math.PI * 2;
    for (const [radius, z] of [[r, -2], [r + 1.6, -2], [r + 1.6, 2], [r, 2]]) positions.push(radius * Math.cos(a), radius * Math.sin(a), z);
  }
  const v = (k, c) => (k % segments) * 4 + c, quad = (a, b, c, d) => indices.push(a, b, c, a, c, d);
  for (let k = 0; k < segments; k += 1) {
    quad(v(k, 1), v(k + 1, 1), v(k + 1, 2), v(k, 2)); quad(v(k, 0), v(k, 3), v(k + 1, 3), v(k + 1, 0));
    quad(v(k, 3), v(k, 2), v(k + 1, 2), v(k + 1, 3)); quad(v(k, 0), v(k + 1, 0), v(k + 1, 1), v(k, 1));
  }
  const stl = writeBinaryStl(castMeshFromBuffers(positions, indices));
  const file = new File([stl], "band.stl", { type: "model/stl" });
  if (!file.arrayBuffer) file.arrayBuffer = async () => stl;
  await act(async () => fireEvent.change(dialog.getByLabelText("Choose STL or OBJ for Cast"), { target: { files: [file] } }));
  await waitFor(() => assert.match(dialog.getByLabelText("Model to check").selectedOptions[0].textContent, /band · file/));

  await act(async () => fireEvent.click(dialog.getByRole("button", { name: "Ring size" })));
  assert.ok(dialog.getByText(/Opening ≈ 17\.3\d mm/));
  assert.ok(dialog.getByText(/US 7 \(17\.32 mm\)/));
  assert.ok(dialog.getByText(/within 0\.1 mm/));

  await act(async () => fireEvent.click(dialog.getByRole("button", { name: "Thickness" })));
  await act(async () => fireEvent.click(dialog.getByRole("button", { name: "Run thickness check" })));
  await waitFor(() => assert.ok(dialog.getByText(/Thinnest ≈ 1\.\d\d mm/)), { timeout: 10000 });
  assert.match(dialog.getByText(/Thinnest/).textContent, /1\.(59|60)/);

  const blobs = [];
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  t.after(() => { URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; });
  URL.createObjectURL = (blob) => { blobs.push(blob); return "blob:cast-test"; };
  URL.revokeObjectURL = () => {};
  await act(async () => fireEvent.click(dialog.getByRole("button", { name: "Resin print" })));
  assert.ok(dialog.getByRole("heading", { name: /mm² needs support/ }));
  await act(async () => fireEvent.click(dialog.getByRole("button", { name: "Export prepared STL" })));
  assert.equal(blobs.length, 1);
  assert.equal(blobs[0].size, 84 + segments * 8 * 50, "binary STL with every triangle");

  await act(async () => fireEvent.keyDown(utils.getByRole("dialog", { name: "Cast print and cast prep" }), { key: "Escape" }));
  assert.equal(utils.queryByRole("dialog", { name: "Cast print and cast prep" }), null);
  assert.equal(window.formCAD.getProjectFile(), before, "Cast reviews a copy; the document is unchanged");
});
