// ═══════════════════════════════════════════════════════════════
// CINEMATIC 3-PHASE CONTINUOUS BACKGROUND SCORE
// ═══════════════════════════════════════════════════════════════
// Phase 1: REALITY — Dark, brooding, dissonant minor drones
// Phase 2: HOPE — Warm piano arpeggios, lush string pads
// Phase 3: POWER — Triumphant, driving, full orchestral energy
//
// Built entirely with Web Audio API — no external files.
// Uses convolver reverb, biquad filters, detuned unison layers,
// chord progressions, and filtered noise for cinematic depth.
// ═══════════════════════════════════════════════════════════════

let audioCtx: AudioContext | null = null;
let isMuted = false;
let masterGain: GainNode | null = null;
let reverbNode: ConvolverNode | null = null;
let reverbGain: GainNode | null = null;
let dryGain: GainNode | null = null;
let currentPhase: MusicPhase | null = null;

// Active nodes for cleanup
let activeOscs: OscillatorNode[] = [];
let activeGains: GainNode[] = [];
let activeSources: AudioBufferSourceNode[] = [];
let activeIntervals: ReturnType<typeof setInterval>[] = [];
let activeTimeouts: ReturnType<typeof setTimeout>[] = [];

// ── Audio Context & Reverb ──

let pendingPhase: MusicPhase | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.5;

    // Create reverb send
    dryGain = audioCtx.createGain();
    dryGain.gain.value = 0.7;
    reverbGain = audioCtx.createGain();
    reverbGain.gain.value = 0.35;

    reverbNode = audioCtx.createConvolver();
    reverbNode.buffer = createReverbImpulse(audioCtx, 3.5, 3.0);

    masterGain.connect(dryGain).connect(audioCtx.destination);
    masterGain.connect(reverbNode).connect(reverbGain!).connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

// Resume AudioContext on first user interaction (required by mobile browsers)
function onFirstInteraction() {
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().then(() => {
      // If a phase was requested before interaction, start it now
      if (pendingPhase && !getMuted()) {
        const phase = pendingPhase;
        pendingPhase = null;
        try { phaseMap[phase]?.(); } catch { /* */ }
      }
    });
  }
  document.removeEventListener("touchstart", onFirstInteraction);
  document.removeEventListener("click", onFirstInteraction);
}
document.addEventListener("touchstart", onFirstInteraction, { once: true });
document.addEventListener("click", onFirstInteraction, { once: true });

function getMaster(): GainNode {
  getCtx();
  return masterGain!;
}

// Generate a lush reverb impulse response
function createReverbImpulse(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

// ── Public controls ──

export function setMuted(muted: boolean) {
  isMuted = muted;
  localStorage.setItem("bbdMusicMuted", muted ? "1" : "0");
  if (muted) {
    // Stop all audio when muting
    fadeOutAll(0.3);
  } else if (currentPhase && currentPhase !== "silent") {
    // Restart current phase when unmuting
    if (masterGain) {
      masterGain.gain.setTargetAtTime(0.5, getCtx().currentTime, 0.1);
    }
    try {
      const phase = currentPhase;
      phaseMap[phase]?.();
    } catch { /* */ }
  }
}

export function getMuted(): boolean {
  const stored = localStorage.getItem("bbdMusicMuted");
  if (stored !== null) isMuted = stored === "1";
  return isMuted;
}

export function setIntensity(level: "low" | "normal" | "high") {
  if (!masterGain || isMuted) return;
  const vol = level === "low" ? 0.2 : level === "high" ? 0.65 : 0.5;
  masterGain.gain.setTargetAtTime(vol, getCtx().currentTime, 0.5);
  // Adjust reverb wetness
  if (reverbGain) {
    const wet = level === "high" ? 0.5 : level === "low" ? 0.2 : 0.35;
    reverbGain.gain.setTargetAtTime(wet, getCtx().currentTime, 0.5);
  }
}

export type MusicPhase = "reality" | "hope" | "power" | "silent";

// ── Cleanup ──

function fadeOutAll(fadeTime = 1.0) {
  const ctx = getCtx();
  const t = ctx.currentTime;
  activeGains.forEach(g => {
    try {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + fadeTime);
    } catch { /* */ }
  });
  const oscs = [...activeOscs];
  const gains = [...activeGains];
  const srcs = [...activeSources];
  setTimeout(() => {
    oscs.forEach(o => { try { o.stop(); o.disconnect(); } catch { /* */ } });
    gains.forEach(g => { try { g.disconnect(); } catch { /* */ } });
    srcs.forEach(s => { try { s.stop(); s.disconnect(); } catch { /* */ } });
  }, fadeTime * 1000 + 200);
  activeOscs = [];
  activeGains = [];
  activeSources = [];
  activeIntervals.forEach(clearInterval);
  activeIntervals = [];
  activeTimeouts.forEach(clearTimeout);
  activeTimeouts = [];
}

// ═══════════════════════════════════════════
// SYNTH BUILDING BLOCKS
// ═══════════════════════════════════════════

// Rich pad — multiple detuned oscillators for cinematic width
function createRichPad(freq: number, vol: number, fadeIn: number, type: OscillatorType = "sine", filterFreq?: number) {
  const ctx = getCtx();
  const t = ctx.currentTime;
  const sumGain = ctx.createGain();
  sumGain.gain.setValueAtTime(0, t);
  sumGain.gain.linearRampToValueAtTime(vol, t + fadeIn);

  // Optional low-pass filter for warmth
  let dest: AudioNode = getMaster();
  if (filterFreq) {
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    filter.Q.value = 0.7;
    filter.connect(getMaster());
    dest = filter;
  }

  // 3 detuned layers for richness
  const detunes = [-7, 0, 7];
  detunes.forEach(d => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = d + (Math.random() - 0.5) * 3;
    osc.connect(sumGain);
    osc.start(t);
    activeOscs.push(osc);
  });

  sumGain.connect(dest);
  activeGains.push(sumGain);
  return sumGain;
}

// Slow evolving LFO
function createLFO(targetParam: AudioParam, rate: number, depth: number) {
  const ctx = getCtx();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.type = "sine";
  lfo.frequency.value = rate;
  lfoGain.gain.value = depth;
  lfo.connect(lfoGain).connect(targetParam);
  lfo.start(ctx.currentTime);
  activeOscs.push(lfo);
  activeGains.push(lfoGain);
}

// Cinematic piano note — rich harmonics with proper ADSR
function playPianoNote(freq: number, duration: number, vol: number, delay = 0) {
  const ctx = getCtx();
  const t = ctx.currentTime + delay;
  const attack = 0.008;
  const sustain = duration * 0.4;
  const release = duration * 0.55;

  // Harmonics with decreasing volume and slight inharmonicity
  const harmonics = [
    { ratio: 1, amp: 1.0, type: "triangle" as OscillatorType },
    { ratio: 2.001, amp: 0.45, type: "sine" as OscillatorType },
    { ratio: 3.002, amp: 0.2, type: "sine" as OscillatorType },
    { ratio: 4.005, amp: 0.1, type: "sine" as OscillatorType },
    { ratio: 5.01, amp: 0.04, type: "sine" as OscillatorType },
  ];

  harmonics.forEach(h => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = h.type;
    osc.frequency.value = freq * h.ratio;
    // Slight random detune for realism
    osc.detune.value = (Math.random() - 0.5) * 4;

    const hVol = vol * h.amp;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(hVol, t + attack);
    gain.gain.setTargetAtTime(hVol * 0.55, t + attack, sustain * 0.5);
    gain.gain.setTargetAtTime(0.0001, t + sustain, release * 0.4);

    osc.connect(gain).connect(getMaster());
    osc.start(t);
    osc.stop(t + duration + 0.5);
    activeOscs.push(osc);
    activeGains.push(gain);
  });
}

// Filtered noise texture — atmosphere
function createNoiseTexture(vol: number, filterFreq: number, filterQ: number, fadeIn: number) {
  const ctx = getCtx();
  const t = ctx.currentTime;
  const bufSize = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(2, bufSize, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterFreq;
  filter.Q.value = filterQ;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + fadeIn);

  src.connect(filter).connect(gain).connect(getMaster());
  src.start(t);
  activeSources.push(src);
  activeGains.push(gain);
  return { gain, filter };
}

// Deep sub-bass with waveshaping
function createSubBass(freq: number, vol: number, fadeIn: number) {
  const ctx = getCtx();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = "sine";
  osc.frequency.value = freq;
  filter.type = "lowpass";
  filter.frequency.value = freq * 3;
  filter.Q.value = 1.2;

  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + fadeIn);

  osc.connect(filter).connect(gain).connect(getMaster());
  osc.start(t);
  activeOscs.push(osc);
  activeGains.push(gain);
  return gain;
}

// String ensemble — layered triangle waves with vibrato
function createStringPad(freqs: number[], vol: number, fadeIn: number) {
  const ctx = getCtx();
  const t = ctx.currentTime;
  const sumGain = ctx.createGain();
  sumGain.gain.setValueAtTime(0, t);
  sumGain.gain.linearRampToValueAtTime(vol, t + fadeIn);

  freqs.forEach(freq => {
    // Each "string" = 2 detuned oscillators + vibrato
    [-5, 5].forEach(detune => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      osc.detune.value = detune + (Math.random() - 0.5) * 3;

      // Vibrato
      const vib = ctx.createOscillator();
      const vibGain = ctx.createGain();
      vib.type = "sine";
      vib.frequency.value = 4.5 + Math.random() * 1.5; // 4.5-6 Hz
      vibGain.gain.value = 3; // 3 cents depth
      vib.connect(vibGain).connect(osc.detune);
      vib.start(t);

      osc.connect(sumGain);
      osc.start(t);
      activeOscs.push(osc, vib);
      activeGains.push(vibGain);
    });
  });

  // Warm filter
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 3000;
  filter.Q.value = 0.5;
  sumGain.connect(filter).connect(getMaster());
  activeGains.push(sumGain);
  return sumGain;
}

// ═══════════════════════════════════════════
// PHASE 1: REALITY + TENSION
// ═══════════════════════════════════════════
// Dark, brooding, unsettling. Minor keys, dissonance,
// slow breathing drones, sparse haunting piano.

function startPhaseReality() {
  // Layer 1: Deep sub-bass drone — C1 + Eb1 (minor second = tension)
  const sub1 = createSubBass(32.7, 0.04, 4);
  createLFO(sub1.gain, 0.06, 0.015); // Very slow breathing

  // Layer 2: Dark filtered pad — Cm chord (C2, Eb2, G2)
  createRichPad(65.4, 0.02, 5, "sawtooth", 400);  // C2 filtered dark
  createRichPad(77.8, 0.015, 5, "sawtooth", 350);  // Eb2
  createRichPad(98, 0.012, 6, "sawtooth", 380);     // G2

  // Layer 3: High dissonant shimmer — tritone tension
  const shimmer = createRichPad(466, 0.004, 7, "sine"); // Bb4
  createLFO(shimmer.gain, 0.04, 0.002); // Ghost-like wavering

  // Layer 4: Filtered noise — like wind / unease
  const { filter: noiseFilter } = createNoiseTexture(0.012, 300, 2, 5);
  createLFO(noiseFilter.frequency, 0.03, 100); // Slowly shifting filter

  // Layer 5: Sparse haunting piano — Cm/Fm/Ddim phrases
  const darkPhrases = [
    // Phrase 1: Descending minor
    [
      { freq: 311.1, delay: 0 },   // Eb4
      { freq: 261.6, delay: 2.5 }, // C4
      { freq: 233.1, delay: 5 },   // Bb3
    ],
    // Phrase 2: Tritone tension
    [
      { freq: 293.7, delay: 0 },   // D4
      { freq: 207.7, delay: 3 },   // Ab3
      { freq: 174.6, delay: 5.5 }, // F3
    ],
    // Phrase 3: Unresolved
    [
      { freq: 349.2, delay: 0 },   // F4
      { freq: 311.1, delay: 2 },   // Eb4
      { freq: 277.2, delay: 4.5 }, // Db4
      { freq: 261.6, delay: 7 },   // C4
    ],
  ];

  let phraseIdx = 0;
  const playPhrase = () => {
    if (currentPhase !== "reality") return;
    const phrase = darkPhrases[phraseIdx % darkPhrases.length];
    phrase.forEach(n => {
      const t = setTimeout(() => {
        if (currentPhase !== "reality") return;
        playPianoNote(n.freq, 5, 0.035, 0);
      }, n.delay * 1000);
      activeTimeouts.push(t);
    });
    phraseIdx++;
  };

  const t1 = setTimeout(playPhrase, 3000);
  activeTimeouts.push(t1);
  const loopId = setInterval(playPhrase, 12000);
  activeIntervals.push(loopId);

  // Layer 6: Real heartbeat audio loop
  try {
    const ctx = getCtx();
    fetch("/sounds/heartbeat.mp3")
      .then(res => res.arrayBuffer())
      .then(buf => ctx.decodeAudioData(buf))
      .then(audioBuffer => {
        if (currentPhase !== "reality") return;
        const src = ctx.createBufferSource();
        const gain = ctx.createGain();
        src.buffer = audioBuffer;
        src.loop = true;
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 1.5);
        src.connect(gain).connect(getMaster());
        src.start(ctx.currentTime);
        activeSources.push(src);
        activeGains.push(gain);
      })
      .catch(() => { /* silent fallback */ });
  } catch { /* */ }

  // Layer 7: Subtle metallic ticking — time running out
  const tickId = setInterval(() => {
    if (currentPhase !== "reality") return;
    try {
      const ctx = getCtx();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = "square";
      osc.frequency.value = 3000 + Math.random() * 500;
      filter.type = "bandpass";
      filter.frequency.value = 3500;
      filter.Q.value = 15;
      gain.gain.setValueAtTime(0.005, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.015);
      osc.connect(filter).connect(gain).connect(getMaster());
      osc.start(t); osc.stop(t + 0.02);
    } catch { /* */ }
  }, 600);
  activeIntervals.push(tickId);
}

// ═══════════════════════════════════════════
// PHASE 2: HOPE + POSSIBILITY
// ═══════════════════════════════════════════
// Warm, emotional, uplifting. Major keys, piano arpeggios,
// lush string pads, gentle movement.

function startPhaseHope() {
  // Layer 1: Warm string pad — C major → Am → F → G progression feel
  createStringPad([130.8, 164.8, 196], 0.012, 5);   // C3, E3, G3 — C major
  createStringPad([220, 261.6, 329.6], 0.008, 6);    // A3, C4, E4 — Am layer

  // Layer 2: Gentle ambient bed — warm filtered
  createRichPad(131, 0.01, 4, "sine", 2000);
  createRichPad(196, 0.008, 4, "sine", 2500);

  // Layer 3: Soft noise breath — like morning air
  createNoiseTexture(0.006, 600, 0.5, 6);

  // Layer 4: Piano arpeggios — emotional, ascending
  // C → Am → F → G → C (classic emotional progression)
  const progressions = [
    // C major arpeggio
    [
      { freq: 261.6, delay: 0 },    // C4
      { freq: 329.6, delay: 0.6 },  // E4
      { freq: 392, delay: 1.2 },    // G4
      { freq: 523.2, delay: 1.8 },  // C5
      { freq: 392, delay: 2.6 },    // G4
      { freq: 329.6, delay: 3.2 },  // E4
    ],
    // Am arpeggio
    [
      { freq: 220, delay: 0 },      // A3
      { freq: 261.6, delay: 0.6 },  // C4
      { freq: 329.6, delay: 1.2 },  // E4
      { freq: 440, delay: 1.8 },    // A4
      { freq: 329.6, delay: 2.6 },  // E4
      { freq: 261.6, delay: 3.2 },  // C4
    ],
    // F major arpeggio
    [
      { freq: 174.6, delay: 0 },    // F3
      { freq: 220, delay: 0.6 },    // A3
      { freq: 261.6, delay: 1.2 },  // C4
      { freq: 349.2, delay: 1.8 },  // F4
      { freq: 261.6, delay: 2.6 },  // C4
      { freq: 220, delay: 3.2 },    // A3
    ],
    // G major → resolve
    [
      { freq: 196, delay: 0 },      // G3
      { freq: 246.9, delay: 0.6 },  // B3
      { freq: 293.7, delay: 1.2 },  // D4
      { freq: 392, delay: 1.8 },    // G4
      { freq: 493.9, delay: 2.4 },  // B4
      { freq: 523.2, delay: 3.0 },  // C5 (resolve up!)
    ],
  ];

  let progIdx = 0;
  const playProgression = () => {
    if (currentPhase !== "hope") return;
    const prog = progressions[progIdx % progressions.length];
    prog.forEach(n => {
      const t = setTimeout(() => {
        if (currentPhase !== "hope") return;
        playPianoNote(n.freq, 3.5, 0.045, 0);
      }, n.delay * 1000);
      activeTimeouts.push(t);
    });
    progIdx++;
  };

  // Start first progression after 2s
  const t1 = setTimeout(playProgression, 2000);
  activeTimeouts.push(t1);
  // Loop every 4.5s — slightly overlapping for continuity
  const loopId = setInterval(playProgression, 4500);
  activeIntervals.push(loopId);

  // Layer 5: Evolving string swell — rises and falls
  const swellId = setInterval(() => {
    if (currentPhase !== "hope") return;
    // Pick a chord to swell
    const swellChords = [
      [261.6, 329.6, 392],     // C
      [220, 261.6, 329.6],     // Am
      [349.2, 440, 523.2],     // F (high)
      [392, 493.9, 587.3],     // G (high)
    ];
    const chord = swellChords[Math.floor(Math.random() * swellChords.length)];
    const ctx = getCtx();
    const t = ctx.currentTime;

    chord.forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      osc.detune.value = (Math.random() - 0.5) * 8;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.008, t + 2);
      gain.gain.linearRampToValueAtTime(0.008, t + 4);
      gain.gain.setTargetAtTime(0.0001, t + 4, 1.5);
      osc.connect(gain).connect(getMaster());
      osc.start(t); osc.stop(t + 8);
      activeOscs.push(osc);
      activeGains.push(gain);
    });
  }, 8000);
  activeIntervals.push(swellId);

  // Layer 6: Gentle rhythmic pulse — 72 BPM, soft
  const pulseInterval = 60000 / 72;
  const pulseId = setInterval(() => {
    if (currentPhase !== "hope") return;
    try {
      const ctx = getCtx();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(65, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      gain.gain.setValueAtTime(0.015, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain).connect(getMaster());
      osc.start(t); osc.stop(t + 0.2);
    } catch { /* */ }
  }, pulseInterval);
  activeIntervals.push(pulseId);
}

// ═══════════════════════════════════════════
// PHASE 3: POWER + ACTION
// ═══════════════════════════════════════════
// Triumphant, driving, motivational. Full harmonic richness,
// strong rhythmic foundation, ascending melodies.

function startPhasePower() {
  // Layer 1: Full orchestral pad — C major power chord stack
  createStringPad([130.8, 196, 261.6], 0.015, 3);     // C3, G3, C4
  createStringPad([329.6, 392, 523.2], 0.01, 4);       // E4, G4, C5
  createRichPad(65.4, 0.02, 3, "sine", 500);           // C2 bass foundation

  // Layer 2: Bright shimmer layer
  const shimmer = createRichPad(1046.5, 0.003, 5, "sine"); // C6
  createLFO(shimmer.gain, 0.1, 0.001);

  // Layer 3: Driving rhythm — 96 BPM
  const driveBPM = 96;
  const driveInterval = 60000 / driveBPM;

  // Bass pulse
  const bassId = setInterval(() => {
    if (currentPhase !== "power") return;
    try {
      const ctx = getCtx();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(65, t);
      osc.frequency.exponentialRampToValueAtTime(32, t + 0.2);
      gain.gain.setValueAtTime(0.04, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain).connect(getMaster());
      osc.start(t); osc.stop(t + 0.25);
    } catch { /* */ }
  }, driveInterval);
  activeIntervals.push(bassId);

  // Soft cinematic percussion — filtered noise hit
  const percId = setInterval(() => {
    if (currentPhase !== "power") return;
    try {
      const ctx = getCtx();
      const t = ctx.currentTime;
      const bufSize = Math.floor(ctx.sampleRate * 0.06);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 3);
      }
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      src.buffer = buf;
      filter.type = "bandpass";
      filter.frequency.value = 4000;
      filter.Q.value = 2;
      gain.gain.setValueAtTime(0.02, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      src.connect(filter).connect(gain).connect(getMaster());
      src.start(t);
    } catch { /* */ }
  }, driveInterval / 2); // 8th notes
  activeIntervals.push(percId);

  // Layer 4: Triumphant piano melody — ascending phrases
  const triumphPhrases = [
    // Phrase 1: Ascending C major
    [
      { freq: 261.6, delay: 0 },    // C4
      { freq: 329.6, delay: 0.5 },  // E4
      { freq: 392, delay: 1.0 },    // G4
      { freq: 523.2, delay: 1.5 },  // C5
      { freq: 659.2, delay: 2.2 },  // E5 — soaring peak
    ],
    // Phrase 2: Emotional high
    [
      { freq: 392, delay: 0 },      // G4
      { freq: 523.2, delay: 0.5 },  // C5
      { freq: 587.3, delay: 1.0 },  // D5
      { freq: 659.2, delay: 1.5 },  // E5
      { freq: 784, delay: 2.2 },    // G5 — triumph!
    ],
    // Phrase 3: Resolve down gently
    [
      { freq: 659.2, delay: 0 },    // E5
      { freq: 587.3, delay: 0.6 },  // D5
      { freq: 523.2, delay: 1.2 },  // C5
      { freq: 392, delay: 2.0 },    // G4
      { freq: 523.2, delay: 3.0 },  // C5 — home
    ],
    // Phrase 4: Power climb
    [
      { freq: 349.2, delay: 0 },    // F4
      { freq: 440, delay: 0.4 },    // A4
      { freq: 523.2, delay: 0.8 },  // C5
      { freq: 659.2, delay: 1.3 },  // E5
      { freq: 784, delay: 1.8 },    // G5
      { freq: 1046.5, delay: 2.5 }, // C6!
    ],
  ];

  let phraseIdx = 0;
  const playTriumph = () => {
    if (currentPhase !== "power") return;
    const phrase = triumphPhrases[phraseIdx % triumphPhrases.length];
    phrase.forEach(n => {
      const t = setTimeout(() => {
        if (currentPhase !== "power") return;
        playPianoNote(n.freq, 2.8, 0.05, 0);
      }, n.delay * 1000);
      activeTimeouts.push(t);
    });
    phraseIdx++;
  };

  const t1 = setTimeout(playTriumph, 1500);
  activeTimeouts.push(t1);
  const loopId = setInterval(playTriumph, 5000);
  activeIntervals.push(loopId);

  // Layer 5: String swells — cinematic rise and fall
  const swellId = setInterval(() => {
    if (currentPhase !== "power") return;
    const swells = [
      [523.2, 659.2, 784],       // C5, E5, G5
      [392, 493.9, 587.3],       // G4, B4, D5
      [440, 523.2, 659.2],       // A4, C5, E5
    ];
    const chord = swells[Math.floor(Math.random() * swells.length)];
    const ctx = getCtx();
    const t = ctx.currentTime;

    chord.forEach(freq => {
      [-6, 0, 6].forEach(detune => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        osc.detune.value = detune;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.006, t + 1.5);
        gain.gain.linearRampToValueAtTime(0.006, t + 3);
        gain.gain.setTargetAtTime(0.0001, t + 3, 1.2);
        osc.connect(gain).connect(getMaster());
        osc.start(t); osc.stop(t + 6);
        activeOscs.push(osc);
        activeGains.push(gain);
      });
    });
  }, 6000);
  activeIntervals.push(swellId);
}

// ═══════════════════════════════════════════
// PHASE CONTROLLER
// ═══════════════════════════════════════════

const phaseMap: Record<MusicPhase, (() => void) | undefined> = {
  reality: startPhaseReality,
  hope: startPhaseHope,
  power: startPhasePower,
  silent: undefined,
};

export function setPhase(_phase: MusicPhase) {
  // Background music disabled globally.
  fadeOutAll(0.4);
  currentPhase = null;
}

export function stopMusic() {
  fadeOutAll(1.5);
  currentPhase = null;
}

// Gentle fade out over duration (seconds), then fully stop
export function fadeOutAndStop(duration = 3.0) {
  if (!masterGain) return;
  const ctx = getCtx();
  const t = ctx.currentTime;
  masterGain.gain.cancelScheduledValues(t);
  masterGain.gain.setValueAtTime(masterGain.gain.value, t);
  masterGain.gain.linearRampToValueAtTime(0, t + duration);
  setTimeout(() => {
    fadeOutAll(0.1);
    currentPhase = null;
  }, duration * 1000 + 200);
}

// ═══════════════════════════════════════════
// SCORE REVEAL IMPACT — One-shot cinematic moment
// ═══════════════════════════════════════════

export function playScoreRevealImpact() {
  if (getMuted()) return;
  try {
    const ctx = getCtx();
    const master = getMaster();
    const t = ctx.currentTime;

    // 1. Deep cinematic bass boom
    const bass = ctx.createOscillator();
    const bassG = ctx.createGain();
    bass.type = "sine";
    bass.frequency.setValueAtTime(55, t);
    bass.frequency.exponentialRampToValueAtTime(18, t + 0.8);
    bassG.gain.setValueAtTime(0.3, t);
    bassG.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    bass.connect(bassG).connect(master);
    bass.start(t); bass.stop(t + 0.9);

    // 2. Sub-bass rumble layer
    const sub = ctx.createOscillator();
    const subG = ctx.createGain();
    sub.type = "sine";
    sub.frequency.value = 30;
    subG.gain.setValueAtTime(0.15, t);
    subG.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    sub.connect(subG).connect(master);
    sub.start(t); sub.stop(t + 1.2);

    // 3. Cinematic shimmer — ascending string resolve
    const shimmerFreqs = [523.2, 659.2, 784, 1046.5, 1318.5];
    shimmerFreqs.forEach((freq, i) => {
      [-4, 0, 4].forEach(detune => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i < 2 ? "triangle" : "sine";
        osc.frequency.value = freq;
        osc.detune.value = detune;
        const start = t + 0.05 + i * 0.06;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.04, start + 0.08);
        gain.gain.setTargetAtTime(0.0001, start + 0.6 + i * 0.15, 0.35);
        osc.connect(gain).connect(master);
        osc.start(start);
        osc.stop(start + 1.8);
      });
    });

    // 4. Noise burst — impact transient
    const bufSize = Math.floor(ctx.sampleRate * 0.08);
    const buf = ctx.createBuffer(2, bufSize, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 4);
      }
    }
    const noise = ctx.createBufferSource();
    const noiseG = ctx.createGain();
    const noiseF = ctx.createBiquadFilter();
    noise.buffer = buf;
    noiseF.type = "lowpass";
    noiseF.frequency.value = 2000;
    noiseG.gain.setValueAtTime(0.08, t);
    noiseG.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    noise.connect(noiseF).connect(noiseG).connect(master);
    noise.start(t);
  } catch { /* */ }
}
