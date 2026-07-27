#!/usr/bin/env node

/**
 * Utility script for theme operations.
 *
 * Usage:
 *   node scripts/theme.mjs list              # List all available themes
 *   node scripts/theme.mjs show <name>       # Show theme colors
 *   node scripts/theme.mjs validate <name>   # Check if a theme exists
 */

import { themes } from "@stats-organization/github-readme-stats-core";

const listThemes = () => {
  const themeKeys = Object.keys(themes || {});
  console.log("Available themes:");
  for (const key of themeKeys) {
    const t = themes[key];
    const preview = t.title_color || t.color || "—";
    console.log(`  • ${key} (title: ${preview})`);
  }
  console.log(`\nTotal: ${themeKeys.length} themes`);
};

const showTheme = (name) => {
  const t = themes?.[name];
  if (!t) {
    console.error(`Theme "${name}" not found.`);
    process.exit(1);
  }
  console.log(`Theme: ${name}`);
  console.log(JSON.stringify(t, null, 2));
};

const validateTheme = (name) => {
  const exists = name in (themes || {});
  console.log(
    exists
      ? `✓ Theme "${name}" exists.`
      : `✗ Theme "${name}" not found.`,
  );
  process.exit(exists ? 0 : 1);
};

const cmd = process.argv[2];
const arg = process.argv[3];

switch (cmd) {
  case "list":
    listThemes();
    break;
  case "show":
    if (!arg) {
      console.error("Usage: node scripts/theme.mjs show <theme-name>");
      process.exit(1);
    }
    showTheme(arg);
    break;
  case "validate":
    if (!arg) {
      console.error("Usage: node scripts/theme.mjs validate <theme-name>");
      process.exit(1);
    }
    validateTheme(arg);
    break;
  default:
    console.log(`
Usage:
  node scripts/theme.mjs list                List all themes
  node scripts/theme.mjs show <name>         Show theme colors
  node scripts/theme.mjs validate <name>     Check if theme exists
`);
    break;
}
