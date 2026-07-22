// /voice page — the one operator-only surface where we allow client JS
// (MediaRecorder API for in-browser audio capture). Everything else in
// the video Worker remains server-rendered, no-JS.

import type { VoiceProfile } from "../voice/storage";
import { escapeHtml, htmlPage } from "./shell";

interface VoiceArgs {
  profile: VoiceProfile | null;
  sampleCount: number;
}

const RECORDER_JS = `
const $ = (q) => document.querySelector(q);
let mediaRecorder = null;
let totalSeconds = 0;
let recStart = 0;
let chunks = [];

async function start() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
  chunks = [];
  mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  mediaRecorder.onstop = async () => {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const elapsed = (Date.now() - recStart) / 1000;
    $('#status').textContent = 'Uploading sample (' + elapsed.toFixed(1) + 's)...';
    const res = await fetch('/voice/upload', {
      method: 'POST',
      headers: { 'content-type': 'audio/webm' },
      body: blob,
    });
    if (res.ok) {
      totalSeconds += elapsed;
      $('#status').textContent = 'Uploaded. Total recorded: ' + totalSeconds.toFixed(0) + 's';
      $('#total').textContent = totalSeconds.toFixed(0);
      stream.getTracks().forEach(t => t.stop());
    } else {
      $('#status').textContent = 'Upload failed: ' + res.status;
    }
  };
  recStart = Date.now();
  mediaRecorder.start();
  $('#rec').disabled = true;
  $('#stop').disabled = false;
  $('#status').textContent = 'Recording...';
}

function stop() {
  if (mediaRecorder) mediaRecorder.stop();
  $('#rec').disabled = false;
  $('#stop').disabled = true;
}

window.addEventListener('DOMContentLoaded', () => {
  $('#rec').addEventListener('click', start);
  $('#stop').addEventListener('click', stop);
});
`;

export function renderVoicePage(args: VoiceArgs): Response {
  const trained = args.profile?.minimax_voice_id;
  const status = trained
    ? `<span class="pill succeeded">trained · ${escapeHtml(trained)}</span>`
    : args.sampleCount > 0
      ? `<span class="pill running">${args.sampleCount} samples recorded · ready to train</span>`
      : `<span class="pill queued">no samples yet</span>`;

  const trainEnabled = args.sampleCount >= 3 && !trained;

  const body = `
  <div class="h1">Voice clone — train your narrator</div>
  <div class="sub">phase 1b · minimax speech 2.8 hd · the only place in the video worker that uses client js (mediarecorder)</div>

  <div class="card" style="margin-bottom:18px">
    <div class="k">status</div>
    <div style="margin-top:6px">${status}</div>
    <div class="row" style="margin-top:14px">
      <div>
        <div class="k">samples recorded</div>
        <div class="v num" id="total">${args.sampleCount}</div>
      </div>
      <div>
        <div class="k">target</div>
        <div class="v">~5 minutes total</div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="k">record a sample</div>
    <div style="font-family:var(--serif);font-size:14.5px;line-height:1.65;margin:6px 0 14px">
      Read aloud for 30-90 seconds. Vary your tone: speak some lines flat, some
      with energy, some at podcast pace. Aim for ~5 minutes across multiple
      samples — three is the absolute minimum, more is better.
    </div>
    <div class="row" style="margin-top:6px">
      <button id="rec" class="btn">⏺ Record</button>
      <button id="stop" class="btn" style="background:#fff;color:var(--ink);border:1px solid var(--rule)" disabled>⏹ Stop &amp; upload</button>
    </div>
    <div id="status" style="margin-top:14px;font-family:var(--mono);font-size:12px;color:var(--ink-3)">—</div>
  </div>

  <form method="POST" action="/voice/train" style="margin-top:18px">
    <button class="btn" type="submit" ${trainEnabled ? "" : "disabled"} style="background:${trainEnabled ? "var(--amber)" : "#ddd"};color:var(--ink);font-weight:600">
      ${trained ? "Re-train clone" : "Train clone (MiniMax)"}
    </button>
    ${
      !trainEnabled && !trained
        ? `<div style="font-family:var(--mono);font-size:11px;color:var(--ink-3);margin-top:8px">Record at least 3 samples first.</div>`
        : ""
    }
  </form>

  <script>${RECORDER_JS}</script>
`;
  return htmlPage({ title: "Voice clone", body });
}
