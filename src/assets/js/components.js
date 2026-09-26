// Interactive building blocks used by the pages. All vanilla custom elements.
import { confetti, pageDone, progress, restartAnimation, shuffle, sound } from "./core.js";

const define = (name, cls) => customElements.get(name) || customElements.define(name, cls);

/** Makes a non-button element behave like a button for keyboard users. */
function pressable(el, onPress) {
  el.tabIndex = 0;
  if (!el.getAttribute("role")) el.setAttribute("role", "button");
  el.addEventListener("click", onPress);
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPress(e);
    }
  });
}

/* ------------------------------------------------------------------
 * <scene-slider data-steps='["...", "..."]' done-at="0.95">
 *   Drives the CSS variable --t (0 → 1) from a range input so the scene
 *   can morph purely in CSS. The caption follows the steps.
 * ------------------------------------------------------------------ */
define(
  "scene-slider",
  class extends HTMLElement {
    connectedCallback() {
      this.input = this.querySelector("input[type=range]");
      this.caption = this.querySelector(".caption");
      this.steps = JSON.parse(this.dataset.steps ?? "[]");
      this.doneAt = Number(this.getAttribute("done-at") ?? 0.95);
      this.lastStep = -1;
      this.input.addEventListener("input", () => this.update());
      this.update(true);
    }

    update(initial = false) {
      const { input } = this;
      const t = (input.value - input.min) / (input.max - input.min);
      this.style.setProperty("--t", t);
      input.style.setProperty("--val", t * 100);
      const step = Math.min(this.steps.length - 1, Math.floor(t * this.steps.length));
      this.dataset.step = step;
      if (step !== this.lastStep && this.caption && this.steps.length) {
        this.caption.textContent = this.steps[step];
        if (!initial) {
          restartAnimation(this.caption, "pop");
          sound("pop");
        }
        this.lastStep = step;
      }
      if (!initial && t >= this.doneAt && !this.done) {
        this.done = true;
        pageDone(this.querySelector(".scene") ?? this);
      }
    }
  },
);

/* ------------------------------------------------------------------
 * <hold-button target="#id" ms="1800" data-done-text="...">
 *   Press and hold to charge. Sets --p on itself and on the target,
 *   then adds the class "on" to the target when fully charged.
 * ------------------------------------------------------------------ */
define(
  "hold-button",
  class extends HTMLElement {
    connectedCallback() {
      this.classList.add("btn", "big");
      this.tabIndex = 0;
      this.setAttribute("role", "button");
      this.target = document.querySelector(this.getAttribute("target"));
      this.ms = Number(this.getAttribute("ms") ?? 1800);
      this.p = 0;
      const start = (e) => {
        e.preventDefault();
        if (this.holding) return;
        this.holding = true;
        this.classList.add("holding");
        this.tick();
      };
      const stop = () => {
        this.holding = false;
        this.classList.remove("holding");
      };
      this.addEventListener("pointerdown", start);
      this.addEventListener("pointerup", stop);
      this.addEventListener("pointerleave", stop);
      this.addEventListener("pointercancel", stop);
      this.addEventListener("contextmenu", (e) => e.preventDefault());
      this.addEventListener("keydown", (e) => (e.key === " " || e.key === "Enter") && start(e));
      this.addEventListener("keyup", stop);
    }

    tick() {
      let last = performance.now();
      const step = (now) => {
        const dt = now - last;
        last = now;
        if (this.p >= 1) return;
        this.p = Math.max(0, Math.min(1, this.p + (this.holding ? dt / this.ms : -dt / (this.ms / 2))));
        this.style.setProperty("--p", this.p);
        this.target?.style.setProperty("--p", this.p);
        if (this.p >= 1) return this.complete();
        if (this.holding || this.p > 0) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    complete() {
      this.holding = false;
      this.classList.remove("holding");
      this.classList.add("done");
      this.target?.classList.add("on");
      if (this.dataset.doneText) this.textContent = this.dataset.doneText;
      sound("boom");
      pageDone(this.target ?? this);
    }
  },
);

/* ------------------------------------------------------------------
 * <anim-trigger target="#id" done-ms="2500"><button>Via!</button></anim-trigger>
 *   Each click (re)starts the CSS animation class "run" on the target.
 * ------------------------------------------------------------------ */
define(
  "anim-trigger",
  class extends HTMLElement {
    connectedCallback() {
      const target = document.querySelector(this.getAttribute("target"));
      const button = this.querySelector("button");
      const doneMs = Number(this.getAttribute("done-ms") ?? 1500);
      button.addEventListener("click", () => {
        restartAnimation(target, "run");
        sound(this.getAttribute("sound") ?? "boom");
        button.disabled = true;
        setTimeout(() => {
          button.disabled = false;
          if (this.dataset.againText) button.textContent = this.dataset.againText;
          pageDone(target);
        }, doneMs);
      });
    }
  },
);

/* ------------------------------------------------------------------
 * <flip-card style="--c: ..."><div class="face front">…</div><div class="face back">…</div></flip-card>
 *   Completes the page when every card on it has been turned at least once.
 * ------------------------------------------------------------------ */
define(
  "flip-card",
  class extends HTMLElement {
    connectedCallback() {
      if (!this.querySelector(".card-inner")) {
        const inner = document.createElement("div");
        inner.className = "card-inner";
        inner.append(...this.children);
        this.append(inner);
      }
      this.setAttribute("aria-pressed", "false");
      pressable(this, () => {
        const flipped = this.getAttribute("aria-pressed") !== "true";
        this.setAttribute("aria-pressed", String(flipped));
        this.seen = true;
        sound("pop");
        const all = [...document.querySelectorAll("flip-card")];
        if (!this.reported && all.every((c) => c.seen)) {
          all.forEach((c) => (c.reported = true));
          pageDone(this);
        }
      });
    }
  },
);

/* ------------------------------------------------------------------
 * <hot-spots>
 *   <div class="scene">… <button class="spot" style="--x:20%;--y:30%" data-label="Nome" data-tip="Spiegazione"></button></div>
 *   <output class="caption"></output>
 * </hot-spots>
 * ------------------------------------------------------------------ */
define(
  "hot-spots",
  class extends HTMLElement {
    connectedCallback() {
      this.spots = [...this.querySelectorAll(".spot")];
      this.caption = this.querySelector(".caption");
      this.counter = document.createElement("p");
      this.counter.className = "counter-pill";
      this.append(this.counter);
      this.spots.forEach((spot) => {
        spot.setAttribute("aria-label", "Scopri cosa c'è qui");
        spot.addEventListener("click", () => this.reveal(spot));
      });
      this.paint();
    }

    reveal(spot) {
      this.spots.forEach((s) => s.classList.toggle("active", s === spot));
      spot.classList.add("found");
      spot.setAttribute("aria-label", spot.dataset.label);
      this.caption.innerHTML = `<b>${spot.dataset.label}:</b> ${spot.dataset.tip}`;
      restartAnimation(this.caption, "pop");
      sound("pop");
      this.dataset.found = spot.dataset.key ?? "";
      this.paint();
      if (!this.done && this.spots.every((s) => s.classList.contains("found"))) {
        this.done = true;
        pageDone(this);
      }
    }

    paint() {
      const found = this.spots.filter((s) => s.classList.contains("found")).length;
      this.counter.textContent = `Scoperti: ${found} su ${this.spots.length}`;
    }
  },
);

/* ------------------------------------------------------------------
 * Drag (pointer) or tap-then-tap helper shared by the two games below.
 * ------------------------------------------------------------------ */
function draggable(chip, { onTap, onDrop }) {
  let start = null;
  let ghostOffset = null;
  chip.addEventListener("pointerdown", (e) => {
    if (chip.classList.contains("placed")) return;
    start = { x: e.clientX, y: e.clientY };
    chip.setPointerCapture(e.pointerId);
  });
  chip.addEventListener("pointermove", (e) => {
    if (!start) return;
    const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    if (!ghostOffset && dist > 8) {
      const r = chip.getBoundingClientRect();
      ghostOffset = { x: start.x - r.left, y: start.y - r.top, w: r.width };
      chip.style.width = `${r.width}px`;
      chip.classList.add("dragging");
    }
    if (ghostOffset) {
      chip.style.left = `${e.clientX - ghostOffset.x}px`;
      chip.style.top = `${e.clientY - ghostOffset.y}px`;
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest(".bin");
      document.querySelectorAll(".bin").forEach((b) => b.classList.toggle("over", b === over));
    }
  });
  const end = (e) => {
    if (!start) return;
    const wasDragging = !!ghostOffset;
    start = null;
    ghostOffset = null;
    chip.classList.remove("dragging");
    chip.style.left = chip.style.top = chip.style.width = "";
    document.querySelectorAll(".bin.over").forEach((b) => b.classList.remove("over"));
    if (wasDragging) {
      const bin = document.elementFromPoint(e.clientX, e.clientY)?.closest(".bin");
      if (bin) onDrop(bin);
    } else if (e.type === "pointerup") {
      onTap();
    }
  };
  chip.addEventListener("pointerup", end);
  chip.addEventListener("pointercancel", end);
  chip.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onTap();
    }
  });
}

/* ------------------------------------------------------------------
 * <sort-game>
 *   <div class="pool"><button class="chip" data-bin="a">…</button></div>
 *   <div class="bins"><div class="bin" data-bin="a"><h3>…</h3><div class="bin-items"></div></div></div>
 * ------------------------------------------------------------------ */
define(
  "sort-game",
  class extends HTMLElement {
    connectedCallback() {
      this.pool = this.querySelector(".pool");
      this.chips = shuffle([...this.pool.querySelectorAll(".chip")]);
      this.pool.append(...this.chips);
      this.hint = this.querySelector(".caption");

      this.chips.forEach((chip) => {
        chip.type = "button";
        chip.setAttribute("aria-pressed", "false");
        draggable(chip, {
          onTap: () => this.select(chip),
          onDrop: (bin) => this.drop(chip, bin),
        });
      });

      this.querySelectorAll(".bin").forEach((bin) => {
        bin.tabIndex = 0;
        bin.setAttribute("role", "button");
        const use = () => this.selected && this.drop(this.selected, bin);
        bin.addEventListener("click", use);
        bin.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), use()));
      });
    }

    select(chip) {
      if (chip.classList.contains("placed")) return;
      const on = this.selected !== chip;
      this.chips.forEach((c) => c.setAttribute("aria-pressed", "false"));
      this.selected = on ? chip : null;
      chip.setAttribute("aria-pressed", String(on));
      if (on) sound("pop");
    }

    drop(chip, bin) {
      this.selected = null;
      chip.setAttribute("aria-pressed", "false");
      if (chip.dataset.bin === bin.dataset.bin) {
        chip.classList.add("placed");
        chip.tabIndex = -1;
        bin.querySelector(".bin-items").append(chip);
        sound("ding");
        if (this.hint) this.hint.textContent = chip.dataset.why ?? "Giusto! 👏";
        if (this.chips.every((c) => c.classList.contains("placed"))) pageDone(this);
      } else {
        sound("oops");
        restartAnimation(chip, "wrong");
        if (this.hint) this.hint.textContent = chip.dataset.hint ?? "Uhm... prova un'altra scatola!";
      }
      if (this.hint) restartAnimation(this.hint, "pop");
    }
  },
);

/* ------------------------------------------------------------------
 * <order-game>
 *   <ol class="slots"></ol>
 *   <div class="pool"><button class="chip" data-i="0">first</button> …</div>
 *   Tap the chips in the right order.
 * ------------------------------------------------------------------ */
define(
  "order-game",
  class extends HTMLElement {
    connectedCallback() {
      this.pool = this.querySelector(".pool");
      this.slots = this.querySelector(".slots");
      this.hint = this.querySelector(".caption");
      const chips = [...this.pool.querySelectorAll(".chip")];
      this.total = chips.length;
      this.next = 0;
      for (let i = 0; i < this.total; i++) this.slots.append(document.createElement("li"));
      this.pool.append(...shuffle(chips));
      chips.forEach((chip) => {
        chip.type = "button";
        chip.addEventListener("click", () => this.pick(chip));
      });
    }

    pick(chip) {
      if (chip.classList.contains("placed")) return;
      if (Number(chip.dataset.i) === this.next) {
        chip.classList.add("placed");
        chip.tabIndex = -1;
        this.slots.children[this.next].append(chip);
        this.next++;
        sound("ding");
        if (this.hint) {
          this.hint.textContent = this.next === this.total
            ? "Perfetto, tutto in ordine! 🎉"
            : "Giusto! E adesso cosa viene?";
        }
        if (this.next === this.total) pageDone(this);
      } else {
        sound("oops");
        restartAnimation(chip, "wrong");
        if (this.hint) this.hint.textContent = "Non ancora... cosa succede prima?";
      }
      if (this.hint) restartAnimation(this.hint, "pop");
    }
  },
);

/* ------------------------------------------------------------------
 * <tap-scene need="6" label="Vulcani: {n} su {need}">
 *   Every click on a [data-hit] element restarts its "go" animation,
 *   counts, and sets --p (0 → 1) on the element for progress visuals.
 * ------------------------------------------------------------------ */
define(
  "tap-scene",
  class extends HTMLElement {
    connectedCallback() {
      this.need = Number(this.getAttribute("need") ?? 5);
      this.count = 0;
      this.counter = this.querySelector(".counter-pill");
      this.querySelectorAll("[data-hit]").forEach((hit) => {
        if (!(hit instanceof HTMLButtonElement)) {
          hit.setAttribute("tabindex", "0");
          hit.setAttribute("role", "button");
          hit.style.cursor = "pointer";
          hit.addEventListener(
            "keydown",
            (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), this.hit(hit)),
          );
        }
        hit.addEventListener("click", () => this.hit(hit));
      });
      this.paint();
    }

    hit(el) {
      restartAnimation(el, "go");
      this.count++;
      sound(el.dataset.sound ?? "pop");
      this.paint();
      this.dispatchEvent(new CustomEvent("hit", { detail: { el, count: this.count } }));
      if (this.count === this.need) pageDone(this);
    }

    paint() {
      this.style.setProperty("--p", Math.min(1, this.count / this.need));
      this.dataset.count = Math.min(this.count, this.need);
      if (this.counter) {
        this.counter.textContent = (this.getAttribute("label") ?? "{n} su {need}")
          .replace("{n}", Math.min(this.count, this.need))
          .replace("{need}", this.need);
      }
    }
  },
);

/* ------------------------------------------------------------------
 * <torch-reveal need="5"> a dark scene explored with a torch.
 *   Hidden things are elements with [data-find].
 * ------------------------------------------------------------------ */
define(
  "torch-reveal",
  class extends HTMLElement {
    connectedCallback() {
      this.scene = this.querySelector(".scene");
      this.finds = [...this.querySelectorAll("[data-find]")];
      this.counter = this.querySelector(".counter-pill");
      const move = (e) => {
        const r = this.scene.getBoundingClientRect();
        this.scene.style.setProperty("--x", `${e.clientX - r.left}px`);
        this.scene.style.setProperty("--y", `${e.clientY - r.top}px`);
        this.scene.classList.add("moved");
      };
      this.scene.addEventListener("pointermove", move);
      this.scene.addEventListener("pointerdown", move);
      this.finds.forEach((f) => {
        f.setAttribute("tabindex", "0");
        f.setAttribute("role", "button");
        f.setAttribute("aria-label", "Nube di gas nascosta");
        const found = () => {
          if (f.classList.contains("found")) return;
          f.classList.add("found");
          sound("ding");
          confetti(f, 10);
          this.paint();
          if (this.finds.every((x) => x.classList.contains("found"))) pageDone(this);
        };
        f.addEventListener("click", found);
        f.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && found());
      });
      this.paint();
    }

    paint() {
      const n = this.finds.filter((f) => f.classList.contains("found")).length;
      this.counter.textContent = `Nubi trovate: ${n} su ${this.finds.length}`;
    }
  },
);

/* ------------------------------------------------------------------
 * <quiz-set lesson="1"> with <quiz-q answer="1"> children
 * ------------------------------------------------------------------ */
define(
  "quiz-q",
  class extends HTMLElement {
    connectedCallback() {
      this.answer = Number(this.getAttribute("answer"));
      this.buttons = [...this.querySelectorAll(".opts button")];
      this.retry = document.createElement("p");
      this.retry.className = "retry";
      this.retry.setAttribute("aria-live", "polite");
      this.querySelector(".opts").after(this.retry);
      this.firstTry = true;
      this.buttons.forEach((b, i) => {
        b.type = "button";
        b.addEventListener("click", () => this.choose(b, i));
      });
    }

    choose(button, i) {
      if (this.solved) return;
      if (i === this.answer) {
        this.solved = true;
        this.classList.add("solved");
        button.classList.add("right");
        this.buttons.forEach((b) => (b.disabled = true));
        this.retry.textContent = "";
        sound("ding");
        confetti(button, 18);
        this.dispatchEvent(new CustomEvent("solved", { bubbles: true, detail: { firstTry: this.firstTry } }));
      } else {
        this.firstTry = false;
        button.classList.add("nope");
        button.disabled = true;
        sound("oops");
        restartAnimation(button, "wrong");
        this.retry.textContent = [
          "Quasi! Riprova 💪",
          "Non è questa... pensaci ancora!",
          "Ops! Prova un'altra risposta.",
        ][Math.floor(Math.random() * 3)];
      }
    }
  },
);

define(
  "quiz-set",
  class extends HTMLElement {
    connectedCallback() {
      this.addEventListener("solved", () => {
        const qs = [...this.querySelectorAll("quiz-q")];
        if (!qs.every((q) => q.solved)) return;
        const perfect = qs.filter((q) => q.firstTry).length;
        const score = this.querySelector("[data-score]");
        if (score) score.textContent = `Hai indovinato ${perfect} domande su ${qs.length} al primo colpo!`;
        this.classList.add("complete");
        progress.addMedal(Number(this.getAttribute("lesson")));
        setTimeout(() => {
          this.querySelector(".medal")?.scrollIntoView({ behavior: "smooth", block: "center" });
          confetti(this.querySelector(".medal"), 80);
          pageDone(this.querySelector(".medal"));
        }, 250);
      });
    }
  },
);

/* ------------------------------------------------------------------
 * <nucleus-builder>: add protons and neutrons, make hydrogen and helium.
 * ------------------------------------------------------------------ */
const NUCLEI = {
  "1-0": ["Idrogeno!", "1 protone da solo: è il nucleo più semplice di tutti."],
  "1-1": ["Deuterio", "È idrogeno 'pesante'. Aggiungi ancora qualcosa..."],
  "2-1": ["Elio-3", "Ci sei quasi! Manca un neutrone."],
  "2-2": ["Elio!", "2 protoni + 2 neutroni: un nucleo di elio. Fortissimo!"],
};

define(
  "nucleus-builder",
  class extends HTMLElement {
    connectedCallback() {
      this.p = 0;
      this.n = 0;
      this.made = new Set();
      this.core = this.querySelector(".nucleus");
      this.caption = this.querySelector(".caption");
      this.querySelector("[data-add=p]").addEventListener("click", () => this.add("p"));
      this.querySelector("[data-add=n]").addEventListener("click", () => this.add("n"));
      this.querySelector("[data-add=reset]").addEventListener("click", () => this.reset());
      this.paint();
    }

    add(kind) {
      if (this.p + this.n >= 4) {
        this.caption.textContent = "Il nucleo è pieno! Premi 'Ricomincia' per costruirne un altro.";
        restartAnimation(this.caption, "pop");
        return sound("oops");
      }
      kind === "p" ? this.p++ : this.n++;
      const ball = document.createElement("span");
      ball.className = `nucleon ${kind}`;
      ball.textContent = kind === "p" ? "+" : "";
      ball.style.setProperty("--i", this.p + this.n - 1);
      this.core.append(ball);
      sound("pop");
      this.paint();
    }

    reset() {
      this.p = this.n = 0;
      this.core.replaceChildren();
      this.paint();
    }

    paint() {
      const key = `${this.p}-${this.n}`;
      const found = NUCLEI[key];
      if (this.p + this.n === 0) {
        this.caption.textContent = "Il nucleo è vuoto. Aggiungi un protone!";
      } else if (found) {
        this.caption.innerHTML = `<b>${found[0]}</b> ${found[1]}`;
        if (key === "1-0" || key === "2-2") {
          if (!this.made.has(key)) confetti(this.core, 20);
          this.made.add(key);
          this.querySelector(`[data-goal="${key}"]`)?.classList.add("got");
          sound("ding");
        }
      } else {
        this.caption.textContent = this.p === 0
          ? "Senza protoni non è un vero nucleo... aggiungine uno!"
          : "Uhm, questo nucleo è strano e si romperebbe subito. Prova un'altra ricetta!";
      }
      restartAnimation(this.caption, "pop");
      this.dataset.p = this.p;
      this.dataset.n = this.n;
      if (!this.done && this.made.size === 2) {
        this.done = true;
        pageDone(this);
      }
    }
  },
);

/* ------------------------------------------------------------------
 * <fusion-game>: tap two hydrogen nuclei to fuse them into helium.
 * ------------------------------------------------------------------ */
define(
  "fusion-game",
  class extends HTMLElement {
    connectedCallback() {
      this.grid = this.querySelector(".fusion-grid");
      this.meter = this.querySelector(".energy");
      this.caption = this.querySelector(".caption");
      this.fused = 0;
      this.need = Number(this.getAttribute("need") ?? 4);
      this.selected = null;
      for (let i = 0; i < this.need * 2; i++) {
        const h = document.createElement("button");
        h.type = "button";
        h.className = "h-atom";
        h.innerHTML = "<span>H</span>";
        h.setAttribute("aria-label", "Nucleo di idrogeno");
        h.style.setProperty("--i", i);
        h.addEventListener("click", () => this.pick(h));
        this.grid.append(h);
      }
      this.paint();
    }

    pick(h) {
      if (h.classList.contains("he")) return;
      if (!this.selected) {
        this.selected = h;
        h.setAttribute("aria-pressed", "true");
        sound("pop");
        this.caption.textContent = "Ora tocca un altro idrogeno per scontrarli!";
        return;
      }
      if (this.selected === h) {
        h.setAttribute("aria-pressed", "false");
        this.selected = null;
        return;
      }
      const a = this.selected;
      this.selected = null;
      a.setAttribute("aria-pressed", "false");
      // fly a into h, then h becomes helium
      const ra = a.getBoundingClientRect();
      const rh = h.getBoundingClientRect();
      a.animate([{ translate: "0 0" }, { translate: `${rh.left - ra.left}px ${rh.top - ra.top}px`, scale: .6 }], {
        duration: 350,
        easing: "ease-in",
      })
        .finished.then(() => {
          a.classList.add("gone");
          a.disabled = true;
          h.classList.add("he");
          h.innerHTML = "<span>He</span>";
          h.setAttribute("aria-label", "Nucleo di elio");
          this.fused++;
          sound("boom");
          confetti(h, 16);
          this.paint();
          if (this.fused === this.need) pageDone(this);
        });
    }

    paint() {
      this.style.setProperty("--p", this.fused / this.need);
      this.caption.textContent = this.fused === this.need
        ? "Tanta energia! Ecco perché le stelle brillano! ✨"
        : this.fused
        ? `BUM! Fusione! Luce ed energia: ${this.fused} su ${this.need}`
        : "Tocca due nuclei di idrogeno (H) per farli scontrare.";
      restartAnimation(this.caption, "pop");
    }
  },
);

/* ------------------------------------------------------------------
 * <candy-jar total="1000" sun="998">: shows how much of the solar
 * system ended up in the Sun.
 * ------------------------------------------------------------------ */
define(
  "candy-jar",
  class extends HTMLElement {
    connectedCallback() {
      const total = Number(this.getAttribute("total") ?? 1000);
      const sun = Number(this.getAttribute("sun") ?? 998);
      const grid = this.querySelector(".jar");
      const frag = document.createDocumentFragment();
      for (let i = 0; i < total; i++) frag.append(document.createElement("i"));
      grid.append(frag);
      const dots = [...grid.children];
      const button = this.querySelector("button");
      button.addEventListener("click", () => {
        button.disabled = true;
        const order = shuffle(dots.map((_, i) => i));
        const leftover = new Set(order.slice(sun));
        order.forEach((i, k) => {
          if (leftover.has(i)) return;
          dots[i].style.transitionDelay = `${(k / sun) * 1600}ms`;
          dots[i].classList.add("sun");
        });
        [...leftover].forEach((i) => dots[i].classList.add("rest"));
        sound("win");
        setTimeout(() => {
          this.classList.add("revealed");
          pageDone(this);
        }, 1900);
      });
    }
  },
);

/* ------------------------------------------------------------------
 * <name-cert>: the final diploma with the child's name.
 * ------------------------------------------------------------------ */
define(
  "name-cert",
  class extends HTMLElement {
    connectedCallback() {
      const input = this.querySelector("input");
      const out = this.querySelector("[data-name]");
      const stars = this.querySelector("[data-stars]");
      const medals = this.querySelector("[data-medals]");
      const date = this.querySelector("[data-date]");
      input.value = progress.state.name ?? "";
      const paint = () => {
        out.textContent = input.value.trim() || "Esploratore del cosmo";
        stars.textContent = progress.state.done.length;
        medals.textContent = progress.state.medals.length;
      };
      date.textContent = new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
      input.addEventListener("input", () => {
        progress.set("name", input.value.trim());
        paint();
      });
      document.addEventListener("lumi:progress", paint);
      this.querySelector("[data-print]")?.addEventListener("click", () => print());
      this.querySelector("[data-party]")?.addEventListener("click", (e) => {
        confetti(e.currentTarget, 90);
        sound("win");
        pageDone(this.querySelector(".cert"));
      });
      paint();
    }
  },
);
