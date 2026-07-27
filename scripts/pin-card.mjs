#!/usr/bin/env node

/**
 * CLI script to generate a single repository pin card.
 * Usage: node scripts/pin-card.mjs --username octocat --repo my-repo --theme dark [options]
 */

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pin, loadConfigFromEnv } from "@stats-organization/github-readme-stats-core";
import "dotenv/config";

// Load GitHub PATs from environment (PAT_1, PAT_2, ...)
loadConfigFromEnv();

const BOOLEAN_KEYS = new Set([
  "hide_border",
  "show_owner",
  "browser_rendering",
  "show_icons",
  "text_bold",
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

  for (const k of ["card_width", "border_radius", "description_lines_count"]) {
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

  if (!opts.username) {
    console.error("Error: --username is required.");
    process.exit(1);
  }

  if (!opts.repo) {
    console.error("Error: --repo is required.");
    process.exit(1);
  }

  const result = await pin(opts);
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
