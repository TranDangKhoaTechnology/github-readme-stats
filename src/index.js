import { pathToFileURL } from "node:url";

export * from "./common/index.js";
export * from "./cards/index.js";

// Keep the package exports side-effect free when imported, while also supporting
// managed hosts that use `node src/index.js` as their default start command.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await import("../express.js");
}
