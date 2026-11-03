import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

const site = process.env.PUBLIC_SITE_URL || "https://aitoolkobo.pages.dev";

if (site.endsWith("/")) {
  throw new Error("PUBLIC_SITE_URL の末尾スラッシュは外してください。");
}

export default defineConfig({
  site,
  trailingSlash: "always",
  integrations: [sitemap()],
  build: {
    format: "directory",
  },
});
