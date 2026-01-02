// scripts/top-langs.mjs
// Node 20+ (fetch built-in)
// Usage:
// node scripts/top-langs.mjs --username TranDangKhoaTechnology --theme blue-green --hide css --langs_count 8 --max_repos 40 --out generated/top-langs.svg

import fs from "node:fs";
import path from "node:path";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v ?? fallback;
}

function argInt(name, fallback) {
  const v = arg(name, null);
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

function argBool(name, fallback = false) {
  const v = arg(name, null);
  if (v == null) return fallback;
  return ["1", "true", "yes", "on"].includes(String(v).toLowerCase());
}

function hideList(str) {
  return String(str || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
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
  "default": {
    bg: "#ffffff",
    title: "#2f80ed",
    text: "#434d58",
    border: "rgba(67,77,88,0.25)",
    muted: "rgba(67,77,88,0.7)",
    track: "rgba(0,0,0,0.08)",
    accent: "#f5b700",
  },
};

const KNOWN_LANG_COLORS = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Python: "#3572A5",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  PHP: "#4F5D95",
  Go: "#00ADD8",
  Rust: "#dea584",
  Kotlin: "#A97BFF",
  Swift: "#F05138",
  Shell: "#89e051",
  Vue: "#41b883",
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

async function fetchRepos(username, maxRepos, includeForks) {
  const perPage = 100;
  let page = 1;
  const out = [];

  while (out.length < maxRepos) {
    const url = `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=${perPage}&page=${page}&sort=pushed`;
    const batch = await gh(url);
    if (!Array.isArray(batch) || batch.length === 0) break;

    for (const r of batch) {
      if (!includeForks && r.fork) continue;
      if (r.archived) continue;
      out.push(r);
      if (out.length >= maxRepos) break;
    }
    page++;
  }
  return out;
}

async function aggregateLangs(repos) {
  const limit = 6;
  let i = 0;
  const totals = new Map();

  async function worker() {
    while (i < repos.length) {
      const idx = i++;
      const repo = repos[idx];
      const data = await gh(repo.languages_url);
      for (const [lang, bytes] of Object.entries(data || {})) {
        totals.set(lang, (totals.get(lang) || 0) + (bytes || 0));
      }
    }
  }

  await Promise.all(Array.from({ length: limit }, worker));
  return totals;
}

function topList(totals, hide, count) {
  const items = [...totals.entries()]
    .filter(([k]) => !hide.includes(k.toLowerCase()))
    .sort((a, b) => b[1] - a[1]);

  const sum = items.reduce((acc, [, v]) => acc + v, 0) || 1;
  return items.slice(0, count).map(([lang, bytes]) => ({
    lang,
    bytes,
    pct: (bytes / sum) * 100,
    color: langColor(lang),
  }));
}

function renderSVG({ username, theme, list, reposUsed, hide, langsCount }) {
  const t = THEMES[theme] || THEMES["blue-green"];

  const W = 495;
  const PAD = 16;
  const GAP = 12;
  const COLS = 2;
  const cellW = Math.floor((W - PAD * 2 - GAP) / 2);
  const headerH = 44;
  const rowH = 34;
  const rows = Math.ceil(list.length / COLS);
  const H = headerH + rows * rowH + 18;

  const title = "Top Languages";
  const subtitle = `${username} • ${reposUsed} repos`;

  let items = "";
  for (let idx = 0; idx < list.length; idx++) {
    const it = list[idx];
    const r = Math.floor(idx / COLS);
    const c = idx % COLS;
    const x = PAD + c * (cellW + GAP);
    const y = headerH + r * rowH;

    const name = esc(it.lang);
    const pct = `${it.pct.toFixed(1)}%`;
    const barW = cellW - 4;
    const fillW = Math.max(0, Math.min(barW, (it.pct / 100) * barW));

    items += `
      <g transform="translate(${x},${y})">
        <circle cx="6" cy="9" r="5" fill="${it.color}" />
        <text x="16" y="13" font-size="12" font-weight="700" fill="${t.text}" font-family="Segoe UI, Ubuntu, Arial">${name}</text>
        <text x="${cellW - 2}" y="13" text-anchor="end" font-size="11" fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">${pct}</text>

        <rect x="0" y="20" width="${barW}" height="6" rx="3" fill="${t.track}" />
        <rect x="0" y="20" width="${fillW}" height="6" rx="3" fill="${it.color}" />
      </g>
    `;
  }

  const foot = `hide=${hide.join(",") || "∅"} • langs_count=${langsCount}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(title)}">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="rgba(0,0,0,0.35)"/>
    </filter>
  </defs>

  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="6" fill="${t.bg}" stroke="${t.border}" filter="url(#shadow)"/>

  <g transform="translate(${PAD},16)">
    <circle cx="8" cy="8" r="8" fill="rgba(245,183,0,0.18)"/>
    <text x="8" y="11" text-anchor="middle" font-size="10" fill="${t.accent}" font-family="Segoe UI, Ubuntu, Arial">⌁</text>
    <text x="24" y="12" font-size="16" font-weight="800" fill="${t.title}" font-family="Segoe UI, Ubuntu, Arial">${esc(title)}</text>
    <text x="${W - PAD * 2}" y="12" text-anchor="end" font-size="11" fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">${esc(subtitle)}</text>
  </g>

  ${items}

  <text x="${PAD}" y="${H - 10}" font-size="10" fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">${esc(foot)}</text>
</svg>`;
}

async function main() {
  const username = arg("username", "TranDangKhoaTechnology");
  const theme = arg("theme", "blue-green");
  const hide = hideList(arg("hide", "css"));
  const langsCount = argInt("langs_count", 8);
  const maxRepos = argInt("max_repos", 40);
  const includeForks = argBool("include_forks", false);
  const outFile = arg("out", "generated/top-langs.svg");

  try {
    const repos = await fetchRepos(username, maxRepos, includeForks);
    const totals = await aggregateLangs(repos);
    const list = topList(totals, hide, langsCount);

    const svg = renderSVG({
      username,
      theme,
      list,
      reposUsed: repos.length,
      hide,
      langsCount,
    });

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, svg, "utf8");
    console.log(`Wrote ${outFile}`);
  } catch (e) {
    const msg = String(e?.message || e);
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="495" height="120" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#040f0f"/>
  <text x="16" y="32" fill="#2f97c1" font-size="16" font-family="Segoe UI, Ubuntu, Arial" font-weight="800">Top Languages</text>
  <text x="16" y="60" fill="#0cf574" font-size="12" font-family="Segoe UI, Ubuntu, Arial">Build failed</text>
  <text x="16" y="82" fill="#0cf574" font-size="10" font-family="Segoe UI, Ubuntu, Arial">${esc(msg).slice(0, 120)}</text>
</svg>`;
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, fallback, "utf8");
    process.exitCode = 0;
  }
}

main();
