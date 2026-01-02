// scripts/top-langs.mjs
// Node 20+
// Usage example:
// node scripts/top-langs.mjs --username TranDangKhoaTechnology --theme tokyonight --hide css --langs_count 8 --max_repos 40 --stacked true --layout compact --show_icons true --out generated/top-langs.dark.svg

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
function listCSV(str) {
  return String(str || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}
function hideList(str) {
  return listCSV(str).map(s => s.toLowerCase());
}
function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
    shadow: "rgba(0,0,0,0.35)",
  },
  "solarized-light": {
    bg: "#fdf6e3",
    title: "#268bd2",
    text: "#586e75",
    border: "rgba(88,110,117,0.25)",
    muted: "rgba(88,110,117,0.75)",
    track: "rgba(0,0,0,0.08)",
    accent: "#b58900",
    shadow: "rgba(0,0,0,0.20)",
  },
  dracula: {
    bg: "#282a36",
    title: "#bd93f9",
    text: "#f8f8f2",
    border: "rgba(189,147,249,0.30)",
    muted: "rgba(248,248,242,0.75)",
    track: "rgba(255,255,255,0.10)",
    accent: "#ffb86c",
    shadow: "rgba(0,0,0,0.35)",
  },
  tokyonight: {
    bg: "#1a1b26",
    title: "#7aa2f7",
    text: "#c0caf5",
    border: "rgba(122,162,247,0.28)",
    muted: "rgba(192,202,245,0.70)",
    track: "rgba(255,255,255,0.10)",
    accent: "#9ece6a",
    shadow: "rgba(0,0,0,0.40)",
  },
  radical: {
    bg: "#141321",
    title: "#fe428e",
    text: "#a9fef7",
    border: "rgba(254,66,142,0.25)",
    muted: "rgba(169,254,247,0.70)",
    track: "rgba(255,255,255,0.10)",
    accent: "#f8d847",
    shadow: "rgba(0,0,0,0.40)",
  },
  gruvbox: {
    bg: "#282828",
    title: "#fabd2f",
    text: "#ebdbb2",
    border: "rgba(250,189,47,0.25)",
    muted: "rgba(235,219,178,0.70)",
    track: "rgba(255,255,255,0.10)",
    accent: "#b8bb26",
    shadow: "rgba(0,0,0,0.40)",
  },
  onedark: {
    bg: "#282c34",
    title: "#61afef",
    text: "#abb2bf",
    border: "rgba(97,175,239,0.25)",
    muted: "rgba(171,178,191,0.70)",
    track: "rgba(255,255,255,0.10)",
    accent: "#98c379",
    shadow: "rgba(0,0,0,0.35)",
  },
  highcontrast: {
    bg: "#000000",
    title: "#ffffff",
    text: "#ffffff",
    border: "rgba(255,255,255,0.35)",
    muted: "rgba(255,255,255,0.75)",
    track: "rgba(255,255,255,0.15)",
    accent: "#ffd700",
    shadow: "rgba(0,0,0,0.55)",
  },
  transparent: {
    bg: "none",
    title: "#2f80ed",
    text: "#434d58",
    border: "rgba(67,77,88,0.25)",
    muted: "rgba(67,77,88,0.70)",
    track: "rgba(0,0,0,0.08)",
    accent: "#f5b700",
    shadow: "rgba(0,0,0,0.20)",
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

function resolveTheme(themeName, overrides) {
  const base = THEMES[themeName] || THEMES["blue-green"];
  return { ...base, ...overrides };
}

function parseOverrides() {
  // Cho phép override nhanh: --bg, --bg2 (gradient), --title, --text, --muted, --border, --track, --accent, --shadow
  const o = {};
  const keys = ["bg", "title", "text", "muted", "border", "track", "accent", "shadow"];
  for (const k of keys) {
    const v = arg(k, null);
    if (v) o[k] = v;
  }
  // bg2 là gradient màu 2 (nếu có)
  const bg2 = arg("bg2", null);
  if (bg2) o.bg2 = bg2;
  return o;
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
    throw new Error(`${res.status} ${res.statusText} ${t.slice(0, 220)}`);
  }
  return res.json();
}

async function fetchRepos(username, maxRepos, includeForks, excludeReposLower) {
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
      if (excludeReposLower.has(String(r.name || "").toLowerCase())) continue;
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

function renderSVG({
  username,
  themeName,
  theme,
  list,
  reposUsed,
  hide,
  langsCount,
  layout,
  stacked,
  showIcons,
  hideTitle,
  hideFooter,
  hideBorder,
  borderRadius,
  titleText,
}) {
  const W = 495;
  const PAD = 16;
  const GAP = 12;
  const headerH = hideTitle ? 16 : 44;

  const cols = layout === "normal" ? 1 : 2;
  const cellW = cols === 1 ? (W - PAD * 2) : Math.floor((W - PAD * 2 - GAP) / 2);
  const rowH = cols === 1 ? 40 : 34;

  const stackH = stacked ? 14 : 0;
  const stackY = headerH + (stacked ? 4 : 0);

  const rows = Math.max(1, Math.ceil((list.length || 0) / cols));
  const footerH = hideFooter ? 8 : 22;
  const H = headerH + (stacked ? (stackH + 10) : 0) + rows * rowH + footerH;

  const title = titleText || "Top Languages";
  const subtitle = `${username} • ${reposUsed} repos`;

  // Background (solid or gradient)
  const hasGradient = theme.bg2 && theme.bg !== "none";
  const bgFill = theme.bg === "none" ? "none" : (hasGradient ? "url(#bgGrad)" : theme.bg);

  // Stacked bar segments
  let stackedBar = "";
  if (stacked && list.length) {
    const barX = PAD;
    const barW = W - PAD * 2;
    const y = stackY;

    // allocate widths with rounding compensation
    const widths = [];
    let used = 0;
    for (let i = 0; i < list.length; i++) {
      const w = Math.floor((list[i].pct / 100) * barW);
      widths.push(w);
      used += w;
    }
    // distribute remainder
    let rem = barW - used;
    let k = 0;
    while (rem > 0 && widths.length) {
      widths[k % widths.length] += 1;
      rem--;
      k++;
    }

    let x = barX;
    let segs = "";
    for (let i = 0; i < list.length; i++) {
      const w = widths[i];
      if (w <= 0) continue;
      segs += `<rect x="${x}" y="${y}" width="${w}" height="${stackH}" fill="${list[i].color}" />`;
      x += w;
    }

    stackedBar = `
      <g>
        <rect x="${barX}" y="${y}" width="${barW}" height="${stackH}" rx="${Math.min(6, Math.floor(stackH/2))}" fill="${theme.track}" />
        <g clip-path="url(#stackClip)">
          ${segs}
        </g>
      </g>
    `;
  }

  // Items list
  let items = "";
  for (let idx = 0; idx < list.length; idx++) {
    const it = list[idx];
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    const x = PAD + c * (cellW + GAP);
    const yBase = headerH + (stacked ? (stackH + 18) : 0) + r * rowH;

    const name = esc(it.lang);
    const pct = `${it.pct.toFixed(1)}%`;

    const barW = cellW - 4;
    const fillW = Math.max(0, Math.min(barW, (it.pct / 100) * barW));
    const dot = showIcons ? `<circle cx="6" cy="10" r="5" fill="${it.color}" />` : "";

    if (layout === "normal") {
      items += `
        <g transform="translate(${x},${yBase})">
          ${dot}
          <text x="${showIcons ? 16 : 0}" y="14" font-size="12" font-weight="700" fill="${theme.text}" font-family="Segoe UI, Ubuntu, Arial">${name}</text>
          <text x="${cellW - 2}" y="14" text-anchor="end" font-size="11" fill="${theme.muted}" font-family="Segoe UI, Ubuntu, Arial">${pct}</text>
          <rect x="0" y="22" width="${barW}" height="8" rx="4" fill="${theme.track}" />
          <rect x="0" y="22" width="${fillW}" height="8" rx="4" fill="${it.color}" />
        </g>
      `;
    } else {
      items += `
        <g transform="translate(${x},${yBase})">
          ${dot}
          <text x="${showIcons ? 16 : 0}" y="13" font-size="12" font-weight="700" fill="${theme.text}" font-family="Segoe UI, Ubuntu, Arial">${name}</text>
          <text x="${cellW - 2}" y="13" text-anchor="end" font-size="11" fill="${theme.muted}" font-family="Segoe UI, Ubuntu, Arial">${pct}</text>
          <rect x="0" y="20" width="${barW}" height="6" rx="3" fill="${theme.track}" />
          <rect x="0" y="20" width="${fillW}" height="6" rx="3" fill="${it.color}" />
        </g>
      `;
    }
  }

  const foot = `theme=${themeName} • hide=${hide.join(",") || "∅"} • langs=${langsCount} • updated=${new Date().toISOString().slice(0, 16)}Z`;
  const stroke = hideBorder ? "none" : theme.border;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(title)}">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="${theme.shadow}"/>
    </filter>

    ${hasGradient ? `
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${theme.bg}" />
      <stop offset="100%" stop-color="${theme.bg2}" />
    </linearGradient>` : ""}

    <clipPath id="stackClip">
      <rect x="${PAD}" y="${stackY}" width="${W - PAD * 2}" height="${stackH}" rx="${Math.min(6, Math.floor(stackH/2))}" />
    </clipPath>
  </defs>

  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${borderRadius}" fill="${bgFill}" stroke="${stroke}" filter="url(#shadow)"/>

  ${hideTitle ? "" : `
  <g transform="translate(${PAD},16)">
    <circle cx="8" cy="8" r="8" fill="rgba(245,183,0,0.18)"/>
    <text x="8" y="11" text-anchor="middle" font-size="10" fill="${theme.accent}" font-family="Segoe UI, Ubuntu, Arial">⌁</text>
    <text x="24" y="12" font-size="16" font-weight="800" fill="${theme.title}" font-family="Segoe UI, Ubuntu, Arial">${esc(title)}</text>
    <text x="${W - PAD * 2}" y="12" text-anchor="end" font-size="11" fill="${theme.muted}" font-family="Segoe UI, Ubuntu, Arial">${esc(subtitle)}</text>
  </g>`}

  ${stackedBar}

  ${items}

  ${hideFooter ? "" : `<text x="${PAD}" y="${H - 10}" font-size="10" fill="${theme.muted}" font-family="Segoe UI, Ubuntu, Arial">${esc(foot)}</text>`}
</svg>`;
}

async function main() {
  const username = arg("username", "TranDangKhoaTechnology");
  const themeName = arg("theme", "blue-green");
  const overrides = parseOverrides();
  const hide = hideList(arg("hide", "css"));
  const langsCount = argInt("langs_count", 8);
  const maxRepos = argInt("max_repos", 40);
  const includeForks = argBool("include_forks", false);
  const excludeRepos = new Set(hideList(arg("exclude_repo", ""))); // repo names
  const outFile = arg("out", "generated/top-langs.svg");

  const layout = arg("layout", "compact"); // compact | normal
  const stacked = argBool("stacked", true);
  const showIcons = argBool("show_icons", true);

  const hideTitle = argBool("hide_title", false);
  const hideFooter = argBool("hide_footer", false);
  const hideBorder = argBool("hide_border", false);
  const borderRadius = argInt("border_radius", 8);
  const titleText = arg("title", null);

  const theme = resolveTheme(themeName, overrides);

  try {
    const repos = await fetchRepos(username, maxRepos, includeForks, excludeRepos);
    const totals = await aggregateLangs(repos);
    const list = topList(totals, hide, langsCount);

    const svg = renderSVG({
      username,
      themeName,
      theme,
      list,
      reposUsed: repos.length,
      hide,
      langsCount,
      layout,
      stacked,
      showIcons,
      hideTitle,
      hideFooter,
      hideBorder,
      borderRadius,
      titleText,
    });

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, svg, "utf8");
    console.log(`Wrote ${outFile}`);
  } catch (e) {
    // fallback vẫn viết file để README không trắng
    const msg = String(e?.message || e);
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="495" height="120" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#111"/>
  <text x="16" y="32" fill="#7aa2f7" font-size="16" font-family="Segoe UI, Ubuntu, Arial" font-weight="800">Top Languages</text>
  <text x="16" y="60" fill="#c0caf5" font-size="12" font-family="Segoe UI, Ubuntu, Arial">Build failed</text>
  <text x="16" y="84" fill="#c0caf5" font-size="10" font-family="Segoe UI, Ubuntu, Arial">${esc(msg).slice(0, 160)}</text>
</svg>`;
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, fallback, "utf8");
    process.exitCode = 0;
  }
}

main();
