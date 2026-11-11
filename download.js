"use strict";
/* Download page: the license, an "I agree" checkbox and links to the GitHub Release. No sign-up, no tokens, nothing recorded. */

const RELEASE = {
  version: "4.0.8",
  page: "https://github.com/Drakesbanereal1/networking-lab-workbench/releases/tag/v4.0.8",
  base: "https://github.com/Drakesbanereal1/networking-lab-workbench/releases/download/v4.0.8/",
  files: [
    { name: "Enterprise-Networking-Lab-Workbench-4.0.8-windows-setup.exe", label: "Windows 10 or 11 (64-bit) setup", bytes: 62232064, sha256: "3adaf11a4d741a88e45208d725f1fa009e6bcf8e7571684407d45a2a443737e2" },
    { name: "enterprise-networking-lab-workbench-4.0.8-linux-x86_64.tar.gz", label: "Linux, 64-bit Intel or AMD (terminal version)", bytes: 1089793, sha256: "5a076670884f90fa89f5ba7ad54d390f0e8c3bda506d047f4db8bac04a0c4a62" },
    { name: "enterprise-networking-lab-workbench-4.0.8-linux-arm64.tar.gz", label: "Linux, 64-bit ARM (terminal version)", bytes: 1030832, sha256: "6ae1358856066e4b5d2e8f5c350c61cc89169aaf1b634022b2f4cab0c40db4db" },
  ],
};

function downloadView() {
  const licenseBox = h("pre", { class: "license", tabindex: "0", "aria-label": "License text" }, "Loading the license…");
  fetch(`LICENSE.txt?v=${WEB_BUILD}`).then((r) => (r.ok ? r.text() : Promise.reject(new Error(r.status))))
    .then((t) => { licenseBox.textContent = t; })
    .catch(() => { licenseBox.textContent = "The license could not be loaded. Open LICENSE.txt on the release page before downloading."; });

  const agree = h("input", { type: "checkbox", id: "agree" });
  const links = RELEASE.files.map((f) => h("a", { class: "btn download", href: RELEASE.base + f.name, "aria-disabled": "true", tabindex: "-1", rel: "noopener" }, `Download for ${f.label}`));
  const sync = () => {
    for (const a of links) {
      a.setAttribute("aria-disabled", agree.checked ? "false" : "true");
      a.tabIndex = agree.checked ? 0 : -1;
    }
  };
  agree.addEventListener("change", sync);
  for (const a of links) a.addEventListener("click", (e) => { if (!agree.checked) e.preventDefault(); });
  sync();

  const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;
  return h("section", {}, heading(`Download the desktop app (version ${RELEASE.version})`),
    h("p", { class: "intro" }, "The download adds what a browser cannot do: live troubleshooting commands on your own computer, the terminal versions for CMD, PowerShell and Linux, and a practice record kept on your computer. It is free for personal learning under the license below."),
    h("h3", {}, "License"),
    licenseBox,
    h("p", { class: "agree" }, agree, h("label", { htmlFor: "agree" }, " I have read the license above and agree to its terms.")),
    h("p", { class: "note" }, "No sign-up, no email and no account. This checkbox is not recorded or sent anywhere."),
    h("div", { class: "links downloads" }, links),
    h("h3", {}, "Files and checksums"),
    h("table", { class: "files" },
      h("thead", {}, h("tr", {}, h("th", {}, "File"), h("th", {}, "Size"), h("th", {}, "SHA-256"))),
      h("tbody", {}, RELEASE.files.map((f) => h("tr", {}, h("td", {}, f.name), h("td", {}, f.bytes ? mb(f.bytes) : ""), h("td", { class: "hash" }, f.sha256))))),
    h("p", { class: "note" }, "To check a download on Windows, run Get-FileHash FILE in PowerShell. On Linux, run sha256sum FILE. The result should match the SHA-256 above."),
    h("h3", {}, "Before you install"),
    h("ul", {},
      h("li", {}, "The Windows setup is not code-signed, so Windows may show \"Windows protected your PC\". Choose More info, then Run anyway. Setup shows the license again and installs for your Windows account only, without administrator rights."),
      h("li", {}, "On Linux, extract the file and run ./subnet_calculator. QUICKSTART.txt inside each download has the details."),
      h("li", {}, "Run live troubleshooting only on computers and networks you own or have permission to test.")),
    h("p", {}, h("a", { href: RELEASE.page, rel: "noopener" }, "Release page on GitHub")));
}
