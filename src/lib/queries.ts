import { getCollection, getEntry, type CollectionEntry } from "astro:content";
import { THEMES } from "./labels";
import { breakdownFor, type ScoreBreakdown } from "./score";
import type { ThemeId } from "./schema";

export type RankedTool = {
  tool: CollectionEntry<"tools">;
  category: CollectionEntry<"categories">;
  score: ScoreBreakdown;
};

async function categoryOf(tool: CollectionEntry<"tools">) {
  const category = await getEntry("categories", tool.data.category);
  if (!category) {
    throw new Error(`カテゴリが見つかりません: ${tool.id} → ${tool.data.category}`);
  }
  return category;
}

export async function rankedTools(): Promise<RankedTool[]> {
  const tools = await getCollection("tools");
  const rows = await Promise.all(
    tools.map(async (tool) => ({
      tool,
      category: await categoryOf(tool),
      score: breakdownFor(tool.data),
    })),
  );
  return rows.sort(compareRanked);
}

export function compareRanked(a: RankedTool, b: RankedTool): number {
  if (b.score.total !== a.score.total) return b.score.total - a.score.total;
  return a.tool.data.name.localeCompare(b.tool.data.name, "ja");
}

export async function toolsInCategory(slug: string): Promise<RankedTool[]> {
  const all = await rankedTools();
  return all.filter((row) => row.category.id === slug);
}

export async function categoriesByTheme() {
  const categories = await getCollection("categories");
  const tools = await rankedTools();
  return (Object.keys(THEMES) as ThemeId[]).map((theme) => ({
    id: theme,
    ...THEMES[theme],
    categories: categories
      .filter((category) => category.data.theme === theme)
      .sort((a, b) => a.data.order - b.data.order)
      .map((category) => {
        const members = tools.filter((row) => row.category.id === category.id);
        return { category, count: members.length, top: members[0] };
      }),
  }));
}

export async function newestTools(limit?: number): Promise<RankedTool[]> {
  const tools = await rankedTools();
  const sorted = [...tools].sort((a, b) => {
    if (a.tool.data.addedAt !== b.tool.data.addedAt) {
      return a.tool.data.addedAt < b.tool.data.addedAt ? 1 : -1;
    }
    return a.tool.data.name.localeCompare(b.tool.data.name, "ja");
  });
  return limit ? sorted.slice(0, limit) : sorted;
}

export async function usecases() {
  const entries = await getCollection("usecases");
  return entries.sort((a, b) => a.data.order - b.data.order);
}
