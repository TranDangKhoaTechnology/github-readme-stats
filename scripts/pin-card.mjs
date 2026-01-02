// scripts/pin-card.mjs
// Node 20+
// Usage:
// node scripts/pin-card.mjs --owner TranDangKhoaTechnology --repo trandangkhoatechnology --theme blue-green --out generated/pins/trandangkhoatechnology.dark.svg
// Options:
// --owner (default: TranDangKhoaTechnology)
// --repo  (required)
// --theme (default: blue-green | solarized-light)
// --out   (required)
// --show  (default: "stars,forks,language,updated") e.g. "stars,forks,issues,language,updated"

import fs from "node:fs";
import path from "node:path";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v ?? fallback;
}

function listArg(name, fallbackCSV) {
  const v = arg(name, fallbackCSV);
  return String(v || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function clampText(s, max) {
  const t = String(s ?? "");
  if (t.length <= max) return t;
  return t.slice(0, Math.max(0, max - 1)) + "…";
}

const THEMES = {
  "blue-green": {
    bg: "#040f0f",
    title: "#2f97c1",
    text: "#0cf574",
    border: "rgba(12,245,116,0.22)",
    muted: "rgba(12,245,116,0.75)",
    track: "rgba(255,255,255,0.08)",
    accent: "#f5b700",
  },
  "solarized-light": {
    bg: "#fdf6e3",
    title: "#268bd2",
    text: "#586e75",
    border: "rgba(88,110,117,0.25)",
    muted: "rgba(88,110,117,0.75)",
    track: "rgba(0,0,0,0.08)",
    accent: "#b58900",
  },
};

async function gh(url) {
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
    throw new Error(`${res.status} ${res.statusText} ${t.slice(0, 180)}`);
  }
  return res.json();
}

function fmtCompact(n) {
  const x = Number(n || 0);
  if (x < 1000) return String(x);
  if (x < 1_000_000) return `${(x / 1000).toFixed(x >= 10_000 ? 0 : 1)}k`;
  return `${(x / 1_000_000).toFixed(x >= 10_000_000 ? 0 : 1)}m`;
}

function toDateShort(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function renderPinSVG({ theme, owner, repo, data, show }) {
  const t = THEMES[theme] || THEMES["blue-green"];

  const W = 495;
  const PAD = 16;
  const H = 145;

  const full = `${owner}/${repo}`;
  const desc = clampText(data.description || "No description.", 92);
  const lang = data.language || "—";

  const stats = [];
  if (show.includes("stars")) stats.push(`★ ${fmtCompact(data.stargazers_count)}`);
  if (show.includes("forks")) stats.push(`⑂ ${fmtCompact(data.forks_count)}`);
  if (show.includes("issues")) stats.push(`! ${fmtCompact(data.open_issues_count)}`);
  if (show.includes("language")) stats.push(`◼ ${lang}`);
  if (show.includes("updated")) stats.push(`↻ ${toDateShort(data.pushed_at || data.updated_at)}`);

  const statsLine = esc(stats.join("   "));

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(full)}">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="rgba(0,0,0,0.35)"/>
    </filter>
  </defs>

  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="8" fill="${t.bg}" stroke="${t.border}" filter="url(#shadow)"/>

  <g transform="translate(${PAD},20)">
    <circle cx="8" cy="8" r="8" fill="rgba(245,183,0,0.18)"/>
    <text x="8" y="11" text-anchor="middle" font-size="10" fill="${t.accent}" font-family="Segoe UI, Ubuntu, Arial">⌁</text>

    <text x="24" y="12" font-size="16" font-weight="800" fill="${t.title}" font-family="Segoe UI, Ubuntu, Arial">${esc(full)}</text>

    <text x="0" y="44" font-size="12" fill="${t.text}" font-family="Segoe UI, Ubuntu, Arial">
      ${esc(desc)}
    </text>

    <rect x="0" y="62" width="${W - PAD * 2}" height="1" fill="${t.track}" />

    <text x="0" y="92" font-size="11" fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">${statsLine}</text>

    <text x="0" y="120" font-size="10" fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">self-built • github actions</text>
  </g>
</svg>`;
}

async function main() {
  const owner = arg("owner", "TranDangKhoaTechnology");
  const repo = arg("repo", null);
  const theme = arg("theme", "blue-green");
  const outFile = arg("out", null);
  const show = listArg("show", "stars,forks,language,updated");

  if (!repo) throw new Error("Missing --repo");
  if (!outFile) throw new Error("Missing --out");

  try {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const data = await gh(url);
    const svg = renderPinSVG({ theme, owner, repo, data, show });

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, svg, "utf8");
    console.log(`Wrote ${outFile}`);
  } catch (e) {
    const msg = String(e?.message || e);
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="495" height="120" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#040f0f"/>
  <text x="16" y="32" fill="#2f97c1" font-size="16" font-family="Segoe UI, Ubuntu, Arial" font-weight="800">Pin Card</text>
  <text x="16" y="60" fill="#0cf574" font-size="12" font-family="Segoe UI, Ubuntu, Arial">Build failed</text>
  <text x="16" y="82" fill="#0cf574" font-size="10" font-family="Segoe UI, Ubuntu, Arial">${esc(msg).slice(0, 120)}</text>
</svg>`;
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, fallback, "utf8");
    process.exitCode = 0;
  }
}

main();
