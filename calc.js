"use strict";
/* Calculate, Design, Reference, Practice drills and Subnet charts. Carried over from the first website; topics now come from the engine. */

/* ---------- Show the math ---------- */
function bitsView(bits) {
  const pre = h("div", { class: "bits" });
  const hextets = bits.groups.length === 8;
  let index = 0;
  bits.groups.forEach((group, g) => {
    if (hextets) {
      const hex = group.includes("?") ? "????" : parseInt(group, 2).toString(16).padStart(4, "0");
      pre.append(`h${g + 1} ${hex}  `);
    }
    for (const c of group) {
      if (index === bits.prefix && bits.prefix > 0) pre.append(h("span", { class: "p" }, " | "));
      const type = c === "?" ? "u" : index < bits.prefix ? "n" : "h";
      pre.append(h("span", { class: type }, c));
      index++;
    }
    if (hextets) pre.append("\n");
    else if (g < bits.groups.length - 1) pre.append(".");
  });
  return pre;
}

function mathView(data) {
  const parts = [];
  if (data.bits) {
    parts.push(bitsView(data.bits), h("div", { class: "legend" },
      h("span", { class: "n" }, "Network bits"), h("span", { class: "h" }, "Host bits"),
      h("span", { class: "u" }, "? = not supplied"), h("span", {}, "| = prefix ends")));
  }
  for (const s of data.math) {
    parts.push(h("div", { class: "step" }, h("h3", {}, s.title),
      h("p", {}, "Formula: ", s.formula), h("p", { class: "num" }, s.numbers), h("p", { class: "res" }, "Result: ", s.result)));
  }
  return parts;
}

/* An output box with its Show the math toggle. */
function tool() {
  const output = h("div", { class: "output", "aria-live": "polite" });
  const math = h("div", { class: "math" });
  let last = null;
  let open = false;
  const toggle = button("Show the math", () => { open = !open; draw(); });
  toggle.disabled = true;
  function draw() {
    const hasMath = last && last.math;
    toggle.disabled = !hasMath;
    toggle.textContent = open && hasMath ? "Hide the math" : "Show the math";
    math.replaceChildren(...(open && hasMath ? mathView(last) : []));
  }
  return {
    output, math, toggle,
    get last() { return last; },
    run(args, render) {
      try {
        last = engine(args);
        output.replaceChildren(...[render(last)].flat(Infinity).filter(Boolean));
        draw();
        return true;
      } catch (error) {
        last = null;
        open = false;
        output.replaceChildren(h("p", { class: "error", role: "alert" }, error.message));
        draw();
        return false;
      }
    },
  };
}

/* ---------- Result views ---------- */
function typeRows(d) {
  return [["Address type", d.address_type.label]];
}

function compareViews(d) {
  const out = [];
  if (d.check) {
    out.push(h("h3", {}, `Compare address: ${d.check.ip}`),
      kv([["Subnet membership", d.check.in_subnet ? "Inside" : "Outside"], ["Position", d.check.role_label], ["Assignment status", "Not determined by this calculator"]]),
      h("p", { class: "note" }, d.check.note));
  }
  if (d.gateway) {
    out.push(h("h3", {}, `Proposed gateway: ${d.gateway.ip}`),
      h("p", { class: d.gateway.plausible ? "good" : "warn" }, d.gateway.label), h("p", { class: "note" }, d.gateway.note));
  }
  return out;
}

function renderIpv4(d) {
  const broadcast = d.semantics === "point_to_point" ? "None (/31 point-to-point, RFC 3021)"
    : d.semantics === "single_address" ? "None (/32 single address)" : d.broadcast;
  const countLabel = d.semantics === "point_to_point" ? "Usable endpoints" : d.semantics === "single_address" ? "Addresses" : "Host candidates";
  return [h("h2", {}, "IPv4 subnet"), kv([
    ["Input", `${d.ip}/${d.prefix}`], ["Network", d.cidr], ["Subnet mask", d.netmask], ["Wildcard mask", d.wildcard], ["Broadcast", broadcast],
    ["Total addresses", commas(d.total)], [countLabel, commas(d.usable)], ["Host range", `${d.first_usable} – ${d.last_usable}`], ...typeRows(d),
  ]), h("p", { class: "note" }, d.address_type.note), compareViews(d)];
}

function renderIpv6(d) {
  return [h("h2", {}, "IPv6 prefix"), kv([
    ["Input", `${d.ip}/${d.prefix}`], ["Canonical prefix", d.cidr], ["Compressed", d.compressed], ["Expanded", d.expanded],
    ["Total addresses in prefix", commas(d.total)], ...typeRows(d),
  ]), h("p", { class: "note" }, "IPv6 has no broadcast address. ", d.address_type.note), compareViews(d)];
}

function renderPartial(d) {
  return [h("h2", {}, "Partial address"), kv([
    ["You entered", `${d.input} with /${d.prefix}`], ["Bits supplied", String(d.known_bits)],
    d.complete ? ["Identified prefix", d.cidr] : ["Prefix bits still needed", String(d.missing_bits)],
    d.complete && ["Zero-filled bits", String(d.zero_filled_bits)],
  ]), h("p", {}, d.message)];
}

function issuesView(d) {
  return d.issues.map((i) => h("p", { class: "warn" }, `${i.severity === "error" ? "Problem" : "Warning"}: ${i.text}`));
}

function renderHosts(d) {
  return [h("h2", {}, "Host sizing"), kv([
    ["Addresses needed", `${commas(d.needed)} (${d.devices} devices + ${d.infrastructure} infrastructure + ${d.growth} growth)`],
    ["Use", `/${d.prefix} (${d.mask})`], ["Host candidates", commas(d.usable)], ["Spare after this plan", commas(d.spare)],
    d.next_smaller && [`Why not /${d.next_smaller.prefix}`, `It holds ${commas(d.next_smaller.usable)}, which is ${commas(d.next_smaller.short_by)} short`],
  ])];
}

function renderVlsm(d) {
  return [h("h2", {}, `VLSM plan for ${d.parent}`),
    h("p", { class: d.fits ? "good" : "warn" }, d.fits ? "Every subnet fits." : "Not everything fits."), issuesView(d),
    h("div", { class: "scroll" }, h("table", {},
      h("thead", {}, h("tr", {}, ["VLAN", "Subnet", "Mask", "Proposed gateway", "Static", "Proposed DHCP pool", "Capacity", "Spare"].map((t) => h("th", {}, t)))),
      h("tbody", {}, d.allocations.map((a) => h("tr", {}, [a.name, a.cidr, a.mask, a.proposed_gateway, a.static_range || "–", `${a.proposed_dhcp_first} – ${a.proposed_dhcp_last}`, a.capacity, a.spare].map((t) => h("td", {}, t))))))),
    h("h3", {}, "Unallocated space"),
    d.unallocated.length ? d.unallocated.map((u) => h("p", { class: "note" }, `${u.first} – ${u.last} (${commas(u.count)} addresses): ${u.cidrs.join(", ")}`)) : h("p", { class: "note" }, "None"),
    h("p", { class: "note" }, d.note)];
}

function renderPlanCheck(d) {
  return [h("h2", {}, `Plan check for ${d.parent}`),
    d.ok ? h("p", { class: "good" }, "No overlaps, invalid ranges or outside allocations found.") : issuesView(d)];
}

function renderAssign(d) {
  return [h("h2", {}, "Check assignment"), kv([
    ["Candidate", `${d.candidate} in ${d.subnet}`], ["Result", d.label],
    d.triggered_by && ["Record that matched", `Line ${d.triggered_by.line}: ${d.triggered_by.text}`], ["Records read", String(d.records_read)],
  ]), d.warnings.map((w) => h("p", { class: "warn" }, `Warning: ${w}`)), h("p", { class: "note" }, d.note)];
}

function renderSummary(d) {
  return [h("h2", {}, "Route summary"), kv([["Inputs", d.inputs], ["Summary", d.summary]]),
    d.exact ? h("p", { class: "good" }, "The summary covers exactly the supplied networks.")
      : [h("p", { class: "warn" }, `The summary also covers ${commas(d.extra_addresses)} addresses outside the supplied networks:`),
        d.extra_ranges.map((r) => h("p", { class: "note" }, `${r.first} – ${r.last}: ${r.cidrs.join(", ")}`))]];
}

/* ---------- Calculate ---------- */
const calc = {};

function calculateView() {
  const address = field("IP address", "", "172.20.0.0, 172.20.0.0/12 or 2001:db8:abcd::/48");
  const prefix = field("Prefix or mask", "", "12 or 255.240.0.0");
  const compare = field("Compare address", "", "Optional: 172.20.10.50");
  const gateway = field("Proposed gateway", "", "Optional: the client's default gateway");
  const partial = h("input", { type: "checkbox", id: "partial" });
  const t = tool();

  function run(kind) {
    const args = [];
    if (partial.checked) args.push("partial");
    args.push(kind, address.input.value);
    if (prefix.input.value.trim()) args.push(prefix.input.value);
    if (!partial.checked && compare.input.value.trim()) args.push("--check", compare.input.value);
    if (!partial.checked && gateway.input.value.trim()) args.push("--gateway", gateway.input.value);
    t.run(args, partial.checked ? renderPartial : kind === "ipv4" ? renderIpv4 : renderIpv6);
  }
  const auto = () => run(address.input.value.includes(":") ? "ipv6" : "ipv4");

  function fill(a, p, c, g, isPartial, kind) {
    address.input.value = a; prefix.input.value = p; compare.input.value = c; gateway.input.value = g; partial.checked = isPartial;
    run(kind);
  }
  calc.fill = fill;

  for (const f of [address, prefix, compare, gateway]) {
    f.input.addEventListener("keydown", (e) => { if (e.key === "Enter") auto(); });
  }

  const chip = (text, ...a) => h("button", { class: "btn chip", type: "button", onclick: () => fill(...a) }, text);

  return h("section", {},
    h("div", { class: "form" }, address.wrap, prefix.wrap, compare.wrap, gateway.wrap),
    h("label", { class: "check", htmlFor: "partial" }, partial, "Partial address mode: type only the leading octets or hextets"),
    h("div", { class: "actions" }, button("Auto-detect", auto, "primary"), button("IPv4", () => run("ipv4")), button("IPv6", () => run("ipv6")), t.toggle),
    h("div", { class: "actions" }, h("span", { class: "label-inline" }, "Examples"),
      chip("192.168.1.70/26", "192.168.1.70", "26", "", "", false, "ipv4"),
      chip("172.20.0.0/12", "172.20.0.0", "12", "172.20.10.50", "", false, "ipv4"),
      chip("2001:db8:abcd::/48", "2001:db8:abcd::", "48", "2001:db8:abcd:25::1", "", false, "ipv6"),
      chip("172.20 /12", "172.20", "12", "", "", true, "ipv4"),
      chip("2001:db8 /48", "2001:db8", "48", "", "", true, "ipv6")),
    t.output, t.math,
    h("details", { class: "intro", style: "margin-top:16px" }, h("summary", {}, "Inside the subnet does not mean free to use"),
      h("p", {}, "Subnet membership is math. Whether an address can be assigned is a records question: confirm the device's VLAN and subnet, then check IPAM or static records and DHCP pools, leases and reservations. A failed ping does not prove an address is free.")));
}

/* ---------- Plan ---------- */
function hostView() {
  const d = field("Devices", "50"), i = field("Infrastructure addresses", "1"), g = field("Growth (count or percent)", "20%");
  const t = tool();
  return h("section", {}, h("p", { class: "intro" }, "Finds the smallest conventional subnet that fits and shows why the next smaller one fails."),
    h("div", { class: "form" }, d.wrap, i.wrap, g.wrap),
    h("div", { class: "actions" }, button("Find prefix", () => t.run(["hosts", d.input.value, i.input.value, g.input.value], renderHosts), "primary"), t.toggle), t.output, t.math);
}

function splitView() {
  const p = field("Parent block", "2001:db8:abcd::/48"), n = field("New prefix", "64");
  const t = tool();
  const list = h("tbody", {});
  let offset = "0";
  const more = button("Next page", () => page(false));
  more.disabled = true;
  function page(reset) {
    if (reset) { offset = "0"; list.replaceChildren(); }
    const ok = t.run(["split", p.input.value, n.input.value, offset, "32"], (d) => {
      for (const b of d.blocks) {
        list.append(h("tr", {}, h("td", {}, b.index), h("td", {}, b.cidr), h("td", {}, b.first_usable ? `${b.first_usable} – ${b.last_usable}` : commas(b.total))));
      }
      offset = d.next_offset;
      more.disabled = !d.has_more;
      return [h("h2", {}, "Equal-size split"), kv([["Parent", d.parent], ["New prefix", `/${d.new_prefix}`], ["Possible blocks", commas(d.count)]]),
        h("div", { class: "scroll" }, h("table", {}, h("thead", {}, h("tr", {}, ["#", "Block", "Hosts or addresses"].map((x) => h("th", {}, x)))), list))];
    });
    if (!ok) more.disabled = true;
  }
  return h("section", {}, h("p", { class: "intro" }, "Splits IPv4 or IPv6 blocks and lists them 32 at a time."),
    h("div", { class: "form" }, p.wrap, n.wrap),
    h("div", { class: "actions" }, button("Display blocks", () => page(true), "primary"), more, t.toggle), t.output, t.math);
}

function vlsmView() {
  const parent = field("Parent block", "10.20.0.0/23", "", { wide: true });
  const entries = field("VLANs: Name=devices:static", "Employee=100:5\nGuest=50\nPrinter=10:10\nManagement=10:5", "", { area: true });
  const manual = field("Manual plan to check: Name=subnet", "Employee=10.20.0.0/25\nGuest=10.20.0.128/26\nPrinter=10.20.0.192/27\nManagement=10.20.0.224/27", "", { area: true });
  const t = tool();
  const csv = button("Export CSV", () => {
    const url = URL.createObjectURL(new Blob([t.last.csv], { type: "text/csv" }));
    h("a", { href: url, download: "vlsm-plan.csv" }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  csv.disabled = true;
  return h("section", {}, h("p", { class: "intro" }, "Sample office shown. One gateway is added to each subnet. Gateway and DHCP values are proposed settings."),
    h("div", { class: "form" }, parent.wrap, entries.wrap, manual.wrap),
    h("div", { class: "actions" },
      button("Build VLSM plan", () => { csv.disabled = !t.run(["vlsm", parent.input.value, ...lines(entries.input)], renderVlsm); }, "primary"),
      button("Check manual plan", () => { t.run(["plancheck", parent.input.value, ...lines(manual.input)], renderPlanCheck); csv.disabled = true; }),
      csv, t.toggle), t.output, t.math);
}

function assignView() {
  const subnet = field("Subnet", "10.20.5.0/24"), candidate = field("Candidate address", "10.20.5.150");
  const records = field("Records: pool,first-last,label or reservation|lease|static,address,label",
    "# type,value,label\npool,10.20.5.100-10.20.5.200,Main DHCP pool\nreservation,10.20.5.150,Front desk printer\nlease,10.20.5.120,Laptop 4471\nstatic,10.20.5.10,Floor switch", "", { area: true, wide: true });
  const t = tool();
  const file = h("input", { type: "file", accept: ".csv,.txt", hidden: true, onchange: async () => {
    if (file.files[0]) records.input.value = await file.files[0].text();
  } });
  return h("section", {}, h("p", { class: "intro" }, "Sample data shown. Results cover only the records supplied here."),
    h("div", { class: "form" }, subnet.wrap, candidate.wrap, records.wrap), file,
    h("div", { class: "actions" }, button("Check assignment", () => t.run(["assign", subnet.input.value, candidate.input.value, records.input.value], renderAssign), "primary"), button("Import records", () => file.click())), t.output);
}

function summaryView() {
  const nets = field("Networks, one per line", "192.168.0.0/24\n192.168.1.0/24\n192.168.3.0/24", "", { area: true, wide: true });
  const t = tool();
  return h("section", {}, h("p", { class: "intro" }, "Finds the shared prefix and flags any space the summary covers beyond your networks."),
    h("div", { class: "form" }, nets.wrap),
    h("div", { class: "actions" }, button("Summarize", () => t.run(["summarize", ...lines(nets.input)], renderSummary), "primary"), t.toggle), t.output, t.math);
}

const planView = () => subnav({ "Host sizing": hostView, "Equal split": splitView, VLSM: vlsmView, "Check assignment": assignView, "Route summary": summaryView });

/* ---------- Learn ---------- */
const COMMAND_KEY = "Angle brackets are values to replace and square brackets are optional. Commands vary by platform and software, so check syntax with ? on the device. These are references, not scripts to paste all at once.";

function referenceView() {
  const search = field("Search topics", "", "DHCP, VLAN or 169.254", { wide: true });
  const list = h("div", { class: "list" });
  const detail = h("div", { "aria-live": "polite" });

  const showTopic = (t, b) => {
    for (const x of list.children) x.setAttribute("aria-current", x === b ? "true" : "false");
    detail.replaceChildren(h("h2", { style: "font-size:1.15rem;margin:0 0 8px" }, t.title),
      h("h3", { style: "font-size:0.95rem;margin:10px 0 2px" }, "What it does"), h("p", { style: "margin:0" }, t.what),
      h("h3", { style: "font-size:0.95rem;margin:10px 0 2px" }, "How a failure looks"), h("p", { style: "margin:0" }, t.failure),
      h("h3", { style: "font-size:0.95rem;margin:10px 0 2px" }, "One way to test it"), h("p", { style: "margin:0" }, t.test));
    if (t.commands) {
      put(detail, h("h3", { style: "font-size:0.95rem;margin:14px 0 2px" }, "Commands"),
        h("p", { class: "note" }, COMMAND_KEY),
        t.commands.map((g) => [g.label ? h("h3", { style: "font-size:0.9rem;margin:10px 0 2px" }, g.label) : null, pre(g.lines.join("\n"))]),
        t.notes ? [h("h3", { style: "font-size:0.95rem;margin:10px 0 2px" }, "Notes"), h("p", { style: "margin:0" }, t.notes)] : null);
    }
  };

  function filter() {
    const q = search.input.value.trim().toLowerCase();
    list.replaceChildren();
    const hits = content("topics.json").filter((t) => JSON.stringify(t).toLowerCase().includes(q));
    for (const t of hits) {
      const b = h("button", { type: "button", onclick: () => showTopic(t, b) }, t.title);
      list.append(b);
    }
    if (hits.length) showTopic(hits[0], list.firstChild);
    else detail.replaceChildren(h("p", { class: "note" }, "No topics match."));
  }
  search.input.addEventListener("input", filter);
  filter();
  return h("section", {}, h("div", { class: "form", style: "margin-bottom:14px" }, search.wrap), h("div", { class: "split" }, list, detail));
}

function practiceView() {
  const kinds = engine(["exercises"]).kinds;
  const id = "kind";
  const select = h("select", { id, onchange: next }, kinds.map((k) => h("option", { value: k.id }, k.title)));
  const question = h("p", { style: "font-weight:600;font-size:1.05rem" });
  const answer = field("Your answer", "", "");
  const result = h("div", { "aria-live": "polite" });
  let current = null;

  function next() {
    current = engine(["exercise", select.value, String(Math.floor(Math.random() * 1000000))]);
    question.textContent = current.question;
    answer.input.value = "";
    result.replaceChildren();
  }
  function check() {
    const given = answer.input.value.replace(/\s/g, "").toLowerCase();
    const right = current.accepted.includes(given);
    result.replaceChildren(h("p", { class: right ? "good" : "warn" }, right ? "Correct." : "Not yet. Try the hint or the worked solution."));
  }
  answer.input.addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });
  next();
  return h("section", {}, h("div", { class: "form" }, h("div", {}, h("label", { htmlFor: id }, "Topic"), select)), question,
    h("div", { class: "form" }, answer.wrap),
    h("div", { class: "actions" }, button("Check answer", check, "primary"), button("Hint", () => result.replaceChildren(h("p", {}, "Hint: ", current.hint))),
      button("Show worked solution", () => result.replaceChildren(h("p", { class: "res" }, h("strong", {}, "Answer: "), current.answer), h("ol", {}, current.solution.map((s) => h("li", {}, s))))),
      button("New problem", next)), result);
}

function chartView() {
  const d = engine(["chart"]);
  const heads = ["/", "Mask", "Wildcard", "Block", "Addresses", "Usable", "Subnets of /8", "Of /16", "Of /24"];
  return h("section", {}, h("div", { class: "scroll" }, h("table", {},
    h("thead", {}, h("tr", {}, heads.map((t) => h("th", {}, t)))),
    h("tbody", {}, d.rows.map((r) => h("tr", {}, [`/${r.prefix}`, r.mask, r.wildcard, r.block, commas(r.total), commas(r.usable), r.subnets_a ? commas(r.subnets_a) : "", r.subnets_b ? commas(r.subnets_b) : "", r.subnets_c ? commas(r.subnets_c) : ""].map((t) => h("td", {}, String(t)))))))),
  h("p", { class: "note" }, d.note), h("h2", { style: "font-size:1.05rem" }, "Decimal to binary"),
  h("div", { class: "binary" }, d.binary.map((b) => h("span", {}, `${String(b.decimal).padStart(3, " ")} ${b.binary}`))));
}

const learnView = () => subnav({ Reference: referenceView, Practice: practiceView, "Subnet charts": chartView });
