import tailwind from "@astrojs/tailwind";
import compress from "astro-compress";
import icon from "astro-icon";
import { defineConfig } from "astro/config";

// Static build config used by the Hetzner deploy (nginx serves /dist).
// The default astro.config.mjs targets Vercel SSR; this file overrides that
// for plain-static output without removing the Vercel pipeline.
export default defineConfig({
    site: "https://iamjorgenunes.com",
    integrations: [tailwind(), icon(), compress()],
    output: "static",
});
