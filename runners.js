"use strict";
/* Interview Practice, evidence cases and foundation labs, Device Labs, practice tickets, guided diagnostics and output analysis. */

/* ---------- Interview Practice ---------- */
function interviewView(id) {
  const iv = engine(["interview", id]);
  const box = h("div", {});
  const log = h("div", { class: "log" });
  let step = 0;
  const intro = [heading(iv.title), h("p", { class: "idline" }, `Interview ID: ${iv.id}   Fingerprint: ${iv.fingerprint}`), h("p", { class: "lead" }, iv.scenario)];
  if (iv.mode === "open") {
    intro.push(h("p", { class: "note" }, "Open answer: type your answer in your own words. It is not graded automatically. After each answer you see what a strong answer includes, then score yourself on the rubric."));
    if (iv.first_evidence) intro.push(h("p", { class: "evidence" }, iv.first_evidence));
  }
  function next() {
    if (step >= iv.steps.length) return;
    const s = iv.steps[step];
    const n = step + 1;
    const own = field("Your own answer", "", iv.mode === "open" ? "Type your answer" : "Or answer in your own words", { area: iv.mode === "open", wide: true });
    const name = `iv-${id}-${n}`;
    const options = (s.choices || []).map((c, i) => h("label", { class: "choice" }, h("input", { type: "radio", name, value: String(i + 1) }), c));
    const out = h("div", { "aria-live": "polite" });
    const submit = button("Submit", () => {
      let r;
      try {
        const picked = options.map((o) => o.querySelector("input")).find((x) => x.checked);
        if (iv.mode === "open") {
          if (!own.input.value.trim()) { fill(out, h("p", { class: "warn" }, "Type an answer first.")); return; }
          r = engine(["interview-answer", id, String(n), "own"]);
          fill(out, h("p", {}, h("strong", {}, "A strong answer includes:")), h("ul", {}, r.points.map((p) => h("li", {}, p))), r.next_evidence ? h("p", { class: "evidence" }, r.next_evidence) : null);
        } else {
          if (!picked && !own.input.value.trim()) { fill(out, h("p", { class: "warn" }, "Choose an answer or type your own.")); return; }
          r = engine(["interview-answer", id, String(n), picked ? picked.value : "own"]);
          fill(out, r.graded ? h("p", { class: r.best ? "good" : "warn" }, r.best ? "Strong answer." : "Not the strongest answer.") : h("p", { class: "note" }, "Compare your answer with the reasoning below."),
            r.graded ? h("p", {}, r.feedback) : null, !r.best ? h("p", {}, h("strong", {}, "Strongest answer: "), r.strongest, ". ", r.strongest_why) : null,
            h("p", {}, h("strong", {}, "Reasoning: "), r.reasoning));
        }
      } catch (e) { fill(out, errorBox(e)); return; }
      submit.disabled = true;
      options.forEach((o) => { o.querySelector("input").disabled = true; });
      own.input.disabled = true;
      step++;
      if (r.last) finish(r.model_answer);
      else put(out, h("div", { class: "actions" }, button("Next question", next, "primary")));
    }, "primary");
    put(log, h("div", { class: "card" }, h("h3", {}, `Question ${n} of ${iv.steps.length}: ${s.ask}`), options, own.wrap, h("div", { class: "actions" }, submit), out));
  }
  function finish(model) {
    put(log, h("h3", {}, "How you might say it"), h("p", {}, model));
    if (iv.mode !== "open") {
      saveAttempt({ kind: "interview", id, practice: "guided" });
      return;
    }
    const rubric = content("study.json").rubric;
    const selects = rubric.map((r) => h("select", { "aria-label": r.title }, ["0", "1", "2"].map((v) => h("option", { value: v }, v))));
    const result = h("div", { "aria-live": "polite" });
    put(log, h("h3", {}, "Score yourself on the rubric (0 to 2 each)"),
      h("div", { class: "rubric" }, rubric.map((r, i) => h("label", { class: "rubric-row" }, h("span", {}, h("strong", {}, r.title), h("br"), h("span", { class: "note" }, `Full credit: ${r.full}`)), selects[i]))),
      h("div", { class: "actions" }, button("Score my answer", () => {
        try {
          const r = engine(["rubric-score", id, ...selects.map((s) => s.value)]);
          fill(result, h("p", { class: "res" }, `Self-score: ${r.score}/${r.max}`), rubricRows(r.rubric));
          saveAttempt({ kind: "interview", id, practice: "self-scored", score: r.score, max: r.max });
        } catch (e) { fill(result, errorBox(e)); }
      }, "primary")), result);
  }
  put(box, ...intro, log);
  next();
  return box;
}

function rubricRows(rows) {
  return h("div", {}, rows.map((r) => h("div", { class: "rubric-out" }, h("p", {}, h("strong", {}, `${r.title} ${r.score}/2`), " ", r.why), r.improve ? h("p", { class: "note" }, `Improve: ${r.improve}`) : null)));
}

function interviewPracticeView() {
  const all = engine(["study-index"]).topics.flatMap((t) => t.interviews);
  const node = splitList(all, (i) => i.title, (i) => interviewView(i.id));
  APP.open.interview = (id) => { APP.show("Interview Practice"); node.chooseBy((i) => i.id === id); };
  return h("section", {}, h("p", { class: "intro" }, "Multiple-choice scenarios give feedback on every choice. The open-answer scenario reveals evidence after each answer and ends with a self-score on the rubric."), node);
}

/* ---------- Evidence cases and foundation labs ---------- */
function foundationLabel(c) {
  const cut = c.title.indexOf("practical: ");
  return cut >= 0 ? `Month ${c.month}  Practical: ${c.title.slice(cut + 11)}` : `Month ${c.month}  Week ${c.week}: ${c.title}`;
}

/* The same runner, attempt format and result text as the desktop app's CaseTab. */
function caseRunner(id) {
  const c = engine(["case", id]);
  const root = h("div", {});
  const guided = h("input", { type: "checkbox", id: `g-${id}` });
  const cause = h("select", { disabled: true, "aria-label": "Cause to practice" }, c.guided_causes.map((x) => h("option", { value: x.id }, x.name)));
  const body = h("div", {});
  guided.addEventListener("change", () => { cause.disabled = !guided.checked; start(); });
  cause.addEventListener("change", start);
  put(root, heading(c.title),
    h("p", { class: "idline" }, `${c.foundation ? `Month ${c.month} foundation lab.   Lab ID: ` : "Case ID: "}${c.id}   Fingerprint: ${c.fingerprint}`),
    h("label", { class: "check", htmlFor: `g-${id}` }, guided, "Guided practice: choose the cause, and each result is explained"), cause, body);

  function start() {
    const mode = guided.checked ? "guided" : "independent";
    const variant = guided.checked ? cause.value : c.variants[Math.floor(Math.random() * c.variants.length)];
    const done = [];
    let hints = 0;
    const evidence = h("div", { class: "log", "aria-live": "polite" });
    const hintText = h("p", { class: "note", "aria-live": "polite" });
    const checks = h("div", { class: "links" });
    for (const k of c.checks) {
      const b = button(k.title, () => {
        try {
          const e = engine(["case-evidence", id, variant, k.id, mode]);
          put(evidence, h("div", { class: "card" }, h("p", { class: "simulated" }, `[${e.shell}] ${e.command}`), pre(e.output),
            e.impact === "high" ? h("p", { class: "warn" }, "This was a change, not a test.") : null,
            e.meaning ? h("p", {}, h("strong", {}, "What it shows: "), e.meaning) : null));
          done.push(k.id);
          b.disabled = true;
        } catch (err) { put(evidence, errorBox(err)); }
      }, "link");
      put(checks, b);
    }
    const hint = button("Hint", () => {
      if (hints >= c.hint_count) { hintText.textContent = "No more hints."; return; }
      hints++;
      hintText.textContent = `Hint ${hints} of ${c.hint_count}: ${engine(["case-hint", id, String(hints)]).text}`;
    });
    const diagnosis = selectField("Diagnosis", c.diagnoses), repair = selectField("Repair or next action", c.repairs), verification = selectField("Verification", c.verifications);
    const handoff = field("Handoff note for the next technician", "", "What you checked, found and did", { wide: true });
    const result = h("div", { "aria-live": "polite" });
    const follow = h("div", {});
    const submit = button("Submit my answer", () => {
      if (!diagnosis.select.value || !repair.select.value || !verification.select.value) { fill(result, h("p", { class: "warn" }, "Choose a diagnosis, a repair and a verification first.")); return; }
      const attempt = { checks: done.slice(), diagnosis: diagnosis.select.value, repair: repair.select.value, verification: verification.select.value, hints, handoff: handoff.input.value, mode };
      let g;
      try { g = engine(["case-grade", id, variant, JSON.stringify(attempt)]); } catch (e) { fill(result, errorBox(e)); return; }
      submit.disabled = true;
      fill(result, pre(formatGrade(g), "result"));
      saveAttempt({ kind: "case", id, practice: g.practice, variant, score: g.score, max: 10, outcome: g.outcome, solved: g.solved, assessment: g.assessment, mode,
        checks: attempt.checks, diagnosis: attempt.diagnosis, repair: attempt.repair, verification: attempt.verification, hints, handoff: attempt.handoff });
      if (g.followup) {
        const f = g.followup;
        const answer = field("Your answer to the follow-up (not graded automatically)", "", "", { area: true, wide: true });
        const shown = h("div", {});
        fill(follow, h("h3", {}, "Interview follow-up"), h("p", {}, `One fact changes: ${f.changed_fact}`), h("p", { class: "lead" }, f.ask), answer.wrap,
          h("div", { class: "actions" }, button("Show a strong answer", () => fill(shown, h("p", {}, h("strong", {}, "A strong answer includes:")), h("ul", {}, f.points.map((p) => h("li", {}, p))), h("p", {}, h("strong", {}, "How you might say it: "), f.model_answer)))), shown);
      }
    }, "primary");
    const name = guided.checked ? (c.guided_causes.find((x) => x.id === variant) || {}).name : null;
    fill(body, h("p", { class: "lead" }, c.brief), c.fixture ? h("p", { class: "note" }, `Fixture: ${c.fixture}`) : null,
      h("p", { class: guided.checked ? "good" : "note" }, guided.checked ? `Guided practice. The cause is: ${name}. Each check explains what it shows.` : `Independent practice. The cause is hidden. It is one of ${c.variants.length} possible faults.`),
      h("h3", {}, "Choose a check to see what it finds"), checks, h("div", { class: "actions" }, hint, button("New attempt", start)), hintText,
      h("h3", {}, "What you found"), evidence, h("div", { class: "form" }, diagnosis.wrap, repair.wrap, verification.wrap, handoff.wrap),
      h("div", { class: "actions" }, submit), result, follow);
  }
  start();
  return root;
}

function formatGrade(g) {
  const out = [];
  out.push(`Cause: ${g.variant_name} (${g.variant})`);
  out.push(`Assessment: ${String(g.assessment).toUpperCase()}   Score: ${g.score}/10   Practice: ${g.practice}`);
  out.push(`Outcome: ${g.outcome}   Diagnosis correct: ${g.diagnosis_correct}   Repair correct: ${g.repair_correct}   Service verified: ${g.verified_service}`);
  if (g.fail_reasons && g.fail_reasons.length) out.push("", "Why this did not pass", ...g.fail_reasons.map((x) => `- ${x}`));
  out.push("", "Rubric");
  for (const r of g.rubric) {
    out.push(`${r.title.padEnd(26)} ${r.score}/2`, `    ${r.why}`);
    if (typeof r.improve === "string") out.push(`    Improve: ${r.improve}`);
  }
  out.push("", "What your checks established", ...g.review.map((x) => `- ${x.title}: ${x.meaning}`));
  out.push("", "The answer", `Diagnosis: ${g.correct_diagnosis}`, `Repair: ${g.correct_repair}`, g.summary);
  if (g.common_wrong) out.push("", `Common wrong answer: ${g.common_wrong.answer}`, `Why it fails: ${g.common_wrong.why}`);
  if (g.pivot) out.push("", `Evidence that should change your next step: ${g.pivot}`);
  if (g.recovery) out.push("", `How to verify recovery: ${g.recovery}`);
  if (g.model_handoff) out.push("", "Compare your handoff with this model:", g.model_handoff);
  return out.join("\n");
}

function evidenceCasesView() {
  const cases = engine(["case-list"]).cases.filter((c) => !c.foundation);
  const node = splitList(cases, (c) => h("span", {}, c.title, h("span", { class: "tag" }, c.track)), (c) => caseRunner(c.id));
  APP.open.caseInTroubleshoot = (id) => node.chooseBy((c) => c.id === id);
  return h("section", {}, h("p", { class: "intro" }, "Each case has two to four causes behind one symptom. Guided practice names the cause and explains each result. Independent practice hides the cause and solution until you submit, then grades the attempt pass, fail or escalated."), node);
}

/* ---------- Device Labs: Months 1 to 3 foundation labs, then the simulated network ---------- */
function simLabView(id) {
  let started = engine(["sim-new", id]);
  let lab = started.lab, state = JSON.stringify(started.state);
  let hints = 0, solutionShown = false, recorded = false, timer = null;
  const root = h("div", {});
  const device = h("select", { "aria-label": "Device" });
  const prompt = h("span", { class: "prompt" });
  const input = h("input", { type: "text", class: "console-input", spellcheck: false, autocomplete: "off", "aria-label": "Command", placeholder: "Type a command and press Enter, for example: show ip interface brief" });
  input.setAttribute("autocapitalize", "off");
  const consoleBox = h("pre", { class: "console", "aria-live": "polite" });
  const results = h("div", { "aria-live": "polite" });
  const help = h("div", { "aria-live": "polite" });
  const topo = h("div", {});
  const timeLeft = h("p", { class: "warn" });
  const summary = h("div", {});

  function call(args) { return engine(args); }
  function refreshPrompt() {
    try { prompt.textContent = call(["sim-exec", state, device.value, ""]).prompt; } catch { prompt.textContent = ""; }
  }
  function drawTopology() {
    const t = call(["sim-topology", state]);
    const tiers = [0, 1, 2].map((tier) => h("div", { class: "tier" }, t.devices.filter((d) => d.tier === tier).map((d) => h("span", { class: `node t${tier}` }, d.name))));
    fill(topo, h("div", { class: "topology" }, tiers), h("details", {}, h("summary", {}, "Interfaces, addresses and links"), pre(t.text)));
  }
  function load() {
    started = call(["sim-new", id]);
    lab = started.lab; state = JSON.stringify(started.state);
    hints = 0; solutionShown = false; recorded = false;
    const keep = device.value;
    fill(device, ...started.topology.devices.map((d) => h("option", { value: d.name }, d.name)));
    device.value = keep && started.topology.devices.some((d) => d.name === keep) ? keep : "PC1";
    consoleBox.textContent = ""; fill(results); fill(help); fill(summary);
    drawTopology(); refreshPrompt();
    if (timer) clearInterval(timer);
    timeLeft.textContent = "";
    if (lab.timed_minutes) {
      let left = lab.timed_minutes * 60;
      timeLeft.textContent = `Time left: ${lab.timed_minutes}:00`;
      timer = setInterval(() => { left--; timeLeft.textContent = `Time left: ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`; if (left <= 0) clearInterval(timer); }, 1000);
    }
  }
  function send() {
    const command = input.value;
    input.value = "";
    try {
      const r = call(["sim-exec", state, device.value, command]);
      consoleBox.textContent += `${prompt.textContent}${command}\n${r.output}\n`;
      consoleBox.scrollTop = consoleBox.scrollHeight;
      state = JSON.stringify(r.state);
      prompt.textContent = r.prompt;
      drawTopology();
    } catch (e) { consoleBox.textContent += `${e.message}\n`; }
  }
  function check() {
    const r = call(["sim-check", state]);
    fill(results, pre(r.results.map((c) => `${c.pass ? "PASS" : "FAIL"}  ${c.label}${c.detail ? `\n      ${c.detail}` : ""}`).join("\n"), "result"));
    if (!r.passed) { fill(help, h("p", { class: "note" }, "Not complete yet. Fix the failing checks, then check again.")); return; }
    if (timer) clearInterval(timer);
    const independent = hints === 0 && !solutionShown;
    fill(summary, h("h3", {}, "Ticket summary"), pre([`Lab: ${lab.title}   Date: ${new Date().toISOString().slice(0, 10)}`, `Issue: ${lab.ticket}`, `Why it failed: ${lab.why}`, "",
      "Verification (checked from network state):", ...r.results.map((c) => `- ${c.label}: ${c.detail}`), "", `Commands used: ${r.commands}`,
      `Completion: ${independent ? "independent" : "with help"}`, "Data source: simulated network, not live equipment."].join("\n")));
    fill(help, h("p", { class: "good" }, `Lab complete. ${lab.why}`));
    if (!recorded) { recorded = true; saveAttempt({ kind: "lab", id, practice: independent ? "independent" : "guided", passed: true }); }
  }
  function walk(from, to, port) {
    const tcp = port.trim() && port.trim() !== "0";
    try {
      const r = call(["sim-walk", state, from.trim(), to.trim(), tcp ? "tcp" : "icmp", tcp ? port.trim() : "0"]);
      fill(results, pre(`${r.ok ? "SUCCESS" : `FAILED: ${r.reason}`}\n${r.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`, "result"));
    } catch (e) { fill(results, errorBox(e)); }
  }
  device.addEventListener("change", refreshPrompt);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
  const wf = field("From", "PC1"), wt = field("To", "app.corp.example"), wp = field("TCP port (0 = ping)", "443");
  put(root, heading(`Ticket: ${lab.ticket}`), h("p", { class: "idline" }, `Lab ID: ${id}   Fingerprint: ${started.fingerprint}`), timeLeft,
    h("p", { class: "simulated" }, "SIMULATED NETWORK. This teaches the workflow and a subset of commands, and is not Cisco IOS. Labs are graded from the resulting network state."),
    h("details", { class: "card" }, h("summary", {}, "Network topology"), topo),
    h("div", { class: "console-row" }, h("label", {}, "Device ", device), prompt, input), consoleBox,
    h("div", { class: "actions" }, button("Check my work", check, "primary"),
      button("Hint", () => { const list = lab.hints || []; if (!list.length) return; fill(help, h("p", {}, `Hint: ${list[Math.min(hints, list.length - 1)]}`)); hints++; }),
      button("Worked solution", () => { solutionShown = true; fill(help, pre(`Worked solution\n${Object.entries(lab.solution).map(([d, cmds]) => `${d}:\n${cmds.map((x) => `  ${x}`).join("\n")}`).join("\n")}\n\nWhy: ${lab.why}`)); }),
      button("Reset lab", load)), help,
    h("h3", {}, "Results"), results,
    h("div", { class: "form" }, wf.wrap, wt.wrap, wp.wrap), h("div", { class: "actions" }, button("Packet walk", () => walk(wf.input.value, wt.input.value, wp.input.value))), summary);
  load();
  return root;
}

function deviceLabsView() {
  const foundation = engine(["case-list"]).cases.filter((c) => c.foundation).sort((a, b) => a.month - b.month || a.week - b.week);
  const sims = engine(["sim-catalog"]).labs;
  const items = foundation.map((c) => Object.assign({ foundation: true }, c)).concat(sims);
  const node = splitList(items, (x) => (x.foundation ? h("span", {}, foundationLabel(x), h("span", { class: "tag" }, "authored evidence")) : `Month ${x.month}  ${x.title}`),
    (x) => (x.foundation ? caseRunner(x.id) : simLabView(x.id)));
  APP.open.lab = (id) => { APP.show("Device Labs"); node.chooseBy((x) => x.id === id); };
  return h("section", {}, h("p", { class: "intro" }, "Months 1 to 3 are foundation labs that use authored evidence: choose checks and interpret the results. From Month 4 the labs run on a simulated company network where you type device commands. An independent pass of a month's practical marks that month ready for Month 4."), node);
}

/* ---------- Practice tickets: the desktop app's guided ticket flow ---------- */
function ticketView(t) {
  const prompts = { PowerShell: "PS C:\\> ", Bash: "$ ", "Switch CLI": "Switch# " };
  const variant = t.variants[Math.floor(Math.random() * t.variants.length)];
  const root = h("div", {});
  let hintsShown = 0;
  const header = [h("span", { class: `badge ${t.platform.toLowerCase()}` }, t.platform), heading(`${t.title}${t.ticket ? ` (${t.ticket})` : ""}`),
    h("p", { class: "lead" }, t.symptom),
    kv([t.site && ["Site", t.site], t.starting_state && ["Starting state", t.starting_state], t.expected && ["Expected result", t.expected]])];
  const hintBox = h("p", { class: "note" });
  const hintBtn = (t.hints || []).length ? button("Hint", () => { hintBox.textContent = `Hint: ${t.hints[Math.min(hintsShown, t.hints.length - 1)]}`; hintsShown++; }) : null;
  const stageBox = h("div", {});
  function stage(i) {
    const s = variant.stages[i];
    const feedback = h("p", { "aria-live": "polite" });
    const name = `tk-${t.id}-${i}`;
    const reveal = button("Reveal sample output", () => {
      radios.forEach((r) => { r.querySelector("input").disabled = true; });
      reveal.remove();
      const after = h("div", {}, h("p", { class: "simulated" }, `SIMULATED OUTPUT (practice data) · ${t.platform} · ${s.shell}`), pre(`${prompts[s.shell] || ""}${s.command}\n${s.output}`),
        h("p", {}, h("strong", {}, "What it tells you: "), s.meaning), h("p", {}, h("strong", {}, "Next step: "), s.next));
      const last = i === variant.stages.length - 1;
      const go = button(last ? "Finish" : "Next", () => (last ? finish() : stage(i + 1)), "primary");
      if (s.evidence) {
        const ef = h("p", { "aria-live": "polite" });
        go.disabled = true;
        const ename = `${name}-e`;
        put(after, h("h3", {}, s.evidence.question), s.evidence.choices.map((c) => h("label", { class: "choice" }, h("input", { type: "radio", name: ename, onchange: () => {
          ef.className = c.best ? "good" : "warn";
          ef.textContent = c.best ? "Supported by the evidence." : "That is not supported by the evidence. Look at the output again.";
          go.disabled = !c.best;
        } }), c.text)), ef);
      }
      put(after, h("div", { class: "actions" }, go));
      put(stageBox, after);
    });
    reveal.disabled = true;
    const radios = s.choices.map((c) => h("label", { class: "choice" }, h("input", { type: "radio", name, onchange: () => { feedback.textContent = c.feedback; feedback.className = c.best ? "good" : "warn"; reveal.disabled = false; } }), c.text));
    fill(stageBox, h("h3", {}, `Step ${i + 1} of ${variant.stages.length}: ${s.question}`), radios, feedback, h("div", { class: "actions" }, reveal));
  }
  function finish() {
    const v = variant;
    fill(stageBox, h("h3", {}, `Diagnosis: ${v.name}`), h("h3", { class: "steps-title" }, "Steps to proceed"), h("ol", { class: "steps" }, v.procedure.map((p) => h("li", {}, p))),
      v.fix ? [h("p", {}, v.fix.summary), h("p", { class: "simulated" }, `SIMULATED OUTPUT (practice data) · ${t.platform} · after the fix`), pre(v.fix.output || ""),
        h("p", {}, h("strong", {}, "Now verify:")), h("ul", {}, (v.fix.verify || []).map((x) => h("li", {}, x))),
        v.fix.ip ? h("div", { class: "actions" }, button("Open in Calculate", () => { APP.show("Study"); APP.study.select("Calculate"); calc.fill(v.fix.ip, v.fix.prefix, "", v.fix.gateway, false, "ipv4"); })) : null] : null,
      v.closing ? h("p", {}, h("strong", {}, "Closing note: "), v.closing) : null,
      v.solution ? [h("h3", {}, "Worked solution"), h("ol", { class: "steps" }, v.solution.map((x) => h("li", {}, x)))] : null,
      h("p", { class: "note" }, `Platform: ${t.platform}. Simulated practice lab.`), h("div", { class: "actions" }, button("Start again", () => stage(0))));
    saveAttempt({ kind: "ticket", id: t.id, practice: "guided", variant: v.id });
  }
  put(root, ...header, h("div", { class: "actions" }, hintBtn), hintBox, stageBox);
  stage(0);
  return root;
}

function ticketsView() {
  const tickets = content("labs.json");
  const node = splitList(tickets, (t) => h("span", {}, h("span", { class: `badge ${t.platform.toLowerCase()}` }, t.platform), t.title), ticketView);
  APP.open.ticketInTroubleshoot = (id) => node.chooseBy((t) => t.id === id);
  return h("section", {}, h("p", { class: "intro" }, "Guided tickets with simulated output. Choose a test, reveal what it shows, answer the evidence question, and finish with the steps to proceed."), node);
}

/* ---------- Guided diagnostics ---------- */
function diagnosticView(id) {
  const root = h("div", {});
  function show(node, path) {
    const parts = [heading(node.title), h("p", { class: "idline" }, `Diagnostic ID: ${id}${node.fingerprint ? `   Fingerprint: ${node.fingerprint}` : ""}`)];
    if (path.length) parts.push(h("p", { class: "note" }, `Your answers: ${path.join(" → ")}`));
    if (node.done) {
      const c = node.result;
      parts.push(h("h3", {}, `Conclusion: ${c.title}`), h("p", { class: "idline" }, `Conclusion ID: ${node.conclusion}`), h("p", {}, c.means),
        h("h3", {}, "Still uncertain"), h("ul", {}, c.uncertain.map((u) => h("li", {}, u))),
        h("h3", {}, "Check next"), c.next.map((n) => h("div", { class: "card" }, h("p", {}, h("strong", {}, n.purpose)), kv([["CMD", n.cmd], ["PowerShell", n.powershell], ["Linux", n.linux]]))),
        h("div", { class: "actions" }, button("Start again", () => show(engine(["diagnostic", id]), []))));
    } else {
      const run = node.run || {};
      parts.push(h("h3", {}, node.ask), kv([run.cmd && ["CMD", run.cmd], run.powershell && ["PowerShell", run.powershell], run.linux && ["Linux", run.linux], run.switch && ["Cisco switch", run.switch]]),
        h("div", { class: "links" }, node.options.map((o, i) => button(o, () => { try { show(engine(["diagnostic-step", id, node.node, String(i + 1)]), path.concat(o)); } catch (e) { put(root, errorBox(e)); } }, "link"))));
    }
    fill(root, ...parts);
  }
  show(engine(["diagnostic", id]), []);
  return root;
}

function guidedView() {
  const all = engine(["study-index"]).topics.flatMap((t) => t.diagnostics);
  const node = splitList(all, (d) => d.title, (d) => diagnosticView(d.id));
  APP.open.diagnosticInTroubleshoot = (id) => node.chooseBy((d) => d.id === id);
  return h("section", {}, h("p", { class: "intro" }, "Each diagnostic asks for a test result, and your answer leads to the next question or to a conclusion that says what is known and what is still uncertain."), node);
}

/* ---------- Explain saved output (the part of live troubleshooting a browser can do) ---------- */
function analyzeView() {
  const text = field("Paste the output of ipconfig /all, ping, nslookup, Resolve-DnsName, Test-NetConnection, ip addr, ip route, resolvectl or dig", "", "Paste command output here", { area: true, wide: true });
  const out = h("div", { "aria-live": "polite" });
  return h("section", {},
    h("p", { class: "intro" }, "Paste output you already have, and the same analyzer the desktop app uses explains it. Nothing you paste leaves this page. A browser cannot run commands on your computer, so running live checks needs the desktop app or the terminal version."),
    h("div", { class: "form" }, text.wrap),
    h("div", { class: "actions" }, button("Explain this output", () => {
      try {
        const r = engine(["analyze", text.input.value]);
        fill(out, h("h3", {}, r.title), h("p", { class: "idline" }, `Conclusion ID: ${r.conclusion}`), h("p", {}, r.means),
          r.shows && r.shows.length ? [h("h3", {}, "What the output shows"), h("ul", {}, r.shows.map((s) => h("li", {}, s)))] : null,
          h("h3", {}, "Still uncertain"), h("ul", {}, (r.uncertain || []).map((u) => h("li", {}, u))),
          h("h3", {}, "Check next"), (r.next || []).map((n) => h("div", { class: "card" }, h("p", {}, h("strong", {}, n.purpose)), kv([["CMD", n.cmd], ["PowerShell", n.powershell], ["Linux", n.linux]]))));
      } catch (e) { fill(out, errorBox(e)); }
    }, "primary")), out);
}
