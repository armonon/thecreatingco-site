import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import test from "node:test";
import {
  buildCmx3600, buildPremiereXml, framesToTimecode, frameClip, mediaPathUrl, nearestRate, partitionLanes,
  secondsToFrames, sequenceRate, timecodeToFrames,
} from "../lib/premiere-xml.ts";
import { autocutToPremiereTimeline } from "../lib/autocut-export.ts";
import { generateCut } from "../lib/autocut-cut.ts";
import { fakeClip, fakeMusic } from "./helpers/autocut-synth.mjs";

test("rates: timebase, NTSC flag and drop-frame only where legal", () => {
  assert.deepEqual(sequenceRate("23.976"), { id: "23.976", timebase: 24, ntsc: true, fps: 24000 / 1001, dropFrame: false });
  assert.equal(sequenceRate("29.97").dropFrame, true);
  assert.equal(sequenceRate("29.97", false).dropFrame, false);
  assert.equal(sequenceRate("59.94").timebase, 60);
  assert.equal(sequenceRate("59.94").dropFrame, true);
  for (const id of ["24", "25", "30", "50", "60"]) {
    const rate = sequenceRate(id);
    assert.equal(rate.ntsc, false);
    assert.equal(rate.dropFrame, false);
    assert.equal(rate.fps, Number(id));
  }
  assert.equal(nearestRate(29.97002997), "29.97");
  assert.equal(nearestRate(30.02), "30");
  assert.equal(nearestRate(23.98), "23.976");
  assert.equal(nearestRate(59.9), "59.94");
  assert.equal(nearestRate(undefined, "25"), "25");
  assert.equal(nearestRate(7, "30"), "30");
});

test("seconds → frames follows the real (NTSC) frame rate", () => {
  assert.equal(secondsToFrames(1, sequenceRate("25")), 25);
  assert.equal(secondsToFrames(1, sequenceRate("60")), 60);
  assert.equal(secondsToFrames(3600, sequenceRate("29.97")), 107892);
  assert.equal(secondsToFrames(3600, sequenceRate("23.976")), 86314);
  assert.equal(secondsToFrames(3600, sequenceRate("59.94")), 215784);
  assert.equal(secondsToFrames(10.01, sequenceRate("29.97")), 300);
});

test("non-drop timecode at 23.976, 25, 30 and 60", () => {
  assert.equal(framesToTimecode(0, sequenceRate("30")), "00:00:00:00");
  assert.equal(framesToTimecode(29, sequenceRate("30")), "00:00:00:29");
  assert.equal(framesToTimecode(30 * 3600 + 30 * 61 + 5, sequenceRate("30")), "01:01:01:05");
  assert.equal(framesToTimecode(90000, sequenceRate("25")), "01:00:00:00");
  assert.equal(framesToTimecode(24, sequenceRate("25")), "00:00:00:24");
  assert.equal(framesToTimecode(60 * 75 + 59, sequenceRate("60")), "00:01:15:59");
  // 23.976 is never drop-frame: an hour of real time reads 3.6 s short.
  assert.equal(framesToTimecode(86314, sequenceRate("23.976")), "00:59:56:10");
  assert.equal(framesToTimecode(23, sequenceRate("23.976")), "00:00:00:23");
  // 29.97 non-drop drifts the same way.
  assert.equal(framesToTimecode(107892, sequenceRate("29.97", false)), "00:59:56:12");
});

test("drop-frame timecode at 29.97 skips ;00 and ;01 except every tenth minute", () => {
  const df = sequenceRate("29.97");
  assert.equal(framesToTimecode(1799, df), "00:00:59;29");
  assert.equal(framesToTimecode(1800, df), "00:01:00;02");
  assert.equal(framesToTimecode(3597, df), "00:01:59;29");
  assert.equal(framesToTimecode(3598, df), "00:02:00;02");
  assert.equal(framesToTimecode(17981, df), "00:09:59;29");
  assert.equal(framesToTimecode(17982, df), "00:10:00;00");
  assert.equal(framesToTimecode(17984, df), "00:10:00;02");
  assert.equal(framesToTimecode(19782, df), "00:11:00;02");
  // An hour of real time reads exactly one hour.
  assert.equal(framesToTimecode(107892, df), "01:00:00;00");
});

test("drop-frame timecode at 59.94 skips four frame numbers", () => {
  const df = sequenceRate("59.94");
  assert.equal(framesToTimecode(3599, df), "00:00:59;59");
  assert.equal(framesToTimecode(3600, df), "00:01:00;04");
  assert.equal(framesToTimecode(35964, df), "00:10:00;00");
  assert.equal(framesToTimecode(215784, df), "01:00:00;00");
});

test("timecode round-trips for every rate", () => {
  for (const [id, dropFrame] of [["23.976", true], ["24", true], ["25", true], ["29.97", true], ["29.97", false], ["30", true], ["50", true], ["59.94", true], ["60", true]]) {
    const rate = sequenceRate(id, dropFrame);
    for (const frames of [0, 1, 2, 29, 59, 1799, 1800, 1801, 3598, 17982, 17983, 54321, 107892, 215784, 863999]) {
      assert.equal(timecodeToFrames(framesToTimecode(frames, rate), rate), frames, `${id}${dropFrame ? " DF" : ""} @ ${frames}`);
    }
  }
  assert.throws(() => timecodeToFrames("1:2:3", sequenceRate("30")), /Invalid timecode/);
});

test("pathurl: real folder, Windows folder, desktop path and the relink placeholder", () => {
  assert.equal(mediaPathUrl("My Clip #1.mov", "/Users/me/Shoot day/"), "file://localhost/Users/me/Shoot%20day/My%20Clip%20%231.mov");
  assert.equal(mediaPathUrl("a.mp4", "C:\\Footage"), "file://localhost/C:/Footage/a.mp4");
  assert.equal(mediaPathUrl("a.mp4", undefined, "/Volumes/SSD/a.mp4"), "file://localhost/Volumes/SSD/a.mp4");
  assert.equal(mediaPathUrl("a.mp4"), "file://localhost/ScenePilot-relink/a.mp4");
});

test("frame quantisation keeps butt joins and clamps the source out to the media", () => {
  const rate = sequenceRate("29.97");
  const media = { id: "m", name: "m.mp4", kind: "video", duration: 2 };
  const a = frameClip({ mediaId: "m", start: 0, duration: 0.517, sourceStart: 0 }, media, rate);
  const b = frameClip({ mediaId: "m", start: 0.517, duration: 0.5, sourceStart: 1.9 }, media, rate);
  assert.equal(a.end, b.start);
  assert.equal(b.out - b.in, b.end - b.start);
  assert.ok(b.out <= secondsToFrames(2, rate));
  assert.equal(frameClip({ mediaId: "m", start: 1, duration: 0.001, sourceStart: 0 }, media, rate), null);
  const lanes = partitionLanes([{ mediaId: "m", start: 0, duration: 1, sourceStart: 0 }, { mediaId: "m", start: 0.5, duration: 1, sourceStart: 0 }, { mediaId: "m", start: 1, duration: 1, sourceStart: 0 }], rate);
  assert.equal(lanes.length, 2);
  assert.equal(lanes[0].length, 2);
});

const timeline = {
  name: "Night drive & <friends>",
  rate: "25",
  width: 1080,
  height: 1920,
  media: [
    { id: "song", name: "song.wav", kind: "audio", duration: 10 },
    { id: "a", name: "A cam.mov", kind: "video", duration: 6, width: 1920, height: 1080, frameRate: 25 },
    { id: "b", name: "b.mp4", kind: "video", duration: 6, width: 3840, height: 2160, frameRate: 29.97, hasAudio: true },
  ],
  video: [
    { mediaId: "a", start: 0, duration: 2, sourceStart: 1 },
    { mediaId: "b", start: 2, duration: 1.5, sourceStart: 0 },
    { mediaId: "a", start: 3.5, duration: 2.5, sourceStart: 3 },
  ],
  audio: [{ mediaId: "song", start: 0, duration: 6, sourceStart: 2 }],
  markers: [{ time: 0, name: "Intro", duration: 2 }, { time: 2, name: "Chorus" }, { time: 99, name: "Past the end" }],
  mediaFolder: "/Users/me/Footage",
};

const tag = (text, name) => [...text.matchAll(new RegExp(`<${name}>([^<]*)</${name}>`, "g"))].map((match) => match[1]);

test("xmeml v4: sequence, rate, clip in/out, the song on A1 and markers", () => {
  const out = buildPremiereXml(timeline);
  assert.match(out, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<!DOCTYPE xmeml>\n<xmeml version="4">/);
  assert.match(out, /<name>Night drive &amp; &lt;friends&gt;<\/name>/);
  assert.match(out, /<sequence id="sequence-1">\n {4}<name>[^<]+<\/name>\n {4}<duration>150<\/duration>/);
  assert.deepEqual(tag(out, "start"), ["0", "50", "88", "0"]);
  assert.deepEqual(tag(out, "end"), ["50", "88", "150", "150"]);
  assert.deepEqual(tag(out, "in").slice(1, 5), ["25", "0", "75", "50"]);
  assert.deepEqual(tag(out, "out").slice(1, 5), ["75", "38", "137", "200"]);
  // Each file is described once, then referenced by id.
  assert.equal((out.match(/<file id="file-2">/g) ?? []).length, 1);
  assert.equal((out.match(/<file id="file-2"\/>/g) ?? []).length, 1);
  assert.match(out, /<pathurl>file:\/\/localhost\/Users\/me\/Footage\/A%20cam.mov<\/pathurl>/);
  // The 29.97 source keeps its own NTSC rate on the file element.
  assert.match(out, /<file id="file-3">[\s\S]*?<timebase>30<\/timebase>\s*<ntsc>TRUE<\/ntsc>/);
  assert.match(out, /<width>3840<\/width>/);
  assert.match(out, /<sourcetrack>\s*<mediatype>audio<\/mediatype>\s*<trackindex>1<\/trackindex>/);
  assert.match(out, /<marker>\s*<comment><\/comment>\s*<name>Intro<\/name>\s*<in>0<\/in>\s*<out>50<\/out>/);
  assert.match(out, /<name>Chorus<\/name>\s*<in>50<\/in>\s*<out>-1<\/out>/);
  assert.doesNotMatch(out, /Past the end/);
  assert.match(out, /<displayformat>NDF<\/displayformat>/);
});

test("xmeml at 29.97 drop-frame declares NTSC + DF", () => {
  const out = buildPremiereXml({ ...timeline, rate: "29.97" });
  assert.match(out, /<sequence id="sequence-1">[\s\S]*?<timebase>30<\/timebase>\s*<ntsc>TRUE<\/ntsc>/);
  assert.match(out, /<string>00:00:00;00<\/string>[\s\S]*?<displayformat>DF<\/displayformat>/);
  assert.match(buildPremiereXml({ ...timeline, rate: "23.976" }), /<timebase>24<\/timebase>\s*<ntsc>TRUE<\/ntsc>[\s\S]*?<displayformat>NDF<\/displayformat>/);
});

test("xmeml is well-formed XML (xmllint)", { skip: !existsSync("/usr/bin/xmllint") && "xmllint not installed" }, () => {
  execFileSync("/usr/bin/xmllint", ["--noout", "-"], { input: buildPremiereXml({ ...timeline, rate: "29.97" }) });
});

test("CMX3600 EDL: header, V and A events, source/record timecode, clip names", () => {
  const edl = buildCmx3600(timeline).split("\r\n");
  assert.equal(edl[0], "TITLE: NIGHT DRIVE & <FRIENDS>");
  assert.equal(edl[1], "FCM: NON-DROP FRAME");
  assert.equal(edl[3], "001  ACAM     V     C        00:00:01:00 00:00:03:00 00:00:00:00 00:00:02:00");
  assert.equal(edl[4], "* FROM CLIP NAME: A cam.mov");
  assert.equal(edl[6], "002  B        V     C        00:00:00:00 00:00:01:13 00:00:02:00 00:00:03:13");
  assert.equal(edl[12], "004  SONG     A     C        00:00:02:00 00:00:08:00 00:00:00:00 00:00:06:00");
  for (const line of edl.filter((row) => /^\d{3} /.test(row))) assert.equal(line.length, 76, line);
  const df = buildCmx3600({ ...timeline, rate: "29.97" });
  assert.match(df, /^TITLE: .*\r\nFCM: DROP FRAME/);
  assert.match(df, /00:00:00;00 00:00:02;00/);
});

test("AutoCut cut → Premiere timeline keeps beats, sections, drop and a trimmed range in sync", () => {
  const music = fakeMusic();
  const clips = ["a", "b", "c"].map((id, index) => fakeClip(id, { energy: index / 2 }));
  const shots = generateCut({ music, clips, preset: "music-video", density: 0.5, seed: 3 });
  const refs = clips.map((clip) => ({ id: clip.id, name: `${clip.id}.mp4`, duration: clip.duration, width: 1920, height: 1080, frameRate: 30 }));
  const full = autocutToPremiereTimeline({ project: "P", music, shots, song: { name: "song.mp3", kind: "audio", duration: music.duration }, clips: refs, rate: "30", aspect: "9:16" });
  assert.equal(full.video.length, shots.length);
  assert.equal(full.width, 1080);
  assert.equal(full.height, 1920);
  assert.deepEqual(full.audio, [{ mediaId: "__song__", start: 0, duration: music.duration, sourceStart: 0 }]);
  assert.ok(full.markers.some((marker) => marker.name.startsWith("Bar ")));
  assert.equal(full.markers.filter((marker) => marker.duration).length, music.sections.length);
  const beats = autocutToPremiereTimeline({ project: "P", music, shots, song: { name: "song.mp3", kind: "audio", duration: music.duration }, clips: refs, rate: "30", aspect: "16:9", beatMarkers: "beats" });
  assert.ok(beats.markers.filter((marker) => marker.name.startsWith("Beat ")).length > full.markers.filter((marker) => marker.name.startsWith("Bar ")).length);
  const range = { start: 4, end: 12 };
  const part = autocutToPremiereTimeline({ project: "P", music, shots, range, song: { name: "song.mp3", kind: "audio", duration: music.duration }, clips: refs, rate: "29.97", aspect: "1:1", beatMarkers: "none" });
  assert.deepEqual(part.audio, [{ mediaId: "__song__", start: 0, duration: 8, sourceStart: 4 }]);
  assert.ok(part.video.every((clip) => clip.start >= 0 && clip.start + clip.duration <= 8 + 1e-9));
  assert.ok(part.markers.every((marker) => marker.time >= 0 && marker.time < 8));
  const total = part.video.reduce((sum, clip) => sum + clip.duration, 0);
  assert.ok(Math.abs(total - 8) < 1e-6, `picture covers the range (${total})`);
  const xml = buildPremiereXml(part);
  assert.match(xml, /<duration>240<\/duration>/);
});
