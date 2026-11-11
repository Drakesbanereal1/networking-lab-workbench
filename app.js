"use strict";
/* Navigation, the Progress page, the version on screen, and start-up. */

const WEB_BUILD = "4.0.8-web.2";

/* ---------- Progress ---------- */
function levelFor(objectiveId, attempts, owners) {
  // Kept apart on purpose: a simulator or authored-evidence pass is never external verification.
  let level = 0;
  const evidence = [];
  for (const a of attempts) {
    const objectives = owners(a);
    if (!objectives.includes(objectiveId)) continue;
    if (a.practice === "external") { level = Math.max(level, 3); evidence.push(`external: ${a.environment}`); }
    else if (a.practice === "independent" && (a.solved === true || a.passed === true || a.assessment === "pass")) { level = Math.max(level, 2); evidence.push(`${a.kind} ${a.id}, independent pass`); }
    else if (a.practice === "guided" || a.assessment === "escalated") { level = Math.max(level, 1); evidence.push(`${a.kind} ${a.id}, guided`); }
  }
  return { level, evidence: [...new Set(evidence)] };
}
const LEVELS = ["Not started", "Guided", "Simulated or authored evidence, unaided", "Externally verified (self-recorded)"];

function progressView() {
  const root = h("section", {});
  const cases = content("study.json").cases;
  const caseObjectives = new Map(cases.map((c) => [c.id, c.objectives || []]));
  const simObjectives = new Map(content("sim_labs.json").labs.map((l) => [l.id, l.objectives || []]));
  const owners = (a) => (a.kind === "case" ? caseObjectives.get(a.id) : a.kind === "lab" ? simObjectives.get(a.id) || caseObjectives.get(a.id) : null) || [];
  const matrix = content("objectives.json");
  const examSelect = h("select", { "aria-label": "Exam" }, matrix.exams.map((e, i) => h("option", { value: String(i) }, e.name)));
  const summaryBox = h("div", {}), objectivesBox = h("div", {}), message = h("p", { "aria-live": "polite" });

  function draw() {
    const attempts = record.all();
    const s = WorkbenchProgress.summarize(attempts);
    const ready = WorkbenchProgress.readiness(cases, s);
    fill(summaryBox, 
      h("p", { class: "note" }, `${attempts.length} records in this browser. ${s.note}`),
      s.items.length ? h("div", { class: "scroll" }, h("table", {}, h("thead", {}, h("tr", {}, ["Kind", "ID", "Guided", "Independent pass", "Independent fail", "Escalated", "Self-scored", "External", "Verified in"].map((x) => h("th", {}, x)))),
        h("tbody", {}, s.items.map((r) => h("tr", {}, [r.kind, r.id, r.guided, r.independent_pass, r.independent_fail, r.escalated, r.self_scored, r.external, r.environments.join(", ")].map((x) => h("td", {}, String(x))))))))
        : h("p", { class: "note" }, "Nothing recorded yet. Attempts are recorded as you finish them."),
      h("h3", {}, "Month 4 readiness (an independent pass of each month's practical)"),
      h("ul", {}, ready.map((r) => h("li", { class: r.ready ? "good" : "" }, `Month ${r.month}: ${r.ready ? "ready" : "not yet"} (${r.gate})`))));
    const exam = matrix.exams[Number(examSelect.value)];
    fill(objectivesBox, h("p", { class: "note" }, exam.note),
      h("div", { class: "scroll" }, h("table", {}, h("thead", {}, h("tr", {}, ["Objective", "Skill", "Content", "Status in the app", "My level in this browser", "Evidence"].map((x) => h("th", {}, x)))),
        h("tbody", {}, exam.objectives.map((o) => {
          const l = levelFor(o.id, attempts, owners);
          return h("tr", {}, [o.objective, o.skill, [o.lesson, o.lab].filter(Boolean).join("; "), o.status, LEVELS[l.level], l.evidence.slice(0, 3).join("; ")].map((x) => h("td", { class: "plain" }, x)));
        })))));
  }
  examSelect.addEventListener("change", draw);
  document.addEventListener("workbench-record", draw);

  const kind = h("select", { "aria-label": "Kind" }, ["lab", "case", "ticket", "interview"].map((k) => h("option", { value: k }, k)));
  const extId = field("ID", "", "such as vlan-access"), extEnv = field("Environment", "", "such as Packet Tracer 8.2"), extNote = field("What you ran and saw", "", "", { wide: true });
  const recordExternal = button("Record external check", () => {
    try {
      if (!extId.input.value.trim()) throw new Error("Name the item you checked.");
      record.add({ kind: kind.value, id: extId.input.value.trim(), practice: "external", environment: extEnv.input.value.trim(), note: extNote.input.value.trim() });
      message.className = "good"; message.textContent = "Recorded. External checks are counted separately from simulated practice.";
      extId.input.value = ""; extEnv.input.value = ""; extNote.input.value = "";
    } catch (e) { message.className = "warn"; message.textContent = e.message; }
  });

  const download = (name, text, type) => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    h("a", { href: url, download: name }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const stamp = () => new Date().toISOString().slice(0, 10);
  const exportJson = button("Export progress (.json)", () => download(`workbench-progress-${stamp()}.json`,
    JSON.stringify({ format: "workbench-progress", version: 1, app_version: APP.version, web_build: WEB_BUILD, exported_at: new Date().toISOString(), attempts: record.all(), gates: store.get("gates", {}) }, null, 1), "application/json"));
  const exportJsonl = button("Export for the desktop app (attempts.jsonl)", () => download("attempts.jsonl", record.all().map((a) => JSON.stringify(a)).join("\n") + "\n", "application/x-ndjson"));
  const file = h("input", { type: "file", accept: ".json,.jsonl,.txt", hidden: true, onchange: async () => {
    const f = file.files[0];
    if (!f) return;
    try {
      const parsed = WorkbenchProgress.parseImport(await f.text());
      const valid = [];
      let rejected = 0;
      for (const a of parsed.attempts) {
        try { valid.push(WorkbenchProgress.validate(a, a.version || "")); } catch { rejected++; }
      }
      const m = WorkbenchProgress.merge(record.all(), valid);
      record.replace(m.merged);
      if (parsed.extras.gates) store.set("gates", Object.assign(store.get("gates", {}), parsed.extras.gates));
      message.className = "good";
      message.textContent = `Imported ${m.added} records. ${m.skipped} were already here${rejected ? `, and ${rejected} were not valid records` : ""}.`;
    } catch (e) { message.className = "warn"; message.textContent = `That file could not be read: ${e.message}`; }
    file.value = "";
  } });
  const importBtn = button("Import progress", () => file.click());
  const clear = button("Clear this browser's record", () => {
    if (!confirm("Delete every practice record in this browser? Export first if you want to keep them.")) return;
    record.replace([]);
    message.className = "note"; message.textContent = "Cleared.";
  });

  put(root, h("p", { class: "intro" }, "Your practice record is kept only in this browser. Export it to keep a copy or move it, and import a file from this site or from the desktop app's attempts.jsonl. Guided practice, independent passes, accepted escalations, self-scored interviews and external checks are counted separately. A simulator or authored-evidence pass never counts as external verification."),
    h("div", { class: "actions" }, exportJson, exportJsonl, importBtn, file, clear), message,
    h("h3", {}, "Practice record"), summaryBox,
    h("h3", {}, "Record a check you ran yourself outside the app"), h("div", { class: "form" }, h("div", {}, h("label", {}, "Kind"), kind), extId.wrap, extEnv.wrap, extNote.wrap), h("div", { class: "actions" }, recordExternal),
    h("h3", {}, "Exam objectives"), h("div", { class: "actions" }, h("label", { class: "label-inline" }, "Exam "), examSelect), objectivesBox);
  draw();
  return root;
}

/* ---------- Sections ---------- */
const pages = {
  Study: () => {
    APP.study = subnav({ Lessons: lessonsView, "Year Plan": yearPlanView, Reference: referenceView, Practice: practiceView, "Subnet charts": chartView, Calculate: calculateView, Design: planView });
    return APP.study;
  },
  "Interview Practice": interviewPracticeView,
  "Device Labs": deviceLabsView,
  Troubleshoot: () => {
    APP.trouble = subnav({ "Guided diagnostics": guidedView, "Practice tickets": ticketsView, "Evidence cases": evidenceCasesView, "Explain saved output": analyzeView });
    return APP.trouble;
  },
  Progress: progressView,
  Download: downloadView,
  About: aboutView,
};
const built = new Map();

APP.show = function show(name) {
  for (const b of document.querySelectorAll(".tab")) b.setAttribute("aria-current", b.textContent === name ? "page" : "false");
  if (!built.has(name)) {
    try { built.set(name, pages[name]()); } catch (e) { built.set(name, errorBox(e)); }
  }
  document.getElementById("view").replaceChildren(built.get(name));
  window.scrollTo({ top: 0 });
};

/* Lessons and quizzes open in the Study > Lessons panel; the rest open in their own section. */
function showInLessons(nodes) {
  APP.show("Study");
  const view = APP.study.view("Lessons");
  const panel = view.querySelector(".panel");
  fill(panel, button("Back to topics", () => APP.study.select("Lessons")), ...[nodes].flat(Infinity).filter(Boolean));
  panel.scrollIntoView({ block: "start" });
}
APP.open.lesson = (id) => showInLessons(lessonView(id));
APP.open.quiz = (id) => showInLessons(quizView(id));
// Building a section replaces these with handlers that select the item. The checks stop a loop if a section failed to build.
const openLabFirst = (id) => { APP.show("Device Labs"); if (APP.open.lab !== openLabFirst) APP.open.lab(id); };
const openInterviewFirst = (id) => { APP.show("Interview Practice"); if (APP.open.interview !== openInterviewFirst) APP.open.interview(id); };
APP.open.lab = openLabFirst;
APP.open.interview = openInterviewFirst;
APP.open.diagnostic = (id) => { APP.show("Troubleshoot"); APP.trouble.select("Guided diagnostics"); APP.open.diagnosticInTroubleshoot?.(id); };
APP.open.ticket = (id) => { APP.show("Troubleshoot"); APP.trouble.select("Practice tickets"); APP.open.ticketInTroubleshoot?.(id); };
APP.open.case = (id) => {
  const c = content("study.json").cases.find((x) => x.id === id);
  if (c && c.foundation) { APP.open.lab(id); return; }
  APP.show("Troubleshoot"); APP.trouble.select("Evidence cases"); APP.open.caseInTroubleshoot?.(id);
};

function aboutView() {
  const about = engine(["about"]);
  const m = engine(["content-manifest"]);
  return h("section", {}, heading("Enterprise Networking Lab Workbench"),
    kv([["App version", about.version], ["Web build", WEB_BUILD], ["Content digest", m.digest], ["Engine", "The same Rust engine as the desktop app and the terminal version, compiled to WebAssembly"]]),
    h("h3", {}, "About the creator"),
    (about.creator || []).map((p) => h("p", {}, p)),
    h("p", { class: "note" }, about.credit_line),
    h("h3", {}, "Your data"),
    h("p", {}, "Everything runs in your browser. Nothing you type or record is sent anywhere. The practice record is stored in this browser only, so export it to keep a copy."),
    h("h3", {}, "What the web version does not do"),
    h("ul", {}, h("li", {}, "Live troubleshooting cannot run commands on your computer from a browser. Use the desktop app or the terminal version for that. You can still paste output you already have into Troubleshoot > Explain saved output."),
      h("li", {}, "The desktop app's objective evidence ladder and spaced drill reviews are not part of the web version. The web Progress page shows levels from your own records instead.")),
    h("h3", {}, "About the practice material"),
    h("p", {}, "All lessons, questions, cases and labs are original. Device output is simulated or authored for practice and was not captured from real equipment. The simulator teaches the workflow and a subset of commands. It is not Cisco IOS."),
    h("p", { class: "note" }, `Content IDs and fingerprints: ${m.lessons.length} lessons, ${m.questions.length} quizzes, ${m.interviews.length} interviews, ${m.diagnostics.length} diagnostics, ${m.cases.length} cases and foundation labs, ${m.device_labs.length} device labs, ${m.tickets.length} tickets, ${m.reference.length} reference topics.`));
}

/* ---------- Start ---------- */
loadEngine().then(() => {
  const about = engine(["about"]);
  APP.version = about.version;
  document.getElementById("version").textContent = `Version ${about.version} · web ${WEB_BUILD}`;
  const tabs = document.getElementById("tabs");
  for (const name of Object.keys(pages)) put(tabs, h("button", { class: "tab", type: "button", onclick: () => APP.show(name) }, name));
  APP.show("Study");
}).catch((error) => {
  document.getElementById("view").replaceChildren(h("p", { class: "error" }, `The workbench could not start: ${error.message}`));
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
