/* eslint-disable @next/next/no-img-element -- Frames are local data URLs; next/image does not apply to this Vite page. */
import { StrictMode, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { createRoot } from "react-dom/client";
import { ArrowDown, ArrowUp, Copy, Download, FileText, GripVertical, ImagePlus, Pencil, Plus, Printer, Trash2, Upload, Wand2, X } from "lucide-react";
import {
  SHOT_TYPES, SHOT_TYPE_LABELS, DEFAULT_LENS, boardDuration, boardToCsv, boardToCutFile, createBoard, makeIdFactory, moveShot, parseBoardJson, parseScript, shotNumber,
  type Board, type BoardAspect, type BoardScene, type BoardShot, type ShotType,
} from "../../../lib/storyboard";
import { ToolShell, downloadFile } from "../shell";
import { loadValue, saveValue } from "../store";
import { SketchDialog, aspectRatio, imageFileToFrame } from "./sketch";
import "../tools.css";

const SAMPLE = `Title: Last Order

INT. ALL-NIGHT DINER - 2 AM

Rain streaks the window. MAYA (30s) stirs a coffee she hasn't touched.

CLOSE ON her hand — a pale band where a ring used to be.

JONAH (30s), soaked, slides into the booth opposite.

JONAH
(out of breath)
You kept the place.

MAYA
I kept the coffee.

CUT TO:

EXT. PARKING LOT - CONTINUOUS

A wide, empty lot. Neon hums over puddles. Maya walks to her car alone.

AERIAL - the diner shrinks into the city grid as the sign flickers out.`;

const LIMITS = [
  "Parsing is rule-based (no AI): it understands screenplay/Fountain-style scene headings, character cues, parentheticals, transitions and shot lines (CLOSE ON, INSERT, POV, AERIAL…), or plain paragraphs and bullet lists. Unusual formatting may need manual fixes.",
  "Shot types, lenses and durations are starting guesses from keywords and word counts (dialogue ≈150 wpm). Change them freely.",
  "PDF export uses the browser’s print dialog (Save as PDF). Layout is landscape, three frames per row.",
  "Boards autosave in this browser only. Use “Save board” to keep a file or move it to another machine.",
  "The ScenePilot handoff carries the shot list as timeline markers and a story brief, not the drawings. Importing a cut replaces the open project, so use it on a new project.",
];

const ASPECTS: BoardAspect[] = ["16:9", "2.39:1", "9:16", "1:1"];
const STORAGE_KEY = "board-v1";

function BoardApp() {
  const [script, setScript] = useState("");
  const [board, setBoard] = useState<Board>(() => createBoard("Untitled board", []));
  const [status, setStatus] = useState<{ text: string; error?: boolean }>({ text: "Paste a script or treatment, then build the shot list." });
  const [sketching, setSketching] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const boardInputRef = useRef<HTMLInputElement | null>(null);
  const frameInputRef = useRef<HTMLInputElement | null>(null);
  const frameTarget = useRef<string | null>(null);
  const idFor = useRef(makeIdFactory()).current;

  // Restore the last board, then autosave every change.
  useEffect(() => {
    loadValue<{ board: Board; script: string }>(STORAGE_KEY)
      .then((saved) => {
        if (saved?.board) {
          setBoard(parseBoardJson(JSON.stringify(saved.board)));
          setScript(saved.script ?? "");
          setStatus({ text: "Restored your last board from this browser." });
        }
      })
      .catch(() => undefined)
      .finally(() => setRestored(true));
  }, []);
  useEffect(() => {
    if (!restored) return;
    const id = window.setTimeout(() => { void saveValue(STORAGE_KEY, { board, script }).catch(() => setStatus({ text: "Autosave failed — browser storage may be full. Save the board as a file.", error: true })); }, 400);
    return () => window.clearTimeout(id);
  }, [board, restored, script]);

  const update = (scenes: BoardScene[]) => setBoard((current) => ({ ...current, scenes, updatedAt: Date.now() }));
  const updateShot = (shotId: string, patch: Partial<BoardShot>) => setBoard((current) => ({
    ...current,
    updatedAt: Date.now(),
    scenes: current.scenes.map((scene) => ({ ...scene, shots: scene.shots.map((shot) => (shot.id === shotId ? { ...shot, ...patch } : shot)) })),
  }));

  const build = () => {
    const scenes = parseScript(script, idFor);
    if (!scenes.length || !scenes.some((scene) => scene.shots.length)) { setStatus({ text: "No scenes or shots found. Add some action lines, paragraphs or a bulleted list.", error: true }); return; }
    const hasFrames = board.scenes.some((scene) => scene.shots.some((shot) => shot.frame));
    if (hasFrames && !window.confirm("Rebuilding replaces the current board, including its frames. Continue?")) return;
    const title = /^title:\s*(.+)$/im.exec(script)?.[1]?.trim() ?? board.title;
    setBoard(createBoard(title, scenes, board.aspect));
    const shots = scenes.reduce((sum, scene) => sum + scene.shots.length, 0);
    setStatus({ text: `Built ${scenes.length} scene${scenes.length === 1 ? "" : "s"} and ${shots} shot${shots === 1 ? "" : "s"}. Adjust anything, then add frames.` });
  };

  const addScene = () => update([...board.scenes, { id: idFor("scene"), heading: `SCENE ${board.scenes.length + 1}`, shots: [] }]);
  const addShot = (sceneId: string) => update(board.scenes.map((scene) => scene.id === sceneId
    ? { ...scene, shots: [...scene.shots, { id: idFor("shot"), description: "New shot", shotType: "MS" as ShotType, lens: DEFAULT_LENS.MS, duration: 3, notes: "" }] }
    : scene));
  const removeShot = (shotId: string) => update(board.scenes.map((scene) => ({ ...scene, shots: scene.shots.filter((shot) => shot.id !== shotId) })));
  const removeScene = (sceneId: string) => {
    const scene = board.scenes.find((item) => item.id === sceneId);
    if (scene?.shots.length && !window.confirm(`Delete ${scene.heading} and its ${scene.shots.length} shots?`)) return;
    update(board.scenes.filter((item) => item.id !== sceneId));
  };
  const duplicateShot = (sceneId: string, shot: BoardShot) => update(board.scenes.map((scene) => {
    if (scene.id !== sceneId) return scene;
    const index = scene.shots.findIndex((item) => item.id === shot.id);
    const shots = [...scene.shots];
    shots.splice(index + 1, 0, { ...shot, id: idFor("shot") });
    return { ...scene, shots };
  }));
  /** Move up/down; at a scene edge, hop into the neighbouring scene. */
  const nudge = (sceneIndex: number, shotIndex: number, direction: -1 | 1) => {
    const scene = board.scenes[sceneIndex];
    const shot = scene.shots[shotIndex];
    const target = shotIndex + direction;
    if (target >= 0 && target < scene.shots.length) { update(moveShot(board.scenes, shot.id, scene.id, target)); return; }
    const neighbour = board.scenes[sceneIndex + direction];
    if (neighbour) update(moveShot(board.scenes, shot.id, neighbour.id, direction < 0 ? neighbour.shots.length : 0));
  };

  const onDrop = (event: DragEvent, sceneId: string, index: number) => {
    event.preventDefault();
    if (dragId) {
      // Dropping on a card inserts before it; moving down within the same scene
      // must account for the dragged card leaving its old slot first.
      const scene = board.scenes.find((item) => item.id === sceneId);
      const from = scene?.shots.findIndex((shot) => shot.id === dragId) ?? -1;
      update(moveShot(board.scenes, dragId, sceneId, from >= 0 && from < index ? index - 1 : index));
    }
    setDragId(null);
    setOverId(null);
  };

  const pickFrame = (shotId: string) => { frameTarget.current = shotId; frameInputRef.current?.click(); };
  const onFrameFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    const target = frameTarget.current;
    if (!picked || !target) return;
    try { updateShot(target, { frame: await imageFileToFrame(picked, board.aspect) }); }
    catch { setStatus({ text: "That image couldn't be read.", error: true }); }
  };

  const loadBoardFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!picked) return;
    try {
      const loaded = parseBoardJson(await picked.text());
      setBoard(loaded);
      setStatus({ text: `Opened “${loaded.title}”.` });
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : "That board couldn't be opened.", error: true });
    }
  };

  const slug = (board.title || "board").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "board";
  const totalShots = board.scenes.reduce((sum, scene) => sum + scene.shots.length, 0);
  const runtime = boardDuration(board);
  const framed = board.scenes.reduce((sum, scene) => sum + scene.shots.filter((shot) => shot.frame).length, 0);
  const ratio = aspectRatio(board.aspect);
  const sketchShot = board.scenes.flatMap((scene) => scene.shots).find((shot) => shot.id === sketching);

  return (
    <ToolShell tool="board" limits={LIMITS}>
      <div className="tool-heading no-print">
        <div>
          <span className="eyebrow"><Wand2 size={12} /> Script → shot list → storyboard · alpha</span>
          <h1>Board</h1>
          <p>Paste a script, treatment or bullet list. Board splits it into scenes and shots, suggests coverage, and gives you frames to sketch or fill with references. Print it, or send the shot list to the ScenePilot timeline.</p>
        </div>
      </div>
      <input ref={boardInputRef} type="file" hidden accept=".json,application/json" onChange={(event) => void loadBoardFile(event)} />
      <input ref={frameInputRef} type="file" hidden accept="image/*" onChange={(event) => void onFrameFile(event)} />

      <div className="board-layout">
        <section className="panel script-input" aria-label="Script">
          <div className="panel-title"><span>01 · Script</span><small>{script.trim() ? `${script.trim().split(/\s+/).length} words` : "screenplay, treatment or list"}</small></div>
          <div className="panel-body" style={{ display: "grid", gap: 10 }}>
            <label className="field"><span>Board title</span><input value={board.title} onChange={(event) => setBoard((current) => ({ ...current, title: event.target.value, updatedAt: Date.now() }))} /></label>
            <label className="field"><span>Frame aspect</span>
              <select value={board.aspect} onChange={(event) => setBoard((current) => ({ ...current, aspect: event.target.value as BoardAspect, updatedAt: Date.now() }))}>
                {ASPECTS.map((aspect) => <option key={aspect} value={aspect}>{aspect}</option>)}
              </select>
            </label>
            <label className="field"><span>Script</span>
              <textarea value={script} onChange={(event) => setScript(event.target.value)} placeholder={"INT. KITCHEN - NIGHT\n\nA kettle starts to scream. ANA doesn't move.\n\nANA\nLet it.\n\n— or plain paragraphs / bullet lists —"} spellCheck />
            </label>
            <div className="btn-row">
              <button type="button" className="btn primary" onClick={build} disabled={!script.trim()}><Wand2 size={14} /> Build shot list</button>
              <button type="button" className="btn" onClick={() => setScript(SAMPLE)}><FileText size={14} /> Sample script</button>
            </div>
            <p className={`status-line ${status.error ? "error" : ""}`} role="status" aria-live="polite">{status.text}</p>
          </div>
        </section>

        <section className="panel" aria-label="Storyboard">
          <div className="panel-title no-print">
            <span>02 · Shot list &amp; board</span>
            <div className="board-summary"><span><b>{board.scenes.length}</b> scenes</span><span><b>{totalShots}</b> shots</span><span><b>{framed}</b> framed</span><span>≈<b>{Math.floor(runtime / 60)}:{String(Math.round(runtime % 60)).padStart(2, "0")}</b> runtime</span></div>
          </div>
          <div className="panel-body">
            <div className="btn-row no-print" style={{ marginBottom: 14 }}>
              <button type="button" className="btn" onClick={addScene}><Plus size={14} /> Scene</button>
              <button type="button" className="btn" onClick={() => window.print()} disabled={!totalShots}><Printer size={14} /> Print / PDF</button>
              <button type="button" className="btn" onClick={() => downloadFile(`${slug}.board.json`, JSON.stringify(board), "application/json")} disabled={!board.scenes.length}><Download size={14} /> Save board</button>
              <button type="button" className="btn" onClick={() => boardInputRef.current?.click()}><Upload size={14} /> Open board</button>
              <button type="button" className="btn" onClick={() => downloadFile(`${slug}-shot-list.csv`, boardToCsv(board), "text/csv")} disabled={!totalShots}><Download size={14} /> CSV</button>
              <button type="button" className="btn primary" onClick={() => downloadFile(`${slug}.scenepilot.json`, JSON.stringify(boardToCutFile(board), null, 2), "application/json")} disabled={!totalShots}><Download size={14} /> ScenePilot markers</button>
            </div>
            <p className="note no-print" style={{ marginTop: -6, marginBottom: 14 }}><strong>To the timeline:</strong> in the editor, start a new project and use <i>Import cut</i> with the <code>.scenepilot.json</code>. Each scene becomes a chapter marker and each shot a range marker at its planned length; the shot list becomes the project’s story brief.</p>

            <div className="print-only">
              <p className="print-title">{board.title}</p>
              <p className="print-meta">{board.scenes.length} scenes · {totalShots} shots · ≈{Math.round(runtime)} s · {board.aspect} · ScenePilot Board</p>
            </div>

            {!board.scenes.length && <div className="dropzone no-print" style={{ minHeight: 280 }}><span><Wand2 size={24} /><strong>No shots yet</strong><small>Build from a script on the left, or add a scene by hand.</small></span></div>}

            {board.scenes.map((scene, sceneIndex) => (
              <div key={scene.id} className="scene-block">
                <div className="scene-heading">
                  <b>SC {sceneIndex + 1}</b>
                  <input aria-label={`Scene ${sceneIndex + 1} heading`} value={scene.heading} onChange={(event) => update(board.scenes.map((item) => (item.id === scene.id ? { ...item, heading: event.target.value } : item)))} />
                  <button type="button" className="btn small no-print" onClick={() => addShot(scene.id)}><Plus size={13} /> Shot</button>
                  <button type="button" className="btn small icon danger no-print" onClick={() => removeScene(scene.id)} aria-label={`Delete scene ${sceneIndex + 1}`}><X size={13} /></button>
                </div>
                <div className="shot-grid" onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop(event, scene.id, scene.shots.length)}>
                  {scene.shots.map((shot, shotIndex) => {
                    const number = shotNumber(sceneIndex, shotIndex);
                    return (
                      <article
                        key={shot.id}
                        className={`shot-card ${dragId === shot.id ? "dragging" : ""} ${overId === shot.id ? "drag-over" : ""}`}
                        onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); if (dragId && dragId !== shot.id) setOverId(shot.id); }}
                        onDragLeave={() => setOverId((id) => (id === shot.id ? null : id))}
                        onDrop={(event) => { event.stopPropagation(); onDrop(event, scene.id, shotIndex); }}
                        aria-label={`Shot ${number}`}
                      >
                        <div className="shot-frame" style={{ aspectRatio: String(ratio) }}>
                          {shot.frame ? <img src={shot.frame} alt={`Frame for shot ${number}`} /> : <span className="frame-empty">No frame</span>}
                          <span className="shot-number">{number}</span>
                          <div className="frame-actions">
                            <button type="button" className="btn small icon" onClick={() => setSketching(shot.id)} aria-label={`Sketch frame ${number}`} title="Sketch"><Pencil size={13} /></button>
                            <button type="button" className="btn small icon" onClick={() => pickFrame(shot.id)} aria-label={`Upload frame ${number}`} title="Upload image"><ImagePlus size={13} /></button>
                            {shot.frame && <button type="button" className="btn small icon danger" onClick={() => updateShot(shot.id, { frame: undefined })} aria-label={`Remove frame ${number}`} title="Remove frame"><X size={13} /></button>}
                          </div>
                        </div>
                        <div className="shot-fields">
                          <label className="field"><span>Shot</span>
                            <select value={shot.shotType} onChange={(event) => { const type = event.target.value as ShotType; updateShot(shot.id, { shotType: type, lens: shot.lens === DEFAULT_LENS[shot.shotType] ? DEFAULT_LENS[type] : shot.lens }); }}>
                              {SHOT_TYPES.map((type) => <option key={type} value={type}>{type} · {SHOT_TYPE_LABELS[type]}</option>)}
                            </select>
                          </label>
                          <div className="row">
                            <label className="field"><span>Lens</span><input value={shot.lens} onChange={(event) => updateShot(shot.id, { lens: event.target.value })} /></label>
                            <label className="field"><span>Seconds</span><input type="number" min={0.1} max={600} step={0.1} value={shot.duration} onChange={(event) => updateShot(shot.id, { duration: Math.max(0.1, Number(event.target.value) || 0.1) })} /></label>
                          </div>
                          <label className="field"><span>Action</span><textarea value={shot.description} onChange={(event) => updateShot(shot.id, { description: event.target.value })} rows={2} /></label>
                          {shot.dialogue && <div className="shot-dialogue"><b>{shot.character ?? "DIALOGUE"}</b>“{shot.dialogue}”</div>}
                          <label className="field"><span>Notes</span><textarea value={shot.notes} onChange={(event) => updateShot(shot.id, { notes: event.target.value })} rows={1} placeholder="Movement, light, props…" /></label>
                        </div>
                        <div className="shot-tools">
                          <span className="btn-row" style={{ gap: 4 }}>
                            <span className="btn small icon drag-handle" draggable onDragStart={(event) => { setDragId(shot.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", shot.id); }} onDragEnd={() => { setDragId(null); setOverId(null); }} title="Drag to reorder" aria-hidden="true"><GripVertical size={13} /></span>
                            <button type="button" className="btn small icon" onClick={() => nudge(sceneIndex, shotIndex, -1)} disabled={sceneIndex === 0 && shotIndex === 0} aria-label={`Move shot ${number} earlier`}><ArrowUp size={13} /></button>
                            <button type="button" className="btn small icon" onClick={() => nudge(sceneIndex, shotIndex, 1)} disabled={sceneIndex === board.scenes.length - 1 && shotIndex === scene.shots.length - 1} aria-label={`Move shot ${number} later`}><ArrowDown size={13} /></button>
                          </span>
                          <span className="btn-row" style={{ gap: 4 }}>
                            <button type="button" className="btn small icon" onClick={() => duplicateShot(scene.id, shot)} aria-label={`Duplicate shot ${number}`}><Copy size={13} /></button>
                            <button type="button" className="btn small icon danger" onClick={() => removeShot(shot.id)} aria-label={`Delete shot ${number}`}><Trash2 size={13} /></button>
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      {sketchShot && <SketchDialog aspect={board.aspect} initial={sketchShot.frame} onSave={(frame) => updateShot(sketchShot.id, { frame })} onClose={() => setSketching(null)} />}
    </ToolShell>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><BoardApp /></StrictMode>);
