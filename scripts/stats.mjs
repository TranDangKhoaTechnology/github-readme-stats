// scripts/stats.mjs
// Node 20+
// Usage:
// node scripts/stats.mjs --username TranDangKhoaTechnology --theme dracula --days 365 --show_icons true --out generated/stats.dark.svg
// Options:
// --days 365 (range contributions), hoặc dùng --from YYYY-MM-DD --to YYYY-MM-DD
// --hide stars,forks,commits,prs,issues,reviews,contrib
// --bg / --bg2 gradient override giống top-langs

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

function parseOverrides() {
  const o = {};
  const keys = ["bg", "title", "text", "muted", "border", "track", "accent", "shadow"];
  for (const k of keys) {
    const v = arg(k, null);
    if (v) o[k] = v;
  }
  const bg2 = arg("bg2", null);
  if (bg2) o.bg2 = bg2;
  return o;
}
function resolveTheme(name, overrides) {
  const base = THEMES[name] || THEMES["blue-green"];
  return { ...base, ...overrides };
}

function fmtCompact(n) {
  const x = Number(n || 0);
  if (x < 1000) return String(x);
  if (x < 1_000_000) return `${(x / 1000).toFixed(x >= 10_000 ? 0 : 1)}k`;
  return `${(x / 1_000_000).toFixed(x >= 10_000_000 ? 0 : 1)}m`;
}

async function gql(query, variables) {
  const token = process.env.GITHUB_TOKEN || "";
  if (!token) throw new Error("Missing GITHUB_TOKEN (needed for GraphQL stats)");

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "readme-cards",
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.errors) {
    const msg = json?.errors?.[0]?.message || `${res.status} ${res.statusText}`;
    throw new Error(`GraphQL error: ${msg}`);
  }
  return json.data;
}

function isoDay(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function fetchAllRepoStats(username) {
  const Q = `
    query($login:String!, $after:String) {
      user(login:$login) {
        repositories(first:100, after:$after, ownerAffiliations:[OWNER], isFork:false) {
          nodes { stargazerCount forkCount }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  `;

  let after = null;
  let stars = 0;
  let forks = 0;

  while (true) {
    const data = await gql(Q, { login: username, after });
    const conn = data.user.repositories;
    for (const r of conn.nodes || []) {
      stars += r.stargazerCount || 0;
      forks += r.forkCount || 0;
    }
    if (!conn.pageInfo?.hasNextPage) break;
    after = conn.pageInfo.endCursor;
  }

  return { stars, forks };
}

async function fetchContrib(username, fromISO, toISO) {
  const Q = `
    query($login:String!, $from:DateTime!, $to:DateTime!) {
      user(login:$login) {
        contributionsCollection(from:$from, to:$to) {
          totalCommitContributions
          totalPullRequestContributions
          totalIssueContributions
          totalPullRequestReviewContributions
          totalRepositoriesWithContributedTo
        }
      }
    }
  `;
  const data = await gql(Q, { login: username, from: fromISO, to: toISO });
  return data.user.contributionsCollection;
}

function renderStatsSVG({
  username,
  themeName,
  theme,
  hide,
  showIcons,
  hideTitle,
  hideFooter,
  hideBorder,
  borderRadius,
  daysLabel,
  stats,
}) {
  const W = 495;
  const PAD = 16;
  const headerH = hideTitle ? 16 : 44;
  const footerH = hideFooter ? 8 : 22;

  const hasGradient = theme.bg2 && theme.bg !== "none";
  const bgFill = theme.bg === "none" ? "none" : (hasGradient ? "url(#bgGrad)" : theme.bg);

  const stroke = hideBorder ? "none" : theme.border;

  const title = "GitHub Stats";
  const subtitle = `${username} • ${daysLabel}`;

  const metrics = [
    { key: "stars", label: "Stars", value: fmtCompact(stats.stars), icon: "★" },
    { key: "forks", label: "Forks", value: fmtCompact(stats.forks), icon: "⑂" },
    { key: "commits", label: "Commits", value: fmtCompact(stats.commits), icon: "⎇" },
    { key: "prs", label: "PRs", value: fmtCompact(stats.prs), icon: "⇄" },
    { key: "issues", label: "Issues", value: fmtCompact(stats.issues), icon: "!" },
    { key: "reviews", label: "Reviews", value: fmtCompact(stats.reviews), icon: "✓" },
    { key: "contrib", label: "Contributed to", value: fmtCompact(stats.contrib), icon: "⌁" },
  ].filter(m => !hide.includes(m.key));

  const cols = 2;
  const cellW = Math.floor((W - PAD * 2 - 12) / 2);
  const rowH = 28;
  const rows = Math.max(1, Math.ceil(metrics.length / cols));
  const H = headerH + rows * rowH + 18 + footerH;

  let items = "";
  for (let i = 0; i < metrics.length; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = PAD + c * (cellW + 12);
    const y = headerH + r * rowH + 10;

    const icon = showIcons ? `<text x="0" y="0" font-size="12" fill="${theme.accent}" font-family="Segoe UI, Ubuntu, Arial">${esc(metrics[i].icon)}</text>` : "";
    const labelX = showIcons ? 18 : 0;

    items += `
      <g transform="translate(${x},${y})">
        ${icon}
        <text x="${labelX}" y="0" font-size="11" fill="${theme.muted}" font-family="Segoe UI, Ubuntu, Arial">${esc(metrics[i].label)}</text>
        <text x="${cellW}" y="0" text-anchor="end" font-size="12" font-weight="800" fill="${theme.text}" font-family="Segoe UI, Ubuntu, Arial">${esc(metrics[i].value)}</text>
      </g>
    `;
  }

  const foot = `theme=${themeName} • updated=${new Date().toISOString().slice(0, 16)}Z`;

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
  </defs>

  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${borderRadius}" fill="${bgFill}" stroke="${stroke}" filter="url(#shadow)"/>

  ${hideTitle ? "" : `
  <g transform="translate(${PAD},16)">
    <circle cx="8" cy="8" r="8" fill="rgba(245,183,0,0.18)"/>
    <text x="8" y="11" text-anchor="middle" font-size="10" fill="${theme.accent}" font-family="Segoe UI, Ubuntu, Arial">⌁</text>
    <text x="24" y="12" font-size="16" font-weight="800" fill="${theme.title}" font-family="Segoe UI, Ubuntu, Arial">${esc(title)}</text>
    <text x="${W - PAD * 2}" y="12" text-anchor="end" font-size="11" fill="${theme.muted}" font-family="Segoe UI, Ubuntu, Arial">${esc(subtitle)}</text>
  </g>`}

  <rect x="${PAD}" y="${headerH}" width="${W - PAD * 2}" height="1" fill="${theme.track}" />

  ${items}

  ${hideFooter ? "" : `<text x="${PAD}" y="${H - 10}" font-size="10" fill="${theme.muted}" font-family="Segoe UI, Ubuntu, Arial">${esc(foot)}</text>`}
</svg>`;
}

async function main() {
  const username = arg("username", "TranDangKhoaTechnology");
  const themeName = arg("theme", "blue-green");
  const overrides = parseOverrides();
  const theme = resolveTheme(themeName, overrides);

  const outFile = arg("out", "generated/stats.svg");
  const showIcons = argBool("show_icons", true);

  const hide = listCSV(arg("hide", "")); // keys: stars,forks,commits,prs,issues,reviews,contrib

  const hideTitle = argBool("hide_title", false);
  const hideFooter = argBool("hide_footer", false);
  const hideBorder = argBool("hide_border", false);
  const borderRadius = argInt("border_radius", 8);

  // Range
  const days = argInt("days", 365);
  const fromArg = arg("from", null);
  const toArg = arg("to", null);

  const now = new Date();
  const toISO = (toArg ? new Date(`${toArg}T00:00:00Z`) : now).toISOString();
  const fromISO = fromArg
    ? new Date(`${fromArg}T00:00:00Z`).toISOString()
    : new Date(now.getTime() - days * 24 * 3600 * 1000).toISOString();

  const daysLabel = `${isoDay(new Date(fromISO))} → ${isoDay(new Date(toISO))}`;

  try {
    const repoAgg = await fetchAllRepoStats(username);
    const c = await fetchContrib(username, fromISO, toISO);

    const stats = {
      stars: repoAgg.stars,
      forks: repoAgg.forks,
      commits: c.totalCommitContributions,
      prs: c.totalPullRequestContributions,
      issues: c.totalIssueContributions,
      reviews: c.totalPullRequestReviewContributions,
      contrib: c.totalRepositoriesWithContributedTo,
    };

    const svg = renderStatsSVG({
      username,
      themeName,
      theme,
      hide,
      showIcons,
      hideTitle,
      hideFooter,
      hideBorder,
      borderRadius,
      daysLabel,
      stats,
    });

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, svg, "utf8");
    console.log(`Wrote ${outFile}`);
  } catch (e) {
    const msg = String(e?.message || e);
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="495" height="120" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#111"/>
  <text x="16" y="32" fill="#7aa2f7" font-size="16" font-family="Segoe UI, Ubuntu, Arial" font-weight="800">GitHub Stats</text>
  <text x="16" y="60" fill="#c0caf5" font-size="12" font-family="Segoe UI, Ubuntu, Arial">Build failed</text>
  <text x="16" y="84" fill="#c0caf5" font-size="10" font-family="Segoe UI, Ubuntu, Arial">${esc(msg).slice(0, 160)}</text>
</svg>`;
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, fallback, "utf8");
    process.exitCode = 0;
  }
}

main();
