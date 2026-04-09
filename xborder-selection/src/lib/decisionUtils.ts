export type DecisionVerdict = 'recommend' | 'caution' | 'reject';

export interface DecisionSummary {
  verdict: DecisionVerdict;
  conclusionLabel: string;
  sellingPoint: string;
}

export function getDecisionSummary(product: {
  grossMargin?: number | null;
  aiCompetitiveness?: number | null;
  aiRiskLevel?: string | null;
  aiRecommended?: boolean | null;
  weight?: number | null;
  moq?: number | null;
  material?: string | null;
  usage?: string | null;
  productSource?: string | null;
  supplierName?: string | null;
}): DecisionSummary {
  const margin = product.grossMargin ?? 0;
  const score = product.aiCompetitiveness ?? 0;
  const risk = product.aiRiskLevel ?? '中';

  // Verdict
  let verdict: DecisionVerdict;
  let conclusionLabel: string;
  if (score >= 7 && margin > 0.25 && risk !== '高') {
    verdict = 'recommend';
    conclusionLabel = '建议测试采购';
  } else if (risk === '高' || margin < 0.1) {
    verdict = 'reject';
    conclusionLabel = '暂不建议采购';
  } else {
    verdict = 'caution';
    conclusionLabel = '谨慎考虑';
  }

  // Best one-line selling point
  const points: string[] = [];
  if (margin > 0.35) points.push(`毛利 ${(margin * 100).toFixed(0)}%，利润优`);
  else if (margin > 0.2) points.push(`毛利 ${(margin * 100).toFixed(0)}%，合理`);
  if (product.weight && product.weight < 0.5) points.push('重量轻，空运成本低');
  if (product.moq && product.moq <= 100) points.push(`MOQ ${product.moq} 件，适合测款`);
  if (risk === '低') points.push('合规风险低');
  if (score >= 8) points.push(`竞争力 ${score}/10`);
  if (product.material?.includes('食品')) points.push('食品级材质');

  const sellingPoint = points.slice(0, 2).join(' · ') || (product.usage ? `主要用途：${product.usage}` : '暂无核心卖点');

  return { verdict, conclusionLabel, sellingPoint };
}

export const verdictStyles: Record<DecisionVerdict, { bg: string; text: string; dot: string }> = {
  recommend: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  caution:   { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400'  },
  reject:    { bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500'    },
};

export type CompetitivenessGrade = 'A' | 'B' | 'C' | 'D';

export function getCompetitivenessGrade(score: number | null | undefined): CompetitivenessGrade {
  const s = score ?? 0;
  if (s >= 8) return 'A';
  if (s >= 6) return 'B';
  if (s >= 4) return 'C';
  return 'D';
}
