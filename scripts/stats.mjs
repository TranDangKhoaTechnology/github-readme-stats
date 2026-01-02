// scripts/stats.mjs
// Node 20+
// Usage:
// node scripts/stats.mjs --username TranDangKhoaTechnology --theme blue-green --hide "" --out generated/stats.svg

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
function hideList(str) {
  return String(str || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const THEMES = {
  "blue-green": {
    bg: "#040f0f",
    title: "#2f97c1",
    text: "#0cf574",
    muted: "rgba(12,245,116,0.78)",
    border: "rgba(12,245,116,0.22)",
    track: "rgba(255,255,255,0.09)",
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
    track: "rgba(0,0,0,0.08)",
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
    track: "rgba(255,255,255,0.10)",
    grad1: "#bd93f9",
    grad2: "#ff79c6",
    chipBg: "rgba(255,255,255,0.07)",
  },
  "tokyo-night": {
    bg: "#1a1b26",
    title: "#7aa2f7",
    text: "#c0caf5",
    muted: "rgba(192,202,245,0.75)",
    border: "rgba(122,162,247,0.25)",
    track: "rgba(255,255,255,0.10)",
    grad1: "#7aa2f7",
    grad2: "#9ece6a",
    chipBg: "rgba(255,255,255,0.07)",
  },
};

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

async function ghGraphQL(query, variables) {
  const token = process.env.GITHUB_TOKEN || "";
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "readme-cards",
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.errors) {
    const msg =
      json?.errors?.[0]?.message ||
      JSON.stringify(json).slice(0, 220) ||
      `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return json.data;
}

async function fetchAllRepos(username, maxRepos = 500, includeForks = false) {
  const per = 100;
  let page = 1;
  const out = [];
  while (out.length < maxRepos) {
    const url = `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=${per}&page=${page}&sort=updated`;
    const batch = await ghRest(url);
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

function renderStatsSVG({ username, themeKey, metrics, meta }) {
  const t = THEMES[themeKey] || THEMES["blue-green"];

  const W = 495;
  const PAD = 16;
  const headerH = 52;

  const cols = 2;
  const gap = 12;
  const cellW = Math.floor((W - PAD * 2 - gap) / cols);
  const rowH = 44;
  const rows = Math.ceil(metrics.length / cols);
  const H = headerH + rows * rowH + 18;

  let cells = "";
  for (let i = 0; i < metrics.length; i++) {
    const m = metrics[i];
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = PAD + c * (cellW + gap);
    const y = headerH + r * rowH;

    const barW = cellW - 18;
    const pct = Math.max(0, Math.min(1, m.pct ?? 0));
    const fillW = Math.round(barW * pct);

    cells += `
      <g transform="translate(${x},${y})">
        <rect x="0" y="0" width="${cellW}" height="38" rx="10" fill="${t.chipBg}" stroke="rgba(255,255,255,0.04)"/>
        <circle cx="16" cy="19" r="8" fill="${m.color}" opacity="0.95"/>
        <text x="30" y="16" font-size="11" fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">${esc(m.label)}</text>
        <text x="30" y="30" font-size="15" font-weight="800" fill="${t.text}" font-family="Segoe UI, Ubuntu, Arial">${esc(m.value)}</text>

        <rect x="10" y="34" width="${barW}" height="4" rx="2" fill="${t.track}" opacity="0.9"/>
        <rect x="10" y="34" width="${fillW}" height="4" rx="2" fill="${m.color}" opacity="0.95"/>
      </g>
    `;
  }

  const title = "GitHub Stats";
  const subtitle = `${username} • updated ${meta.updated}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(title)}">
  <defs>
    <linearGradient id="borderGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${t.grad1}"/>
      <stop offset="100%" stop-color="${t.grad2}"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="rgba(0,0,0,0.30)"/>
    </filter>
  </defs>

  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14"
        fill="${t.bg}" stroke="url(#borderGrad)" stroke-width="1.2" filter="url(#shadow)"/>

  <g transform="translate(${PAD},18)">
    <circle cx="10" cy="10" r="10" fill="rgba(255,255,255,0.06)"/>
    <text x="10" y="14" text-anchor="middle" font-size="12" fill="${t.title}" font-family="Segoe UI, Ubuntu, Arial">★</text>
    <text x="30" y="14" font-size="18" font-weight="900" fill="${t.title}" font-family="Segoe UI, Ubuntu, Arial">${esc(title)}</text>
    <text x="${W - PAD * 2}" y="14" text-anchor="end" font-size="11" fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">${esc(subtitle)}</text>
  </g>

  ${cells}

  <text x="${PAD}" y="${H - 10}" font-size="10" fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">
    ${esc(meta.note)}
  </text>
</svg>`;
}

async function main() {
  const username = arg("username", "TranDangKhoaTechnology");
  const themeKey = arg("theme", "blue-green");
  const hide = hideList(arg("hide", ""));
  const outFile = arg("out", "generated/stats.svg");
  const maxRepos = argInt("max_repos", 500);
  const includeForks = String(arg("include_forks", "false")).toLowerCase() === "true";

  const colors = {
    stars: "#f5b700",
    forks: "#2f97c1",
    followers: "#0cf574",
    repos: "#bd93f9",
    commits: "#ff79c6",
    prs: "#9ece6a",
    issues: "#e34c26",
    reviews: "#3178c6",
    contrib: "#b58900",
    contribRepos: "#41b883",
  };

  try {
    // REST: stars/forks totals
    const repos = await fetchAllRepos(username, maxRepos, includeForks);
    const totalStars = repos.reduce((a, r) => a + (r.stargazers_count || 0), 0);
    const totalForks = repos.reduce((a, r) => a + (r.forks_count || 0), 0);

    // GraphQL: contributions last 1y
    const now = new Date();
    const to = now.toISOString();
    const from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();

    const q = `
      query($login:String!, $from:DateTime!, $to:DateTime!) {
        user(login:$login) {
          followers { totalCount }
          repositories(ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) { totalCount }
          contributionsCollection(from:$from, to:$to) {
            contributionCalendar { totalContributions }
            totalCommitContributions
            totalPullRequestContributions
            totalIssueContributions
            totalPullRequestReviewContributions

            commitContributionsByRepository(maxRepositories: 100) { repository { nameWithOwner } }
            issueContributionsByRepository(maxRepositories: 100) { repository { nameWithOwner } }
            pullRequestContributionsByRepository(maxRepositories: 100) { repository { nameWithOwner } }
            pullRequestReviewContributionsByRepository(maxRepositories: 100) { repository { nameWithOwner } }
          }
        }
      }
    `;

    const data = await ghGraphQL(q, { login: username, from, to });
    const u = data.user;
    const cc = u.contributionsCollection;

    const totalContrib = cc.contributionCalendar?.totalContributions ?? 0;

    // union repos contributed (approx, up to 100 repos/type)
    const set = new Set();
    for (const arr of [
      cc.commitContributionsByRepository,
      cc.issueContributionsByRepository,
      cc.pullRequestContributionsByRepository,
      cc.pullRequestReviewContributionsByRepository,
    ]) {
      for (const x of arr || []) {
        const n = x?.repository?.nameWithOwner;
        if (n) set.add(n);
      }
    }
    const contribRepos = set.size;

    // build metrics (hide-able)
    const all = [
      { key: "stars", label: "Total Stars", value: String(totalStars), color: colors.stars, pct: Math.min(1, totalStars / 200) },
      { key: "forks", label: "Total Forks", value: String(totalForks), color: colors.forks, pct: Math.min(1, totalForks / 80) },
      { key: "followers", label: "Followers", value: String(u.followers.totalCount), color: colors.followers, pct: Math.min(1, u.followers.totalCount / 50) },
      { key: "repos", label: "Public Repos", value: String(u.repositories.totalCount), color: colors.repos, pct: Math.min(1, u.repositories.totalCount / 80) },

      { key: "commits", label: "Commits (1y)", value: String(cc.totalCommitContributions ?? 0), color: colors.commits, pct: Math.min(1, (cc.totalCommitContributions ?? 0) / 300) },
      { key: "prs", label: "Pull Requests (1y)", value: String(cc.totalPullRequestContributions ?? 0), color: colors.prs, pct: Math.min(1, (cc.totalPullRequestContributions ?? 0) / 80) },
      { key: "issues", label: "Issues (1y)", value: String(cc.totalIssueContributions ?? 0), color: colors.issues, pct: Math.min(1, (cc.totalIssueContributions ?? 0) / 80) },
      { key: "reviews", label: "Reviews (1y)", value: String(cc.totalPullRequestReviewContributions ?? 0), color: colors.reviews, pct: Math.min(1, (cc.totalPullRequestReviewContributions ?? 0) / 120) },

      { key: "contrib", label: "Contributions (1y)", value: String(totalContrib), color: colors.contrib, pct: Math.min(1, totalContrib / 400) },
      { key: "contrib_to", label: "Contributed Repos (1y)", value: String(contribRepos), color: colors.contribRepos, pct: Math.min(1, contribRepos / 30) },
    ];

    const metrics = all.filter((m) => !hide.includes(m.key));

    const svg = renderStatsSVG({
      username,
      themeKey,
      metrics,
      meta: {
        updated: now.toISOString().slice(0, 16).replace("T", " "),
        note: `hide=${hide.join(",") || "∅"} • repos_counted=${repos.length}`,
      },
    });

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, svg, "utf8");
    console.log(`Wrote ${outFile}`);
  } catch (e) {
    // fallback SVG để README vẫn hiện
    const msg = String(e?.message || e);
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="495" height="120" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#040f0f"/>
  <text x="16" y="32" fill="#2f97c1" font-size="16" font-family="Segoe UI, Ubuntu, Arial" font-weight="800">GitHub Stats</text>
  <text x="16" y="60" fill="#0cf574" font-size="12" font-family="Segoe UI, Ubuntu, Arial">Build failed</text>
  <text x="16" y="82" fill="#0cf574" font-size="10" font-family="Segoe UI, Ubuntu, Arial">${esc(msg).slice(0, 140)}</text>
</svg>`;
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, fallback, "utf8");
    process.exitCode = 1;
  }
}

main();
