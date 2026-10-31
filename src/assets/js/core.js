// Shared helpers: saved progress, celebrations and little sounds.

const KEY = "lumi-v1";

// ---------- Texts ----------
// Every text the scripts show comes from the page (see layouts/Base.astro): the shared
// ones from content/<lang>/_data/ui.yml, plus the `strings` of the page's .md file.
const TEXT = (() => {
  try {
    return JSON.parse(document.getElementById("lumi-text")?.textContent ?? "{}");
  } catch {
    return {};
  }
})();

/** The text for `key`, with its {placeholders} filled in. A list gives one of its items at random. */
export function t(key, vars = {}) {
  let text = TEXT[key] ?? key;
  if (Array.isArray(text)) text = text[Math.floor(Math.random() * text.length)];
  return String(text).replace(/\{(\w+)\}/g, (all, name) => String(vars[name] ?? all));
}

/** Language of the page, e.g. "it-IT" (read-aloud voice, dates) */
export const locale = TEXT.locale ?? document.documentElement.lang;

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

const state = Object.assign({ visited: [], done: [], medals: [], sound: true }, load());

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* private mode: progress simply isn't remembered */ }
}

export const progress = {
  get state() {
    return state;
  },
  visit(url) {
    if (!state.visited.includes(url)) {
      state.visited.push(url);
      save();
    }
  },
  isDone: (url) => state.done.includes(url),
  markDone(url) {
    if (state.done.includes(url)) return false;
    state.done.push(url);
    save();
    return true;
  },
  addMedal(lesson) {
    if (!state.medals.includes(lesson)) state.medals.push(lesson);
    save();
  },
  set(key, value) {
    state[key] = value;
    save();
  },
};

export const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Sound (synthesized, no audio files): a book made of paper and board ----------
let audio;
let noiseBuffer;
function ctx() {
  audio ??= new AudioContext();
  return audio;
}

function noise(ac) {
  if (!noiseBuffer) {
    noiseBuffer = ac.createBuffer(1, ac.sampleRate * 1.2, ac.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

/** A burst of filtered noise: every rustle, scratch and thud is one of these. */
function rustle(ac, at, { dur, freq, q = 0.8, gain = 0.2, type = "bandpass", sweep = freq }) {
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, at);
  filter.frequency.exponentialRampToValueAtTime(sweep, at + dur);
  const env = ac.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + Math.min(0.012, dur / 4));
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(filter).connect(env).connect(ac.destination);
  src.start(at, Math.random() * 0.5);
  src.stop(at + dur + 0.05);
}

/** A knock on hollow cardboard: a short low tone with a papery click on top. */
function knock(ac, at, freq, gain = 0.28) {
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq * 1.5, at);
  osc.frequency.exponentialRampToValueAtTime(freq, at + 0.03);
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.17);
  osc.connect(env).connect(ac.destination);
  osc.start(at);
  osc.stop(at + 0.2);
  rustle(ac, at, { dur: 0.03, freq: 2400, gain: gain * 0.5 });
}

export function sound(kind = "ding") {
  if (!state.sound) return;
  try {
    const ac = ctx();
    const now = ac.currentTime;
    const play = {
      // a bright knock, then one higher: "you got it"
      ding() {
        knock(ac, now, 520);
        knock(ac, now + 0.09, 780);
      },
      win() {
        [440, 554, 660, 880].forEach((f, i) => knock(ac, now + i * 0.1, f));
      },
      // a dull, sagging thud
      oops() {
        knock(ac, now, 150, 0.3);
        knock(ac, now + 0.12, 105, 0.26);
      },
      // a flicked scrap of paper
      pop() {
        rustle(ac, now, { dur: 0.05, freq: 1500 + Math.random() * 1500, q: 1.4, gain: 0.3 });
      },
      // a heavy box dropped on the floor
      boom() {
        knock(ac, now, 62, 0.5);
        rustle(ac, now, { dur: 0.7, freq: 500, sweep: 90, type: "lowpass", gain: 0.34 });
        rustle(ac, now + 0.02, { dur: 0.3, freq: 2600, sweep: 900, gain: 0.08 });
      },
      // a stiff page swinging over and landing
      flip() {
        rustle(ac, now, { dur: 0.3, freq: 900, sweep: 3600, q: 0.6, gain: 0.1 });
        knock(ac, now + 0.3, 110, 0.14);
      },
    }[kind] ?? (() => knock(ac, now, 330));
    play();
    if (kind === "ding" || kind === "win" || kind === "boom") navigator.vibrate?.(kind === "boom" ? 40 : 12);
  } catch { /* no audio available */ }
}

// ---------- Confetti: snippets of paper that tumble as they fall ----------
const COLORS = ["#efbd38", "#dd6682", "#7fbfd6", "#8dc9a6", "#9a7dc0", "#dd7f38", "#f6f0e3"];

export function confetti(el, amount = 36) {
  if (reduceMotion) return;
  const r = el?.getBoundingClientRect?.() ?? { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  for (let i = 0; i < amount; i++) {
    const bit = document.createElement("i");
    bit.className = "confetti";
    bit.style.cssText = `left:${x}px;top:${y}px;background:${COLORS[i % COLORS.length]}`;
    if (i % 3 === 0) bit.style.borderRadius = "50%";
    document.body.append(bit);
    const angle = Math.random() * Math.PI * 2;
    const dist = 70 + Math.random() * 170;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 130;
    const sway = (Math.random() - 0.5) * 80;
    const axis = `${Math.random().toFixed(2)},${Math.random().toFixed(2)},${Math.random().toFixed(2)}`;
    const spin = 360 + Math.random() * 900;
    bit.animate(
      [
        { transform: `translate(-50%,-50%) rotate3d(${axis},0deg)`, opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate3d(${axis},${spin * 0.4}deg)`, opacity: 1, offset: 0.3 },
        {
          transform: `translate(${dx + sway}px, ${dy + 240}px) rotate3d(${axis},${spin * 0.75}deg)`,
          opacity: 1,
          offset: 0.75,
        },
        { transform: `translate(${dx - sway * 0.4}px, ${dy + 420}px) rotate3d(${axis},${spin}deg)`, opacity: 0 },
      ],
      { duration: 1700 + Math.random() * 900, easing: "cubic-bezier(.16,.7,.5,1)" },
    ).finished.then(() => bit.remove());
  }
}

export function toast(message) {
  document.querySelector(".toast")?.remove();
  const t = document.createElement("div");
  t.className = "toast";
  t.setAttribute("role", "status");
  t.textContent = message;
  document.body.append(t);
  t.addEventListener("animationend", () => t.remove());
}

/**
 * Call when the activity of the current page has been completed.
 * The first time it earns a star; every time it throws some confetti.
 */
export function pageDone(el) {
  confetti(el);
  const url = location.pathname;
  if (progress.markDone(url)) {
    sound("win");
    toast(t("star", { praise: t("praise") }));
    document.dispatchEvent(new CustomEvent("lumi:progress"));
  } else {
    sound("ding");
  }
}

export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  // never leave a puzzle already solved
  if (a.length > 1 && a.every((x, i) => x === list[i])) a.push(a.shift());
  return a;
}

export function restartAnimation(el, className) {
  el.classList.remove(className);
  void el.getBoundingClientRect();
  el.classList.add(className);
}
