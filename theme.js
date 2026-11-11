"use strict";
/* Light, dark or system theme. Runs in <head> so the saved choice applies before the page is drawn. */
(function () {
  const KEY = "workbench.theme";
  const read = () => { try { return localStorage.getItem(KEY) || "system"; } catch { return "system"; } };
  const apply = (choice) => {
    if (choice === "light" || choice === "dark") document.documentElement.setAttribute("data-theme", choice);
    else document.documentElement.removeAttribute("data-theme");
  };
  apply(read());
  window.WorkbenchTheme = {
    current: read,
    set(choice) {
      try { localStorage.setItem(KEY, choice); } catch { /* the choice still applies for this visit */ }
      apply(choice);
    },
  };
  document.addEventListener("DOMContentLoaded", () => {
    const host = document.getElementById("theme-picker");
    if (!host) return;
    const select = document.createElement("select");
    select.id = "theme-select";
    select.setAttribute("aria-label", "Color theme");
    for (const [value, label] of [["system", "System"], ["light", "Light"], ["dark", "Dark"]]) {
      const o = document.createElement("option");
      o.value = value;
      o.textContent = label;
      select.append(o);
    }
    select.value = read();
    select.addEventListener("change", () => window.WorkbenchTheme.set(select.value));
    const label = document.createElement("label");
    label.htmlFor = "theme-select";
    label.textContent = "Theme ";
    host.append(label, select);
  });
})();
