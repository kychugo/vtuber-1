#!/usr/bin/env node
/**
 * capture_live2d.js
 * =================
 * Renders the Live2D Miku model in headless Chromium via Puppeteer and
 * encodes the animation into an MP4 video using an FFmpeg child process.
 *
 * Usage:
 *   node capture_live2d.js <server_port> <output_mp4> <duration_secs> <fps>
 *
 * Environment:
 *   Expects a static HTTP server already running at localhost:<server_port>
 *   that serves the repository root (so /miku_sample_t04.model3.json etc.
 *   are reachable).
 *
 * Strategy:
 *   Screenshots are taken with page.screenshot() which returns PNG buffers.
 *   These are piped directly into FFmpeg via -f image2pipe -vcodec png, which
 *   avoids any per-frame JSON serialisation and keeps throughput high.
 */

'use strict';

const puppeteer = require('puppeteer');
const { spawn }  = require('child_process');
const process    = require('process');

// ── CLI arguments ────────────────────────────────────────────────────────────
const [,, serverPort, outputMp4, durationStr, fpsStr] = process.argv;

if (!serverPort || !outputMp4 || !durationStr || !fpsStr) {
  console.error('Usage: node capture_live2d.js <port> <output.mp4> <duration_secs> <fps>');
  process.exit(1);
}

const DURATION     = parseFloat(durationStr);
const FPS          = parseInt(fpsStr, 10);
const WIDTH        = 1080;
const HEIGHT       = 1920;
const FRAME_MS     = 1000 / FPS;   // exact, not rounded — avoids accumulated drift
const TOTAL_FRAMES = Math.ceil(DURATION * FPS);

const CAPTURE_URL = `http://localhost:${serverPort}/scripts/live2d_capture.html`;

// ── FFmpeg child process (reads PNG images piped through stdin) ───────────────
function startFFmpeg(output, fps) {
  const args = [
    '-y',
    '-f', 'image2pipe',
    '-framerate', String(fps),
    '-vcodec', 'png',
    '-i', 'pipe:0',
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    output,
  ];
  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  ff.on('error', (err) => { console.error('[FFmpeg error]', err); process.exit(1); });
  return ff;
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`[capture] Launching headless browser — ${TOTAL_FRAMES} frames @ ${FPS}fps (${DURATION}s)`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--enable-webgl',
      '--use-gl=angle',
      '--use-angle=swiftshader',
    ],
  });

  const page = await browser.newPage();

  // Exact pixel viewport with no scaling
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });

  console.log(`[capture] Navigating to ${CAPTURE_URL}`);
  await page.goto(CAPTURE_URL, { waitUntil: 'networkidle0', timeout: 60_000 });

  // Wait until the Live2D model has finished loading (or errored)
  console.log('[capture] Waiting for Live2D model to load …');
  await page.waitForFunction(
    () => window.modelReady === true || window.modelError !== null,
    { timeout: 60_000 }
  );

  const errMsg = await page.evaluate(() => window.modelError);
  if (errMsg) {
    console.error('[capture] Model failed to load:', errMsg);
    await browser.close();
    process.exit(1);
  }
  console.log('[capture] Model ready — starting frame capture');

  // live2d_capture.html already settled the animation for 1.5 s during init
  // and switched the PIXI ticker to manual mode.  No additional wait needed.

  const ff = startFFmpeg(outputMp4, FPS);

  // Capture each frame deterministically:
  //   1. Advance the simulated clock by exactly FRAME_MS ms (no wall-clock drift).
  //   2. Screenshot the canvas — which is already updated by the nextFrame call.
  // This eliminates the variable-dt jitter that caused the character to shake.
  for (let i = 0; i < TOTAL_FRAMES; i++) {
    await page.evaluate((ms) => window.nextFrame(ms), FRAME_MS);
    const pngBuf = await page.screenshot({ type: 'png', omitBackground: false });
    ff.stdin.write(pngBuf);

    if ((i + 1) % FPS === 0 || i === TOTAL_FRAMES - 1) {
      const elapsed = ((i + 1) / FPS).toFixed(1);
      console.log(`[capture] ${i + 1}/${TOTAL_FRAMES} frames (${elapsed}s)`);
    }
  }

  ff.stdin.end();

  await new Promise((resolve, reject) => {
    ff.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });
  });

  await browser.close();
  console.log(`[capture] Done — ${outputMp4}`);
})().catch((err) => {
  console.error('[capture] Fatal error:', err);
  process.exit(1);
});
