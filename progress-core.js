"use strict";
/*
 * The practice record, kept in this browser. Records use the same fields as the desktop app's
 * attempts.jsonl, so an export from either one can be imported into the other.
 * summarize() and readiness() follow the engine's case.rs exactly. Testing/verify_web.py checks that.
 */
(function (root) {
  const PRACTICE = ["guided", "independent", "self-scored", "external"];

  function summarize(items) {
    const rows = [];
    for (const x of items) {
      const kind = x.kind || "", id = x.id || "";
      let r = rows.find((y) => y.kind === kind && y.id === id);
      if (!r) {
        r = { kind, id, guided: 0, independent_pass: 0, independent_fail: 0, escalated: 0, self_scored: 0, external: 0, environments: [] };
        rows.push(r);
      }
      switch (x.practice) {
        case "guided": r.guided++; break;
        case "self-scored": r.self_scored++; break;
        case "external":
          r.external++;
          if (typeof x.environment === "string" && !r.environments.includes(x.environment)) r.environments.push(x.environment);
          break;
        case "independent":
          if (x.assessment === "escalated") r.escalated++;
          else if (x.passed === true || x.solved === true || x.assessment === "pass") r.independent_pass++;
          else r.independent_fail++;
          break;
        default: break;
      }
    }
    return {
      kind: "progress_summary", items: rows,
      note: "A simulator pass never counts as external verification. External records are added only by the learner, with the environment named.",
    };
  }

  /* Month 4 readiness: each foundation month is ready once its practical has an independent pass. */
  function readiness(cases, summary) {
    return cases.filter((c) => c.foundation === true && c.week === 4).map((g) => {
      const row = summary.items.find((r) => r.kind === "case" && r.id === g.id);
      const passes = row ? row.independent_pass : 0;
      return { month: g.month, gate: g.id, title: g.title, ready: passes > 0, independent_passes: passes, guided_attempts: row ? row.guided : 0 };
    });
  }

  /* Checks one record the way the desktop app's attempt-record does, then stamps it. */
  function validate(v, version) {
    for (const key of ["kind", "id", "practice", "entry"]) {
      if (typeof v[key] !== "string") throw new Error(`Attempt record needs ${key}`);
    }
    if (!PRACTICE.includes(v.practice)) throw new Error("practice must be guided, independent, self-scored or external");
    if (v.practice === "external" && !(typeof v.environment === "string" && v.environment.trim())) {
      throw new Error("An external verification needs the environment it was run in, such as Packet Tracer 8.2");
    }
    const out = Object.assign({}, v);
    if (out.recorded_at === undefined) out.recorded_at = Math.floor(Date.now() / 1000);
    if (out.version === undefined) out.version = version;
    return out;
  }

  /* Reads an export: this app's JSON file, or the desktop app's attempts.jsonl lines. */
  function parseImport(text) {
    const trimmed = text.replace(/^﻿/, "").trim();
    if (!trimmed) return { attempts: [], extras: {} };
    if (trimmed.startsWith("{") && trimmed.includes("\"attempts\"")) {
      const data = JSON.parse(trimmed);
      if (!Array.isArray(data.attempts)) throw new Error("This file has no attempts list.");
      return { attempts: data.attempts, extras: { gates: data.gates || {}, drills: data.drills || {} } };
    }
    const attempts = [];
    for (const line of trimmed.split(/\r?\n/)) {
      if (!line.trim()) continue;
      attempts.push(JSON.parse(line));
    }
    return { attempts, extras: {} };
  }

  const key = (a) => [a.kind, a.id, a.practice, a.entry, a.recorded_at, a.variant || "", a.environment || ""].join("|");

  /* Adds records that are not already present. The record is append-only, like the desktop log. */
  function merge(existing, incoming) {
    const seen = new Set(existing.map(key));
    const added = [];
    for (const a of incoming) {
      if (!a || typeof a !== "object") continue;
      const k = key(a);
      if (!seen.has(k)) {
        seen.add(k);
        added.push(a);
      }
    }
    return { merged: existing.concat(added), added: added.length, skipped: incoming.length - added.length };
  }

  root.WorkbenchProgress = { summarize, readiness, validate, parseImport, merge, PRACTICE };
})(typeof window !== "undefined" ? window : globalThis);
