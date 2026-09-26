import { locale, progress, sound, t } from "./core.js";
import "./components.js";

const html = document.documentElement;
const here = location.pathname;
const index = Number(html.dataset.index);

// ---------- Progress: visited pages, stars, medals ----------
progress.visit(here);
if (index >= 0) progress.set("last", here);

const continueLink = document.querySelector("[data-continue]");
if (continueLink && progress.state.last) {
  continueLink.href = progress.state.last;
  continueLink.hidden = false;
}

function paintProgress() {
  const { visited, done, medals } = progress.state;
  for (const a of document.querySelectorAll("a[data-url]")) {
    a.toggleAttribute("data-visited", visited.includes(a.dataset.url));
    a.toggleAttribute("data-done", done.includes(a.dataset.url));
  }
  for (const el of document.querySelectorAll("[data-star-count]")) el.textContent = done.length;
  for (const ring of document.querySelectorAll("[data-lesson-progress]")) {
    const n = ring.dataset.lessonProgress;
    const links = [...document.querySelectorAll(`#toc .toc-lesson:nth-child(${n}) a[data-url]`)];
    const seen = links.filter((a) => visited.includes(a.dataset.url)).length;
    ring.style.setProperty("--p", links.length ? seen / links.length : 0);
    ring.classList.toggle("complete", medals.includes(Number(n)));
  }
  for (const m of document.querySelectorAll("[data-medal]")) {
    m.toggleAttribute("data-earned", medals.includes(Number(m.dataset.medal)));
  }
}

paintProgress();
document.addEventListener("lumi:progress", () => {
  paintProgress();
  const counter = document.querySelector(".star-count");
  counter?.classList.remove("bump");
  void counter?.offsetWidth;
  counter?.classList.add("bump");
});

// ---------- Table of contents ----------
const toc = document.getElementById("toc");

function openToc() {
  if (toc.open) return;
  toc.showModal();
  toc.querySelector("[aria-current]")?.scrollIntoView({ block: "center" });
}

document.querySelector("[data-toc]")?.addEventListener("click", openToc);
toc.querySelector("[data-close]").addEventListener("click", () => toc.close());
// click on the dim backdrop closes the menu
toc.addEventListener("click", (e) => {
  if (e.target !== toc) return;
  const r = toc.getBoundingClientRect();
  const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  if (!inside) toc.close();
});

// ---------- Navigation: arrows, keyboard, swipe, trackpad ----------
function go(dir) {
  const link = document.querySelector(dir === "back" ? 'a[rel="prev"]' : 'a[rel="next"]');
  if (!link) return;
  link.classList.add("pressed");
  location.href = link.href;
}

function isTyping(el) {
  return el?.closest?.("input, textarea, select, [contenteditable], [role='slider']");
}

addEventListener("keydown", (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === "m" || e.key === "M") {
    if (isTyping(e.target)) return;
    toc.open ? toc.close() : openToc();
    return;
  }
  if (toc.open || isTyping(e.target)) return;
  if (e.key === "ArrowRight" || e.key === "PageDown") go("forward");
  else if (e.key === "ArrowLeft" || e.key === "PageUp") go("back");
});

// Swipe with a finger (touch events keep working even while the page scrolls)
const NO_SWIPE = "input, canvas, .chip, hold-button, torch-reveal, .scene [data-hit], [data-no-swipe]";
let touch = null;
addEventListener("touchstart", (e) => {
  if (e.touches.length !== 1 || e.target.closest(NO_SWIPE) || toc.open) return (touch = null);
  touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: performance.now() };
}, { passive: true });
addEventListener("touchend", (e) => {
  if (!touch) return;
  const dx = e.changedTouches[0].clientX - touch.x;
  const dy = e.changedTouches[0].clientY - touch.y;
  const quick = performance.now() - touch.t < 700;
  touch = null;
  if (quick && Math.abs(dx) > 70 && Math.abs(dy) < Math.abs(dx) * 0.6) go(dx < 0 ? "forward" : "back");
}, { passive: true });

// Two-finger horizontal swipe on a trackpad
let wheelX = 0;
let wheelLock = false;
let wheelReset;
addEventListener("wheel", (e) => {
  if (wheelLock || toc.open || Math.abs(e.deltaX) < Math.abs(e.deltaY) * 1.5) return;
  wheelX += e.deltaX;
  clearTimeout(wheelReset);
  wheelReset = setTimeout(() => (wheelX = 0), 250);
  if (Math.abs(wheelX) > 140) {
    wheelLock = true;
    go(wheelX > 0 ? "forward" : "back");
  }
}, { passive: true });

// ---------- Read aloud (in the language of the page) ----------
const readBtn = document.querySelector("[data-read]");
const synth = globalThis.speechSynthesis;

if (!synth) readBtn?.remove();

// Voices load asynchronously (getVoices() is often empty on first call), so
// pick the voice up front and refresh it whenever the list changes.
const wanted = locale.toLowerCase();
let pageVoice = null;
function pickVoice() {
  const voices = synth?.getVoices() ?? [];
  const lang = (v) => v.lang?.toLowerCase().replace("_", "-") ?? "";
  pageVoice = voices.find((v) => lang(v) === wanted && v.localService) ??
    voices.find((v) => lang(v) === wanted) ??
    voices.find((v) => lang(v).startsWith(wanted.split("-")[0])) ??
    null;
}
pickVoice();
synth?.addEventListener?.("voiceschanged", pickVoice);

function stopReading() {
  synth?.cancel();
  readBtn?.setAttribute("aria-pressed", "false");
}

readBtn?.addEventListener("click", () => {
  if (readBtn.getAttribute("aria-pressed") === "true") return stopReading();
  const parts = [...document.querySelectorAll("main h1, main [data-speak]")]
    .map((el) => el.innerText.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (!pageVoice) pickVoice();
  const voice = pageVoice;
  synth.cancel();
  parts.forEach((text, i) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = locale;
    u.rate = 0.92;
    u.pitch = 1.1;
    if (voice) u.voice = voice;
    if (i === parts.length - 1) u.onend = stopReading;
    synth.speak(u);
  });
  readBtn.setAttribute("aria-pressed", "true");
});
addEventListener("pagehide", stopReading);

// ---------- Sound toggle ----------
const soundBtn = document.querySelector("[data-sound]");
function paintSound() {
  soundBtn?.setAttribute("aria-pressed", String(progress.state.sound));
  soundBtn?.setAttribute("title", t(progress.state.sound ? "soundOn" : "soundOff"));
}
paintSound();
soundBtn?.addEventListener("click", () => {
  progress.set("sound", !progress.state.sound);
  paintSound();
  sound("ding");
});

// Canvas scenes are only loaded where needed
if (document.querySelector("space-canvas")) import("./canvas.js");

// ---------- Offline app: service worker and background updates ----------
// sw.js (written at build time) stores the whole book for offline use. When a
// new version is published, the new sw.js downloads it in the background and
// the next page turn shows it. The browser checks for a new sw.js by itself,
// but only now and then: an installed app can stay open for days, so we also
// check when the page loads, when the connection comes back and when the app
// returns to the foreground (at most every 30 minutes).
const UPDATE_EVERY = 30 * 60 * 1000;
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

async function registerOffline() {
  const reg = await navigator.serviceWorker.register(new URL("../../sw.js", import.meta.url), {
    updateViaCache: "none", // always fetch sw.js from the network when checking
  });
  // every page turn loads a new document, so the last check time is kept in storage
  const check = (force = false) => {
    if (!navigator.onLine || document.hidden || !reg.active) return;
    try {
      const last = Number(localStorage.getItem("lumi-update-check")) || 0;
      if (!force && Date.now() - last < UPDATE_EVERY) return;
      localStorage.setItem("lumi-update-check", String(Date.now()));
    } catch { /* no storage: check anyway */ }
    reg.update().catch(() => {/* offline or server down: try again later */});
  };
  check();
  addEventListener("online", () => check(true));
  document.addEventListener("visibilitychange", () => check());
  setInterval(check, UPDATE_EVERY);
  // An installed app keeps its storage (the book and saved progress) safe from eviction
  if (standalone) navigator.storage?.persist?.();
}

if ("serviceWorker" in navigator) {
  if (html.hasAttribute("data-offline")) {
    // wait for the page to finish loading, so the download doesn't slow it down
    addEventListener("load", () => registerOffline().catch(() => {}), { once: true });
  } else {
    // dev server: drop any worker left from a production build, so live reload works
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
  }
}
