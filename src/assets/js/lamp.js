// The desk lamp. Pointer movement, or tilting a phone or tablet, slides the pool of light
// over the desk and shifts the paper cut-outs against the back wall of each diorama, so
// the depth of the scenes reads as real. Only composited properties change: nothing repaints.
import { reduceMotion } from "./core.js";

const LITE = "lumi-lite";
const html = document.documentElement;

// Cutting every piece of paper live is heavy for an old tablet. If a page with a scene
// stays under about 40 frames per second, use the lighter look from now on.
function watchFrames() {
  let frames = 0;
  let start = 0;
  let last = 0;
  const count = (now) => {
    // a long gap means the tab was hidden or the page was busy loading: that says nothing
    if (last && now - last > 400) return;
    last = now;
    start ||= now;
    frames++;
    if (now - start < 2500) return requestAnimationFrame(count);
    if (frames / ((now - start) / 1000) >= 40) return;
    html.dataset.lite = "";
    try {
      localStorage.setItem(LITE, "1");
    } catch { /* no storage: measure again on the next page */ }
  };
  // skip the page turn, which is not what we are measuring
  setTimeout(() => requestAnimationFrame(count), 1200);
}

let lite = false;
try {
  lite = localStorage.getItem(LITE) === "1";
} catch { /* no storage */ }
if (lite) html.dataset.lite = "";
else if (document.querySelector(".scene")) watchFrames();

const lamp = document.querySelector(".lamp");
const scenes = () => document.querySelectorAll(".scene");

if (lamp && !reduceMotion) {
  // rest position: the lamp stands at the top left
  const rest = { x: -0.12, y: -0.2 };
  const target = { ...rest };
  const now = { ...rest };
  let frame = 0;

  const tick = () => {
    now.x += (target.x - now.x) * 0.09;
    now.y += (target.y - now.y) * 0.09;
    lamp.style.setProperty("--lx", now.x.toFixed(4));
    lamp.style.setProperty("--ly", now.y.toFixed(4));
    for (const scene of scenes()) {
      scene.style.setProperty("--px", now.x.toFixed(4));
      scene.style.setProperty("--py", now.y.toFixed(4));
    }
    const settled = Math.abs(target.x - now.x) + Math.abs(target.y - now.y) < 0.001;
    frame = settled ? 0 : requestAnimationFrame(tick);
  };

  const aim = (x, y) => {
    target.x = Math.max(-1, Math.min(1, x));
    target.y = Math.max(-1, Math.min(1, y));
    frame ||= requestAnimationFrame(tick);
  };

  addEventListener("pointermove", (e) => {
    aim(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1);
  }, { passive: true });

  // Android tells the tilt at once. iOS would show a permission prompt to a child
  // in the middle of reading, so there the lamp simply follows the finger.
  if (typeof DeviceOrientationEvent === "function" && !DeviceOrientationEvent.requestPermission) {
    let start = null;
    addEventListener("deviceorientation", (e) => {
      if (e.beta === null || e.gamma === null) return;
      start ??= { beta: e.beta, gamma: e.gamma };
      aim((e.gamma - start.gamma) / 22 + rest.x, (e.beta - start.beta) / 22 + rest.y);
    }, { passive: true });
  }
}
