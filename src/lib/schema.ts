import { z } from "zod";

export const themes = ["vibe", "game", "agent"] as const;
export const supportLevels = ["supported", "partial", "unsupported", "unknown"] as const;
export const priceTiers = ["free", "freemium", "subscription", "open-source", "unknown"] as const;
export const commercialUses = ["allowed", "restricted", "not-allowed", "unknown"] as const;
export const checkFields = ["ui", "input", "output", "pricing", "commercial"] as const;

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

export const criterionSchema = z
  .object({
    score: z.number().int().min(1).max(5).nullable(),
    note: z.string().min(8).max(240),
  })
  .strict();

export const toolSchema = z
  .object({
    name: z.string().min(1).max(80),
    url: z.string().url(),
    category: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: z.string().min(24).max(160),
    detail: z.string().min(40).max(520),
    platforms: z.array(z.string().min(1).max(40)).min(1).max(6),
    pricing: z
      .object({
        tier: z.enum(priceTiers),
        currency: z.enum(["USD", "EUR", "JPY"]).nullable(),
        monthlyAmount: z.number().nonnegative().nullable(),
        yenAmount: z.number().nonnegative().nullable(),
        short: z.string().min(2).max(48),
        label: z.string().min(12).max(420),
        sourceUrl: z.string().url(),
      })
      .strict(),
    japanese: z
      .object({
        ui: z.enum(supportLevels),
        input: z.enum(supportLevels),
        output: z.enum(supportLevels),
        note: z.string().min(4).max(320),
      })
      .strict(),
    editorial: z
      .object({
        features: criterionSchema,
        usability: criterionSchema,
        updates: criterionSchema,
      })
      .strict(),
    addedAt: dateString,
    lastChecked: dateString,
    commercialUse: z.enum(commercialUses),
    commercialNote: z.string().min(4).max(240),
    checks: z
      .array(
        z
          .object({
            field: z.enum(checkFields),
            sourceUrl: z.string().url(),
            checkedAt: dateString,
          })
          .strict(),
      )
      .max(8),
    sources: z
      .array(
        z
          .object({
            label: z.string().min(1).max(80),
            url: z.string().url(),
          })
          .strict(),
      )
      .min(1)
      .max(6),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.pricing.monthlyAmount != null && data.pricing.currency == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pricing", "currency"],
        message: "monthlyAmount があるときは currency が必要です。",
      });
    }
    if (
      (data.pricing.tier === "free" ||
        data.pricing.tier === "open-source" ||
        data.pricing.tier === "unknown") &&
      data.pricing.monthlyAmount != null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pricing", "monthlyAmount"],
        message: "free / open-source / unknown では monthlyAmount を空にしてください。",
      });
    }
    if (data.addedAt > data.lastChecked) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["addedAt"],
        message: "addedAt は lastChecked 以前にしてください。",
      });
    }
    const needs: Array<(typeof checkFields)[number]> = [];
    if (data.japanese.ui !== "unknown") needs.push("ui");
    if (data.japanese.input !== "unknown") needs.push("input");
    if (data.japanese.output !== "unknown") needs.push("output");
    if (data.commercialUse !== "unknown") needs.push("commercial");
    if (
      data.pricing.tier !== "unknown" ||
      data.pricing.monthlyAmount != null ||
      data.pricing.yenAmount != null
    ) {
      needs.push("pricing");
    }
    for (const field of needs) {
      if (!data.checks.some((check) => check.field === field)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["checks"],
          message: `${field} を未確認以外にするときは、出典と確認日が必要です。`,
        });
      }
    }
    for (const check of data.checks) {
      const unknown =
        (check.field === "ui" && data.japanese.ui === "unknown") ||
        (check.field === "input" && data.japanese.input === "unknown") ||
        (check.field === "output" && data.japanese.output === "unknown") ||
        (check.field === "commercial" && data.commercialUse === "unknown");
      if (unknown) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["checks"],
          message: `${check.field} が未確認なのに出典が付いています。`,
        });
      }
      if (check.checkedAt > data.lastChecked) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["checks"],
          message: "checks.checkedAt は lastChecked 以前にしてください。",
        });
      }
    }
  });

export const categorySchema = z
  .object({
    name: z.string().min(1).max(40),
    theme: z.enum(themes),
    description: z.string().min(20).max(240),
    order: z.number().int().min(1).max(99),
  })
  .strict();

export const usecaseSchema = z
  .object({
    title: z.string().min(4).max(80),
    description: z.string().min(20).max(180),
    theme: z.enum(themes),
    order: z.number().int().min(1).max(99),
    tools: z
      .array(
        z
          .object({
            slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
            reason: z.string().min(12).max(180),
          })
          .strict(),
      )
      .min(3)
      .max(4),
  })
  .strict();

export type ToolData = z.infer<typeof toolSchema>;
export type CategoryData = z.infer<typeof categorySchema>;
export type SupportLevel = (typeof supportLevels)[number];
export type PriceTier = (typeof priceTiers)[number];
export type ThemeId = (typeof themes)[number];
