// scripts/pin.mjs
// Node 20+
// Usage:
// node scripts/pin.mjs --username TranDangKhoaTechnology --repo FaceAutoVN --theme blue-green --out generated/pins/FaceAutoVN.dark.svg

import fs from "node:fs";
import path from "node:path";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v ?? fallback;
}

const THEMES = {
  "blue-green": {
    bg: "#040f0f",
    title: "#2f97c1",
    text: "#0cf574",
    muted: "rgba(12,245,116,0.78)",
    border: "rgba(12,245,116,0.22)",
    grad1: "#2f97c1",
    grad2: "#0cf574",
    chipBg: "rgba(255,255,255,0.06)",
  },
  "solarized-light": {
    bg: "#fdf6e3",
    title: "#268bd2",
    text: "#586e75",
    muted: "rgba(88,110,117,0.75)",
    border: "rgba(88,110,117,0.25)",
    grad1: "#268bd2",
    grad2: "#b58900",
    chipBg: "rgba(0,0,0,0.05)",
  },
  "dracula": {
    bg: "#282a36",
    title: "#bd93f9",
    text: "#f8f8f2",
    muted: "rgba(248,248,242,0.75)",
    border: "rgba(189,147,249,0.28)",
    grad1: "#bd93f9",
    grad2: "#ff79c6",
    chipBg: "rgba(255,255,255,0.07)",
  },
};

const KNOWN_LANG_COLORS = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Python: "#3572A5",
  PHP: "#4F5D95",
  Go: "#00ADD8",
  Rust: "#dea584",
  "C++": "#f34b7d",
  C: "#555555",
  Pascal: "#E3F171",
};

function hashColor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 72% 52%)`;
}
function langColor(name) {
  return KNOWN_LANG_COLORS[name] || hashColor(name);
}
function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function clampText(s, max = 90) {
  const x = String(s || "").trim();
  if (x.length <= max) return x;
  return x.slice(0, max - 1).trimEnd() + "…";
}

async function ghRest(url) {
  const token = process.env.GITHUB_TOKEN || "";
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "readme-cards",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} ${t.slice(0, 220)}`);
  }
  return res.json();
}

function renderPin({ themeKey, owner, repo, info }) {
  const t = THEMES[themeKey] || THEMES["blue-green"];
  const W = 495;
  const H = 120;
  const PAD = 16;

  const name = `${owner}/${repo}`;
  const desc = clampText(info.description || "No description");
  const lang = info.language || "N/A";
  const langDot = langColor(lang);

  const stars = info.stargazers_count ?? 0;
  const forks = info.forks_count ?? 0;
  const issues = info.open_issues_count ?? 0;
  const pushed = (info.pushed_at || "").slice(0, 10);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(name)}">
  <defs>
    <linearGradient id="borderGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${t.grad1}"/>
      <stop offset="100%" stop-color="${t.grad2}"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="rgba(0,0,0,0.28)"/>
    </filter>
  </defs>

  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14"
        fill="${t.bg}" stroke="url(#borderGrad)" stroke-width="1.2" filter="url(#shadow)"/>

  <g transform="translate(${PAD},18)">
    <text x="0" y="14" font-size="16" font-weight="900" fill="${t.title}" font-family="Segoe UI, Ubuntu, Arial">${esc(repo)}</text>
    <text x="0" y="32" font-size="11" fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">${esc(owner)}</text>

    <foreignObject x="0" y="42" width="${W - PAD * 2}" height="34">
      <div xmlns="http://www.w3.org/1999/xhtml"
           style="font-family: Segoe UI, Ubuntu, Arial; font-size: 12px; color: ${t.text}; opacity: 0.95; line-height: 1.25;">
        ${esc(desc)}
      </div>
    </foreignObject>

    <g transform="translate(0,88)">
      <rect x="0" y="-14" width="${W - PAD * 2}" height="28" rx="10" fill="${t.chipBg}" />
      <circle cx="14" cy="0" r="5" fill="${langDot}" />
      <text x="24" y="4" font-size="11" fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">${esc(lang)}</text>

      <text x="170" y="4" font-size="11" fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">★ ${stars}</text>
      <text x="240" y="4" font-size="11" fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">⑂ ${forks}</text>
      <text x="310" y="4" font-size="11" fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">! ${issues}</text>

      <text x="${W - PAD * 2 - 10}" y="4" text-anchor="end" font-size="11" fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">updated ${esc(pushed)}</text>
    </g>
  </g>
</svg>`;
}

async function main() {
  const owner = arg("username", "TranDangKhoaTechnology");
  const repo = arg("repo", "");
  const themeKey = arg("theme", "blue-green");
  const outFile = arg("out", `generated/pins/${repo}.svg`);

  if (!repo) throw new Error("Missing --repo");

  try {
    const info = await ghRest(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
    const svg = renderPin({ themeKey, owner, repo, info });

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, svg, "utf8");
    console.log(`Wrote ${outFile}`);
  } catch (e) {
    const msg = String(e?.message || e);
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="495" height="120" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#040f0f"/>
  <text x="16" y="32" fill="#2f97c1" font-size="16" font-family="Segoe UI, Ubuntu, Arial" font-weight="800">Repo Pin</text>
  <text x="16" y="60" fill="#0cf574" font-size="12" font-family="Segoe UI, Ubuntu, Arial">Build failed</text>
  <text x="16" y="82" fill="#0cf574" font-size="10" font-family="Segoe UI, Ubuntu, Arial">${esc(msg).slice(0, 140)}</text>
</svg>`;
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, fallback, "utf8");
    process.exitCode = 1;
  }
}

main();
