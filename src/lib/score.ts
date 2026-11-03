import type { SupportLevel, ToolData } from "./schema";

/** 公開する重み。合計は 100。評価基準ページはこの定数を表示する。 */
export const WEIGHTS = {
  features: 30,
  japanese: 25,
  price: 15,
  usability: 20,
  updates: 10,
} as const;

export type CriterionKey = keyof typeof WEIGHTS;

/**
 * 価格帯の上限（この額以下）。
 * EUR は USD と同じ数字の帯で、為替換算はしない。
 * JPY は公式の円建てがあるときだけ使う。
 */
export const PRICE_BANDS = {
  USD: { low: 10, mid: 30, high: 60 },
  EUR: { low: 10, mid: 30, high: 60 },
  JPY: { low: 1500, mid: 4500, high: 9000 },
} as const;

export const CRITERIA: { key: CriterionKey; label: string; question: string }[] = [
  {
    key: "features",
    label: "機能",
    question: "そのカテゴリの仕事を、どこまで一人で片付けられるか",
  },
  {
    key: "japanese",
    label: "日本語対応",
    question: "UI・日本語入力・日本語出力が、確認できた範囲でどうか",
  },
  {
    key: "price",
    label: "価格",
    question: "個人がライセンス料なし、または少ない月額で使い始められるか",
  },
  {
    key: "usability",
    label: "使いやすさ",
    question: "説明をどれだけ読まなくても、最初の成果物に届くか",
  },
  {
    key: "updates",
    label: "更新頻度",
    question: "確認日の時点で、プロダクトが更新され続けているか",
  },
];

const SUPPORT_POINTS: Record<Exclude<SupportLevel, "unknown">, number> = {
  unsupported: 0,
  partial: 1,
  supported: 2,
};

/** UI・入力・出力がすべて確認できたときだけ 1〜5。ひとつでも未確認なら null。 */
export function japaneseScore(japanese: ToolData["japanese"]): number | null {
  const levels = [japanese.ui, japanese.input, japanese.output];
  if (levels.some((level) => level === "unknown")) return null;
  const sum = levels.reduce(
    (total, level) => total + SUPPORT_POINTS[level as Exclude<SupportLevel, "unknown">],
    0,
  );
  return [1, 2, 2, 3, 4, 4, 5][sum] ?? null;
}

/**
 * 月払いの表示価格で帯を決める。年額割引は使わない。
 * free / open-source は購読が不要なので 5。金額が未確認なら null。
 */
export function priceScore(pricing: ToolData["pricing"]): number | null {
  if (pricing.tier === "unknown") return null;
  if (pricing.tier === "free" || pricing.tier === "open-source") return 5;
  if (pricing.monthlyAmount == null || pricing.currency == null) return null;

  const band = PRICE_BANDS[pricing.currency];
  const amount = pricing.monthlyAmount;
  const freemium = pricing.tier === "freemium";
  if (amount <= band.low) return freemium ? 5 : 4;
  if (amount <= band.mid) return freemium ? 4 : 3;
  if (amount <= band.high) return freemium ? 3 : 2;
  return freemium ? 2 : 1;
}

export type ScoreRow = {
  key: CriterionKey;
  label: string;
  weight: number;
  raw: number | null;
  included: boolean;
  effectiveWeight: number;
  contribution: number;
};

export type ScoreBreakdown = {
  total: number;
  rows: ScoreRow[];
  excludedWeight: number;
};

export function scoreFromRaws(raw: Record<CriterionKey, number | null>): ScoreBreakdown {
  const includedWeight = CRITERIA.reduce(
    (sum, item) => (raw[item.key] == null ? sum : sum + WEIGHTS[item.key]),
    0,
  );

  const rows = CRITERIA.map((item) => {
    const value = raw[item.key];
    const included = value != null && includedWeight > 0;
    const effectiveWeight = included ? (WEIGHTS[item.key] / includedWeight) * 100 : 0;
    const contribution = included ? (value / 5) * effectiveWeight : 0;
    return {
      key: item.key,
      label: item.label,
      weight: WEIGHTS[item.key],
      raw: value,
      included,
      effectiveWeight,
      contribution,
    };
  });

  const total = round1(rows.reduce((sum, row) => sum + row.contribution, 0));
  return {
    total,
    rows,
    excludedWeight: 100 - includedWeight,
  };
}

export function breakdownFor(tool: ToolData): ScoreBreakdown {
  return scoreFromRaws({
    features: tool.editorial.features.score,
    japanese: japaneseScore(tool.japanese),
    price: priceScore(tool.pricing),
    usability: tool.editorial.usability.score,
    updates: tool.editorial.updates.score,
  });
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function formatScore(total: number): string {
  return total.toFixed(1);
}
