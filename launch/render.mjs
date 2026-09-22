import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";

const url = process.env.LAUNCH_URL || "http://127.0.0.1:5203/launch/index.html";
const out = path.resolve(process.env.LAUNCH_OUTPUT || "tmp/launch");
const fps = 30,
  duration = 41,
  stillsOnly = process.argv.includes("--stills");
await mkdir(out + "/frames", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1.5,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(url + "?capture");
await page.waitForFunction(() => typeof window.setFilmTime === "function");
await page.evaluate(async () => {
  await Promise.all(
    ["Inter", "Fraunces", "IBM Plex Mono"].map((f) =>
      document.fonts.load(`16px "${f}"`),
    ),
  );
  await document.fonts.ready;
});
const fonts = await page.evaluate(() =>
  ["Inter", "Fraunces", "IBM Plex Mono"].map((f) => ({
    family: f,
    loaded: document.fonts.check(`16px "${f}"`),
  })),
);
if (fonts.some((f) => !f.loaded))
  throw new Error("A bundled font failed to load");
for (const t of [2.5, 7.8, 11, 14.5, 18.5, 26, 33, 38]) {
  await page.evaluate((t) => window.setFilmTime(t), t);
  await page.locator(".film").screenshot({ path: `${out}/frames/${t}.png` });
}
if (errors.length) throw new Error(errors.join("\n"));
if (stillsOnly) {
  await browser.close();
  console.log("Keyframes exported; all fonts loaded.");
  process.exit(0);
}
const video = spawn(
  "ffmpeg",
  [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "image2pipe",
    "-vcodec",
    "mjpeg",
    "-r",
    String(fps),
    "-i",
    "-",
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    out + "/silent.mp4",
  ],
  { stdio: ["pipe", "inherit", "inherit"] },
);
const completed = once(video, "exit");
for (let frame = 0; frame < fps * duration; frame++) {
  await page.evaluate((t) => window.setFilmTime(t), frame / fps);
  const data = await page
    .locator(".film")
    .screenshot({ type: "jpeg", quality: 96 });
  if (!video.stdin.write(data)) await once(video.stdin, "drain");
  if (frame % 150 === 0) console.log(`Rendered ${frame}/${fps * duration}`);
}
video.stdin.end();
const [code] = await completed;
if (code !== 0) throw new Error(`Encoder exited ${code}`);
await page.goto(url + "?capture&name=Ozarm");
await page.waitForFunction(() => typeof window.setFilmTime === "function");
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => window.setFilmTime(38));
await page.locator(".film").screenshot({ path: out + "/ozarm-title.png" });
await browser.close();

// Original score, no samples or third-party recording. 120 BPM with scene accents.
const sr = 48000,
  n = duration * sr,
  samples = new Float32Array(n);
function note(at, len, f, amp, bell = false) {
  for (let i = 0; i < len * sr && Math.floor(at * sr) + i < n; i++) {
    let t = i / sr,
      envelope =
        Math.min(1, t / 0.025) *
        Math.exp(-t / (len * 0.55)) *
        Math.min(1, (len - t) / 0.2);
    const phase = 2 * Math.PI * f * t;
    samples[Math.floor(at * sr) + i] +=
      amp *
      envelope *
      (Math.sin(phase) +
        0.12 * Math.sin(phase * 2) +
        (bell ? 0.2 * Math.sin(phase * 3.002) : 0));
  }
}
const chords = [
  [146.83, 174.61, 220],
  [116.54, 146.83, 174.61],
  [130.81, 174.61, 220],
  [130.81, 164.81, 196],
];
for (let bar = 0; bar < 20; bar++) {
  const t = bar * 2,
    c = chords[Math.floor(bar / 2) % 4];
  for (let f of c) note(t, 2.8, f, 0.05);
  note(t, 1.8, c[0] / 2, 0.08);
  for (let beat = 0; beat < 4; beat++)
    note(t + beat * 0.5, 0.7, c[(bar + beat) % 3] * 4, 0.022, true);
  if (bar > 1 && bar < 18)
    for (let beat = 0; beat < 4; beat++) note(t + beat * 0.5, 0.15, 55, 0.09);
}
for (const t of [4, 12, 16, 22, 29, 35]) {
  note(t, 1.5, 880, 0.035, true);
  note(t, 1.2, 587.33, 0.025, true);
}
for (const f of chords[0]) note(39, 2, f, 0.065);
const wav = Buffer.alloc(44 + n * 2);
wav.write("RIFF");
wav.writeUInt32LE(36 + n * 2, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sr, 24);
wav.writeUInt32LE(sr * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(n * 2, 40);
for (let i = 0; i < n; i++) {
  const fade = Math.min(1, i / sr / 1.5, (duration - i / sr) / 1.8);
  wav.writeInt16LE(
    Math.round(Math.tanh(samples[i]) * fade * 28000),
    44 + i * 2,
  );
}
await writeFile(out + "/score.wav", wav);
const mux = spawn(
  "ffmpeg",
  [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    out + "/silent.mp4",
    "-i",
    out + "/score.wav",
    "-c:v",
    "copy",
    "-af",
    "loudnorm=I=-18:TP=-1.5:LRA=9",
    "-c:a",
    "aac",
    "-ar",
    "48000",
    "-b:a",
    "192k",
    "-shortest",
    "-movflags",
    "+faststart",
    out + "/launch-film.mp4",
  ],
  { stdio: "inherit" },
);
const [muxCode] = await once(mux, "exit");
if (muxCode !== 0) throw new Error("Audio mix failed");
await writeFile(
  out + "/manifest.json",
  JSON.stringify(
    {
      title: "Open CRM launch film",
      duration,
      fps,
      width: 1920,
      height: 1080,
      fonts,
      source: "launch/film.tsx",
      music: "Original synthesized instrumental, source in launch/render.mjs",
      fixture:
        "Synthetic Northstar Robotics; illustrative external-agent workflow",
      state: "Internal launch candidate; not published",
      naming: "Ozarm title is a candidate, not a product rename",
      connection: "Local feedback handoff. No connected delivery claimed.",
    },
    null,
    2,
  ) + "\n",
);
console.log("Exported " + out + "/launch-film.mp4");
