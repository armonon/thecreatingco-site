"use client";
import { useRef, useState } from "react";
import type { AutoEditPolicy, AutoTiming } from "../lib/auto-edit-policy";
import type { AutoEditVersion } from "./auto-edit-types";
import type { SceneCut } from "../lib/analysis-engine";
import { AutoDraftPreview } from "./auto-draft-preview";
import type { PreviewAsset } from "./canvas-preview";

export function AutoEditReviewPanel(p: {
  part?: "settings" | "review";
  previewAssets?: PreviewAsset[]; mainVisualUrl?: string;
  previewSourceSize?: { width: number; height: number };
  policy: AutoEditPolicy; change(value: AutoEditPolicy): void; disabled: boolean; timingReason: string;
  sources: Array<{id:string;name:string;duration?:number}>; versions: AutoEditVersion[];
  apply(version: AutoEditVersion): void; discard(id:string): void; sourceUrl?: string;
  boundaries: SceneCut[]; transitionCandidates: SceneCut[]; boundary(time:number,remove:boolean): void;
}) {
  const [boundaryTime,setBoundaryTime]=useState(0);
  const [selected,setSelected]=useState("");
  const sourcePreview=useRef<HTMLVideoElement>(null);
  const version=p.versions.find(v=>v.id===selected) ?? p.versions.at(-1);
  const change=(patch:Partial<AutoEditPolicy>)=>p.change({...p.policy,...patch});
  return <section className="auto-review-panel" aria-label="Auto Cut plan and versions">
    {p.part !== "review" && <><h2>Timing & constraints</h2>
    <p>Generation creates a separate saved draft. The timeline changes only when you apply it; Undo restores the previous edit.</p>
    <fieldset disabled={p.disabled}><legend>Editorial intent</legend>
      <label>Timing approach<select value={p.policy.timing} onChange={e=>change({timing:e.target.value as AutoTiming})}>{[["auto","Suggest from evidence"],["music","Follow music"],["scenes","Follow scenes / action"],["dialogue","Follow dialogue"],["hybrid","Dialogue + music"]].map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
      <p role="status">{p.timingReason}</p>
      <label>Target duration (seconds; 0 = automatic)<input type="number" min="0" step=".1" value={p.policy.targetDuration} onChange={e=>change({targetDuration:Number(e.target.value)})}/></label>
      <details className="auto-edit-rules"><summary>Fine-tune editing rules</summary>
      <label>Minimum shot (seconds)<input type="number" min=".04" step=".05" value={p.policy.minShot} onChange={e=>change({minShot:Number(e.target.value)})}/></label>
      <label>Maximum shot (seconds)<input type="number" min=".04" step=".1" value={p.policy.maxShot} onChange={e=>change({maxShot:Number(e.target.value)})}/></label>
      <label><input type="checkbox" checked={p.policy.noRepeat} onChange={e=>change({noRepeat:e.target.checked})}/>Use each source at most once</label>
      <label><input type="checkbox" checked={p.policy.preserveDialogue} onChange={e=>change({preserveDialogue:e.target.checked})}/>Keep spoken phrases whole (requires transcript)</label>
      <label><input type="checkbox" checked={Boolean(p.policy.range)} onChange={e=>change({range:e.target.checked?{start:0,end:10}:undefined})}/>Only rebuild a timeline region</label>
      {p.policy.range && <><label>Region start<input type="number" min="0" step=".1" value={p.policy.range.start} onChange={e=>change({range:{...p.policy.range!,start:Number(e.target.value)}})}/></label><label>Region end<input type="number" min="0" step=".1" value={p.policy.range.end} onChange={e=>change({range:{...p.policy.range!,end:Number(e.target.value)}})}/></label></>}
      <details><summary>Source priorities & keep ranges</summary>{p.sources.map(source=>{
        const rule=p.policy.sources.find(r=>r.assetId===source.id) ?? {assetId:source.id,priority:1,exclude:false,inPoint:0};
        const update=(patch:Partial<typeof rule>)=>change({sources:[...p.policy.sources.filter(r=>r.assetId!==source.id),{...rule,...patch}]});
        return <fieldset key={source.id}><legend>{source.name}</legend><label><input type="checkbox" checked={rule.exclude} onChange={e=>update({exclude:e.target.checked})}/>Exclude source</label><label>Priority<select value={rule.priority} onChange={e=>update({priority:Number(e.target.value)})}><option value="1">Normal</option><option value="2">Prefer</option><option value="3">Strongly prefer</option></select></label><label>Keep from<input type="number" min="0" step=".1" value={rule.inPoint} onChange={e=>update({inPoint:Number(e.target.value)})}/></label><label>Keep to (blank = source end)<input type="number" min="0" step=".1" value={rule.outPoint ?? ""} onChange={e=>update({outPoint:e.target.value===""?undefined:Number(e.target.value)})}/></label></fieldset>;
      })}</details>
      </details>
    </fieldset>
    <details><summary>Review scene boundaries · {p.boundaries.length}</summary>
      {p.sourceUrl && <video ref={sourcePreview} src={p.sourceUrl} controls preload="metadata" aria-label="Original source boundary preview" style={{width:"100%",maxHeight:240}}/>}
      <fieldset disabled={p.disabled}><label>Boundary time (source seconds)<input type="number" min="0" step=".001" value={boundaryTime} onChange={e=>setBoundaryTime(Number(e.target.value))}/></label><button onClick={()=>p.boundary(boundaryTime,false)}>Add boundary</button>
      {p.boundaries.map(b=><div key={b.time}><button onClick={()=>{setBoundaryTime(b.time);if(sourcePreview.current){sourcePreview.current.pause();sourcePreview.current.currentTime=b.time;}}}>{b.time.toFixed(3)}s · {b.precision ?? "coarse"} · {Math.round(b.confidence*100)}%</button><button aria-label={`Remove boundary ${b.time.toFixed(3)}`} onClick={()=>p.boundary(b.time,true)}>Remove</button></div>)}
      {p.policy.sceneBoundaries && <button onClick={()=>change({sceneBoundaries:undefined})}>Use detected boundaries on next analysis</button>}
      {p.transitionCandidates.map((b,i)=><p key={i}>{b.transition} candidate at {b.time.toFixed(3)}s · not used as a hard cut</p>)}</fieldset>
    </details>
    </>}
    {p.part !== "settings" && <><h3>Draft versions · {p.versions.length}/8</h3>
    {version ? <><label>Review version<select value={version.id} onChange={e=>setSelected(e.target.value)}>{p.versions.map(v=><option key={v.id} value={v.id}>{v.name} · {v.createdAt}</option>)}</select></label>
      <p>{version.evidence.length} cuts · {(version.snapshot.duration ?? 0).toFixed(2)}s</p>
      {p.previewAssets && <AutoDraftPreview key={version.id} version={version} assets={p.previewAssets} mainUrl={p.mainVisualUrl ?? ""} sourceSize={p.previewSourceSize} />}
      {version.warnings.map((w,i)=><p role="status" key={i}>{w}</p>)}
      <button disabled={p.disabled} onClick={()=>p.apply(version)}>Apply reviewed version</button><button disabled={p.disabled} onClick={()=>p.discard(version.id)}>Discard draft</button>
      <details><summary>Why these cuts? Reasons, confidence & alternatives</summary>{version.evidence.map(c=><article key={c.id}><strong>{p.sources.find(s=>s.id===c.assetId)?.name ?? c.assetId} · {c.start.toFixed(2)}–{(c.start+c.duration).toFixed(2)}s</strong><p>{c.editorial.reason} · {Math.round(c.editorial.confidence*100)}% heuristic confidence</p>{c.editorial.alternatives.length>0 && <small>Other candidates: {c.editorial.alternatives.map(id=>p.sources.find(s=>s.id===id)?.name ?? id).join(", ")} · change priority / boundaries and regenerate to compare.</small>}</article>)}</details>
    </> : <p>No draft yet. Choose your timing approach, add media and generate a first cut.</p>}
    </>}
  </section>;
}
