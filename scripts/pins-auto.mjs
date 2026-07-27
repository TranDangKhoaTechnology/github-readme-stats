#!/usr/bin/env node

/**
 * Auto-generate pin cards for all (or top N) repos of a GitHub user.
 *
 * Usage:
 *   node scripts/pins-auto.mjs                           \
 *     --owner TranDangKhoaTechnology                     \
 *     --out_dir generated/pins                           \
 *     --theme_dark tokyonight                            \
 *     --theme_light solarized-light                      \
 *     --max_repos 50                                     \
 *     --include_forks false                              \
 *     --sort updated                                     \
 *     --show "stars,forks,issues,watchers,language,license,topics,updated,size"
 */

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pin, loadConfigFromEnv } from "@stats-organization/github-readme-stats-core";
import "dotenv/config";

// Load GitHub PATs from environment (PAT_1, PAT_2, ...)
loadConfigFromEnv();

const parseArgs = () => {
  const args = process.argv.slice(2);
  const opts = {
    max_repos: 100,
    include_forks: false,
    sort: "updated",
    show: "stars,forks,language",
  };

  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith("--")) continue;
    const key = args[i].slice(2);
    const val = args[i + 1];
    if (val !== undefined && !val.startsWith("--")) {
      opts[key] = val;
      i++;
    }
  }

  // Parse booleans
  if (typeof opts.include_forks === "string") {
    opts.include_forks =
      opts.include_forks === "true" || opts.include_forks === "1";
  }

  if (typeof opts.max_repos === "string") {
    opts.max_repos = Number(opts.max_repos);
  }

  return opts;
};

const fetchRepos = async (owner, maxRepos, includeForks, sort) => {
  const token =
    process.env.PAT_1 ||
    process.env.GITHUB_TOKEN ||
    process.env.INPUT_TOKEN ||
    "";

  const headers = { Accept: "application/vnd.github.v3+json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const perPage = Math.min(maxRepos, 100);
  let allRepos = [];
  let page = 1;
  let fetched;

  do {
    const url = `https://api.github.com/users/${owner}/repos?per_page=${perPage}&page=${page}&sort=${sort}&direction=desc`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      console.error(
        `GitHub API error: ${res.status} ${res.statusText}`,
      );
      break;
    }

    fetched = await res.json();
    if (!Array.isArray(fetched) || fetched.length === 0) break;

    allRepos = allRepos.concat(
      fetched.filter(
        (r) => includeForks || !r.fork,
      ),
    );
    page++;

    // Respect rate limits
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining && Number(remaining) < 10) {
      console.warn(`Rate limit low (${remaining}), stopping pagination.`);
      break;
    }
  } while (allRepos.length < maxRepos && fetched.length === perPage);

  return allRepos.slice(0, maxRepos);
};

const run = async () => {
  const opts = parseArgs();

  if (!opts.owner) {
    console.error("Error: --owner is required.");
    process.exit(1);
  }

  const outDir = resolve(opts.out_dir || "generated/pins");

  console.log(
    `Fetching up to ${opts.max_repos} repos for ${opts.owner}...`,
  );
  const repos = await fetchRepos(
    opts.owner,
    opts.max_repos,
    opts.include_forks,
    opts.sort || "updated",
  );
  console.log(`Found ${repos.length} repos.`);

  await mkdir(outDir, { recursive: true });

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    const repoName = repo.name;
    console.log(`[${i + 1}/${repos.length}] Generating pin for ${repoName}...`);

    // Generate dark variant
    const darkOpts = {
      username: opts.owner,
      repo: repoName,
      theme: opts.theme_dark || "tokyonight",
      show_owner: true,
      hide_border: true,
    };

    // Light variant
    const lightOpts = {
      username: opts.owner,
      repo: repoName,
      theme: opts.theme_light || "solarized-light",
      show_owner: true,
      hide_border: true,
    };

    try {
      const darkResult = await pin(darkOpts);
      if (darkResult?.content) {
        await writeFile(
          resolve(outDir, `${repoName}.dark.svg`),
          darkResult.content,
          "utf8",
        );
      }

      const lightResult = await pin(lightOpts);
      if (lightResult?.content) {
        await writeFile(
          resolve(outDir, `${repoName}.light.svg`),
          lightResult.content,
          "utf8",
        );
      }

      successCount++;
    } catch (err) {
      console.error(`  Failed for ${repoName}: ${err.message}`);
      failCount++;
    }

    // Small delay to avoid rate limiting
    if (i < repos.length - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  console.log(`\nDone. ${successCount} succeeded, ${failCount} failed.`);
};

run().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
