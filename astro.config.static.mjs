// Static-output config used by the `deploy-iamjorgenunes` skill.
// It reuses astro.config.mjs (Folex Lite is already static — there's no
// adapter wired) and runs the build prereqs that `npm run build` would
// normally chain: toml-watcher (must run before astro.config.mjs imports
// .astro/config.generated.json) and cms:cache (downloads Directus assets).

import { execSync } from "node:child_process";

console.log("[static-config] running prereqs...");
execSync("node scripts/toml-watcher.mjs", { stdio: "inherit" });
execSync("node scripts/cms-cache-images.mjs", { stdio: "inherit" });

const baseConfig = (await import("./astro.config.mjs")).default;

export default baseConfig;
