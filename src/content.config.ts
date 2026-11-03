import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { categorySchema, toolSchema, usecaseSchema } from "./lib/schema";

export const collections = {
  tools: defineCollection({
    loader: glob({ pattern: "**/*.json", base: "./src/content/tools" }),
    schema: toolSchema,
  }),
  categories: defineCollection({
    loader: glob({ pattern: "**/*.json", base: "./src/content/categories" }),
    schema: categorySchema,
  }),
  usecases: defineCollection({
    loader: glob({ pattern: "**/*.md", base: "./src/content/usecases" }),
    schema: usecaseSchema,
  }),
};
