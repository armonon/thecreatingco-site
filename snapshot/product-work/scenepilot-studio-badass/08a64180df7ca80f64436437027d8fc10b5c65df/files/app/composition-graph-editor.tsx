import { memo } from "react";
import { Activity, Diamond } from "lucide-react";
import type { CompositionLayer } from "../lib/compositor";
import { graphValueFromRatio, normalizeGraphValue, sampleTransformValueGraph, transformGraphRange, type TransformGraphProperty } from "../lib/value-graph";
import type { TransformKeyframe } from "../lib/keyframes";
import { compositionToLayerTime, layerToCompositionTime, compositionLayerRate } from "../lib/composition-editing";

type Props = {
  layer: CompositionLayer;
  duration: number;
  locked?: boolean;
  frameRate?: number;
  selectedKeyframeId: string | null;
  onBeginEdit: () => void;
  onEndEdit: () => void;
  onCheckpoint: () => void;
  onSelect: (keyframeId: string, time: number) => void;
  onValue: (keyframeId: string, patch: Partial<Pick<TransformKeyframe, TransformGraphProperty | "time">>) => void;
};

const PROPERTIES: TransformGraphProperty[] = ["x", "y", "scale", "rotation", "opacity"];

/** Isolated from the editor shell because pointer moves can update at display
 * refresh rate. Memoization keeps unrelated timeline/audio state from
 * rebuilding every graph node. */
export const CompositionGraphEditor = memo(function CompositionGraphEditor(props: Props) {
  if (!props.layer.keyframes.length) return <p className="graph-empty">Add a keyframe to animate {props.layer.name}.</p>;
  const duration = Math.max(.01, props.duration);
  return (
    <div className="graph-editor">
      <div><Activity size={13} /><span>VALUE GRAPH</span><small>{props.layer.name} · drag time + value · Shift locks time · Alt adjusts time only</small></div>
      <div className="graph-grid">
        {PROPERTIES.map((property) => {
          const range = transformGraphRange(property);
          const curve = sampleTransformValueGraph(props.layer.keyframes.map(frame => ({ ...frame, time: layerToCompositionTime(props.layer, frame.time) })), property, duration);
          return <div className={`graph-lane ${property}`} key={property}>
            <span>{property.toUpperCase()}</span><i />
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polyline points={curve.map((point) => `${point.x * 100},${(1 - point.y) * 100}`).join(" ")} />
            </svg>
            {props.layer.keyframes.map((keyframe) => {
              const value = keyframe[property];
              const normalized = normalizeGraphValue(property, value);
              return (
                <button
                  key={`${property}-${keyframe.id}`}
                  disabled={props.locked || props.layer.locked}
                  className={keyframe.id === props.selectedKeyframeId ? "selected" : ""}
                  style={{ left: `${Math.max(0, Math.min(100, layerToCompositionTime(props.layer, keyframe.time) / duration * 100))}%`, bottom: `${Math.max(0, Math.min(100, normalized * 100))}%` }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    props.onBeginEdit();
                    props.onSelect(keyframe.id, keyframe.time);
                  }}
                  onPointerMove={(event) => {
                    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                    const lane = event.currentTarget.parentElement;
                    if (!lane) return;
                    const bounds = lane.getBoundingClientRect();
                    const time = Math.max(0, Math.min(duration, (event.clientX - bounds.left) / bounds.width * duration));
                    const ratio = Math.max(0, Math.min(1, 1 - (event.clientY - bounds.top) / bounds.height));
                    props.onValue(keyframe.id, {
                      ...(event.shiftKey ? {} : { time: compositionToLayerTime(props.layer, time) }),
                      ...(event.altKey ? {} : { [property]: graphValueFromRatio(property, ratio) }),
                    });
                  }}
                  onPointerUp={(event) => { event.currentTarget.releasePointerCapture(event.pointerId); props.onEndEdit(); }}
                  onPointerCancel={props.onEndEdit}
                  onKeyDown={(event) => {
                    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
                    event.preventDefault();
                    event.stopPropagation();
                    props.onCheckpoint();
                    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                      props.onValue(keyframe.id, { time: keyframe.time + (event.key === "ArrowRight" ? 1 : -1) * compositionLayerRate(props.layer) / (props.frameRate ?? 30) });
                    } else {
                      props.onValue(keyframe.id, { [property]: Math.max(range.minimum, Math.min(range.maximum, value + (event.key === "ArrowUp" ? range.step : -range.step))) });
                    }
                  }}
                  onClick={(event) => { if (event.detail === 0) props.onSelect(keyframe.id, keyframe.time); }}
                  aria-label={`${property} ${value.toFixed(1)} at ${layerToCompositionTime(props.layer, keyframe.time).toFixed(2)} seconds`}
                  title={`${property}: ${value.toFixed(1)} · ${keyframe.easing ?? "linear"} · drag time + value`}
                ><Diamond size={9} fill="currentColor" /></button>
              );
            })}
          </div>
        })}
      </div>
    </div>
  );
});
