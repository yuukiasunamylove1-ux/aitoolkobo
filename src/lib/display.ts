import type { SupportLevel, ToolData } from "./schema";

/** 表示用の概算。公式の円建てではない。 */
export const FX = {
  asOf: "2026-11-03",
  USD: 150,
} as const;

export const FX_NOTE = `円の「約」は 1 USD = ¥${FX.USD}（${FX.asOf}）の概算です。公式の円建てではありません。`;

export const JA_MARK: Record<SupportLevel, string> = {
  supported: "○",
  partial: "△",
  unsupported: "×",
  unknown: "—",
};

export const JA_WORD: Record<SupportLevel, string> = {
  supported: "対応",
  partial: "一部対応",
  unsupported: "非対応",
  unknown: "未確認",
};

const JA_SHORT: Record<"ui" | "input" | "output", string> = {
  ui: "UI",
  input: "入力",
  output: "出力",
};

export function testedValue(
  checks: ToolData["checks"],
  field: "ui" | "input" | "output",
): SupportLevel | null {
  const found = checks.find((check) => check.kind === "tested" && check.field === field && check.value);
  return found?.value && found.value !== "unknown" ? found.value : null;
}

export function shownLevel(
  official: SupportLevel,
  tested: SupportLevel | null,
): { level: SupportLevel; kind: "official" | "tested" } {
  if (official !== "unknown") return { level: official, kind: "official" };
  if (tested) return { level: tested, kind: "tested" };
  return { level: "unknown", kind: "official" };
}

export function jaPhrase(japanese: ToolData["japanese"]): string {
  return (["ui", "input", "output"] as const)
    .map((key) => `${JA_SHORT[key]}${JA_MARK[japanese[key]]}（${JA_WORD[japanese[key]]}）`)
    .join("、");
}

export function formatYen(amount: number): string {
  return `¥${Math.round(amount).toLocaleString("ja-JP")}`;
}

export function approxYenFromUsd(usd: number): number {
  return Math.round(usd * FX.USD);
}

export type PriceView = {
  text: string;
  yenText: string;
  title: string;
  sort: number | null;
};

export function priceView(pricing: ToolData["pricing"]): PriceView {
  if (pricing.yenAmount != null) {
    const text = `${formatYen(pricing.yenAmount)}〜`;
    return { text, yenText: text, title: "公式の円建て", sort: pricing.yenAmount };
  }
  if (pricing.monthlyAmount != null && pricing.currency === "USD") {
    const yen = approxYenFromUsd(pricing.monthlyAmount);
    const yenText = `約${formatYen(yen)}〜`;
    const prefix = pricing.tier === "freemium" ? "無料枠 / " : "";
    return {
      text: `${prefix}${yenText}`,
      yenText,
      title: `公式の月額は $${pricing.monthlyAmount}。${FX_NOTE}`,
      sort: yen,
    };
  }
  if (pricing.monthlyAmount != null && pricing.currency === "EUR") {
    return {
      text: `€${pricing.monthlyAmount}〜`,
      yenText: "—",
      title: "公式の月額はユーロです。円の概算レートはドルだけに適用しています。",
      sort: null,
    };
  }
  if (pricing.tier === "free" || pricing.tier === "open-source") {
    return { text: "無料", yenText: "無料", title: pricing.label, sort: 0 };
  }
  if (pricing.tier === "freemium") {
    return { text: "無料枠", yenText: "—", title: "有料プランの月額は未確認", sort: 0 };
  }
  return { text: "—", yenText: "—", title: "料金は未確認", sort: null };
}

export function rowMeta(data: ToolData) {
  const price = priceView(data.pricing);
  return {
    free: data.pricing.tier === "free" || data.pricing.tier === "freemium" || data.pricing.tier === "open-source",
    ja: data.japanese.ui === "supported",
    self: data.platforms.some((item) => item.includes("セルフホスト")),
    oss: data.pricing.tier === "open-source",
    price: price.sort,
    added: data.addedAt,
  };
}
