// scripts/theme.mjs
export const THEMES = {
  "blue-green": {
    bg: "#040f0f",
    bg2: "#061a1a",
    title: "#2f97c1",
    text: "#0cf574",
    muted: "rgba(12,245,116,0.75)",
    border: "rgba(12,245,116,0.22)",
    track: "rgba(255,255,255,0.10)",
    chipBg: "rgba(255,255,255,0.07)",
    accent: "#f5b700",
    shadow: "rgba(0,0,0,0.30)",
    grad1: "#2f97c1",
    grad2: "#0cf574",
  },
  "solarized-light": {
    bg: "#fdf6e3",
    bg2: "#fffdf6",
    title: "#268bd2",
    text: "#586e75",
    muted: "rgba(88,110,117,0.75)",
    border: "rgba(88,110,117,0.25)",
    track: "rgba(0,0,0,0.10)",
    chipBg: "rgba(0,0,0,0.05)",
    accent: "#b58900",
    shadow: "rgba(0,0,0,0.18)",
    grad1: "#268bd2",
    grad2: "#b58900",
  },
  dracula: {
    bg: "#282a36",
    bg2: "#1f2230",
    title: "#bd93f9",
    text: "#f8f8f2",
    muted: "rgba(248,248,242,0.75)",
    border: "rgba(189,147,249,0.28)",
    track: "rgba(255,255,255,0.12)",
    chipBg: "rgba(255,255,255,0.08)",
    accent: "#ffb86c",
    shadow: "rgba(0,0,0,0.35)",
    grad1: "#bd93f9",
    grad2: "#ff79c6",
  },
  tokyonight: {
    bg: "#1a1b26",
    bg2: "#141524",
    title: "#7aa2f7",
    text: "#c0caf5",
    muted: "rgba(192,202,245,0.70)",
    border: "rgba(122,162,247,0.28)",
    track: "rgba(255,255,255,0.12)",
    chipBg: "rgba(255,255,255,0.08)",
    accent: "#9ece6a",
    shadow: "rgba(0,0,0,0.40)",
    grad1: "#7aa2f7",
    grad2: "#9ece6a",
  },
  radical: {
    bg: "#141321",
    bg2: "#0f0e18",
    title: "#fe428e",
    text: "#a9fef7",
    muted: "rgba(169,254,247,0.70)",
    border: "rgba(254,66,142,0.25)",
    track: "rgba(255,255,255,0.12)",
    chipBg: "rgba(255,255,255,0.08)",
    accent: "#f8d847",
    shadow: "rgba(0,0,0,0.42)",
    grad1: "#fe428e",
    grad2: "#a9fef7",
  },
  gruvbox: {
    bg: "#282828",
    bg2: "#1f1f1f",
    title: "#fabd2f",
    text: "#ebdbb2",
    muted: "rgba(235,219,178,0.70)",
    border: "rgba(250,189,47,0.25)",
    track: "rgba(255,255,255,0.12)",
    chipBg: "rgba(255,255,255,0.08)",
    accent: "#fe8019",
    shadow: "rgba(0,0,0,0.42)",
    grad1: "#fabd2f",
    grad2: "#fe8019",
  },
};

export const KNOWN_LANG_COLORS = {
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

export function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function fmtCompact(n) {
  const x = Number(n || 0);
  if (x < 1000) return String(x);
  if (x < 1_000_000) return `${(x / 1000).toFixed(x >= 10_000 ? 0 : 1)}k`;
  return `${(x / 1_000_000).toFixed(x >= 10_000_000 ? 0 : 1)}m`;
}

export function toDateShort(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function wrapLines(text, maxLen = 60, maxLines = 2) {
  const s = String(text || "").trim();
  if (!s) return ["No description"];
  const words = s.split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxLen) cur = next;
    else {
      lines.push(cur || w);
      cur = w;
      if (lines.length >= maxLines) break;
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  // ellipsis if truncated
  const joined = lines.join(" ");
  if (joined.length < s.length) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/\s+$/, "");
    if (!lines[lines.length - 1].endsWith("…")) lines[lines.length - 1] += "…";
  }
  return lines.slice(0, maxLines);
}

export function hashColor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 72% 52%)`;
}
export function langColor(name) {
  return KNOWN_LANG_COLORS[name] || hashColor(String(name || "lang"));
}

// width estimate: đủ tốt để layout chip
export function estTextW(text, fontSize = 11) {
  return String(text || "").length * fontSize * 0.56;
}

export function listCSV(v) {
  return String(v || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}
export function listLowerCSV(v) {
  return listCSV(v).map(s => s.toLowerCase());
}

export function resolveTheme(name) {
  return THEMES[name] || THEMES["blue-green"];
}
