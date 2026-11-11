"use strict";
/* Study: lessons by topic, quizzes, and the Year Plan. Content and grading come from the engine. */

const KIND_LABEL = { lessons: "Lesson", questions: "Quiz", interviews: "Interview", diagnostics: "Guided diagnostic", cases: "Case", device_labs: "Device lab", tickets: "Practice ticket" };
const KIND_PLURAL = { lessons: "Lessons", questions: "Quizzes", interviews: "Interviews", diagnostics: "Guided diagnostics", cases: "Cases", device_labs: "Device labs", tickets: "Practice tickets" };
const KIND_OPEN = { lessons: "lesson", questions: "quiz", interviews: "interview", diagnostics: "diagnostic", cases: "case", device_labs: "lab", tickets: "ticket" };

function commandsBlock(commands) {
  const out = [];
  for (const [key, label] of [["cmd", "CMD"], ["powershell", "PowerShell"], ["linux", "Linux"], ["switch", "Cisco device"]]) {
    const list = (commands || {})[key];
    if (list && list.length) out.push(h("h3", {}, label), pre(list.join("\n")));
  }
  return out;
}

function lessonView(id) {
  const l = engine(["lesson", id]);
  return [heading(l.title), h("p", { class: "idline" }, `Lesson ID: ${l.id}   Fingerprint: ${l.fingerprint}`), h("p", { class: "lead" }, l.summary),
    (l.sections || []).map((s) => [h("h3", {}, s.heading), h("p", {}, s.text)]),
    h("h3", {}, "Commands to know"), commandsBlock(l.commands),
    l.see_also && l.see_also.length ? [h("h3", {}, "Related lessons"), h("div", { class: "links" }, l.see_also.map((r) => button(r.title, () => openItem("lesson", r.id), "link")))] : null];
}

/* One quiz question. Grading is the engine's answer command, so it matches the desktop and the terminal. */
function quizView(id) {
  const q = engine(["question", id]);
  const result = h("div", { "aria-live": "polite" });
  const name = `quiz-${id}`;
  const options = q.choices.map((c, i) => h("label", { class: "choice" }, h("input", { type: "radio", name, value: String(i + 1) }), c));
  const submit = button("Submit answer", () => {
    const picked = options.map((o) => o.querySelector("input")).find((r) => r.checked);
    if (!picked) { fill(result, h("p", { class: "warn" }, "Choose an answer first.")); return; }
    const r = engine(["answer", id, picked.value]);
    fill(result, h("p", { class: r.correct ? "good" : "warn" }, r.correct ? "Correct." : "Not correct."),
      !r.correct && h("p", {}, `The answer is ${r.correct_choice}: ${r.correct_text}`),
      !r.correct && r.why_not && h("p", {}, `Why not your choice: ${r.why_not}`), h("p", {}, r.explanation));
  }, "primary");
  return [heading("Quiz"), h("p", { class: "idline" }, `Question ID: ${q.id}   Fingerprint: ${q.fingerprint}`), h("p", { class: "lead" }, q.prompt), options, h("div", { class: "actions" }, submit), result];
}

function topicPage(t) {
  const parts = [heading(t.title), t.blueprint ? h("p", { class: "note" }, `CCNA v2.0 blueprint: ${t.blueprint}`) : null];
  for (const key of Object.keys(KIND_LABEL)) {
    const items = t[key] || [];
    if (!items.length) continue;
    parts.push(h("h3", {}, KIND_PLURAL[key]), h("div", { class: "links" },
      items.map((x) => button(`${x.title || x.id}`, () => openItem(KIND_OPEN[key], x.id), "link"))));
  }
  return parts;
}

function lessonsView() {
  const index = engine(["study-index"]).topics;
  const blueprint = new Map(content("study.json").topics.map((t) => [t.id, t.blueprint]));
  const topics = index.map((t) => Object.assign({ blueprint: blueprint.get(t.id) }, t));
  const page = h("div", {});
  const lists = splitList(topics, (t) => t.title, (t) => topicPage(t));
  put(page, h("p", { class: "intro" }, "Choose a topic to see its lessons, quizzes, interviews, guided diagnostics, cases, labs and tickets."), lists);
  return page;
}

/* ---------- Year Plan ---------- */
function readinessFor(month) {
  const r = WorkbenchProgress.readiness(content("study.json").cases, WorkbenchProgress.summarize(record.all())).find((x) => x.month === month);
  if (!r) return null;
  return h("p", { class: r.ready ? "good" : "note" }, r.ready ? `Month 4 readiness: ready. The practical ${r.gate} has an independent pass in this browser.`
    : `Month 4 readiness: not yet. Pass the practical ${r.gate} in independent mode.`);
}

function yearPlanView() {
  const plan = content("curriculum.json");
  const cases = content("study.json").cases;
  const caseTitle = (id) => { const c = cases.find((x) => x.id === id); return c ? foundationLabel(c) : id; };
  const sims = engine(["sim-catalog"]).labs;
  const simTitle = (id) => (sims.find((x) => x.id === id) || { title: id }).title;
  const months = splitList(plan.months, (m) => `Month ${m.month}: ${m.title}`, (m) => [
    heading(`Month ${m.month}: ${m.title}`), kv([["Study", m.sources], ["Proof of skill", m.proof]]),
    m.drills && m.drills.length ? [h("h3", {}, "Drills in Study > Practice"), h("p", {}, m.drills.map((d) => d.replace(/_/g, " ")).join(", "))] : null,
    m.foundation_labs && m.foundation_labs.length ? [h("h3", {}, "Foundation labs, in Device Labs above Month 4"),
      h("div", { class: "links" }, m.foundation_labs.map((id) => button(caseTitle(id), () => openItem("lab", id), "link"))), readinessFor(m.month)] : null,
    m.labs && m.labs.length ? [h("h3", {}, "Device labs this month"), h("div", { class: "links" }, m.labs.map((id) => button(simTitle(id), () => openItem("lab", id), "link")))] : null,
  ]);
  return subnav({
    "12-month path": () => months,
    "Competency gates": () => gatesView(plan),
    "Closet tour": () => closetView(plan),
    "Troubleshooting method": () => h("section", {}, heading("Use this method on every ticket"), h("ol", { class: "steps" }, plan.method.map((s) => h("li", {}, h("strong", {}, `${s.name}: `), s.text)))),
    "Book map": () => h("section", {}, h("p", { class: "intro" }, "Chapter titles come from each book's table of contents. Coverage means original lessons and labs on that topic. No book text is included."),
      h("div", { class: "scroll" }, h("table", {}, h("thead", {}, h("tr", {}, ["Book", "Chapter", "Title", "Month", "Coverage"].map((x) => h("th", {}, x)))),
        h("tbody", {}, plan.book_map.map((b) => h("tr", {}, [b.book, b.chapter === null ? "" : String(b.chapter), b.title, String(b.month), b.coverage].map((x) => h("td", { class: "plain" }, x)))))))),
  });
}

function gatesView(plan) {
  const checked = store.get("gates", {});
  const box = h("section", {}, h("p", { class: "intro" }, "Check an item only when someone qualified has seen you do it on real work or a real lab. These checks are saved in this browser."));
  for (const [day, items] of Object.entries(plan.gates).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    put(box, h("h3", {}, `By day ${day}`));
    items.forEach((text, i) => {
      const id = `${day}:${i}`;
      const input = h("input", { type: "checkbox", checked: Boolean(checked[id]), onchange: () => { const c = store.get("gates", {}); c[id] = input.checked; store.set("gates", c); } });
      put(box, h("label", { class: "choice" }, input, text));
    });
  }
  return box;
}

function closetView(plan) {
  const norm = (s) => s.replace(/\s/g, "").toLowerCase();
  const trace = plan.trace.map((t, i) => {
    const answer = field(`Question ${i + 1}: ${t.question}`, "", "Your answer");
    const result = h("p", { "aria-live": "polite" });
    const check = () => {
      const right = [t.answer, ...(t.accepted || [])].map(norm).includes(norm(answer.input.value));
      result.className = right ? "good" : "warn";
      result.textContent = right ? `Correct. ${t.answer}` : "Not yet. Read the labels again.";
    };
    answer.input.addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });
    return h("div", { class: "trace" }, h("div", { class: "form" }, answer.wrap), h("div", { class: "actions" }, button("Check", check)), result);
  });
  return h("section", {},
    plan.closet.map((c) => h("details", { class: "card" }, h("summary", {}, c.name), kv([["What it is", c.what], ["How to identify it", c.identify], ["What to check", c.check], ["What not to do", c.dont]]))),
    h("h3", {}, "Closet rules"), h("ol", { class: "steps" }, plan.rules.map((r) => h("li", {}, r))),
    h("h3", {}, "Port trace questions"), trace);
}
