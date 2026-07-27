#!/usr/bin/env node

/**
 * CLI script to generate a GitHub Stats SVG card.
 * Usage: node scripts/stats.mjs --username octocat --theme dark [options]
 *
 * Options mirror the core.api() parameters.  Use --out <path> to write the SVG
 * to a file; otherwise the SVG is printed to stdout.
 */

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { api, loadConfigFromEnv } from "@stats-organization/github-readme-stats-core";
import "dotenv/config";

// Load GitHub PATs from environment (PAT_1, PAT_2, ...)
loadConfigFromEnv();

const BOOLEAN_KEYS = new Set([
  "hide_title",
  "hide_border",
  "hide_rank",
  "show_icons",
  "include_all_commits",
  "text_bold",
  "disable_animations",
]);

const parseArgs = () => {
  const args = process.argv.slice(2);
  const opts = {};

  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith("--")) continue;
    const key = args[i].slice(2);
    const val = args[i + 1];
    if (val !== undefined && !val.startsWith("--")) {
      opts[key] = val;
      i++;
    } else {
      opts[key] = "true";
    }
  }

  // Parse known boolean-like strings
  for (const k of BOOLEAN_KEYS) {
    if (opts[k] !== undefined) {
      opts[k] = opts[k] === "true" || opts[k] === "1" || opts[k] === true;
    }
  }

  // Parse numeric options
  for (const k of ["card_width", "commits_year", "border_radius", "number_precision"]) {
    if (opts[k] !== undefined) opts[k] = Number(opts[k]);
  }

  // Remove empty-string values so the core treats them as unset
  for (const [k, v] of Object.entries(opts)) {
    if (v === "") delete opts[k];
  }

  return opts;
};

const run = async () => {
  const opts = parseArgs();

  if (!opts.username && !process.env.GITHUB_REPOSITORY_OWNER) {
    console.error(
      "Error: --username is required (or set GITHUB_REPOSITORY_OWNER env).",
    );
    process.exit(1);
  }

  if (!opts.username) {
    opts.username = process.env.GITHUB_REPOSITORY_OWNER;
  }

  const result = await api(opts);
  const svg = result?.content;

  if (!svg) {
    console.error("Error: card renderer returned empty output.");
    process.exit(1);
  }

  if (opts.out) {
    const outPath = resolve(opts.out);
    await writeFile(outPath, svg, "utf8");
    console.log(`Wrote ${outPath}`);
  } else {
    process.stdout.write(svg);
  }
};

run().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
