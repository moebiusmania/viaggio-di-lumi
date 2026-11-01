// Background music, made entirely with the Web Audio API: slow ambient chords with a few
// bell notes, quiet enough for someone to speak over. Only books with `music: true` use it.
//
// Every page turn loads a new document, which ends the audio. So the chord being played
// comes from the clock, not from a counter: the next page picks up on the same chord
// and fades in, and the music seems to carry on.

const CHORD = 14; // seconds each chord lasts
const FADE = 7; // seconds two chords overlap
const LEVEL = 0.3;

const hz = (note) => 440 * 2 ** ((note - 69) / 12);

// D major pentatonic, high up, above most of the speaking voice
const BELLS = [86, 88, 90, 93, 95, 98];

// One mood per lesson, with the same instruments throughout. Notes are MIDI numbers.
// `bass` has a note per chord, `cutoff` is how bright the pads are, `bell` is the average
// wait between bell notes, `tide` is the level of the soft sea noise.
const MOODS = {
  // mysterious: a deep drone, then the sound opens up
  1: {
    chords: [[50, 57, 64], [48, 55, 62], [46, 53, 60, 65], [50, 55, 62]],
    bass: [38, 36, 34, 38],
    cutoff: 450,
    bell: 16,
    tide: 0,
  },
  // sparkling: airy pads and plenty of bells
  2: {
    chords: [[50, 57, 62, 66], [47, 54, 62, 64], [43, 50, 59, 66], [45, 52, 57, 64]],
    bass: [38, 35, 31, 33],
    cutoff: 800,
    bell: 6,
    tide: 0,
  },
  // warm and rising: fuller, brighter chords
  3: {
    chords: [[50, 57, 62, 66, 69], [43, 55, 62, 66, 71], [45, 57, 61, 64, 69], [47, 54, 62, 66, 69]],
    bass: [38, 31, 33, 35],
    cutoff: 1000,
    bell: 10,
    tide: 0,
  },
  // arriving home: low and calm, with the sound of the sea
  4: {
    chords: [[50, 57, 62, 64], [43, 50, 59, 62], [48, 55, 60, 64], [45, 50, 57, 62]],
    bass: [38, 31, 36, 33],
    cutoff: 600,
    bell: 13,
    tide: 0.05,
  },
};

function noiseBuffer(ac, seconds, channels = 1, shape = () => 1) {
  const buffer = ac.createBuffer(channels, ac.sampleRate * seconds, ac.sampleRate);
  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * shape(i / data.length);
  }
  return buffer;
}

/** One sustained note: two slightly detuned oscillators behind a soft filter. */
function pad(ac, out, freq, at, dur, level, cutoff, attack) {
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = cutoff;
  filter.Q.value = 0.3;
  const env = ac.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(level, at + attack);
  env.gain.setValueAtTime(level, at + dur);
  env.gain.linearRampToValueAtTime(0, at + dur + FADE);
  filter.connect(env).connect(out);
  [["triangle", -4], ["sine", 4]].forEach(([type, detune], i) => {
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.connect(filter);
    osc.start(at);
    osc.stop(at + dur + FADE + 0.1);
    // the filter and envelope go with the last oscillator
    if (i) {
      osc.onended = () => {
        filter.disconnect();
        env.disconnect();
      };
    }
  });
}

/** A single soft bell: a sine and a quieter overtone, dying away. */
function bell(ac, out, freq, at) {
  const env = ac.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(0.035, at + 0.02);
  env.gain.exponentialRampToValueAtTime(0.0001, at + 3);
  env.connect(out);
  [[1, 1], [2.76, 0.2]].forEach(([ratio, level]) => {
    const osc = ac.createOscillator();
    const partial = ac.createGain();
    osc.frequency.value = freq * ratio;
    partial.gain.value = level;
    osc.connect(partial).connect(env);
    osc.start(at);
    osc.stop(at + 3.1);
    osc.onended = () => partial.disconnect();
  });
}

/** Sea noise that swells and fades very slowly. */
function tide(ac, out, level) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, 4);
  src.loop = true;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 350;
  const swell = ac.createGain();
  swell.gain.value = level;
  const lfo = ac.createOscillator();
  const depth = ac.createGain();
  lfo.frequency.value = 0.08;
  depth.gain.value = level * 0.8;
  lfo.connect(depth).connect(swell.gain);
  src.connect(filter).connect(swell).connect(out);
  src.start();
  lfo.start();
}

function play(lesson) {
  const mood = MOODS[lesson] ?? MOODS[1];
  const ac = new AudioContext({ latencyHint: "playback" });
  const timers = new Set();
  let begun = false;

  const later = (fn, seconds) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, seconds * 1000);
    timers.add(id);
  };

  // pads → dip in the speaking range → master, with a long reverb alongside
  const master = ac.createGain();
  master.gain.value = 0;
  master.connect(ac.destination);
  const dip = ac.createBiquadFilter();
  dip.type = "peaking";
  dip.frequency.value = 1400;
  dip.Q.value = 0.6;
  dip.gain.value = -9;
  dip.connect(master);
  const reverb = ac.createConvolver();
  reverb.buffer = noiseBuffer(ac, 3.5, 2, (t) => (1 - t) ** 3);
  const wet = ac.createGain();
  wet.gain.value = 0.5;
  reverb.connect(wet).connect(dip);
  const bus = ac.createGain();
  bus.connect(dip);
  bus.connect(reverb);

  function chord(first) {
    if (ac.state === "running") {
      const seconds = Date.now() / 1000;
      const i = Math.floor(seconds / CHORD) % mood.chords.length;
      const left = CHORD - (seconds % CHORD);
      const at = ac.currentTime + 0.05;
      const attack = first ? 2.5 : FADE;
      mood.chords[i].forEach((note) => pad(ac, bus, hz(note), at, left, 0.09, mood.cutoff, attack));
      pad(ac, bus, hz(mood.bass[i]), at, left, 0.3, 300, attack);
    }
    later(() => chord(false), CHORD - (Date.now() / 1000) % CHORD);
  }

  function ring() {
    if (ac.state === "running") {
      bell(ac, reverb, hz(BELLS[Math.floor(Math.random() * BELLS.length)]), ac.currentTime + 0.05);
    }
    later(ring, mood.bell * (0.5 + Math.random()));
  }

  function begin() {
    if (begun || ac.state !== "running") return;
    begun = true;
    removeEventListener("pointerdown", wake);
    removeEventListener("keydown", wake);
    master.gain.linearRampToValueAtTime(LEVEL, ac.currentTime + 2);
    if (mood.tide) tide(ac, master, mood.tide);
    chord(true);
    later(ring, mood.bell * Math.random());
  }

  // a browser may keep the audio waiting for the first tap on each new page
  const wake = () => ac.resume();
  ac.addEventListener("statechange", begin);
  addEventListener("pointerdown", wake);
  addEventListener("keydown", wake);
  begin();

  const onVisibility = () => (document.hidden ? ac.suspend() : ac.resume());
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    timers.forEach(clearTimeout);
    timers.clear();
    begun = true; // nothing starts any more
    removeEventListener("pointerdown", wake);
    removeEventListener("keydown", wake);
    document.removeEventListener("visibilitychange", onVisibility);
    const now = ac.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + 1.2);
    setTimeout(() => ac.close(), 1400);
  };
}

let stop;

export function startMusic() {
  stop ??= play(Number(document.documentElement.dataset.lesson));
}

export function stopMusic() {
  stop?.();
  stop = undefined;
}
