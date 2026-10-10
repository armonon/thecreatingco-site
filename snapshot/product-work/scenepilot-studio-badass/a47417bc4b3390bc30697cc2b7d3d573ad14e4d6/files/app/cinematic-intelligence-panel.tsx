import { AlertTriangle, Camera, CheckCircle2, Clapperboard, Film, Gauge, Sparkles, UserRound, WandSparkles, Waves } from "lucide-react";
import type { CinematicAnalysis, CinematicAssemblyKind } from "../lib/cinematic-analysis";
import { formatTime } from "../lib/format";

export function CinematicIntelligencePanel(props: {
  report: CinematicAnalysis;
  seek(time: number): void;
  applyAssembly(kind: CinematicAssemblyKind): void;
  disabled?: boolean;
}) {
  const { report } = props;
  const bestShots = [...report.shots].sort((a, b) => b.editorialScore - a.editorialScore).slice(0, 12);
  return <div className="cinematic-analysis-card">
    <div className="cinematic-analysis-head">
      <span><Film size={15} /><strong>Cinematic Intelligence</strong><small>Subject-aware story, quality and coverage analysis</small></span>
      <em>{report.pace.toUpperCase()}</em>
    </div>
    <div className="cinematic-analysis-grid">
      <span><strong>{report.shotCount}</strong><small>SHOTS</small></span>
      <span><strong>{report.sceneChanges.length}</strong><small>SCENE CHANGES</small></span>
      <span><strong>{report.jumpCuts.length}</strong><small>LIKELY JUMP CUTS</small></span>
      <span><strong>{Math.round(report.technicalPassRate * 100)}%</strong><small>CLEAN COVERAGE</small></span>
      <span><strong>{report.subjectFramesAnalyzed ? `${Math.round(report.subjectPresence * 100)}%` : "—"}</strong><small>PERSON PRESENCE</small></span>
      <span><strong>{report.motion}</strong><small>CAMERA / MOTION</small></span>
    </div>

    <section className="cinematic-subsection cinematic-story-map">
      <header><Clapperboard size={13} /><span><strong>SUGGESTED STRUCTURE</strong><small>Five proportional regions—not detected story events · click to inspect</small></span></header>
      <div className="cinematic-story-track">
        {report.storyBeats.map((beat) => <button key={beat.id} style={{ flexGrow: Math.max(.1, beat.end - beat.start), opacity: .55 + beat.intensity * .45 }} onClick={() => props.seek(beat.start)} title={`${beat.label} · ${Math.round(beat.intensity * 100)}% intensity`}><strong>{beat.label}</strong><small>{formatTime(beat.start)}</small></button>)}
      </div>
    </section>

    <section className="cinematic-subsection">
      <header><Gauge size={13} /><span><strong>BEST SHOTS</strong><small>Ranked for technical quality, engagement and usable duration</small></span></header>
      <div className="cinematic-shot-list">
        {bestShots.map((shot) => <button key={shot.id} onClick={() => props.seek(shot.start)} title={shot.issues.length ? shot.issues.join(" · ") : "No technical warnings"}>
          <span><strong>{shot.id.replace("shot-", "#")}</strong><small>{formatTime(shot.start)}–{formatTime(shot.end)}</small></span>
          <em>{shot.shotSize}</em><em>{shot.cameraMove}</em><em>{shot.role}</em>
          <b className={shot.technicalScore >= .62 ? "pass" : "warn"}>{Math.round(shot.editorialScore * 100)}</b>
        </button>)}
      </div>
    </section>

    {report.audioMoments.length > 0 && <section className="cinematic-subsection">
      <header><Waves size={13} /><span><strong>AUDIO MOMENTS</strong><small>Texture analysis—not transcription · labels remain reviewable</small></span></header>
      <div className="cinematic-cue-row">
        {report.audioMoments.slice(0, 18).map((moment) => <button key={moment.id} onClick={() => props.seek(moment.start)} title={`${Math.round(moment.confidence * 100)}% confidence`}>{moment.kind.replace("-", " ")} <b>{formatTime(moment.start)}</b></button>)}
      </div>
    </section>}

    <div className="cinematic-review-grid">
      <section className="cinematic-subsection">
        <header><AlertTriangle size={13} /><span><strong>CONTINUITY REVIEW</strong><small>{report.continuityIssues.length} flagged edit points</small></span></header>
        <div className="cinematic-review-list">
          {report.continuityIssues.length ? report.continuityIssues.slice(0, 8).map((issue) => <button key={issue.id} onClick={() => props.seek(issue.time)}><AlertTriangle size={11} /><span><strong>{issue.kind.replaceAll("-", " ")}</strong><small>{issue.message}</small></span><em>{formatTime(issue.time)}</em></button>) : <p><CheckCircle2 size={12} /> No high-confidence continuity warnings.</p>}
        </div>
      </section>
      <section className="cinematic-subsection">
        <header><Camera size={13} /><span><strong>COVERAGE COACH</strong><small>What the edit may still need</small></span></header>
        <div className="cinematic-review-list">
          {report.coverageGaps.length ? report.coverageGaps.map((gap) => <div key={gap.id}><Camera size={11} /><span><strong>{gap.label}</strong><small>{gap.message}</small></span><em>{gap.severity}</em></div>) : <p><CheckCircle2 size={12} /> Wide, close and insert coverage are represented.</p>}
        </div>
      </section>
    </div>

    {report.similarTakes.length > 0 && <section className="cinematic-subsection">
      <header><UserRound size={13} /><span><strong>SIMILAR-TAKE CANDIDATES</strong><small>Repeated framing and motion patterns · compare before removing</small></span></header>
      <div className="cinematic-cue-row">
        {report.similarTakes.slice(0, 8).map((pair) => {
          const first = report.shots.find((shot) => shot.id === pair.firstShotId);
          return <button key={`${pair.firstShotId}-${pair.secondShotId}`} onClick={() => first && props.seek(first.start)}>{pair.firstShotId.replace("shot-", "#")} ↔ {pair.secondShotId.replace("shot-", "#")} <b>{Math.round(pair.similarity * 100)}%</b></button>;
        })}
      </div>
    </section>}

    <section className="cinematic-subsection cinematic-assemblies">
      <header><WandSparkles size={13} /><span><strong>BUILD AN EDITABLE FIRST CUT</strong><small>Creates ordinary linked timeline clips—you keep full control</small></span></header>
      <div className="cinematic-assembly-grid">
        {report.assemblies.map((assembly) => <button key={assembly.kind} disabled={props.disabled || !assembly.shotIds.length} onClick={() => props.applyAssembly(assembly.kind)}>
          <Sparkles size={13} /><span><strong>{assembly.label}</strong><small>{assembly.summary}</small><em>{assembly.shotIds.length} shots · {formatTime(assembly.estimatedDuration)}</em></span>
        </button>)}
      </div>
    </section>

    <p>Person framing uses ScenePilot&apos;s offline segmentation model on sparse key frames. Shot size, dialogue-like audio, jump cuts and similar takes are editorial candidates—not irreversible decisions.</p>
  </div>;
}
