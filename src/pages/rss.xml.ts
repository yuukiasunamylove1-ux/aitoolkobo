import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { newestTools } from "../lib/queries";
import { SITE_DESCRIPTION, SITE_NAME } from "../lib/seo";

export async function GET(context: APIContext) {
  const tools = await newestTools();
  return rss({
    title: `${SITE_NAME} 新着AIツール`,
    description: SITE_DESCRIPTION,
    site: context.site!,
    trailingSlash: true,
    customData: "<language>ja</language>",
    items: tools.map((row) => ({
      title: row.tool.data.name,
      description: row.tool.data.description,
      link: `/tools/${row.tool.id}/`,
      pubDate: new Date(`${row.tool.data.addedAt}T00:00:00Z`),
      categories: [row.category.data.name],
    })),
  });
}
