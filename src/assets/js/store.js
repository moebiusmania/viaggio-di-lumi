// The Alpine store behind the app shell: what the top bar, the index, the page dots and the
// cover show. The games stay vanilla custom elements (components.js, canvas.js): they save
// through `progress` and fire "lumi:progress", and the store follows.
import Alpine from "alpinejs";
import { locale, progress, sound, t } from "./core.js";

const synth = globalThis.speechSynthesis;

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

const toc = () => document.getElementById("toc");

Alpine.store("book", {
  visited: [...progress.state.visited],
  done: [...progress.state.done],
  medals: [...progress.state.medals],
  last: progress.state.last ?? "",
  sound: progress.state.sound,
  music: Boolean(progress.state.music),
  reading: false,
  canRead: Boolean(synth),

  /** Copies the saved progress in, which redraws everything that shows it. */
  sync() {
    const { visited, done, medals } = progress.state;
    this.visited = [...visited];
    this.done = [...done];
    this.medals = [...medals];
  },

  // attribute values: "" sets the attribute, null removes it
  visitedMark(link) {
    return this.visited.includes(link.dataset.url) ? "" : null;
  },
  doneMark(link) {
    return this.done.includes(link.dataset.url) ? "" : null;
  },

  /** How much of a lesson has been seen, from 0 to 1 (the ring in the index). */
  lessonShare(n) {
    const links = [...document.querySelectorAll(`#toc .toc-lesson:nth-child(${n}) a[data-url]`)];
    const seen = links.filter((a) => this.visited.includes(a.dataset.url)).length;
    return links.length ? seen / links.length : 0;
  },

  get soundLabel() {
    return t(this.sound ? "soundOn" : "soundOff");
  },
  toggleSound() {
    this.sound = !this.sound;
    progress.set("sound", this.sound);
    sound("ding");
  },

  async toggleMusic() {
    this.music = !this.music;
    progress.set("music", this.music);
    const { startMusic, stopMusic } = await import("./music.js");
    this.music ? startMusic() : stopMusic();
  },

  openToc() {
    const dialog = toc();
    if (dialog.open) return;
    dialog.showModal();
    dialog.querySelector("[aria-current]")?.scrollIntoView({ block: "center" });
  },
  closeToc() {
    toc().close();
  },

  stopReading() {
    synth?.cancel();
    this.reading = false;
  },
  /** Reads the page aloud, in the language of the page. */
  toggleReading() {
    if (this.reading) return this.stopReading();
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
      if (i === parts.length - 1) u.onend = () => this.stopReading();
      synth.speak(u);
    });
    this.reading = true;
  },
});

addEventListener("pagehide", () => Alpine.store("book").stopReading());
