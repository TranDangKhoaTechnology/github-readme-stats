#!/usr/bin/env node

/**
 * CLI script to generate a Top Languages SVG card.
 * Usage: node scripts/top-langs.mjs --username octocat --theme dark [options]
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { topLangs, loadConfigFromEnv } from "@stats-organization/github-readme-stats-core";
import "dotenv/config";

// Load GitHub PATs from environment (PAT_1, PAT_2, ...)
loadConfigFromEnv();

const BOOLEAN_KEYS = new Set([
  "hide_title",
  "hide_border",
  "disable_animations",
  "hide_progress",
  "hide_values",
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

  for (const k of BOOLEAN_KEYS) {
    if (opts[k] !== undefined) {
      opts[k] = opts[k] === "true" || opts[k] === "1" || opts[k] === true;
    }
  }

  for (const k of ["card_width", "border_radius", "langs_count"]) {
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

  const result = await topLangs(opts);
  const svg = result?.content;

  if (!svg) {
    console.error("Error: card renderer returned empty output.");
    process.exit(1);
  }

  if (opts.out) {
    const outPath = resolve(opts.out);
    await mkdir(dirname(outPath), { recursive: true });
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
