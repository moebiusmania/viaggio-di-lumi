// Shared helpers: saved progress, celebrations and little sounds.

const KEY = "lumi-v1";

// ---------- Texts ----------
// Every text the scripts show comes from the page (see layouts/base.vto): the shared
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

// ---------- Sound (tiny synthesized chimes, no audio files) ----------
let audio;
function ctx() {
  audio ??= new AudioContext();
  return audio;
}

export function sound(kind = "ding") {
  if (!state.sound) return;
  try {
    const ac = ctx();
    const now = ac.currentTime;
    const notes = {
      ding: [[880, 0], [1320, 0.08]],
      win: [[660, 0], [880, 0.1], [1100, 0.2], [1320, 0.3]],
      oops: [[300, 0], [220, 0.12]],
      pop: [[520 + Math.random() * 300, 0]],
      boom: [[90, 0], [60, 0.1]],
    }[kind] ?? [[660, 0]];
    for (const [freq, at] of notes) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = kind === "boom" ? "sawtooth" : "triangle";
      osc.frequency.setValueAtTime(freq, now + at);
      if (kind === "boom") osc.frequency.exponentialRampToValueAtTime(30, now + at + 0.5);
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(kind === "boom" ? 0.25 : 0.18, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + (kind === "boom" ? 0.7 : 0.35));
      osc.connect(gain).connect(ac.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.8);
    }
  } catch { /* no audio available */ }
}

// ---------- Confetti ----------
const COLORS = ["#ffd23f", "#ff5d8f", "#6fd3ff", "#7ee8b8", "#b28cff", "#ff8a3d"];

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
    const dist = 80 + Math.random() * 180;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 120;
    bit.animate(
      [
        { transform: "translate(-50%,-50%) rotate(0) scale(1)", opacity: 1 },
        {
          transform: `translate(${dx}px, ${dy}px) rotate(${Math.random() * 720}deg) scale(1)`,
          opacity: 1,
          offset: 0.6,
        },
        {
          transform: `translate(${dx * 1.1}px, ${dy + 260}px) rotate(${Math.random() * 1080}deg) scale(.6)`,
          opacity: 0,
        },
      ],
      { duration: 1400 + Math.random() * 700, easing: "cubic-bezier(.2,.7,.3,1)" },
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
