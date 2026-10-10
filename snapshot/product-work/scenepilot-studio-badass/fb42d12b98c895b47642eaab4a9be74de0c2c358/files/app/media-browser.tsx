"use client";

/* eslint-disable @next/next/no-img-element -- Media browser thumbnails use local blob URLs. */

import { Box, Film, FolderOpen, FolderPlus, Grid2X2, Image as ImageIcon, List, Music2, Plus, Search, Star, Video, X } from "lucide-react";
import { memo, type ChangeEvent, type RefObject } from "react";
import type { MediaBin, ProxyState } from "../lib/pro-editor";
import type { SmartMediaFilter } from "../lib/workflow";
import { useFullWorkspaceControls } from "./studio-shell";
import { ShellDisclosure } from "./shell-disclosure";

export type MediaAsset = {
  beatMap?: import("../lib/song-beat-map").SongBeatMap;
  id: string; name: string; file: File; url: string; kind: "image" | "video" | "audio"; color: string; duration?: number; folderId: string;
  proxyState: ProxyState; proxyProgress: number; proxyFile?: File; proxyUrl?: string; waveform?: number[]; nativeCodec?: string; nativeDimensions?: string;
  nativeFrameRate?: number; nativeVfr?: boolean; nativeBitDepth?: number; nativeHdr?: boolean; sourcePath?: string; favorite?: boolean;
  offline?: boolean; sourceSize?: number; sourceLastModified?: number;
};
export type MediaKindFilter = "all" | "video" | "audio" | "image" | "missing" | "favorites";
export type MediaSort = "name" | "recent" | "duration" | "usage";

type Props = {
  projectName: string; assets: MediaAsset[]; visibleAssets: MediaAsset[]; bins: MediaBin[]; activeBinId: string; sourceAssetId: string | null;
  search: string; kindFilter: MediaKindFilter; sort: MediaSort; view: "list" | "grid"; smartFilter: SmartMediaFilter; showSmartFilters: boolean;
  isPro: boolean; disabled: boolean; nativeMediaAvailable: boolean; usage: Map<string, number>; inputRef: RefObject<HTMLInputElement | null>;
  canCancelProxy(id: string): boolean; onImport(event: ChangeEvent<HTMLInputElement>): void; onAddBin(): void; onSearch(value: string): void;
  onKindFilter(value: MediaKindFilter): void; onSort(value: MediaSort): void; onView(value: "list" | "grid"): void; onActiveBin(id: string): void;
  onSmartFilter(value: SmartMediaFilter): void; onOpen(asset: MediaAsset): void; onBuildProxy(id: string): void; onCancelProxy(id: string): void;
  onMoveToBin(id: string, binId: string): void; onToggleFavorite(id: string): void; onRemove(id: string): void;
  onCreateCompositionFromAsset?(asset: MediaAsset): void;
};

const formatDuration = (seconds?: number) => {
  if (!seconds || !Number.isFinite(seconds)) return "still";
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${(seconds - minutes * 60).toFixed(2).padStart(5, "0")}`;
};

export const MediaBrowser = memo(function MediaBrowser(props: Props) {
  const full = useFullWorkspaceControls();
  const accept = props.isPro ? "image/*,video/*,audio/*,.mov,.mxf,.mkv,.avi,.mts,.m2ts,.aif,.aiff,.flac,.exr,.dpx" : "image/*,video/*";
  return <>
    <div className="panel-head"><div><FolderOpen size={16} /><strong>Project: {props.projectName.replace(/\.[^/.]+$/, "")}</strong><span>{props.assets.length} media · local</span></div><button className="add-button" disabled={props.disabled} onClick={() => props.inputRef.current?.click()}><Plus size={15} /> Import</button><input ref={props.inputRef} disabled={props.disabled} hidden type="file" multiple accept={accept} onChange={props.onImport} /></div>
    <div className="media-bin-toolbar"><label><Search size={13} /><input aria-label="Search project media" value={props.search} onChange={(event) => props.onSearch(event.target.value)} placeholder="Search media" /></label><button onClick={props.onAddBin} title="New media bin" aria-label="New media bin"><FolderPlus size={14} /></button></div>
    <details className="media-organize"><summary>Organize & filter{props.kindFilter !== "all" || props.activeBinId !== "bin-root" || props.smartFilter !== "all" ? " · filtered" : ""}</summary>
    <div className="media-browser-controls" aria-label="Media browser controls">
      <select aria-label="Filter media" value={props.kindFilter} onChange={(event) => props.onKindFilter(event.target.value as MediaKindFilter)}><option value="all">All media</option><option value="video">Video</option><option value="audio">Audio</option><option value="image">Stills</option><option value="favorites">Favorites</option><option value="missing">Offline</option></select>
      <select aria-label="Sort media" value={props.sort} onChange={(event) => props.onSort(event.target.value as MediaSort)}><option value="name">Name</option><option value="recent">Newest</option><option value="duration">Duration</option><option value="usage">Most used</option></select>
      <div><button className={props.view === "list" ? "active" : ""} onClick={() => props.onView("list")} aria-label="List view"><List size={13} /></button><button className={props.view === "grid" ? "active" : ""} onClick={() => props.onView("grid")} aria-label="Grid view"><Grid2X2 size={13} /></button></div>
    </div>
    <div className="media-bin-tabs">{props.bins.filter((bin) => props.isPro || bin.id !== "bin-audio").map((bin) => <button key={bin.id} className={props.activeBinId === bin.id ? "active" : ""} onClick={() => props.onActiveBin(bin.id)}>{bin.name}<small>{bin.id === "bin-root" ? props.assets.length : props.assets.filter((asset) => asset.folderId === bin.id).length}</small></button>)}</div>
    {props.showSmartFilters && <div className="smart-filter-row" role="group" aria-label="Intelligent media selects">{(["all", "best", "energetic", "steady", "bright", "dark"] as SmartMediaFilter[]).map((filter) => <button key={filter} className={props.smartFilter === filter ? "active" : ""} onClick={() => props.onSmartFilter(filter)}>{filter}</button>)}</div>}
    </details>
    <div className="project-section-label"><Film size={13} /><span>MEDIA</span><small>{props.visibleAssets.length}</small></div>
    <div className={`asset-bin ${props.view === "grid" ? "asset-grid" : ""}`}>
      {props.visibleAssets.length ? props.visibleAssets.map((asset) => <div tabIndex={0} data-context-kind="media" data-context-id={asset.id} className={`asset-row ${props.sourceAssetId === asset.id ? "source-selected" : ""} ${!asset.url ? "offline" : ""}`} key={asset.id} draggable={Boolean(asset.url)} title={asset.url ? "Double-click to open in Source · drag onto a track" : "Media is offline — relink from this project"} onDoubleClick={() => asset.url && props.onOpen(asset)} onDragStart={(event) => { event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData("application/x-scenepilot", `asset:${asset.id}`); }}>
        <div className="asset-thumb" style={{ borderColor: asset.color }}>{!asset.url ? asset.kind === "audio" ? <Music2 size={19} /> : <Film size={19} /> : asset.kind === "image" ? <img src={asset.url} alt="" /> : asset.kind === "video" ? <video src={asset.proxyUrl ?? asset.url} muted /> : <Music2 size={19} />}<span>{asset.kind === "image" ? <ImageIcon size={12} /> : asset.kind === "video" ? <Video size={12} /> : <Music2 size={12} />}</span></div>
        <div className="asset-meta"><strong>{asset.name}</strong><span>{!asset.url ? "OFFLINE" : asset.nativeCodec ? `${asset.nativeCodec.toUpperCase()}${asset.nativeDimensions ? ` · ${asset.nativeDimensions}` : ""}${asset.nativeFrameRate ? ` · ${asset.nativeFrameRate.toFixed(2)} FPS` : ""}` : asset.kind} · {formatDuration(asset.duration)} · {props.usage.get(asset.id) ?? 0} use{(props.usage.get(asset.id) ?? 0) === 1 ? "" : "s"}</span>
          {asset.kind === "video" && (asset.nativeVfr || asset.nativeHdr || (asset.nativeBitDepth ?? 8) > 8) && <small className="media-technical-badges">{asset.nativeVfr && <b>VFR</b>}{asset.nativeHdr && <b>HDR</b>}{(asset.nativeBitDepth ?? 8) > 8 && <b>{asset.nativeBitDepth}-BIT</b>}</small>}
          {!asset.url && <button className="proxy-chip failed" onClick={(event) => { event.stopPropagation(); props.inputRef.current?.click(); }} aria-label={`Relink ${asset.name}`}>RELINK</button>}
          <ShellDisclosure expanded={full} className="media-item-details" label="Media options">
          {asset.kind === "video" && asset.url && <button className={`proxy-chip ${asset.proxyState}`} onClick={(event) => { event.stopPropagation(); if (asset.proxyState === "building") props.onCancelProxy(asset.id); else props.onBuildProxy(asset.id); }} disabled={asset.proxyState === "building" && !props.canCancelProxy(asset.id)}>{asset.proxyState === "ready" ? "PROXY ON" : asset.proxyState === "building" ? `CANCEL ${Math.round(asset.proxyProgress * 100)}%` : props.nativeMediaAvailable ? "NATIVE PROXY" : "MAKE PROXY"}</button>}
          <select aria-label={`Move ${asset.name} to media bin`} value={asset.folderId} onChange={(event) => props.onMoveToBin(asset.id, event.target.value)}>{props.bins.filter((bin) => bin.id !== "bin-root").map((bin) => <option key={bin.id} value={bin.id}>{bin.name}</option>)}</select>
          </ShellDisclosure>
        </div>
        <div className="asset-actions"><button disabled={!asset.url} onClick={() => props.onOpen(asset)} aria-label={`Open ${asset.name} in Source monitor`}><FolderOpen size={13} /></button>{props.isPro && asset.kind !== "audio" && props.onCreateCompositionFromAsset && <button disabled={!asset.url || props.disabled} onClick={() => props.onCreateCompositionFromAsset?.(asset)} aria-label={`New composition from ${asset.name}`} title="Create a composition from this source"><Box size={13} /></button>}<button className={asset.favorite ? "active" : ""} onClick={() => props.onToggleFavorite(asset.id)} aria-label={`${asset.favorite ? "Remove" : "Add"} ${asset.name} ${asset.favorite ? "from" : "to"} favorites`}><Star size={13} fill={asset.favorite ? "currentColor" : "none"} /></button><button onClick={() => props.onRemove(asset.id)} aria-label={`Remove ${asset.name}`}><X size={14} /></button></div>
      </div>) : <button className="asset-empty" onClick={() => props.inputRef.current?.click()}><div><Plus size={20} /></div><strong>Import media</strong><span>Video, audio, images, textures</span></button>}
    </div>
  </>;
});
