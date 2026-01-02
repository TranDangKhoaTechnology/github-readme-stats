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
    track: "rgba(255,255,255,0.09)",
    accent: "#f5b700",
    shadow: "rgba(0,0,0,0.30)",
  },
  "solarized-light": {
    bg: "#fdf6e3",
    title: "#268bd2",
    text: "#586e75",
    muted: "rgba(88,110,117,0.75)",
    border: "rgba(88,110,117,0.25)",
    track: "rgba(0,0,0,0.08)",
    accent: "#b58900",
    shadow: "rgba(0,0,0,0.18)",
  },
  dracula: {
    bg: "#282a36",
    title: "#bd93f9",
    text: "#f8f8f2",
    muted: "rgba(248,248,242,0.75)",
    border: "rgba(189,147,249,0.28)",
    track: "rgba(255,255,255,0.10)",
    accent: "#ffb86c",
    shadow: "rgba(0,0,0,0.35)",
  },
};

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// wrap text into 2 lines safely (no foreignObject)
function wrap2(text, maxLen = 48) {
  const s = String(text || "").trim();
  if (!s) return ["No description", ""];
  if (s.length <= maxLen) return [s, ""];
  const cut = s.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  const a = (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trim();
  const bRaw = s.slice(a.length).trim();
  const b = bRaw.length > maxLen ? (bRaw.slice(0, maxLen - 1).trimEnd() + "…") : bRaw;
  return [a, b];
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

function renderPin({ owner, repo, theme, info }) {
  const t = THEMES[theme] || THEMES["blue-green"];
  const W = 495;
  const H = 120;
  const PAD = 16;

  const full = `${owner}/${repo}`;
  const desc = wrap2(info.description || "");
  const lang = info.language || "N/A";

  const stars = info.stargazers_count ?? 0;
  const forks = info.forks_count ?? 0;
  const issues = info.open_issues_count ?? 0;
  const pushed = (info.pushed_at || "").slice(0, 10);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(full)}">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="${t.shadow}"/>
    </filter>
  </defs>

  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14"
        fill="${t.bg}" stroke="${t.border}" stroke-width="1.2" filter="url(#shadow)"/>

  <g transform="translate(${PAD},14)">
    <text x="0" y="16" font-size="16" font-weight="900" fill="${t.title}" font-family="Segoe UI, Ubuntu, Arial">${esc(repo)}</text>
    <text x="0" y="32" font-size="11" fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">${esc(owner)}</text>

    <text x="0" y="50" font-size="12" fill="${t.text}" font-family="Segoe UI, Ubuntu, Arial">${esc(desc[0])}</text>
    ${desc[1] ? `<text x="0" y="66" font-size="12" fill="${t.text}" font-family="Segoe UI, Ubuntu, Arial">${esc(desc[1])}</text>` : ""}

    <rect x="0" y="72" width="${W - PAD * 2}" height="26" rx="10" fill="${t.track}" opacity="0.8"/>
    <text x="12" y="90" font-size="11" fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">${esc(lang)}</text>

    <text x="170" y="90" font-size="11" fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">★ ${stars}</text>
    <text x="240" y="90" font-size="11" fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">⑂ ${forks}</text>
    <text x="310" y="90" font-size="11" fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">! ${issues}</text>

    <text x="${W - PAD * 2 - 10}" y="90" text-anchor="end" font-size="11" fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">updated ${esc(pushed)}</text>
  </g>
</svg>`;
}

async function main() {
  const owner = arg("username", "TranDangKhoaTechnology");
  const repo = arg("repo", "");
  const theme = arg("theme", "blue-green");
  const outFile = arg("out", `generated/pins/${repo}.svg`);

  if (!repo) throw new Error("Missing --repo");

  try {
    const info = await ghRest(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
    const svg = renderPin({ owner, repo, theme, info });

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, svg, "utf8");
    console.log(`Wrote ${outFile}`);
  } catch (e) {
    const msg = String(e?.message || e);
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="495" height="120" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#111"/>
  <text x="16" y="32" fill="#7aa2f7" font-size="16" font-family="Segoe UI, Ubuntu, Arial" font-weight="800">Repo Pin</text>
  <text x="16" y="60" fill="#c0caf5" font-size="12" font-family="Segoe UI, Ubuntu, Arial">Build failed</text>
  <text x="16" y="84" fill="#c0caf5" font-size="10" font-family="Segoe UI, Ubuntu, Arial">${esc(msg).slice(0, 160)}</text>
</svg>`;
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, fallback, "utf8");
    process.exitCode = 1;
  }
}

main();
