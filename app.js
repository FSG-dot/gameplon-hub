const videoInput = document.querySelector("#videoFile");
const tempoInput = document.querySelector("#tempo");
const analyzeBtn = document.querySelector("#analyzeBtn");
const exportTxtBtn = document.querySelector("#exportTxtBtn");
const exportJsonBtn = document.querySelector("#exportJsonBtn");
const statusText = document.querySelector("#status");
const player = document.querySelector("#player");
const tabTrack = document.querySelector("#tabTrack");
const tabViewport = document.querySelector("#tabViewport");
const tabLegend = document.querySelector("#tabLegend");

let videoUrl = "";
let noteEvents = [];
let rafId = 0;

const STRINGS = ["e", "B", "G", "D", "A", "E"];
const STRING_MIDI = [64, 59, 55, 50, 45, 40];
const PX_PER_SECOND = 140;

videoInput.addEventListener("change", () => {
  const [file] = videoInput.files || [];
  if (!file) return;

  if (videoUrl) URL.revokeObjectURL(videoUrl);
  videoUrl = URL.createObjectURL(file);

  player.src = videoUrl;
  analyzeBtn.disabled = false;
  noteEvents = [];
  clearTab();
  toggleExportButtons(false);
  statusText.textContent = "영상이 준비되었습니다. 분석 버튼을 눌러주세요.";
});

analyzeBtn.addEventListener("click", async () => {
  if (!player.src) return;

  analyzeBtn.disabled = true;
  statusText.textContent = "오디오 분석 중... (영상 길이에 따라 5~20초)";

  try {
    const audioBuffer = await extractAudioBuffer(player);
    const bpm = Number(tempoInput.value) || 96;
    noteEvents = generateTabFromAudio(audioBuffer, bpm);
    renderTab(noteEvents, audioBuffer.duration);
    toggleExportButtons(noteEvents.length > 0);
    statusText.textContent = `분석 완료: ${noteEvents.length}개 노트 이벤트 생성`;
  } catch (error) {
    console.error(error);
    statusText.textContent = "분석 실패: 브라우저가 영상 디코딩을 지원하는지 확인해주세요.";
  } finally {
    analyzeBtn.disabled = false;
  }
});

exportTxtBtn.addEventListener("click", () => {
  if (!noteEvents.length) return;

  const lines = [
    "# Fingerstyle TAB Export",
    `# total_events=${noteEvents.length}`,
    "# columns: time_sec\tstring\tfret\tfreq_hz\tmidi",
  ];

  noteEvents.forEach((event) => {
    lines.push(
      `${event.time.toFixed(3)}\t${STRINGS[event.stringIndex]}\t${event.fret}\t${event.freq.toFixed(
        2,
      )}\t${event.midi}`,
    );
  });

  downloadTextFile("fingerstyle-tab.txt", lines.join("\n"));
});

exportJsonBtn.addEventListener("click", () => {
  if (!noteEvents.length) return;

  const payload = {
    exportedAt: new Date().toISOString(),
    tuning: "E2 A2 D3 G3 B3 E4",
    events: noteEvents,
  };

  downloadTextFile("fingerstyle-tab.json", JSON.stringify(payload, null, 2));
});

player.addEventListener("play", syncScrollLoop);
player.addEventListener("pause", stopScrollLoop);
player.addEventListener("ended", stopScrollLoop);
player.addEventListener("seeked", syncTabScroll);

function clearTab() {
  tabTrack.innerHTML = "";
  tabTrack.style.width = "100%";
  tabLegend.textContent = "생성된 노트가 없습니다.";
}

async function extractAudioBuffer(videoElement) {
  const source = videoElement.currentSrc;
  const response = await fetch(source);
  const arrayBuffer = await response.arrayBuffer();

  const context = new (window.AudioContext || window.webkitAudioContext)();
  const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
  await context.close();
  return decoded;
}

function generateTabFromAudio(audioBuffer, bpm) {
  const channel = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  const hopSize = 2048;
  const frameSize = 4096;
  const minDistanceSeconds = 60 / Math.max(50, bpm * 2);

  let previousEnergy = 0;
  let lastOnsetTime = -Infinity;
  const events = [];

  for (let offset = 0; offset + frameSize < channel.length; offset += hopSize) {
    const frame = channel.subarray(offset, offset + frameSize);
    const energy = rms(frame);
    const flux = Math.max(0, energy - previousEnergy);
    previousEnergy = energy;

    const time = offset / sampleRate;
    if (flux < 0.008 || time - lastOnsetTime < minDistanceSeconds) continue;

    const frequency = detectPitchAutoCorrelation(frame, sampleRate);
    if (!Number.isFinite(frequency) || frequency < 70 || frequency > 1200) continue;

    const midi = frequencyToMidi(frequency);
    const tabPos = midiToTab(midi);
    if (!tabPos) continue;

    events.push({
      time,
      midi,
      freq: frequency,
      stringIndex: tabPos.stringIndex,
      fret: tabPos.fret,
    });

    lastOnsetTime = time;
  }

  return events;
}

function rms(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

function detectPitchAutoCorrelation(frame, sampleRate) {
  const size = frame.length;
  let bestOffset = -1;
  let bestCorrelation = 0;

  for (let offset = 24; offset < 1200; offset += 1) {
    let correlation = 0;
    for (let i = 0; i < size - offset; i += 1) {
      correlation += frame[i] * frame[i + offset];
    }

    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
  }

  if (bestOffset <= 0 || bestCorrelation < 0.02) return NaN;
  return sampleRate / bestOffset;
}

function frequencyToMidi(frequency) {
  return Math.round(69 + 12 * Math.log2(frequency / 440));
}

function midiToTab(midi) {
  const candidates = [];

  for (let stringIndex = 0; stringIndex < STRING_MIDI.length; stringIndex += 1) {
    const fret = midi - STRING_MIDI[stringIndex];
    if (fret >= 0 && fret <= 20) {
      candidates.push({ stringIndex, fret });
    }
  }

  if (!candidates.length) return null;
  return candidates.sort((a, b) => a.fret - b.fret)[0];
}

function renderTab(events, duration) {
  clearTab();

  const minWidth = Math.max(tabViewport.clientWidth, duration * PX_PER_SECOND + 120);
  tabTrack.style.width = `${minWidth}px`;

  const rowLabels = document.createElement("div");
  rowLabels.className = "tab-strings";

  STRINGS.forEach((stringName) => {
    const row = document.createElement("div");
    row.className = "string-row";
    row.dataset.string = stringName;
    rowLabels.appendChild(row);
  });

  tabTrack.appendChild(rowLabels);

  events.forEach((event) => {
    const note = document.createElement("div");
    note.className = "tab-note";
    note.style.left = `${event.time * PX_PER_SECOND}px`;
    note.style.top = `${event.stringIndex * 48 + 14}px`;
    note.textContent = `${event.fret}`;
    note.title = `${STRINGS[event.stringIndex]}줄 ${event.fret}프렛 (${event.freq.toFixed(1)}Hz)`;
    tabTrack.appendChild(note);
  });

  tabLegend.textContent =
    "참고: 단일 음 기준 자동 추정 결과입니다. 실제 핑거스타일의 동시 다성음/슬랩/하모닉은 보정 편집이 필요합니다.";
}

function syncScrollLoop() {
  cancelAnimationFrame(rafId);

  const loop = () => {
    syncTabScroll();
    if (!player.paused && !player.ended) {
      rafId = requestAnimationFrame(loop);
    }
  };

  rafId = requestAnimationFrame(loop);
}

function stopScrollLoop() {
  cancelAnimationFrame(rafId);
}

function syncTabScroll() {
  const currentX = player.currentTime * PX_PER_SECOND;
  const target = Math.max(0, currentX - tabViewport.clientWidth * 0.35);
  tabViewport.scrollLeft = target;
}

function toggleExportButtons(enabled) {
  exportTxtBtn.disabled = !enabled;
  exportJsonBtn.disabled = !enabled;
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
