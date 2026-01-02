// scripts/pins-auto.mjs
// Node 20+
// Generate ALL repos pins (dark+light) without json.
// Example:
// node scripts/pins-auto.mjs --username TranDangKhoaTechnology --theme_dark tokyonight --theme_light solarized-light --out_dir generated/pins --max_repos 500 --sort updated
// Options:
// --username / --owner (default TranDangKhoaTechnology)
// --theme_dark (default tokyonight)
// --theme_light (default solarized-light)
// --out_dir (default generated/pins)
// --max_repos (default 500)
// --include_forks (default false)
// --exclude_repo (csv repo names)
// --sort (stars|updated|pushed) (default updated)
// --show (same as pin-card.mjs)

import fs from "node:fs";
import path from "node:path";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
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
function listLowerCSV(v) {
  return String(v || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
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

async function fetchUserRepos(username, maxRepos, includeForks, excludeSet, sort) {
  const per = 100;
  let page = 1;
  const out = [];

  // GitHub supports sort: created, updated, pushed, full_name
  const sortParam = sort === "pushed" ? "pushed" : "updated";

  while (out.length < maxRepos) {
    const url = `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=${per}&page=${page}&sort=${sortParam}&direction=desc`;
    const batch = await gh(url);
    if (!Array.isArray(batch) || batch.length === 0) break;

    for (const r of batch) {
      if (!includeForks && r.fork) continue;
      if (r.archived) continue;
      const name = String(r.name || "");
      if (!name) continue;
      if (excludeSet.has(name.toLowerCase())) continue;
      out.push(name);
      if (out.length >= maxRepos) break;
    }
    page++;
  }

  return out;
}

// small concurrency limiter
async function mapLimit(items, limit, fn) {
  const res = [];
  let i = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const idx = i++;
      res[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return res;
}

async function main() {
  const username = arg("username", arg("owner", "TranDangKhoaTechnology"));
  const themeDark = arg("theme_dark", "tokyonight");
  const themeLight = arg("theme_light", "solarized-light");
  const outDir = arg("out_dir", "generated/pins");
  const maxRepos = argInt("max_repos", 500);

  const includeForks = argBool("include_forks", false);
  const excludeSet = new Set(listLowerCSV(arg("exclude_repo", "")));
  const sort = String(arg("sort", "updated")).toLowerCase();

  const show = arg("show", "stars,forks,issues,language,license,topics,updated");

  fs.mkdirSync(outDir, { recursive: true });

  // 1) list repos
  const names = await fetchUserRepos(username, maxRepos, includeForks, excludeSet, sort);

  // 2) render each repo (dark+light)
  const limit = 6;
  await mapLimit(names, limit, async (repo) => {
    const safe = repo.replaceAll("/", "-");
    const outDark = path.join(outDir, `${safe}.dark.svg`);
    const outLight = path.join(outDir, `${safe}.light.svg`);

    // call pin-card generator in-process by dynamic import (no spawn)
    const { default: runOne } = await import("./pins-auto-runner.mjs").catch(() => ({ default: null }));

    if (!runOne) {
      // fallback spawnless: import pin-card.mjs main is not exportable, so we generate by running node inline
      // => easiest reliable is spawn; but we keep it simple: run node as command
      const { execSync } = await import("node:child_process");
      execSync(`node scripts/pin-card.mjs --owner ${username} --repo "${repo}" --theme ${themeDark} --show "${show}" --out "${outDark}"`, { stdio: "inherit" });
      execSync(`node scripts/pin-card.mjs --owner ${username} --repo "${repo}" --theme ${themeLight} --show "${show}" --out "${outLight}"`, { stdio: "inherit" });
      return;
    }

    await runOne({ owner: username, repo
