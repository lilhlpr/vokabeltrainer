/* Englisch-Vokabeltrainer
   Die Vokabeln kommen aus den Dateien im Ordner vokabeln/ (window.VOKABELN).
   Eine Runde fragt alle Wörter der ausgewählten Listen ab. */
"use strict";

const LISTS = (window.VOKABELN || []).filter(l => l && l.id && Array.isArray(l.woerter) && l.woerter.length);
const LIST_BY_ID = Object.fromEntries(LISTS.map(l => [l.id, l]));
const MAX_STARS = 3;
const KEY_STARS = "vokabeltrainer-sterne-v1";
const KEY_SETTINGS = "vokabeltrainer-einstellungen-v1";
const KEY_ROUND = "vokabeltrainer-runde-v1";
const $ = id => document.getElementById(id);

/* ---------- Speicher (klappt auch, wenn der Browser nichts speichern darf) ---------- */
const store = {
  get(k, fallback) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? fallback : v; } catch (e) { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

let stars = store.get(KEY_STARS, {});
const settings = Object.assign({ level: "easy", dir: "de-en", lists: [] }, store.get(KEY_SETTINGS, {}));
settings.lists = (settings.lists || []).filter(id => LIST_BY_ID[id]);
if (!settings.lists.length && LISTS.length) settings.lists = [LISTS[0].id];
const saveSettings = () => store.set(KEY_SETTINGS, settings);

let round = null;

/* ---------- Hilfsfunktionen ---------- */
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const starHTML = (n, max) => Array.from({ length: max }, (_, i) => i < n ? "⭐" : '<span class="off">⭐</span>').join("");
const starKey = (list, w) => list.id + "|" + w.en;
const starsOf = (list, w) => stars[starKey(list, w)] || 0;
const wordOf = item => LIST_BY_ID[item.l].woerter[item.i];
const listOf = item => LIST_BY_ID[item.l];
const labels = (list, w) => Object.assign({ en: "Englisch", de: "Deutsch" }, list.labels || {}, (w && w.labels) || {});
const hasLabels = (list, w) => !!(list.labels || (w && w.labels));

const promptOf = w => settings.dir === "en-de" ? w.en : w.de;
const targetOf = w => settings.dir === "en-de" ? w.de : w.en;
const extrasOf = w => (settings.dir === "en-de" ? w.auchDe : w.auchEn) || [];

function norm(s) {
  return String(s).toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/\bsth\./g, "something").replace(/\bsb\./g, "somebody").replace(/\bjm\./g, "jemandem").replace(/\betw\./g, "etwas")
    .replace(/…|\.\.\./g, " ")
    .replace(/[?!.,;:"()\/]/g, " ")
    .replace(/-/g, "")
    .replace(/\bit is\b/g, "it's").replace(/\bwhat is\b/g, "what's").replace(/\bthat is\b/g, "that's")
    .replace(/\bdo not\b/g, "don't").replace(/\bmust not\b/g, "mustn't")
    .replace(/\s+/g, " ").trim();
}
const noArticle = s => s.replace(/^(the|a|an|das|der|die|ein|eine) /, "");

/* Alle Schreibweisen, die als richtig gelten */
function variants(raw, extra) {
  const out = new Set();
  const add = s => { const n = norm(s); if (n) out.add(n); };
  const parts = [raw].concat(String(raw).split(/;|,|\s\/\s/));
  for (let p of parts) {
    p = p.trim();
    if (!p) continue;
    const forms = [p];
    if (/\/in\b/.test(p)) forms.push(p.replace(/\/in\b/g, ""), p.replace(/\/in\b/g, "in"));
    for (const f of forms) {
      add(f);
      add(f.replace(/\([^)]*\)/g, " "));
      add(f.replace(/[()]/g, ""));
      const short = f.replace(/\b(sth|sb|jm|etw)\.\s*/g, "").replace(/\b(etwas|something|somebody|jemandem|jemanden|sich)\s+/gi, "");
      add(short);
      add(short.replace(/\([^)]*\)/g, " "));
    }
  }
  (extra || []).forEach(add);
  return Array.from(out);
}
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

function show(id) {
  if (id !== "result") confettiRun++;
  ["start", "quiz", "result"].forEach(s => { $(s).hidden = s !== id; });
  window.scrollTo(0, 0);
}

/* ================= START ================= */
function renderStart() {
  $("lists").innerHTML = LISTS.map(l => {
    const on = settings.lists.includes(l.id);
    const total = l.woerter.reduce((a, w) => a + starsOf(l, w), 0);
    const sure = l.woerter.filter(w => starsOf(l, w) >= MAX_STARS).length;
    const pct = total / (l.woerter.length * MAX_STARS) * 100;
    const words = l.woerter.map(w => `
      <li><span class="em" aria-hidden="true">${esc(w.emoji || l.emoji || "📘")}</span>
        <span class="txt"><span class="en">${esc(w.en)}</span><span class="de">${esc(w.de)}</span></span>
        <span class="stars" aria-label="${starsOf(l, w)} von ${MAX_STARS} Sternen">${starHTML(starsOf(l, w), MAX_STARS)}</span></li>`).join("");
    return `
      <div class="listcard${on ? " on" : ""}">
        <button class="pick" data-id="${esc(l.id)}" aria-pressed="${on}">
          <span class="lem" aria-hidden="true">${esc(l.emoji || "📘")}</span>
          <span class="ltxt">
            <span class="ltitle">${esc(l.titel || l.id)}</span>
            <span class="lsub">${l.woerter.length} Wörter · ${sure} sicher</span>
            <span class="minimeter" aria-hidden="true"><div style="width:${pct}%"></div></span>
          </span>
          <span class="check" aria-hidden="true">✓</span>
        </button>
        <details><summary>Wörter ansehen</summary><ul class="wordlist">${words}</ul></details>
      </div>`;
  }).join("") || "<p>Keine Vokabellisten gefunden. Prüfe die &lt;script&gt;-Zeilen in index.html.</p>";

  $("lists").querySelectorAll(".pick").forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.id;
    settings.lists = settings.lists.includes(id) ? settings.lists.filter(x => x !== id) : settings.lists.concat(id);
    saveSettings();
    b.setAttribute("aria-pressed", settings.lists.includes(id));
    b.parentElement.classList.toggle("on", settings.lists.includes(id));
    updateStartButton();
  }));

  document.querySelectorAll(".level").forEach(x => x.setAttribute("aria-pressed", x.dataset.level === settings.level));
  document.querySelectorAll(".seg button").forEach(x => x.setAttribute("aria-pressed", x.dataset.dir === settings.dir));
  updateStartButton();
  renderResume();
}

function selectedItems() {
  const items = [];
  LISTS.forEach(l => { if (settings.lists.includes(l.id)) l.woerter.forEach((_, i) => items.push({ l: l.id, i })); });
  return items;
}
function updateStartButton() {
  const n = selectedItems().length;
  $("go").disabled = n === 0;
  $("go").textContent = n ? `Los geht's! · ${n} Wörter 🚀` : "Bitte eine Liste wählen";
  $("toggle-all").textContent = settings.lists.length === LISTS.length ? "Keine auswählen" : "Alle auswählen";
}
$("toggle-all").addEventListener("click", () => {
  settings.lists = settings.lists.length === LISTS.length ? [] : LISTS.map(l => l.id);
  saveSettings(); renderStart();
});
document.querySelectorAll(".level").forEach(b => b.addEventListener("click", () => {
  settings.level = b.dataset.level; saveSettings();
  document.querySelectorAll(".level").forEach(x => x.setAttribute("aria-pressed", x === b));
}));
document.querySelectorAll(".seg button").forEach(b => b.addEventListener("click", () => {
  settings.dir = b.dataset.dir; saveSettings();
  document.querySelectorAll(".seg button").forEach(x => x.setAttribute("aria-pressed", x === b));
}));

function askReset() {
  const row = $("reset-row");
  row.innerHTML = '<span>Alle Sterne löschen?</span><button class="link danger" id="yes">Ja, löschen</button><button class="link" id="no">Nein</button>';
  const back = () => {
    row.innerHTML = '<span>⭐⭐⭐ = Wort sitzt sicher</span><button class="link" id="reset">Sterne zurücksetzen</button>';
    $("reset").addEventListener("click", askReset);
  };
  $("yes").onclick = () => { stars = {}; store.set(KEY_STARS, stars); renderStart(); back(); };
  $("no").onclick = back;
}
$("reset").addEventListener("click", askReset);

/* ---------- unterbrochene Runde ---------- */
function savedRound() {
  const r = store.get(KEY_ROUND, null);
  if (!r || !Array.isArray(r.items) || !r.items.length) return null;
  if (!r.items.every(it => LIST_BY_ID[it.l] && LIST_BY_ID[it.l].woerter[it.i])) return null;
  if ((r.results || []).length >= r.items.length) return null;
  return r;
}
function renderResume() {
  const r = savedRound();
  $("resume").hidden = !r;
  if (r) $("resume-txt").textContent = `${r.results.length} von ${r.items.length} Wörtern geschafft · ${r.level === "hard" ? "Schwer" : "Leicht"}`;
}
$("resume-go").addEventListener("click", () => {
  const r = savedRound(); if (!r) return renderResume();
  settings.level = r.level; settings.dir = r.dir; saveSettings();
  round = { items: r.items, results: r.results, idx: r.results.length, tries: 0, answered: false };
  show("quiz"); renderQuestion();
});
$("resume-drop").addEventListener("click", () => { store.del(KEY_ROUND); renderResume(); });
const persistRound = () => store.set(KEY_ROUND, { items: round.items, results: round.results, level: settings.level, dir: settings.dir });

/* ================= QUIZ ================= */
function startRound(items) {
  round = { items: shuffle(items), idx: 0, results: [], tries: 0, answered: false };
  persistRound();
  show("quiz");
  renderQuestion();
}

function renderProgress() {
  const n = round.items.length;
  const ok = round.results.filter(r => r.ok).length;
  const no = round.results.length - ok;
  $("bar-ok").style.width = (ok / n * 100) + "%";
  $("bar-no").style.width = (no / n * 100) + "%";
  $("qcount").textContent = `${Math.min(round.idx + 1, n)}/${n}`;
  $("t-ok").textContent = ok; $("t-no").textContent = no;
}

function renderQuestion() {
  const item = round.items[round.idx];
  const w = wordOf(item), list = listOf(item), lab = labels(list, w), custom = hasLabels(list, w);
  round.tries = 0; round.answered = false;
  renderProgress();
  $("t-list").textContent = list.titel || "";
  $("qemoji").textContent = w.emoji || list.emoji || "📘";
  $("qword").textContent = promptOf(w);
  $("qhint").textContent = custom
    ? `Gesucht: ${settings.dir === "en-de" ? lab.de : lab.en}`
    : (settings.dir === "en-de" ? "Was heißt das auf Deutsch?" : "Was heißt das auf Englisch?");
  $("speak").hidden = !canSpeak() || settings.dir !== "en-de";
  $("feedback").hidden = true; $("next").hidden = true;

  if (settings.level === "easy") {
    $("typebox").hidden = true; $("choices").hidden = false;
    const target = targetOf(w);
    let pool = list.woerter.filter(x => !!x.labels === !!w.labels).map(targetOf);
    if (new Set(pool).size < 4) pool = pool.concat(LISTS.flatMap(l => l.woerter.map(targetOf)));
    const others = shuffle(Array.from(new Set(pool)).filter(t => t !== target)).slice(0, 3);
    const opts = shuffle([target].concat(others));
    $("choices").innerHTML = opts.map((o, i) =>
      `<button class="choice" data-val="${esc(o)}"><span class="key">${"ABCD"[i]}</span><span>${esc(o)}</span></button>`).join("");
    $("choices").querySelectorAll(".choice").forEach(b => b.addEventListener("click", () => answerChoice(b, target)));
  } else {
    $("choices").hidden = true; $("typebox").hidden = false;
    const inp = $("answer");
    inp.value = ""; inp.className = ""; inp.disabled = false;
    inp.placeholder = `${settings.dir === "en-de" ? lab.de : lab.en} …`;
    $("umlauts").hidden = settings.dir !== "en-de" || custom;
    $("check").disabled = false; $("dunno").disabled = false;
    setTimeout(() => inp.focus({ preventScroll: true }), 50);
  }
}

function answerChoice(btn, target) {
  if (round.answered) return;
  const ok = btn.dataset.val === target;
  $("choices").querySelectorAll(".choice").forEach(b => {
    b.disabled = true;
    if (b.dataset.val === target) b.classList.add("ok");
    else if (b === btn) b.classList.add("no");
    else b.classList.add("dim");
  });
  finish(ok, btn.dataset.val);
}

function checkTyped(given) {
  const w = wordOf(round.items[round.idx]);
  const target = targetOf(w);
  const g = norm(given);
  if (!g) { $("answer").focus(); return; }
  const vs = variants(target, extrasOf(w));
  if (vs.includes(g)) return finish(true, given);
  if (vs.some(v => noArticle(v) === noArticle(g))) return finish(true, given, `Vollständig heißt es „${target}“.`);
  const d = Math.min.apply(null, vs.map(v => lev(g, v)));
  if (round.tries === 0 && d <= (g.length > 8 ? 2 : 1)) {
    round.tries++;
    $("answer").className = "near";
    const fb = $("feedback");
    fb.className = "feedback near"; fb.hidden = false;
    fb.innerHTML = `<strong>Fast! 🧐</strong><span>Ein kleiner Fehler. Schau nochmal genau hin und versuch es noch einmal.</span>`;
    $("answer").focus();
    return;
  }
  finish(false, given);
}

function finish(ok, given, tip) {
  round.answered = true;
  const item = round.items[round.idx];
  const w = wordOf(item), list = listOf(item);
  round.results[round.idx] = { l: item.l, i: item.i, ok, given };
  const k = starKey(list, w);
  stars[k] = ok ? Math.min(MAX_STARS, (stars[k] || 0) + 1) : Math.max(0, (stars[k] || 0) - 1);
  store.set(KEY_STARS, stars);
  persistRound();

  if (settings.level === "hard") {
    $("answer").className = ok ? "ok" : "no";
    $("answer").disabled = true; $("check").disabled = true; $("dunno").disabled = true;
  }
  const praise = ["Super! 🎉", "Richtig! 🌟", "Klasse! 👏", "Toll gemacht! 😎", "Genau! ✅", "Spitze! 🚀"];
  const info = w.info ? `<span class="tip">ℹ️ ${esc(w.info)}</span>` : "";
  const fb = $("feedback");
  fb.className = "feedback " + (ok ? "ok" : "no");
  fb.innerHTML = ok
    ? `<strong>${praise[Math.floor(Math.random() * praise.length)]}</strong>${tip ? `<span class="tip">${esc(tip)}</span>` : ""}${info}`
    : `<strong>Leider falsch 🙈</strong><span>Richtig ist:</span><span class="sol">${esc(w.emoji || "")} ${esc(targetOf(w))}</span>${info}`;
  fb.hidden = false;
  if (ok) { const e = $("qemoji"); e.classList.remove("pop"); void e.offsetWidth; e.classList.add("pop"); }
  if (canSpeak()) $("speak").hidden = false;

  renderProgress();
  const last = round.idx === round.items.length - 1;
  $("next").textContent = last ? "Zur Auswertung 🏁" : "Weiter ➜";
  $("next").hidden = false;
  $("next").focus({ preventScroll: true });
  $("next").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function nextQuestion() {
  if (round.idx < round.items.length - 1) { round.idx++; renderQuestion(); }
  else showResult();
}

$("typebox").addEventListener("submit", e => {
  e.preventDefault();
  if (round.answered) nextQuestion(); else checkTyped($("answer").value);
});
$("dunno").addEventListener("click", () => { if (!round.answered) finish(false, "–"); });
$("umlauts").querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
  const inp = $("answer"); if (inp.disabled) return;
  const s = inp.selectionStart == null ? inp.value.length : inp.selectionStart;
  const en = inp.selectionEnd == null ? inp.value.length : inp.selectionEnd;
  inp.value = inp.value.slice(0, s) + b.textContent + inp.value.slice(en);
  inp.focus(); inp.setSelectionRange(s + 1, s + 1);
}));
$("next").addEventListener("click", nextQuestion);
$("quit").addEventListener("click", () => { renderStart(); show("start"); });

function canSpeak() { return "speechSynthesis" in window && typeof SpeechSynthesisUtterance === "function"; }
$("speak").addEventListener("click", () => {
  try {
    const w = wordOf(round.items[round.idx]);
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(w.en.replace(/\b(sth|sb)\./g, m => m === "sth." ? "something" : "somebody").replace(/…/g, ""));
    u.lang = "en-GB"; u.rate = .85;
    speechSynthesis.speak(u);
  } catch (e) {}
});

/* ================= AUSWERTUNG ================= */
function resultRow(r) {
  const w = LIST_BY_ID[r.l].woerter[r.i];
  const yours = r.ok ? "" : `<br><span class="yours">${r.given === "–" ? "nicht gewusst" : "Deine Antwort: " + esc(r.given)}</span>`;
  return `<li class="${r.ok ? "ok" : "no"}"><span class="mark">${r.ok ? "✅" : "❌"}</span>
    <span class="txt"><span class="pair">${esc(w.emoji || "")} ${esc(promptOf(w))} → ${esc(targetOf(w))}</span>${yours}</span></li>`;
}

function showResult() {
  store.del(KEY_ROUND);
  const res = round.results;
  const n = res.length;
  const right = res.filter(r => r.ok);
  const wrong = res.filter(r => !r.ok);
  const pct = n ? right.length / n : 0;
  $("score").innerHTML = `${right.length} <small>von ${n}</small>`;
  $("pct").textContent = Math.round(pct * 100) + " % richtig";
  const st = pct === 1 ? 3 : pct >= .8 ? 2 : pct >= .6 ? 1 : 0;
  $("rstars").innerHTML = starHTML(st, 3);
  let trophy, msg;
  if (pct === 1) { trophy = "🏆"; msg = "Vokabel-Profi! Alles richtig!"; }
  else if (pct >= .8) { trophy = "🌟"; msg = "Fast perfekt! Super gemacht!"; }
  else if (pct >= .6) { trophy = "👍"; msg = "Gut gemacht! Noch ein bisschen üben."; }
  else { trophy = "🌈"; msg = "Weiter üben – du schaffst das!"; }
  $("trophy").textContent = trophy; $("msg").textContent = msg;

  $("wrong-wrap").hidden = wrong.length === 0;
  $("rlist-wrong").innerHTML = wrong.map(resultRow).join("");
  $("right-wrap").hidden = right.length === 0;
  $("right-wrap").open = wrong.length === 0;
  $("right-sum").textContent = `Richtig beantwortet (${right.length})`;
  $("rlist-right").innerHTML = right.map(resultRow).join("");

  $("practice").hidden = wrong.length === 0;
  $("practice").textContent = `Fehler üben · ${wrong.length} 🎯`;
  $("practice").onclick = () => startRound(wrong.map(r => ({ l: r.l, i: r.i })));
  $("again").onclick = () => startRound(round.items.slice());
  show("result");
  if (pct === 1) setTimeout(confetti, 250);
}
$("home").addEventListener("click", () => { renderStart(); show("start"); });
$("go").addEventListener("click", () => { const items = selectedItems(); if (items.length) startRound(items); });

/* ================= KONFETTI ================= */
let confettiRun = 0;
function confetti() {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const run = ++confettiRun;
  const c = $("confetti"), ctx = c.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const W = c.width = innerWidth * dpr, H = c.height = innerHeight * dpr;
  const css = getComputedStyle(document.documentElement);
  const cols = ["--sun", "--sky", "--good", "--bad"].map(v => css.getPropertyValue(v).trim()).concat(["#b46cf0", "#ff9ac1"]);
  const emo = ["⭐", "🎉", "🏆", "🌈", "✨"];
  const parts = Array.from({ length: 170 }, (_, k) => {
    const fromLeft = k % 2 === 0;
    return {
      x: fromLeft ? 0 : W, y: H * .75,
      vx: (fromLeft ? 1 : -1) * (4 + Math.random() * 9) * dpr,
      vy: -(9 + Math.random() * 11) * dpr,
      s: (6 + Math.random() * 7) * dpr, r: Math.random() * 6, vr: (Math.random() - .5) * .3,
      col: cols[k % cols.length], emo: k % 9 === 0 ? emo[k % emo.length] : null
    };
  });
  const t0 = performance.now();
  (function frame(t) {
    const el = t - t0;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = el > 3200 ? Math.max(0, 1 - (el - 3200) / 800) : 1;
    for (const p of parts) {
      p.vy += .32 * dpr; p.vx *= .99; p.vy *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      if (p.emo) { ctx.font = `${p.s * 2.2}px sans-serif`; ctx.fillText(p.emo, 0, 0); }
      else { ctx.fillStyle = p.col; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); }
      ctx.restore();
    }
    if (el < 4000 && run === confettiRun) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
  })(t0);
}

renderStart();
