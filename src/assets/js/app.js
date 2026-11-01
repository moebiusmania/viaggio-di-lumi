import Alpine from "alpinejs";
import { progress, sound } from "./core.js";
import "./store.js";
import "./components.js";
import "./lamp.js";

const html = document.documentElement;
const here = location.pathname;
const index = Number(html.dataset.index);

// ---------- Progress: visited pages, stars, medals ----------
progress.visit(here);
if (index >= 0) progress.set("last", here);

document.addEventListener("lumi:progress", () => {
  Alpine.store("book").sync();
  const counter = document.querySelector(".star-count");
  counter?.classList.remove("bump");
  void counter?.offsetWidth;
  counter?.classList.add("bump");
});

// ---------- Table of contents ----------
const toc = document.getElementById("toc");

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
  sound("flip");
  location.href = link.href;
}

document.querySelectorAll('a[rel="prev"], a[rel="next"]').forEach((a) =>
  a.addEventListener("click", () => sound("flip"))
);

function isTyping(el) {
  return el?.closest?.("input, textarea, select, [contenteditable], [role='slider']");
}

addEventListener("keydown", (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === "m" || e.key === "M") {
    if (isTyping(e.target)) return;
    toc.open ? toc.close() : Alpine.store("book").openToc();
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
  const reg = await navigator.serviceWorker.register(`${html.dataset.offline}sw.js`, {
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

// The app shell in the templates (x-* attributes) comes alive here
Alpine.start();
