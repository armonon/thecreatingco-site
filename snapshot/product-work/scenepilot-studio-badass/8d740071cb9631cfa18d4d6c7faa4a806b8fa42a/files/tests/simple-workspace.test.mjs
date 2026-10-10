import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  stdin: { contents: 'export { WorkspaceModebar } from "./app/workspace-modebar"; export { TimelineToolbar } from "./app/timeline-toolbar"; export { StudioTopbar } from "./app/studio-topbar";', resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, platform: "node", format: "esm", jsx: "automatic", logLevel: "silent",
  plugins: [{ name: "workspace-preferences", setup(builder) {
    builder.onResolve({ filter: /^\.\/studio-shell$/ }, () => ({ path: "shell", namespace: "test" }));
    builder.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents: "export const useFullWorkspaceControls=()=>globalThis.__simple.full; export const useTimelineVisibility=()=>globalThis.__simple.visibility; export const WorkspaceLayoutControls=()=>null;" }));
  } }],
});
const { WorkspaceModebar, TimelineToolbar, StudioTopbar } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`);
function nodes(value) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  return [value, ...nodes(value.props?.children)];
}
function text(value) {
  if (value == null || typeof value === "boolean") return "";
  if (Array.isArray(value)) return value.map(text).join("");
  return typeof value === "object" ? text(value.props?.children) : String(value);
}
const button = (tree, label) => nodes(tree).find(n => n.type === "button" && text(n).trim() === label);

test("Simple navigation keeps every studio reachable with the same callbacks", () => {
  const opened = [];
  globalThis.__simple = { full: false };
  const props = { workspace: "edit", isPro: true, guide: {}, onOpen: id => opened.push(id) };
  const simple = WorkspaceModebar(props);
  const menu = nodes(simple).find(n => n.props?.className === "workspace-more");
  assert.equal(menu.props.label, "Tools");
  for (const id of ["composition", "color", "audio", "deliver"]) {
    const action = nodes(menu).find(n => n.type === "button" && n.props.onClick && n.props.title === ({ composition:"Compositions + keyframes", color:"Grade + scopes", audio:"Mix + automate", deliver:"Queue + export" })[id]);
    assert.ok(action); action.props.onClick();
  }
  assert.deepEqual(opened, ["composition", "color", "audio", "deliver"]);
  globalThis.__simple.full = true;
  assert.equal(nodes(WorkspaceModebar(props)).filter(n => n.props?.className === "workspace-more").length, 0);
  globalThis.__simple.full = false;
  const liteMenu = nodes(WorkspaceModebar({ ...props, isPro:false })).find(n => n.props?.className === "workspace-more");
  assert.ok(nodes(liteMenu).filter(n => n.type === "button").every(n => n.props.disabled));
  delete globalThis.__simple;
});

test("Add track reveals unused lanes before creating a track; edit commands stay wired", () => {
  const calls = [];
  globalThis.__simple = { full:false, visibility:{ showEmpty:false, reveal:()=>calls.push("reveal"), toggle:()=>calls.push("toggle") } };
  const tree = TimelineToolbar({ isPro:true, capabilities:{timelineEditModes:true}, tool:"select", range:{inPoint:null,outPoint:null}, onAddVideoTrack:()=>calls.push("video"), onAddAudioTrack:()=>calls.push("audio"), onGroup:()=>calls.push("group"), onNest:()=>calls.push("nest"), canGroup:true, canNest:true });
  button(tree,"Video track").props.onClick(); button(tree,"Audio track").props.onClick();
  button(tree,"Show unused tracks").props.onClick(); button(tree,"Group").props.onClick(); button(tree,"Nest").props.onClick();
  assert.deepEqual(calls,["reveal","video","reveal","audio","toggle","group","nest"]);
  for (const label of ["Slip","Slide","Rolling edit","Rate Stretch","Hand","Zoom"]) assert.ok(nodes(tree).some(n=>n.type === "button" && n.props["aria-label"]?.startsWith(`${label} tool`)));
  delete globalThis.__simple;
});

test("Pro Export opens settings, while Lite retains its existing render action", () => {
  const calls=[];
  const props={capabilities:{},projects:[],isPro:true,onOpenQueue:()=>calls.push("settings"),onExport:()=>calls.push("render"),renderableSequence:true,selectedProfileSupported:true};
  button(StudioTopbar(props),"Export").props.onClick();
  button(StudioTopbar({...props,isPro:false}),"Render MP4").props.onClick();
  assert.deepEqual(calls,["settings","render"]);
  assert.equal(button(StudioTopbar({...props,isPro:false,renderableSequence:false}),"Render MP4").props.disabled,true);
});
