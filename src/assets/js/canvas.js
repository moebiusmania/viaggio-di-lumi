// <space-canvas mode="…"> — small canvas simulations for the scenes that
// need hundreds of moving particles. Each mode is a tiny self-contained world.
// The texts they show come from the `strings` of the page's .md file (see t()).
import { confetti, pageDone, reduceMotion, restartAnimation, sound, t } from "./core.js";

const TAU = Math.PI * 2;
const INK = "#1d1846";
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

/** Cartoon face drawn straight on the canvas. */
function face(ctx, x, y, s, mood = "happy") {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#ff7aa2aa";
  for (const dx of [-0.55, 0.55]) {
    ctx.beginPath();
    ctx.ellipse(dx * s, 0.25 * s, 0.14 * s, 0.09 * s, 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = INK;
  for (const dx of [-0.3, 0.3]) {
    ctx.beginPath();
    ctx.ellipse(dx * s, -0.1 * s, 0.09 * s, 0.12 * s, 0, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.5, s * 0.07);
  ctx.lineCap = "round";
  ctx.beginPath();
  if (mood === "wow") ctx.ellipse(0, 0.28 * s, 0.1 * s, 0.13 * s, 0, 0, TAU);
  else ctx.arc(0, 0.12 * s, 0.2 * s, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

function glow(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/** A disc of paper. Its cast shadow and grain come from the scene (see .scene in components.css). */
function ball(ctx, x, y, r, fill) {
  // a hint of the board's thickness on the side away from the lamp
  ctx.beginPath();
  ctx.arc(x + 0.4, y + Math.min(2, r * 0.14), r, 0, TAU);
  ctx.fillStyle = "#6e5236";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** A tumbling snippet of paper: wide when it faces us, a sliver when it is edge-on. */
function snippet(ctx, x, y, size, color, turn) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(turn);
  ctx.scale(1, Math.max(0.2, Math.abs(Math.sin(turn * 1.7))));
  ctx.fillStyle = color;
  ctx.fillRect(-size, -size * 0.7, size * 2, size * 1.4);
  ctx.restore();
}

/* =================================================================
 * MODES
 * ================================================================= */
const MODES = {};

/* ---------- The Big Bang: countdown, flash, expanding fireworks ---------- */
MODES.bang = (host) => {
  let phase = "idle";
  let clock = 0;
  let parts = [];
  let flash = 0;
  let ring = 0;
  const COLORS = ["#ffffff", "#fff3a3", "#ffd23f", "#ff9f43", "#ff5d8f", "#c38cff", "#6fd3ff"];

  function boom() {
    const { w, h } = host;
    const scale = Math.min(w, h) / 300;
    parts = Array.from({ length: 520 }, () => {
      const a = rand(0, TAU);
      const s = rand(30, 420) * scale;
      return {
        x: w / 2,
        y: h / 2,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        r: rand(1, 3.4),
        c: pick(COLORS),
        tw: rand(0, TAU),
      };
    });
    flash = 1;
    ring = 0;
    phase = "boom";
    clock = 0;
    sound("boom");
    host.caption(t("boom"));
    confetti(host.scene, 40);
    setTimeout(() => pageDone(host.scene), 1200);
  }

  return {
    action(name) {
      if (name !== "bang" || phase === "count") return;
      phase = "count";
      clock = 0;
      let n = 3;
      host.caption("3...");
      const iv = setInterval(() => {
        n--;
        sound("pop");
        if (n > 0) host.caption(`${n}...`);
        else {
          clearInterval(iv);
          boom();
        }
      }, 550);
    },
    click() {
      this.action("bang");
    },
    step(dt) {
      clock += dt;
      flash = Math.max(0, flash - dt * 1.6);
      ring += dt * Math.max(host.w, host.h) * 0.9;
      const damp = Math.pow(0.35, dt);
      for (const p of parts) {
        p.vx *= damp;
        p.vy *= damp;
        // after the blast everything keeps drifting apart: space expands
        p.vx += (p.x - host.w / 2) * 0.03 * dt;
        p.vy += (p.y - host.h / 2) * 0.03 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.tw += dt * 4;
      }
      if (phase === "boom" && clock > 7) {
        parts = parts.filter((p) => p.x > -20 && p.x < host.w + 20 && p.y > -20 && p.y < host.h + 20);
      }
    },
    draw(ctx) {
      const { w, h } = host;
      const cx = w / 2;
      const cy = h / 2;
      if (phase !== "boom" || clock > 3.5) {
        // the tiny, super-hot dot waiting to begin
        const speed = phase === "count" ? 30 : 5;
        const r = 5 + Math.sin(performance.now() / 1000 * speed) * 2 + (phase === "count" ? 3 : 0);
        const a = phase === "boom" ? Math.min(1, (clock - 3.5) / 2) : 1;
        ctx.globalAlpha = a;
        glow(ctx, cx, cy, r * 8, "#fff3a3cc");
        ball(ctx, cx, cy, r, "#fff");
        ctx.globalAlpha = 1;
      }
      for (const p of parts) {
        snippet(ctx, p.x, p.y, p.r * 1.25, p.c, p.tw * 0.5);
      }
      ctx.globalAlpha = 1;
      if (phase === "boom" && ring < Math.max(w, h)) {
        ctx.strokeStyle = `rgba(255,243,163,${1 - ring / Math.max(w, h)})`;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(cx, cy, ring, 0, TAU);
        ctx.stroke();
      }
      if (flash > 0) {
        ctx.fillStyle = `rgba(255,250,220,${flash})`;
        ctx.fillRect(0, 0, w, h);
      }
    },
  };
};

/* ---------- Hot quark soup that cools into protons and neutrons ---------- */
MODES.soup = (host) => {
  let temp = 1;
  const QUARK = ["#ff5d6c", "#43d18a", "#4ba3ff"];
  let parts = [];
  let groups = [];

  function init() {
    const { w, h } = host;
    groups = Array.from(
      { length: 10 },
      (_, g) => ({ kind: g % 2 ? "n" : "p", x: rand(40, w - 40), y: rand(40, h - 40) }),
    );
    parts = [];
    groups.forEach((_, gi) => {
      for (let k = 0; k < 3; k++) {
        parts.push({ type: "q", g: gi, k, c: QUARK[k], x: rand(10, w - 10), y: rand(10, h - 10), vx: 0, vy: 0, r: 7 });
      }
    });
    for (let i = 0; i < 16; i++) parts.push({ type: "e", x: rand(0, w), y: rand(0, h), vx: 0, vy: 0, r: 4 });
    for (let i = 0; i < 18; i++) {
      parts.push({ type: "l", x: rand(0, w), y: rand(0, h), vx: 0, vy: 0, r: 2, a: rand(0, TAU) });
    }
  }

  const centre = (gi) => {
    const qs = parts.filter((q) => q.type === "q" && q.g === gi);
    return [qs.reduce((a, q) => a + q.x, 0) / 3, qs.reduce((a, q) => a + q.y, 0) / 3];
  };

  let reported = false;
  let lastLabel = "";
  return {
    init,
    resize: init,
    param(name, v) {
      if (name !== "temp") return;
      temp = v;
      const label = temp > 0.7 ? t("hot") : temp > 0.35 ? t("warm") : temp > 0.12 ? t("cool") : t("cold");
      if (label !== lastLabel) host.caption(label);
      lastLabel = label;
      if (temp < 0.12 && !reported) {
        reported = true;
        setTimeout(() => pageDone(host.scene), 600);
      }
    },
    step(dt) {
      const { w, h } = host;
      const energy = 40 + temp * 520;
      const bind = Math.max(0, 0.4 - temp) / 0.4; // 0 hot → 1 cold
      // group centres wander slowly
      for (const g of groups) {
        g.x += rand(-1, 1) * energy * 0.05 * dt;
        g.y += rand(-1, 1) * energy * 0.05 * dt;
        g.x = Math.min(w - 30, Math.max(30, g.x));
        g.y = Math.min(h - 30, Math.max(30, g.y));
      }
      for (const p of parts) {
        p.vx += rand(-1, 1) * energy * 6 * dt;
        p.vy += rand(-1, 1) * energy * 6 * dt;
        if (p.type === "q" && bind > 0) {
          const g = groups[p.g];
          const tx = g.x + Math.cos(p.k * TAU / 3) * 8;
          const ty = g.y + Math.sin(p.k * TAU / 3) * 8;
          p.vx += (tx - p.x) * 30 * bind * dt;
          p.vy += (ty - p.y) * 30 * bind * dt;
        }
        const damp = Math.pow(p.type === "q" && bind > 0 ? 0.02 : 0.25, dt);
        p.vx *= damp;
        p.vy *= damp;
        const max = energy * (p.type === "l" ? 2 : 1);
        const s = Math.hypot(p.vx, p.vy);
        if (s > max) {
          p.vx *= max / s;
          p.vy *= max / s;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < p.r || p.x > w - p.r) p.vx *= -1;
        if (p.y < p.r || p.y > h - p.r) p.vy *= -1;
        p.x = Math.min(w - p.r, Math.max(p.r, p.x));
        p.y = Math.min(h - p.r, Math.max(p.r, p.y));
        if (p.a !== undefined) p.a += dt * 10;
      }
    },
    draw(ctx) {
      const { w, h } = host;
      // the heat haze
      const heat = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
      heat.addColorStop(0, `rgba(255,${180 + 60 * (1 - temp)},90,${0.55 * temp})`);
      heat.addColorStop(1, `rgba(255,90,60,${0.25 * temp})`);
      ctx.fillStyle = heat;
      ctx.fillRect(0, 0, w, h);

      const bind = Math.max(0, 0.4 - temp) / 0.4;
      if (bind > 0.3) {
        groups.forEach((g, gi) => {
          const [mx, my] = centre(gi);
          ctx.globalAlpha = Math.min(1, (bind - 0.3) * 2);
          ball(ctx, mx, my, 17, g.kind === "p" ? "#ffb3c9" : "#d7d3e6");
          ctx.globalAlpha = 1;
        });
      }
      for (const p of parts) {
        if (p.type === "q") ball(ctx, p.x, p.y, p.r, p.c);
        else if (p.type === "e") ball(ctx, p.x, p.y, p.r, "#ffe066");
        else {
          ctx.strokeStyle = "#fffbe0";
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = -6; i <= 6; i++) {
            const px = p.x + i;
            const py = p.y + Math.sin(p.a + i) * 2.5;
            i === -6 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      }
      if (bind > 0.6) {
        ctx.font = "800 13px 'Caveat Brush', cursive";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        groups.forEach((g, gi) => {
          const [mx, my] = centre(gi);
          ball(ctx, mx + 15, my - 15, 8, g.kind === "p" ? "#ff5d8f" : "#8a8f9e");
          ctx.fillStyle = "#fff";
          ctx.fillText(g.kind === "p" ? "p" : "n", mx + 15, my - 15);
        });
      }
    },
  };
};

/* ---------- Old TV static: a bit of it is the Big Bang's first light ---------- */
MODES.static = (host) => {
  let on = false;
  const noise = document.createElement("canvas");
  noise.width = 110;
  noise.height = 80;
  const nctx = noise.getContext("2d");
  const img = nctx.createImageData(noise.width, noise.height);
  let frame = 0;

  return {
    action(name) {
      if (name !== "tv") return;
      on = !on;
      host.el.classList.toggle("tv-on", on);
      sound(on ? "ding" : "pop");
      host.caption(
        on ? t("tvOn") : t("tvOff"),
      );
      if (on) setTimeout(() => pageDone(host.scene), 900);
    },
    click() {
      this.action("tv");
    },
    step() {
      frame++;
    },
    draw(ctx) {
      const { w, h } = host;
      if (!on) {
        ctx.fillStyle = "#1f2a38";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "rgba(255,255,255,.08)";
        ctx.beginPath();
        ctx.ellipse(w * 0.3, h * 0.25, w * 0.25, h * 0.12, -0.4, 0, TAU);
        ctx.fill();
        return;
      }
      if (frame % 2 === 0) {
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
          const v = Math.random() * 255;
          const cmb = Math.random() < 0.012;
          d[i] = cmb ? 255 : v;
          d[i + 1] = cmb ? 210 : v;
          d[i + 2] = cmb ? 60 : v;
          d[i + 3] = 255;
        }
        nctx.putImageData(img, 0, 0);
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(noise, 0, 0, w, h);
    },
  };
};

/* ---------- Gravity pulls gas together until a star is born ---------- */
MODES.gravity = (host) => {
  let bodies = [];
  let born = false;
  const G = 2600;

  function add(x, y, n = 1, spread = 0) {
    for (let i = 0; i < n; i++) {
      bodies.push({
        x: x + rand(-spread, spread),
        y: y + rand(-spread, spread),
        vx: rand(-8, 8),
        vy: rand(-8, 8),
        m: 1,
      });
    }
  }

  function init() {
    bodies = [];
    for (let i = 0; i < 150; i++) add(rand(10, host.w - 10), rand(10, host.h - 10));
  }

  const radius = (m) => 2 + Math.sqrt(m) * 1.5;

  return {
    init,
    click(x, y) {
      add(x, y, 14, 30);
      sound("pop");
      host.caption(t("moreGas"));
    },
    action(name) {
      if (name === "reset") {
        init();
        born = false;
        host.caption(t("restart"));
      }
    },
    step(dt) {
      const { w, h } = host;
      for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i];
        for (let j = i + 1; j < bodies.length; j++) {
          const b = bodies[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d2 = dx * dx + dy * dy + 60;
          const f = G / (d2 * Math.sqrt(d2));
          a.vx += dx * f * b.m * dt;
          a.vy += dy * f * b.m * dt;
          b.vx -= dx * f * a.m * dt;
          b.vy -= dy * f * a.m * dt;
        }
      }
      const damp = Math.pow(0.7, dt);
      for (const b of bodies) {
        b.vx *= damp;
        b.vy *= damp;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < 0 || b.x > w) b.vx *= -0.5;
        if (b.y < 0 || b.y > h) b.vy *= -0.5;
        b.x = Math.min(w, Math.max(0, b.x));
        b.y = Math.min(h, Math.max(0, b.y));
      }
      // merge touching clumps
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const a = bodies[i];
          const b = bodies[j];
          if (Math.hypot(a.x - b.x, a.y - b.y) < (radius(a.m) + radius(b.m)) * 0.6) {
            const m = a.m + b.m;
            a.x = (a.x * a.m + b.x * b.m) / m;
            a.y = (a.y * a.m + b.y * b.m) / m;
            a.vx = (a.vx * a.m + b.vx * b.m) / m;
            a.vy = (a.vy * a.m + b.vy * b.m) / m;
            a.m = m;
            bodies.splice(j--, 1);
          }
        }
      }
      if (!born && bodies.some((b) => b.m >= 30)) {
        born = true;
        sound("win");
        host.caption(t("starBorn"));
        pageDone(host.scene);
      }
    },
    draw(ctx) {
      for (const b of bodies) {
        const r = radius(b.m);
        if (b.m >= 30) {
          glow(ctx, b.x, b.y, r * 3.2, "#ffd23faa");
          ball(ctx, b.x, b.y, r, "#ffe066");
          face(ctx, b.x, b.y + r * 0.1, r * 0.9);
        } else if (b.m >= 8) {
          glow(ctx, b.x, b.y, r * 2.2, "#ff9f4366");
          ball(ctx, b.x, b.y, r, "#ffb36b");
        } else {
          ctx.fillStyle = b.m > 2 ? "#b8d8ff" : "#8fb4ffcc";
          ctx.beginPath();
          ctx.arc(b.x, b.y, r, 0, TAU);
          ctx.fill();
        }
      }
    },
  };
};

/* ---------- A giant star explodes and scatters new elements ---------- */
MODES.supernova = (host) => {
  let phase = "star";
  let clock = 0;
  let parts = [];
  const ELEMENTS = [["C", "#3a3a3a"], ["O", "#6fd3ff"], ["Fe", "#c7743a"], ["Au", "#ffd23f"], ["Si", "#b28cff"], [
    "Ca",
    "#ffffff",
  ], ["N", "#7ee8b8"]];

  function explode() {
    const { w, h } = host;
    const s = Math.min(w, h) / 300;
    parts = Array.from({ length: 380 }, () => {
      const a = rand(0, TAU);
      const v = rand(40, 360) * s;
      return {
        x: w / 2,
        y: h / 2,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        c: pick(["#ff5d8f", "#ffd23f", "#6fd3ff", "#c38cff", "#ff9f43"]),
        r: rand(1.5, 3.5),
      };
    });
    ELEMENTS.forEach(([sym, c], i) => {
      const a = (i / ELEMENTS.length) * TAU + rand(-0.2, 0.2);
      const v = rand(90, 140) * s;
      parts.push({ x: w / 2, y: h / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c, r: 15, sym });
    });
    phase = "boom";
    clock = 0;
    sound("boom");
    host.caption(t("boom"));
    confetti(host.scene, 50);
    setTimeout(() => pageDone(host.scene), 1500);
  }

  return {
    click() {
      this.action("boom");
    },
    action(name) {
      if (name !== "boom") return;
      if (phase === "star") {
        phase = "collapse";
        clock = 0;
        host.caption(t("collapse"));
      } else if (phase === "boom" && clock > 3) {
        phase = "star";
        parts = [];
        host.caption(t("again"));
      }
    },
    step(dt) {
      clock += dt;
      if (phase === "collapse" && clock > 0.9) explode();
      const damp = Math.pow(0.5, dt);
      for (const p of parts) {
        p.vx *= p.sym ? Math.pow(0.35, dt) : damp;
        p.vy *= p.sym ? Math.pow(0.35, dt) : damp;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    },
    draw(ctx) {
      const { w, h } = host;
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) * 0.2;
      if (phase === "star" || phase === "collapse") {
        const k = phase === "collapse" ? Math.max(0.15, 1 - clock) : 1 + Math.sin(performance.now() / 400) * 0.03;
        const r = R * k;
        glow(ctx, cx, cy, r * 1.8, "#ff5d3d88");
        const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
        g.addColorStop(0, "#ffd08a");
        g.addColorStop(1, "#ff5d3d");
        ball(ctx, cx, cy, r, g);
        face(ctx, cx, cy + r * 0.1, r * 0.8, phase === "collapse" ? "wow" : "happy");
        return;
      }
      if (clock < 0.4) {
        ctx.fillStyle = `rgba(255,255,255,${1 - clock / 0.4})`;
        ctx.fillRect(0, 0, w, h);
      }
      const ringR = clock * Math.max(w, h) * 0.8;
      ctx.strokeStyle = `rgba(111,211,255,${Math.max(0, 1 - clock / 1.5)})`;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, TAU);
      ctx.stroke();
      // tiny leftover core
      glow(ctx, cx, cy, 16, "#ffffffcc");
      for (const p of parts) {
        if (!p.sym) snippet(ctx, p.x, p.y, p.r * 1.2, p.c, p.x * 0.05 + clock * 3);
      }
      ctx.font = "800 15px 'Caveat Brush', cursive";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const p of parts) {
        if (!p.sym) continue;
        ball(ctx, p.x, p.y, p.r, p.c);
        ctx.fillStyle = p.c === "#3a3a3a" ? "#fff" : INK;
        ctx.fillText(p.sym, p.x, p.y + 1);
      }
    },
  };
};

/* ---------- Dust in the disk around the young Sun sticks into planets ---------- */
MODES.accretion = (host) => {
  let bodies = [];
  let speed = 1;
  let reported = false;
  let rin;
  let rout;
  let frost;

  const radius = (m) => 1.6 + Math.sqrt(m) * 1.1;

  function add(R, n = 1) {
    for (let i = 0; i < n; i++) bodies.push({ R: R + rand(-6, 6), a: rand(0, TAU), m: 1 });
  }

  function init() {
    const s = Math.min(host.w, host.h);
    rin = s * 0.17;
    rout = s * 0.49;
    frost = rin + (rout - rin) * 0.38;
    bodies = [];
    for (let i = 0; i < 190; i++) add(rand(rin, rout));
  }

  return {
    init,
    action(name) {
      if (name === "fast") {
        speed = speed === 1 ? 5 : 1;
        host.el.querySelector("[data-action=fast]").textContent = speed === 1 ? t("fast") : t("normal");
      }
      if (name === "reset") {
        init();
        reported = false;
      }
    },
    click(x, y) {
      const R = Math.hypot(x - host.w / 2, y - host.h / 2);
      if (R < rin * 0.8) return;
      add(R, 10);
      sound("pop");
    },
    step(dt) {
      dt *= speed;
      for (const b of bodies) b.a += 2.2 * Math.pow(b.R / rin, -1.5) * dt;
      for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i];
        const ax = Math.cos(a.a) * a.R;
        const ay = Math.sin(a.a) * a.R;
        for (let j = i + 1; j < bodies.length; j++) {
          const b = bodies[j];
          const reach = radius(a.m) + radius(b.m) + 3;
          if (Math.abs(a.R - b.R) > reach) continue;
          const d = Math.hypot(ax - Math.cos(b.a) * b.R, ay - Math.sin(b.a) * b.R);
          if (d < reach) {
            const m = a.m + b.m;
            a.R = (a.R * a.m + b.R * b.m) / m;
            a.m = m;
            bodies.splice(j--, 1);
          }
        }
      }
      const planets = bodies.filter((b) => b.m >= 10).length;
      host.counter(t("counter", { n: planets }));
      if (!reported && planets >= 4) {
        reported = true;
        host.caption(t("done"));
        pageDone(host.scene);
      }
    },
    draw(ctx) {
      const cx = host.w / 2;
      const cy = host.h / 2;
      // disk haze
      const g = ctx.createRadialGradient(cx, cy, rin * 0.6, cx, cy, rout);
      g.addColorStop(0, "rgba(255,190,110,.25)");
      g.addColorStop(1, "rgba(140,170,255,.05)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, rout + 8, 0, TAU);
      ctx.fill();
      // frost line
      ctx.setLineDash([6, 8]);
      ctx.strokeStyle = "rgba(160,220,255,.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, frost, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "800 12px 'Caveat Brush', cursive";
      ctx.fillStyle = "rgba(190,235,255,.95)";
      ctx.textAlign = "center";
      ctx.fillText(t("frostLine"), cx, cy - frost - 6);
      // the young Sun
      const sr = rin * 0.55;
      glow(ctx, cx, cy, sr * 2.4, "#ffd23f99");
      ball(ctx, cx, cy, sr, "#ffe066");
      face(ctx, cx, cy + sr * 0.1, sr * 0.85);
      for (const b of bodies) {
        const x = cx + Math.cos(b.a) * b.R;
        const y = cy + Math.sin(b.a) * b.R;
        const r = radius(b.m);
        const icy = b.R > frost;
        if (b.m >= 10) {
          const color = icy ? (b.m > 20 ? "#f2b36b" : "#8fd8ff") : "#c78f64";
          ball(ctx, x, y, r, color);
          if (r > 7) face(ctx, x, y + r * 0.1, r * 0.8);
        } else {
          ctx.fillStyle = icy ? "#cdeeff" : "#e0b48c";
          ctx.beginPath();
          ctx.arc(x, y, r, 0, TAU);
          ctx.fill();
        }
      }
    },
  };
};

/* ---------- Baby Earth grows from rocks (or fills with water from comets) ---------- */
MODES.earth = (host) => {
  const comets = host.el.getAttribute("variant") === "comets";
  const need = comets ? 8 : 10;
  let hits = 0;
  let rocks = [];
  let sparks = [];
  const blobs = [];
  let auto = 0;
  let wobble = 0;

  const base = () => Math.min(host.w, host.h) * (comets ? 0.25 : 0.12);
  const earthR = () => comets ? base() : base() * (1 + Math.min(hits, need) * 0.09);

  function launch(x, y) {
    const { w, h } = host;
    if (x === undefined) {
      const a = rand(0, TAU);
      x = w / 2 + Math.cos(a) * Math.max(w, h) * 0.7;
      y = h / 2 + Math.sin(a) * Math.max(w, h) * 0.7;
    }
    const dx = w / 2 - x;
    const dy = h / 2 - y;
    const d = Math.hypot(dx, dy);
    const v = Math.min(w, h) * 0.9;
    rocks.push({ x, y, vx: (dx / d) * v, vy: (dy / d) * v, r: rand(5, 9), spin: rand(0, TAU) });
  }

  function hit(rock) {
    hits++;
    wobble = 1;
    sound(comets ? "ding" : "boom");
    for (let i = 0; i < 14; i++) {
      const a = rand(0, TAU);
      sparks.push({
        x: rock.x,
        y: rock.y,
        vx: Math.cos(a) * rand(40, 140),
        vy: Math.sin(a) * rand(40, 140),
        life: 1,
        c: comets ? "#bfefff" : pick(["#ffd23f", "#ff9f43", "#ff5d3d"]),
      });
    }
    if (comets) {
      // spread the new seas around the planet so it slowly turns blue everywhere
      const a = (blobs.length * 2.4) + rand(-0.4, 0.4);
      blobs.push({ a, d: rand(0.25, 0.75), r: 0, target: rand(0.35, 0.5) });
    }
    host.counter(t("counter", { n: Math.min(hits, need), need }));
    if (hits === need) {
      host.caption(t("done"));
      pageDone(host.scene);
    }
  }

  return {
    init() {
      host.counter(t("counter", { n: 0, need }));
    },
    click(x, y) {
      const d = Math.hypot(x - host.w / 2, y - host.h / 2);
      if (d < earthR() * 1.3) launch();
      else launch(x, y);
      sound("pop");
    },
    action(name) {
      if (name === "launch") {
        launch();
        sound("pop");
      }
    },
    step(dt) {
      auto += dt;
      if (auto > 2.2 && hits < need) {
        auto = 0;
        launch();
      }
      wobble = Math.max(0, wobble - dt * 3);
      const R = earthR();
      for (const r of rocks) {
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        r.spin += dt * 5;
        if (Math.hypot(r.x - host.w / 2, r.y - host.h / 2) < R + r.r * 0.5) {
          r.dead = true;
          hit(r);
        }
      }
      rocks = rocks.filter((r) => !r.dead);
      for (const s of sparks) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life -= dt * 1.6;
      }
      sparks = sparks.filter((s) => s.life > 0);
      for (const b of blobs) b.r += (b.target - b.r) * Math.min(1, dt * 2);
    },
    draw(ctx) {
      const cx = host.w / 2;
      const cy = host.h / 2;
      const R = earthR() * (1 + wobble * 0.06);
      const cool = comets ? 1 : Math.min(1, hits / need);
      if (!comets) glow(ctx, cx, cy, R * 1.8, `rgba(255,120,50,${0.5 - cool * 0.2})`);
      // planet body
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.fillStyle = comets ? "#8d6e5a" : "#ff7a3d";
      ctx.fill();
      ctx.clip();
      if (!comets) {
        // glowing lava cracks and darker cooling crust patches
        ctx.strokeStyle = "#ffe066";
        ctx.lineWidth = 3;
        const t = performance.now() / 1000;
        for (let i = 0; i < 6; i++) {
          const a = i * 1.1 + t * 0.2;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * R * 0.2, cy + Math.sin(a) * R * 0.2);
          ctx.quadraticCurveTo(
            cx + Math.cos(a + 0.6) * R * 0.7,
            cy + Math.sin(a + 0.6) * R * 0.5,
            cx + Math.cos(a + 0.3) * R,
            cy + Math.sin(a + 0.3) * R,
          );
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(120,50,40,.55)";
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.arc(cx + Math.cos(i * 2.3) * R * 0.55, cy + Math.sin(i * 2.3) * R * 0.5, R * 0.22, 0, TAU);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = "#6f5446";
        for (let i = 0; i < 7; i++) {
          ctx.beginPath();
          ctx.arc(cx + Math.cos(i * 1.9) * R * 0.6, cy + Math.sin(i * 1.9) * R * 0.55, R * 0.16, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = "#3fa9f5";
        for (const b of blobs) {
          ctx.beginPath();
          ctx.arc(cx + Math.cos(b.a) * b.d * R, cy + Math.sin(b.a) * b.d * R, b.r * R, 0, TAU);
          ctx.fill();
        }
      }
      // shading
      const shade = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.4, R * 0.2, cx, cy, R * 1.1);
      shade.addColorStop(0, "rgba(255,255,255,.25)");
      shade.addColorStop(1, "rgba(0,0,0,.25)");
      ctx.fillStyle = shade;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.restore();
      face(ctx, cx, cy + R * 0.12, R * 0.6, wobble > 0.3 ? "wow" : "happy");

      for (const r of rocks) {
        if (comets) {
          const a = Math.atan2(r.vy, r.vx);
          const tail = ctx.createLinearGradient(r.x, r.y, r.x - Math.cos(a) * 60, r.y - Math.sin(a) * 60);
          tail.addColorStop(0, "rgba(190,240,255,.9)");
          tail.addColorStop(1, "rgba(190,240,255,0)");
          ctx.strokeStyle = tail;
          ctx.lineWidth = r.r * 1.6;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(r.x, r.y);
          ctx.lineTo(r.x - Math.cos(a) * 60, r.y - Math.sin(a) * 60);
          ctx.stroke();
          ball(ctx, r.x, r.y, r.r, "#e8fbff");
        } else {
          ctx.save();
          ctx.translate(r.x, r.y);
          ctx.rotate(r.spin);
          ctx.beginPath();
          for (let i = 0; i < 7; i++) {
            const a = (i / 7) * TAU;
            const rr = r.r * (0.75 + ((i * 37) % 10) / 30);
            i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          }
          ctx.closePath();
          ctx.fillStyle = "#9c8a7a";
          ctx.fill();
          ctx.restore();
        }
      }
      for (const s of sparks) {
        ctx.globalAlpha = Math.max(0, s.life);
        ctx.fillStyle = s.c;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 3, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
  };
};

/* =================================================================
 * The element
 * ================================================================= */
class SpaceCanvas extends HTMLElement {
  connectedCallback() {
    this.canvas = this.querySelector("canvas");
    this.scene = this.querySelector(".scene") ?? this;
    this.captionEl = this.querySelector(".caption");
    this.counterEl = this.querySelector(".counter-pill");
    this.ctx = this.canvas.getContext("2d");
    this.w = 0;
    this.h = 0;
    const host = {
      el: this,
      scene: this.scene,
      caption: (text) => {
        if (!this.captionEl || this.captionEl.textContent === text) return;
        this.captionEl.textContent = text;
        restartAnimation(this.captionEl, "pop");
      },
      counter: (text) => {
        if (this.counterEl && this.counterEl.textContent !== text) this.counterEl.textContent = text;
      },
    };
    // modes always read the live canvas size
    Object.defineProperties(host, {
      w: { get: () => this.w },
      h: { get: () => this.h },
    });
    this.mode = MODES[this.getAttribute("mode")](host);

    new ResizeObserver(() => this.resize()).observe(this.canvas);
    this.resize();
    this.mode.init?.();

    this.canvas.addEventListener("pointerdown", (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.mode.click?.(e.clientX - r.left, e.clientY - r.top);
    });
    this.querySelectorAll("[data-action]").forEach((b) =>
      b.addEventListener("click", () => this.mode.action?.(b.dataset.action))
    );
    this.querySelectorAll("[data-param]").forEach((input) => {
      const send = () => {
        const v = (input.value - input.min) / (input.max - input.min);
        input.style.setProperty("--val", v * 100);
        this.mode.param?.(input.dataset.param, v);
      };
      input.addEventListener("input", send);
      send();
    });

    // only animate while visible
    this.visible = true;
    new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible) this.loop();
    }).observe(this.canvas);
    this.loop();
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const { width, height } = this.canvas.getBoundingClientRect();
    if (!width || !height) return;
    const first = this.w === 0;
    this.w = width;
    this.h = height;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!first) this.mode.resize?.();
  }

  loop() {
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    const frame = (now) => {
      if (!this.visible || !this.isConnected) {
        this.running = false;
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000) * (reduceMotion ? 0.5 : 1);
      last = now;
      this.mode.step?.(dt);
      this.ctx.clearRect(0, 0, this.w, this.h);
      this.mode.draw(this.ctx);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}

customElements.define("space-canvas", SpaceCanvas);
