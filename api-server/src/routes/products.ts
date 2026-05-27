import { Router, type IRouter, type Request, type Response } from "express";
import { authenticate } from "../middleware/authenticate";
import { db } from "@workspace/db";
import {
  productsTable,
  procurementTaskAssigneesTable,
  procurementTasksTable,
  sampleOptionsTable,
  sampleSkuLinesTable,
} from "@workspace/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  ListProductsQueryParams,
  CreateProductBody,
  UpdateProductBody,
  SubmitScreeningBody,
  ManagerActionBody,
} from "@workspace/api-zod";
import { fetchAndStoreImage, fetchAndStoreImages } from "../lib/fetchAndStoreImage";
import { assertTransitOrThrow, type ProductAction, type ProductFromStatus } from "../domain/product-state-machine";

const router: IRouter = Router();

type ProductRow = typeof productsTable.$inferSelect;

function canSeeAllProducts(req: Request) {
  return req.user?.role === "product_manager" || req.user?.role === "admin";
}

function canAccessProduct(req: Request, product: Pick<ProductRow, "employeeId">) {
  if (canSeeAllProducts(req)) return true;
  return req.user?.role === "product_specialist" && product.employeeId === req.user.employeeId;
}

function sendProductAccessDenied(res: Response) {
  res.status(403).json({ error: "No permission to access this employee's product" });
}

async function loadProductForAccess(req: Request, res: Response, productId: string) {
  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, productId));

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return null;
  }

  if (!canAccessProduct(req, product)) {
    sendProductAccessDenied(res);
    return null;
  }

  return product;
}

/** SKU 采购状态分层：用于多 SKU 时推导产品主状态 */
const SKU_PASSED = new Set(["passed", "completed"]);
const SKU_INSPECTING = new Set(["inspecting", "passed", "completed", "anomaly_resolved"]);
const SKU_ARRIVED = new Set(["arrived", "inspecting", "passed", "completed", "anomaly_resolved", "anomaly_reported"]);
const SKU_ORDERED = new Set([
  "ordered", "arrived", "inspecting", "passed", "completed",
  "anomaly_reported", "anomaly_resolved",
]);
const SKU_ANOMALY_ACTIVE = new Set(["anomaly_handling", "anomaly_processing"]);

const AGGREGATE_SKU_ACTIONS = new Set([
  "confirm_order",
  "mark_arrived",
  "start_inspection",
  "pass_inspection",
]);

async function getManagerSelectedSkus(productId: string) {
  const options = await db
    .select({
      id: sampleOptionsTable.id,
      selectedAt: sampleOptionsTable.selectedAt,
    })
    .from(sampleOptionsTable)
    .where(eq(sampleOptionsTable.productId, productId));
  const selectedOptionIds = options.filter((o) => o.selectedAt != null).map((o) => o.id);
  if (selectedOptionIds.length === 0) return [];
  const rows = await db
    .select({
      id: sampleSkuLinesTable.id,
      purchaseStatus: sampleSkuLinesTable.purchaseStatus,
      managerSelected: sampleSkuLinesTable.managerSelected,
    })
    .from(sampleSkuLinesTable)
    .where(inArray(sampleSkuLinesTable.sampleOptionId, selectedOptionIds));
  return rows.filter((s) => s.managerSelected);
}

function isSampleSkuEvaluationComplete(sku: {
  anomalyType?: unknown;
  skuConsistentWithImage?: unknown;
  skuMaterialEval?: unknown;
  skuWorkmanshipEval?: unknown;
  skuFunctionEval?: unknown;
}) {
  if (sku.anomalyType) return true;
  return (
    sku.skuConsistentWithImage != null &&
    !!sku.skuMaterialEval &&
    !!sku.skuWorkmanshipEval &&
    !!sku.skuFunctionEval
  );
}

async function validateSamplingReviewReady(productId: string): Promise<string | null> {
  const options = await db
    .select({
      id: sampleOptionsTable.id,
      sampleOrderStatus: sampleOptionsTable.sampleOrderStatus,
    })
    .from(sampleOptionsTable)
    .where(eq(sampleOptionsTable.productId, productId));

  if (options.length < 3) {
    return "Please add at least 3 sample options before submitting review";
  }

  const unevaluated = options.filter((option) => (option.sampleOrderStatus || "pending") !== "evaluated");
  if (unevaluated.length > 0) {
    return "All sample options must be evaluated before submitting review";
  }

  const optionIds = options.map((option) => option.id);
  if (optionIds.length === 0) return null;

  const skuRows = await db
    .select({
      id: sampleSkuLinesTable.id,
      sampleOptionId: sampleSkuLinesTable.sampleOptionId,
      anomalyType: sampleSkuLinesTable.anomalyType,
      skuConsistentWithImage: sampleSkuLinesTable.skuConsistentWithImage,
      skuMaterialEval: sampleSkuLinesTable.skuMaterialEval,
      skuWorkmanshipEval: sampleSkuLinesTable.skuWorkmanshipEval,
      skuFunctionEval: sampleSkuLinesTable.skuFunctionEval,
    })
    .from(sampleSkuLinesTable)
    .where(inArray(sampleSkuLinesTable.sampleOptionId, optionIds));

  const incompleteSku = skuRows.find((sku) => !isSampleSkuEvaluationComplete(sku));
  if (incompleteSku) {
    return "All non-anomaly SKUs must have complete evaluation before submitting review";
  }

  return null;
}

async function validateProductTaskAssignment(taskId: string | null | undefined, employeeId: string | null | undefined) {
  if (!taskId) return null;
  if (!employeeId) {
    return "当前账号缺少员工编号，无法绑定采购任务";
  }

  const [task] = await db
    .select()
    .from(procurementTasksTable)
    .where(eq(procurementTasksTable.id, taskId));

  if (!task) return "采购任务不存在";
  if (task.status !== "published") return "采购任务已关闭，不能在该任务下新建产品目录";
  if (task.assigneeMode === "all") return null;

  const [assignee] = await db
    .select()
    .from(procurementTaskAssigneesTable)
    .where(and(
      eq(procurementTaskAssigneesTable.taskId, taskId),
      eq(procurementTaskAssigneesTable.employeeId, employeeId),
    ));

  return assignee ? null : "该采购任务未分配给当前产品专员";
}

/** 根据经理选中的 SKU 采购状态推导产品主状态（多 SKU 不提前推进） */
function deriveAggregateProductStatus(skuStatuses: string[], currentProductStatus: string): string {
  if (skuStatuses.length === 0) return currentProductStatus;

  if (skuStatuses.some((s) => s === "anomaly_reported")) {
    return "inspection_anomaly";
  }
  if (skuStatuses.some((s) => SKU_ANOMALY_ACTIVE.has(s))) {
    return "anomaly_handling";
  }
  if (skuStatuses.some((s) => s === "anomaly_resolved")) {
    return "anomaly_resolved";
  }
  if (skuStatuses.every((s) => SKU_PASSED.has(s))) {
    return "goods_inspected";
  }
  if (skuStatuses.every((s) => SKU_INSPECTING.has(s))) {
    return "inspecting";
  }
  if (skuStatuses.every((s) => SKU_ARRIVED.has(s))) {
    return "goods_arrived";
  }
  if (skuStatuses.every((s) => SKU_ORDERED.has(s))) {
    return "ordered";
  }
  return "pending_purchase";
}

const PRODUCT_STATUS_RANK: Record<string, number> = {
  pending_purchase: 1,
  ordered: 2,
  goods_arrived: 3,
  inspecting: 4,
  inspecting_anomaly_entry: 4,
  inspection_anomaly: 4,
  anomaly_handling: 4,
  anomaly_resolved: 4,
  goods_inspected: 5,
  completed: 6,
};

function isForwardAggregateTransition(from: string, to: string): boolean {
  if (from === to) return true;
  const fromRank = PRODUCT_STATUS_RANK[from] ?? 0;
  const toRank = PRODUCT_STATUS_RANK[to] ?? 0;
  return toRank >= fromRank;
}

function getShanghaiCodePeriod(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "2-digit",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? String(now.getUTCFullYear()).slice(-2);
  const month = parts.find((part) => part.type === "month")?.value ?? String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}${month}`;
}

async function nextSpuSequence(tx: any, period: string, now: Date) {
  const result = await tx.execute(sql`
    insert into spu_code_counters (period, current_sequence, updated_at)
    values (${period}, 1, ${now})
    on conflict (period)
    do update set
      current_sequence = spu_code_counters.current_sequence + 1,
      updated_at = excluded.updated_at
    returning current_sequence
  `);
  const rows = Array.isArray((result as any)?.rows) ? (result as any).rows : [];
  const sequence = Number(rows[0]?.current_sequence ?? rows[0]?.currentSequence ?? 0);
  if (!Number.isFinite(sequence) || sequence <= 0) {
    throw new Error("SPU code sequence generation failed");
  }
  return sequence;
}

async function ensureSpuCode(
  tx: any,
  productLike: { spuCode?: string | null; spu_code?: string | null; spuCodePeriod?: string | null; spu_code_period?: string | null; spuCodeSequence?: number | null; spu_code_sequence?: number | null; spuCodeAssignedAt?: Date | string | null; spu_code_assigned_at?: Date | string | null },
  now: Date,
) {
  const existingCode = productLike.spuCode ?? productLike.spu_code ?? null;
  if (existingCode) {
    return {
      spuCode: existingCode,
      period: productLike.spuCodePeriod ?? productLike.spu_code_period ?? existingCode.slice(0, 4),
      sequence: Number(productLike.spuCodeSequence ?? productLike.spu_code_sequence ?? existingCode.slice(4)),
      assignedAt: productLike.spuCodeAssignedAt ?? productLike.spu_code_assigned_at ?? now,
      generated: false,
    };
  }

  const period = getShanghaiCodePeriod(now);
  const sequence = await nextSpuSequence(tx, period, now);
  return {
    spuCode: `${period}${sequence}`,
    period,
    sequence,
    assignedAt: now,
    generated: true,
  };
}

type SkuAnomalyHistoryEntry = {
  id: string;
  round: number;
  status: "reported" | "handling" | "processing" | "resolved";
  anomalyType?: string | null;
  anomalyTypes?: string[] | null;
  anomalyNote?: string | null;
  reportedAt?: string | null;
  reportedBy?: string | null;
  handlingMethod?: string | null;
  handlingNote?: string | null;
  handledAt?: string | null;
  handledBy?: string | null;
  startedAt?: string | null;
  startedBy?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
};

function dateToIso(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function normalizeAnomalyTypes(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const items = value.map(String).filter(Boolean);
    return items.length ? items : null;
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return null;
}

function normalizeSkuAnomalyHistory(sku: Record<string, unknown>): SkuAnomalyHistoryEntry[] {
  const raw = sku.anomalyHistory;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item, index) => ({
        id: String(item.id || `${sku.id || "sku"}-anomaly-${index + 1}`),
        round: Number(item.round) || index + 1,
        status: (item.status as SkuAnomalyHistoryEntry["status"]) || "reported",
        anomalyType: (item.anomalyType as string | null | undefined) ?? null,
        anomalyTypes: normalizeAnomalyTypes(item.anomalyTypes ?? item.anomalyType),
        anomalyNote: (item.anomalyNote as string | null | undefined) ?? null,
        reportedAt: (item.reportedAt as string | null | undefined) ?? null,
        reportedBy: (item.reportedBy as string | null | undefined) ?? null,
        handlingMethod: (item.handlingMethod as string | null | undefined) ?? null,
        handlingNote: (item.handlingNote as string | null | undefined) ?? null,
        handledAt: (item.handledAt as string | null | undefined) ?? null,
        handledBy: (item.handledBy as string | null | undefined) ?? null,
        startedAt: (item.startedAt as string | null | undefined) ?? null,
        startedBy: (item.startedBy as string | null | undefined) ?? null,
        resolvedAt: (item.resolvedAt as string | null | undefined) ?? null,
        resolvedBy: (item.resolvedBy as string | null | undefined) ?? null,
      }));
  }

  if (!sku.anomalyType && !sku.anomalyNote && !sku.anomalyHandlingNote && !sku.anomalyReportedAt) {
    return [];
  }

  const purchaseStatus = String(sku.purchaseStatus || "");
  const status: SkuAnomalyHistoryEntry["status"] = sku.anomalyResolvedAt
    ? "resolved"
    : purchaseStatus === "anomaly_processing"
      ? "processing"
      : sku.anomalyHandlingNote || sku.anomalyHandledAt || purchaseStatus === "anomaly_handling"
        ? "handling"
        : "reported";
  const anomalyTypes = normalizeAnomalyTypes(sku.anomalyType);
  return [{
    id: `${sku.id || "sku"}-legacy-anomaly-1`,
    round: 1,
    status,
    anomalyType: anomalyTypes?.[0] ?? null,
    anomalyTypes,
    anomalyNote: (sku.anomalyNote as string | null | undefined) ?? null,
    reportedAt: dateToIso(sku.anomalyReportedAt),
    reportedBy: (sku.anomalyReportedBy as string | null | undefined) ?? null,
    handlingMethod: (sku.anomalyHandlingMethod as string | null | undefined) ?? null,
    handlingNote: (sku.anomalyHandlingNote as string | null | undefined) ?? null,
    handledAt: dateToIso(sku.anomalyHandledAt),
    handledBy: (sku.anomalyHandledBy as string | null | undefined) ?? null,
    resolvedAt: dateToIso(sku.anomalyResolvedAt),
    resolvedBy: null,
  }];
}

function latestOpenAnomalyIndex(history: SkuAnomalyHistoryEntry[]) {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].status !== "resolved") return i;
  }
  return history.length - 1;
}

function buildSkuAnomalyHistory(
  sku: Record<string, unknown>,
  action: string,
  now: Date,
  data: Record<string, unknown>,
  operatorName: string,
) {
  const history = normalizeSkuAnomalyHistory(sku);
  const isoNow = now.toISOString();

  if (action === "report_anomaly") {
    const anomalyTypes = normalizeAnomalyTypes(data.anomalyTypes ?? data.anomalyType);
    const nextRound = history.reduce((max, item) => Math.max(max, Number(item.round) || 0), 0) + 1;
    return [
      ...history,
      {
        id: randomUUID(),
        round: nextRound,
        status: "reported" as const,
        anomalyType: anomalyTypes?.[0] ?? null,
        anomalyTypes,
        anomalyNote: String(data.anomalyNote ?? ""),
        reportedAt: isoNow,
        reportedBy: operatorName,
      },
    ];
  }

  const targetIndex = latestOpenAnomalyIndex(history);
  if (targetIndex < 0) return history;

  return history.map((item, index) => {
    if (index !== targetIndex) return item;
    if (action === "acknowledge_anomaly") {
      return {
        ...item,
        status: "handling" as const,
        handlingMethod: (data.anomalyHandlingMethod as string | null | undefined) ?? null,
        handlingNote: (data.anomalyHandlingNote as string | null | undefined) ?? null,
        handledAt: isoNow,
        handledBy: operatorName,
      };
    }
    if (action === "start_anomaly_handling") {
      return {
        ...item,
        status: "processing" as const,
        startedAt: isoNow,
        startedBy: operatorName,
      };
    }
    if (action === "resolve_anomaly") {
      return {
        ...item,
        status: "resolved" as const,
        resolvedAt: isoNow,
        resolvedBy: operatorName,
      };
    }
    return item;
  });
}

function serializeSkuLine(r: Record<string, unknown>) {
  return {
    ...r,
    skuCode: r.skuCode ?? null,
    skuCodeSuffix: r.skuCodeSuffix != null ? Number(r.skuCodeSuffix) : null,
    skuCodeAssignedAt: r.skuCodeAssignedAt ? (r.skuCodeAssignedAt as Date).toISOString() : null,
    unitPrice: r.unitPrice != null ? Number(r.unitPrice) : null,
    moq: r.moq != null ? Number(r.moq) : null,
    weight: r.weight != null ? Number(r.weight) : null,
    purchaseStatus: (r.purchaseStatus as string) ?? "pending_purchase",
    orderedAt: r.orderedAt ? (r.orderedAt as Date).toISOString() : null,
    arrivedAt: r.arrivedAt ? (r.arrivedAt as Date).toISOString() : null,
    inspectingStartedAt: r.inspectingStartedAt ? (r.inspectingStartedAt as Date).toISOString() : null,
    passedAt: r.passedAt ? (r.passedAt as Date).toISOString() : null,
    completedAt: r.completedAt ? (r.completedAt as Date).toISOString() : null,
    anomalyReportedAt: r.anomalyReportedAt ? (r.anomalyReportedAt as Date).toISOString() : null,
    anomalyHandledAt: r.anomalyHandledAt ? (r.anomalyHandledAt as Date).toISOString() : null,
    anomalyResolvedAt: r.anomalyResolvedAt ? (r.anomalyResolvedAt as Date).toISOString() : null,
    anomalyHistory: normalizeSkuAnomalyHistory(r),
    createdAt: r.createdAt ? (r.createdAt as Date).toISOString() : null,
    updatedAt: r.updatedAt ? (r.updatedAt as Date).toISOString() : null,
  };
}

function calcCosts(product: Record<string, unknown>) {
  const purchasePrice = Number(product.purchasePrice) || 0;
  const weight = Number(product.weight) || 0;
  const length = Number(product.length) || 0;
  const width = Number(product.width) || 0;
  const height = Number(product.height) || 0;
  const suggestedPrice = Number(product.suggestedPrice) || 0;
  const logisticsMode = (product.logisticsMode as string) || "air";

  const volumetricWeight = (length * width * height) / 6000;
  const airFreight = Math.max(weight, volumetricWeight) * 35;
  const volume = (length * width * height) / 1000000;
  const seaFreight = volume * 800;

  const freight = logisticsMode === "sea" ? seaFreight : airFreight;

  const tariff = (purchasePrice + freight) * 0.15;
  const vat = (purchasePrice + freight + tariff) * 0.18;
  const totalTax = tariff + vat;
  const totalCost = purchasePrice + freight + totalTax;
  const grossProfit = suggestedPrice - totalCost;
  const grossMargin = suggestedPrice > 0 ? grossProfit / suggestedPrice : 0;

  return {
    airFreight: round2(airFreight),
    seaFreight: round2(seaFreight),
    tariff: round2(tariff),
    vat: round2(vat),
    totalTax: round2(totalTax),
    totalCost: round2(totalCost),
    grossProfit: round2(grossProfit),
    grossMargin: round2(grossMargin),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function mockAiAnalysis(product: Record<string, unknown>) {
  const category = (product.categoryGuess as string) || "消费品";
  const totalCostRMB = Number(product.totalCost) || 0;
  const exchangeRate = 7.2;
  const costUSD = totalCostRMB / exchangeRate;

  // Compute margin from suggestedPrice (USD) vs totalCost (RMB)
  const suggestedPriceUSD = Number(product.suggestedPrice) || 0;
  let margin = 0;
  if (suggestedPriceUSD > 0 && totalCostRMB > 0) {
    const priceRMB = suggestedPriceUSD * exchangeRate;
    margin = (priceRMB - totalCostRMB) / priceRMB;
  }

  // AI pricing: three margin brackets (45% / 55% / 65%)
  const aiSuggestedPriceMin = costUSD > 0 ? round2(costUSD / (1 - 0.45)) : null;
  const aiRecommendedPrice = costUSD > 0 ? round2(costUSD / (1 - 0.55)) : null;
  const aiSuggestedPriceMax = costUSD > 0 ? round2(costUSD / (1 - 0.65)) : null;
  const aiRecommendedMargin = aiRecommendedPrice && totalCostRMB > 0
    ? round2(((aiRecommendedPrice * exchangeRate - totalCostRMB) / (aiRecommendedPrice * exchangeRate)) * 100)
    : 55.0;

  // Use effective margin: if suggestedPrice present use actual margin, else use AI recommended (55%)
  const effectiveMargin = suggestedPriceUSD > 0 ? margin : 0.55;
  const risk = effectiveMargin > 0.4 ? "低" : effectiveMargin > 0.2 ? "中" : "高";
  const score = Math.min(10, Math.max(1, parseFloat((effectiveMargin * 18 + 0.1).toFixed(1))));

  return {
    aiCategory: category || "家居用品",
    aiHsCode: "3924.10.00 / 3924.90.00",
    aiRiskLevel: risk,
    aiCompetitiveness: score,
    aiRecommended: effectiveMargin > 0.25,
    aiReport: `根据产品属性分析：该产品（${product.productName || ""}）属于${category}类目，市场竞争力评分为 ${score}/10。` +
      `主要风险：${risk === "高" ? "毛利偏低，需优化采购成本或提高售价" : risk === "中" ? "毛利处于合理区间，需关注竞品定价" : "毛利率良好，具备较强竞争力"}。` +
      `建议：${effectiveMargin > 0.3 ? "推荐进入采购阶段，可适当加大备货量。" : "建议进一步核实供应商报价，优化物流方案后再决策。"}` +
      ` HS候选编码适用于合规申报，请在正式采购前核实最终归类。`,
    aiSuggestedPriceMin,
    aiSuggestedPriceMax,
    aiRecommendedPrice,
    aiRecommendedMargin,
  };
}

function addHistory(
  existing: unknown[],
  actor: string,
  action: string,
  fromStatus: string,
  toStatus: string,
  note?: string,
) {
  return [
    ...existing,
    {
      timestamp: new Date().toISOString(),
      actor,
      action,
      fromStatus,
      toStatus,
      note: note || "",
    },
  ];
}

const RESUBMIT_COMPARE_FIELDS: Array<{ key: string; label: string; money?: boolean }> = [
  { key: "productName", label: "产品名称" },
  { key: "productSource", label: "产品来源" },
  { key: "link1688", label: "采购链接" },
  { key: "supplierName", label: "供应商" },
  { key: "purchasePrice", label: "采购价", money: true },
  { key: "moq", label: "MOQ" },
  { key: "weight", label: "重量" },
  { key: "length", label: "长" },
  { key: "width", label: "宽" },
  { key: "height", label: "高" },
  { key: "material", label: "材质" },
  { key: "usage", label: "用途" },
  { key: "suggestedPrice", label: "建议售价" },
  { key: "remarks", label: "备注" },
  { key: "logisticsMode", label: "物流方式" },
];

function normalizeCompareValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  return String(value).trim();
}

function formatCompareValue(value: unknown, money?: boolean) {
  const normalized = normalizeCompareValue(value);
  if (!normalized) return "空";
  const n = Number(normalized);
  if (money && Number.isFinite(n)) return `¥${n.toFixed(2)}`;
  return normalized;
}

function buildResubmitChangeNote(existing: Record<string, unknown>, data: Record<string, unknown>) {
  const lines: string[] = [];
  for (const field of RESUBMIT_COMPARE_FIELDS) {
    if (!(field.key in data)) continue;
    const before = normalizeCompareValue(existing[field.key]);
    const after = normalizeCompareValue(data[field.key]);
    if (before !== after) {
      lines.push(`- ${field.label}：${formatCompareValue(existing[field.key], field.money)} → ${formatCompareValue(data[field.key], field.money)}`);
    }
  }
  return lines.length > 0
    ? ["【本次修改】", ...lines].join("\n")
    : "【本次修改】未检测到产品基础字段变化";
}

function serializeProduct(p: Record<string, unknown>) {
  return {
    ...p,
    spuCode: p.spuCode ?? null,
    spuCodePeriod: p.spuCodePeriod ?? null,
    spuCodeSequence: p.spuCodeSequence != null ? Number(p.spuCodeSequence) : null,
    spuCodeAssignedAt: p.spuCodeAssignedAt ? (p.spuCodeAssignedAt as Date).toISOString() : null,
    purchasePrice: p.purchasePrice != null ? Number(p.purchasePrice) : null,
    moq: p.moq != null ? Number(p.moq) : null,
    weight: p.weight != null ? Number(p.weight) : null,
    length: p.length != null ? Number(p.length) : null,
    width: p.width != null ? Number(p.width) : null,
    height: p.height != null ? Number(p.height) : null,
    boxQuantity: p.boxQuantity != null ? Number(p.boxQuantity) : null,
    airFreight: p.airFreight != null ? Number(p.airFreight) : null,
    seaFreight: p.seaFreight != null ? Number(p.seaFreight) : null,
    tariff: p.tariff != null ? Number(p.tariff) : null,
    vat: p.vat != null ? Number(p.vat) : null,
    totalTax: p.totalTax != null ? Number(p.totalTax) : null,
    totalCost: p.totalCost != null ? Number(p.totalCost) : null,
    grossProfit: p.grossProfit != null ? Number(p.grossProfit) : null,
    grossMargin: p.grossMargin != null ? Number(p.grossMargin) : null,
    suggestedPrice: p.suggestedPrice != null ? Number(p.suggestedPrice) : null,
    aiCompetitiveness: p.aiCompetitiveness != null ? Number(p.aiCompetitiveness) : null,
    aiSuggestedPriceMin: p.aiSuggestedPriceMin != null ? Number(p.aiSuggestedPriceMin) : null,
    aiSuggestedPriceMax: p.aiSuggestedPriceMax != null ? Number(p.aiSuggestedPriceMax) : null,
    aiRecommendedPrice: p.aiRecommendedPrice != null ? Number(p.aiRecommendedPrice) : null,
    aiRecommendedMargin: p.aiRecommendedMargin != null ? Number(p.aiRecommendedMargin) : null,
    samplingStartedBy: p.samplingStartedBy ?? null,
    samplingStartedAt: p.samplingStartedAt ? (p.samplingStartedAt as Date).toISOString() : null,
    sampleArrivedAt: p.sampleArrivedAt ? (p.sampleArrivedAt as Date).toISOString() : null,
    sampleConsistentWithImage: p.sampleConsistentWithImage ?? null,
    sampleMaterialEval: p.sampleMaterialEval ?? null,
    sampleWorkmanshipEval: p.sampleWorkmanshipEval ?? null,
    sampleFunctionEval: p.sampleFunctionEval ?? null,
    sampleRemarks: p.sampleRemarks ?? null,
    sampleReviewedBy: p.sampleReviewedBy ?? null,
    sampleReviewedAt: p.sampleReviewedAt ? (p.sampleReviewedAt as Date).toISOString() : null,
    purchaseQuantity: p.purchaseQuantity != null ? Number(p.purchaseQuantity) : null,
    supplierChangeCount: p.supplierChangeCount != null ? Number(p.supplierChangeCount) : 0,
    previousSupplierName: p.previousSupplierName ?? null,
    previousPurchasePrice: p.previousPurchasePrice != null ? Number(p.previousPurchasePrice) : null,
    previousMoq: p.previousMoq != null ? Number(p.previousMoq) : null,
    orderedAt: p.orderedAt ? (p.orderedAt as Date).toISOString() : null,
    goodsArrivedAt: p.goodsArrivedAt ? (p.goodsArrivedAt as Date).toISOString() : null,
    inspectingStartedAt: p.inspectingStartedAt ? (p.inspectingStartedAt as Date).toISOString() : null,
    goodsInspectedAt: p.goodsInspectedAt ? (p.goodsInspectedAt as Date).toISOString() : null,
    goodsInspectionNote: p.goodsInspectionNote ?? null,
    anomalyTypes: p.anomalyTypes ?? null,
    anomalyQuantity: p.anomalyQuantity != null ? Number(p.anomalyQuantity) : null,
    anomalySeverity: p.anomalySeverity ?? null,
    anomalyNote: p.anomalyNote ?? null,
    anomalyReportedAt: p.anomalyReportedAt ? (p.anomalyReportedAt as Date).toISOString() : null,
    anomalyReportedBy: p.anomalyReportedBy ?? null,
    anomalyHandlingMethod: p.anomalyHandlingMethod ?? null,
    anomalyHandlingNote: p.anomalyHandlingNote ?? null,
    anomalyHandledBy: p.anomalyHandledBy ?? null,
    anomalyHandledAt: p.anomalyHandledAt ? (p.anomalyHandledAt as Date).toISOString() : null,
    anomalyResolvedAt: p.anomalyResolvedAt ? (p.anomalyResolvedAt as Date).toISOString() : null,
    anomalyResolvedBy: p.anomalyResolvedBy ?? null,
    completedAt: p.completedAt ? (p.completedAt as Date).toISOString() : null,
    enteredEndedAt: p.enteredEndedAt ? (p.enteredEndedAt as Date).toISOString() : null,
    enteredPurchaseAt: p.enteredPurchaseAt ? (p.enteredPurchaseAt as Date).toISOString() : null,
    historyLog: p.historyLog || [],
  };
}

router.get("/products", authenticate, async (req, res) => {
  const query = ListProductsQueryParams.safeParse(req.query);
  const rows = await db.select().from(productsTable);
  let filtered = rows;
  if (query.success && query.data.status) {
    filtered = rows.filter((r) => r.status === query.data.status);
  }
  if (query.success && query.data.submittedBy) {
    filtered = filtered.filter(
      (r) => r.submitterName === query.data.submittedBy,
    );
  }
  // 数据权限过滤：product_specialist只能看到自己的产品
  const employeeIdFilter = typeof req.query.employeeId === "string" ? req.query.employeeId.trim() : "";
  if (employeeIdFilter && canSeeAllProducts(req)) {
    filtered = filtered.filter((r) => r.employeeId === employeeIdFilter);
  }
  if (req.user?.role === "product_specialist") {
    filtered = filtered.filter((r) => r.employeeId === req.user?.employeeId);
  }
  res.json(filtered.map((r) => serializeProduct(r as Record<string, unknown>)));
});

router.post("/products", async (req, res) => {
  const body = CreateProductBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const data = { ...body.data };
  if (req.user?.role === "product_specialist") {
    data.submitterName = req.user.name;
    data.employeeId = req.user.employeeId;
  }

  const now = new Date();
  const id = randomUUID();

  const taskError = await validateProductTaskAssignment(data.taskId, data.employeeId);
  if (taskError) {
    res.status(400).json({ error: taskError });
    return;
  }

  let createAction: ProductAction;
  switch (data.action) {
    case "pending_info":
      createAction = "create_pending_info";
      break;
    case "submit_analysis":
      createAction = "create_submit_analysis";
      break;
    default:
      createAction = "create_draft";
  }
  let finalStatus: string;
  try {
    finalStatus = assertTransitOrThrow("__new__", createAction);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }

  const costs = calcCosts(data as Record<string, unknown>);
  const ai = data.action === "submit_analysis"
    ? mockAiAnalysis({ ...data, ...costs } as Record<string, unknown>)
    : {};

  const historyLog = [
    {
      timestamp: now.toISOString(),
      actor: data.submitterName,
      action: "创建产品",
      fromStatus: "",
      toStatus: finalStatus,
      note: "",
    },
  ];

  await db.insert(productsTable).values({
    id,
    status: finalStatus,
    submitterName: data.submitterName,
    employeeId: data.employeeId,
    department: data.department,
    taskId: data.taskId || null,
    productName: data.productName,
    productSource: data.productSource,
    link1688: data.link1688,
    imageUrl: data.imageUrl,
    supplierName: data.supplierName,
    contactStatus: data.contactStatus,
    purchasePrice: data.purchasePrice?.toString(),
    moq: data.moq != null ? Math.round(Number(data.moq)) : null,
    weight: data.weight?.toString(),
    length: data.length?.toString(),
    width: data.width?.toString(),
    height: data.height?.toString(),
    boxQuantity: data.boxQuantity,
    packagingNote: data.packagingNote,
    material: data.material,
    usage: data.usage,
    categoryGuess: data.categoryGuess,
    suggestedPrice: data.suggestedPrice?.toString(),
    remarks: data.remarks,
    logisticsMode: data.logisticsMode || "air",
    ...Object.fromEntries(
      Object.entries(costs).map(([k, v]) => [k, v?.toString()]),
    ),
    ...(ai as Record<string, unknown>),
    createdBy: data.submitterName,
    createdAt: now,
    updatedBy: data.submitterName,
    updatedAt: now,
    analysisSubmittedAt: data.action === "submit_analysis" ? now : undefined,
    historyLog,
  });

  // Auto-create initial SampleOption + SampleSkuLine(s) for every new product
  // Wrapped in try/catch so a sample-data failure never rolls back the product itself
  try {
    const rawSkus: Array<{ skuName?: string; unitPrice?: number; moq?: number; notes?: string; imageUrl?: string | null }> =
      Array.isArray(req.body.skus) && req.body.skus.length > 0 ? req.body.skus : [];

    const soId = randomUUID();
    await db.insert(sampleOptionsTable).values({
      id: soId,
      productId: id,
      status: "draft",
      optionLabel: "初始方案",
      supplierName: data.supplierName || null,
      link1688: data.link1688 || null,
      contactStatus: data.contactStatus || null,
      material: data.material || null,
      packagingNote: data.packagingNote || null,
      remarks: data.remarks || null,
      createdBy: data.submitterName,
      createdAt: now,
      updatedAt: now,
    });

    const skusToCreate: Array<{ skuName?: string; unitPrice?: number; moq?: number; notes?: string; imageUrl?: string | null }> = rawSkus.length > 0
      ? rawSkus
      : [{ skuName: "默认款", unitPrice: data.purchasePrice, moq: data.moq, notes: "", imageUrl: null }];

    const createdSkuIds: Array<{ id: string; imageUrl: string | null }> = [];
    for (const sku of skusToCreate) {
      const skuId = randomUUID();
      await db.insert(sampleSkuLinesTable).values({
        id: skuId,
        sampleOptionId: soId,
        skuName: sku.skuName || "默认款",
        unitPrice: sku.unitPrice != null ? String(sku.unitPrice)
          : (data.purchasePrice != null ? String(data.purchasePrice) : null),
        moq: sku.moq != null ? Number(sku.moq)
          : (data.moq != null ? Number(data.moq) : null),
        notes: sku.notes || null,
        imageUrl: sku.imageUrl || null,
        recommended: false,
        createdAt: now,
        updatedAt: now,
      });
      createdSkuIds.push({ id: skuId, imageUrl: sku.imageUrl || null });
    }

    // 批量抓取 SKU 图片（并行 allSettled，失败不阻断）
    const skusWithImages = createdSkuIds.filter(s => !!s.imageUrl);
    if (skusWithImages.length > 0) {
      const hostedUrls = await fetchAndStoreImages(
        skusWithImages.map(s => ({
          url: s.imageUrl!,
          gcsPath: `products/${id}/sku-${s.id}`,
        }))
      );
      for (let i = 0; i < skusWithImages.length; i++) {
        if (hostedUrls[i]) {
          await db.update(sampleSkuLinesTable)
            .set({ hostedImageUrl: hostedUrls[i] })
            .where(eq(sampleSkuLinesTable.id, skusWithImages[i].id));
        }
      }
    }
  } catch (sampleErr) {
    console.error("Failed to create sample option/sku lines for product", id, sampleErr);
  }

  // 抓取产品主图（失败不阻断主流程）
  if (data.imageUrl) {
    try {
      const hostedUrl = await fetchAndStoreImage(data.imageUrl, `products/${id}/main`);
      if (hostedUrl) {
        await db.update(productsTable)
          .set({ hostedImageUrl: hostedUrl })
          .where(eq(productsTable.id, id));
      }
    } catch {
      // 静默跳过
    }
  }

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, id));
  res.status(201).json(serializeProduct(product as Record<string, unknown>));
});

router.get("/products/:id", async (req, res) => {
  const productId = String(req.params.id);
  const product = await loadProductForAccess(req, res, productId);
  if (!product) {
    return;
  }
  res.json(serializeProduct(product as Record<string, unknown>));
});

router.put("/products/:id", async (req, res) => {
  const productId = String(req.params.id);
  const body = UpdateProductBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const data = body.data as typeof body.data & { action?: string; comment?: string };
  if ((data.action === "return" || data.action === "reject") && !data.comment?.trim()) {
    res.status(400).json({ error: data.action === "return" ? "请填写退回补充原因" : "请填写拒绝原因" });
    return;
  }

  const existing = await loadProductForAccess(req, res, productId);
  if (!existing) {
    return;
  }
  if (req.user?.role === "product_specialist") {
    data.submitterName = existing.submitterName;
    data.employeeId = existing.employeeId;
  }

  if (data.taskId !== undefined || data.employeeId !== undefined) {
    const taskError = await validateProductTaskAssignment(
      data.taskId ?? existing.taskId,
      data.employeeId ?? existing.employeeId,
    );
    if (taskError) {
      res.status(400).json({ error: taskError });
      return;
    }
  }

  const now = new Date();
  const merged = { ...existing, ...data };
  const costs = calcCosts(merged as Record<string, unknown>);

  let newStatus: string = existing.status;
  if (data.action) {
    let updateAction: ProductAction | null = null;
    switch (data.action) {
      case "pending_info":
        updateAction = "update_pending_info";
        break;
      case "submit_analysis":
        updateAction = "update_submit_analysis";
        break;
      case "save_draft":
        // 保存草稿回到待处理区，状态设为returned
        updateAction = null;
        newStatus = "returned";
        break;
      case "resubmit_screening":
        // 重新提交初筛：状态直接设为screening_submitted，不走状态机
        updateAction = null;
        newStatus = "screening_submitted";
        break;
      case "draft":
        updateAction = "update_draft";
        break;
      default:
        updateAction = null;
    }
    if (updateAction) {
      try {
        newStatus = assertTransitOrThrow(existing.status as ProductFromStatus, updateAction);
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
        return;
      }
    }
  }

  const ai = data.action === "submit_analysis"
    ? mockAiAnalysis({ ...merged, ...costs } as Record<string, unknown>)
    : {};

  const isReturnedAnalysisResubmit = data.action === "submit_analysis" && existing.status === "returned";
  const historyAction =
    isReturnedAnalysisResubmit ? "重新提交AI分析"
    : data.action === "submit_analysis" ? "提交分析"
    : data.action === "pending_info" ? "标记待补充"
    : data.action === "resubmit_screening" ? "重新提交初筛"
    : "更新信息";
  const historyNote = isReturnedAnalysisResubmit
    ? buildResubmitChangeNote(existing as Record<string, unknown>, data as Record<string, unknown>)
    : undefined;

  const historyLog = addHistory(
    (existing.historyLog as unknown[]) || [],
    data.submitterName || existing.submitterName,
    historyAction,
    existing.status,
    newStatus,
    historyNote,
  );

  await db
    .update(productsTable)
    .set({
      status: newStatus,
      resubmitted: (data.action === "resubmit_screening" || isReturnedAnalysisResubmit) ? true : (existing.resubmitted || false),
      screeningSubmittedAt: data.action === "resubmit_screening" ? now : existing.screeningSubmittedAt,
      screeningSubmittedBy: data.action === "resubmit_screening" ? (data.submitterName || existing.submitterName) : existing.screeningSubmittedBy,
      submitterName: data.submitterName ?? existing.submitterName,
      employeeId: data.employeeId ?? existing.employeeId,
      department: data.department ?? existing.department,
      taskId: data.taskId ?? existing.taskId,
      productName: data.productName ?? existing.productName,
      productSource: data.productSource ?? existing.productSource,
      link1688: data.link1688 ?? existing.link1688,
      imageUrl: data.imageUrl ?? existing.imageUrl,
      supplierName: data.supplierName ?? existing.supplierName,
      contactStatus: data.contactStatus ?? existing.contactStatus,
      purchasePrice: data.purchasePrice?.toString() ?? existing.purchasePrice,
      moq: data.moq != null ? Math.round(Number(data.moq)) : (existing.moq ?? null),
      weight: data.weight?.toString() ?? existing.weight,
      length: data.length?.toString() ?? existing.length,
      width: data.width?.toString() ?? existing.width,
      height: data.height?.toString() ?? existing.height,
      boxQuantity: data.boxQuantity ?? existing.boxQuantity,
      packagingNote: data.packagingNote ?? existing.packagingNote,
      material: data.material ?? existing.material,
      usage: data.usage ?? existing.usage,
      categoryGuess: data.categoryGuess ?? existing.categoryGuess,
      suggestedPrice: data.suggestedPrice?.toString() ?? existing.suggestedPrice,
      remarks: data.remarks ?? existing.remarks,
      logisticsMode: data.logisticsMode ?? existing.logisticsMode,
      ...Object.fromEntries(
        Object.entries(costs).map(([k, v]) => [k, v?.toString()]),
      ),
      ...(ai as Record<string, unknown>),
      updatedBy: data.submitterName || existing.submitterName,
      updatedAt: now,
      analysisSubmittedAt: data.action === "submit_analysis" ? now : existing.analysisSubmittedAt,
      historyLog,
    })
    .where(eq(productsTable.id, productId));

  // 主图变更时重新抓取（imageUrl 有变化才触发）
  if (data.imageUrl && data.imageUrl !== existing.imageUrl) {
    try {
      const hostedUrl = await fetchAndStoreImage(
        data.imageUrl,
        `products/${req.params.id}/main`
      );
      if (hostedUrl) {
        await db.update(productsTable)
          .set({ hostedImageUrl: hostedUrl })
          .where(eq(productsTable.id, productId));
      }
    } catch {
      // 静默跳过
    }
  }

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, productId));
  res.json(serializeProduct(product as Record<string, unknown>));
});

// Safe alias (avoids ad-blocker keyword "analyze"); old path kept for backward compat
async function handleRunAnalysis(req: import("express").Request, res: import("express").Response) {
  const existing = await loadProductForAccess(req, res, String(req.params.id));
  if (!existing) {
    return;
  }

  const costs = calcCosts(existing as Record<string, unknown>);
  const ai = mockAiAnalysis({ ...existing, ...costs } as Record<string, unknown>);
  const now = new Date();
  let nextStatus: string;
  try {
    nextStatus = assertTransitOrThrow(existing.status as ProductFromStatus, "run_analysis");
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }

  const historyLog = addHistory(
    (existing.historyLog as unknown[]) || [],
    existing.submitterName,
    "重新分析",
    existing.status,
    nextStatus,
  );

  await db
    .update(productsTable)
    .set({
      status: nextStatus,
      ...Object.fromEntries(
        Object.entries(costs).map(([k, v]) => [k, v?.toString()]),
      ),
      ...(ai as Record<string, unknown>),
      updatedAt: now,
      analysisSubmittedAt: now,
      historyLog,
    })
    .where(eq(productsTable.id, String(req.params.id)));

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, String(req.params.id)));
  res.json(serializeProduct(product as Record<string, unknown>));
}

router.post("/products/:id/run-analysis", handleRunAnalysis);
router.post("/products/:id/analyze", handleRunAnalysis);

router.post("/products/:id/submit-screening", async (req, res) => {
  const body = SubmitScreeningBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const existing = await loadProductForAccess(req, res, String(req.params.id));
  if (!existing) {
    return;
  }

  const now = new Date();
  const submitterName = req.user?.role === "product_specialist" ? req.user.name : body.data.submitterName;
  let nextStatus: string;
  try {
    const action = (existing.status === "completed" || existing.status === "rejected" || existing.status === "returned") ? "resubmit_screening" : "submit_screening";
    nextStatus = assertTransitOrThrow(existing.status as ProductFromStatus, action);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }
  const historyLog = addHistory(
    (existing.historyLog as unknown[]) || [],
    submitterName,
    "提交初筛",
    existing.status,
    nextStatus,
    body.data.employeeNote,
  );

  // 如果是重新提交，设置resubmitted标记
  const resubmittedFlag = (existing.status === "completed" || existing.status === "rejected" || existing.status === "returned");

  await db
    .update(productsTable)
    .set({
      status: nextStatus,
      employeeNote: body.data.employeeNote,
      screeningSubmittedBy: submitterName,
      screeningSubmittedAt: now,
      resubmitted: resubmittedFlag ? true : existing.resubmitted,
      updatedAt: now,
      historyLog,
    })
    .where(eq(productsTable.id, String(req.params.id)));

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, String(req.params.id)));
  res.json(serializeProduct(product as Record<string, unknown>));
});

router.post("/products/:id/manager-action", async (req, res) => {
  // Role enforcement: only product_manager may perform manager actions
  const operatorRole = req.user?.role;
  if (operatorRole !== "product_manager") {
    res.status(403).json({
      error: "权限不足：此操作需要产品经理权限，产品专员无法执行审批决策",
    });
    return;
  }

  const body = ManagerActionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, String(req.params.id)));
  if (!existing) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  if (!canAccessProduct(req, existing)) {
    sendProductAccessDenied(res);
    return;
  }

  const now = new Date();
  let newStatus: string;
  let actionLabel: string;
  let transitionAction: ProductAction;

  switch (body.data.action) {
    case "approve":
      transitionAction = "manager_approve";
      actionLabel = "管理层通过初筛，进入采样阶段";
      break;
    case "reject":
      transitionAction = "manager_reject";
      actionLabel = "管理层拒绝（待员工确认）";
      break;
    case "return":
      transitionAction = "manager_return";
      actionLabel = "退回补充";
      break;
    default:
      res.status(400).json({ error: "Invalid action" });
      return;
  }
  try {
    newStatus = assertTransitOrThrow(existing.status as ProductFromStatus, transitionAction);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }

  const managerHistoryLog = addHistory(
    (existing.historyLog as unknown[]) || [],
    body.data.managerName,
    actionLabel,
    existing.status,
    newStatus,
    body.data.comment,
  );

  const managerUpdates: Record<string, unknown> = {
    status: newStatus,
    managerReviewedBy: body.data.managerName,
    managerReviewedAt: now,
    managerComment: body.data.comment,
    updatedAt: now,
    historyLog: managerHistoryLog,
  };

  await db
    .update(productsTable)
    .set(managerUpdates)
    .where(eq(productsTable.id, String(req.params.id)));

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, String(req.params.id)));
  res.json(serializeProduct(product as Record<string, unknown>));
});

// Actions within sample-action that require product_manager role
const MANAGER_ONLY_SAMPLE_ACTIONS = new Set([
  "approve_purchase",
  "change_supplier",
  "abandon",
  "acknowledge_anomaly",
  "accept_goods",
  "terminate_order",
  "accept_exception",
  "reorder_exception",
  "terminate_exception",
]);

const SKU_PURCHASE_TRANSITIONS: Record<string, {
  from: string[];
  to: string;
  productAction: ProductAction;
  label: string;
  skuUpdates: (now: Date, data: Record<string, unknown>, operatorName: string) => Record<string, unknown>;
}> = {
  confirm_order: {
    from: ["pending_purchase"],
    to: "ordered",
    productAction: "confirm_order",
    label: "确认已下单",
    skuUpdates: (now) => ({ purchaseStatus: "ordered", orderedAt: now, updatedAt: now }),
  },
  mark_arrived: {
    from: ["ordered"],
    to: "arrived",
    productAction: "mark_arrived",
    label: "标记货物已到",
    skuUpdates: (now) => ({ purchaseStatus: "arrived", arrivedAt: now, updatedAt: now }),
  },
  start_inspection: {
    from: ["arrived", "anomaly_resolved"],
    to: "inspecting",
    productAction: "start_inspection",
    label: "开始验货",
    skuUpdates: (now) => ({ purchaseStatus: "inspecting", inspectingStartedAt: now, updatedAt: now }),
  },
  pass_inspection: {
    from: ["inspecting"],
    to: "passed",
    productAction: "pass_inspection",
    label: "验货通过",
    skuUpdates: (now) => ({ purchaseStatus: "passed", passedAt: now, updatedAt: now }),
  },
  report_anomaly: {
    from: ["inspecting"],
    to: "anomaly_reported",
    productAction: "report_anomaly",
    label: "报告验货异常",
    skuUpdates: (now, data, operatorName) => ({
      purchaseStatus: "anomaly_reported",
      anomalyType: Array.isArray(data.anomalyTypes) ? data.anomalyTypes[0] : data.anomalyTypes ?? null,
      anomalyNote: data.anomalyNote ?? null,
      anomalyReportedAt: now,
      anomalyReportedBy: operatorName,
      updatedAt: now,
    }),
  },
  acknowledge_anomaly: {
    from: ["anomaly_reported"],
    to: "anomaly_handling",
    productAction: "acknowledge_anomaly",
    label: "管理层确认处理方案",
    skuUpdates: (now, data, operatorName) => ({
      purchaseStatus: "anomaly_handling",
      anomalyHandlingMethod: data.anomalyHandlingMethod ?? null,
      anomalyHandlingNote: data.anomalyHandlingNote ?? null,
      anomalyHandledBy: operatorName,
      anomalyHandledAt: now,
      updatedAt: now,
    }),
  },
  start_anomaly_handling: {
    from: ["anomaly_handling"],
    to: "anomaly_processing",
    productAction: "start_anomaly_handling",
    label: "开始执行异常处理方案",
    skuUpdates: (now) => ({ purchaseStatus: "anomaly_processing", updatedAt: now }),
  },
  resolve_anomaly: {
    from: ["anomaly_processing"],
    to: "anomaly_resolved",
    productAction: "resolve_anomaly",
    label: "确认异常处理完毕",
    skuUpdates: (now) => ({ purchaseStatus: "anomaly_resolved", anomalyResolvedAt: now, updatedAt: now }),
  },
};

async function handleSkuPurchaseAction(
  req: any,
  res: any,
  existing: typeof productsTable.$inferSelect,
  action: string,
  skuLineId: string,
  data: Record<string, unknown>,
  operatorName: string,
) {
  const rule = SKU_PURCHASE_TRANSITIONS[action];
  if (!rule) return false;

  const now = new Date();

  if (action === "acknowledge_anomaly" && !String(data.anomalyHandlingNote ?? "").trim()) {
    res.status(400).json({ error: "请填写该 SKU 的异常处理意见" });
    return true;
  }

  const result = await db.transaction(async (tx) => {
    const options = await tx
      .select({
        id: sampleOptionsTable.id,
        selectedAt: sampleOptionsTable.selectedAt,
      })
      .from(sampleOptionsTable)
      .where(eq(sampleOptionsTable.productId, existing.id));
    const optionIds = options.map((o) => o.id);
    if (optionIds.length === 0) {
      return { errorStatus: 404, error: "该产品没有采购方案" };
    }

    const [sku] = await tx
      .select()
      .from(sampleSkuLinesTable)
      .where(eq(sampleSkuLinesTable.id, skuLineId));
    if (!sku || !optionIds.includes(sku.sampleOptionId)) {
      return { errorStatus: 404, error: "SKU line not found for product" };
    }

    const currentSkuStatus = (sku.purchaseStatus as string) || "pending_purchase";
    if (!rule.from.includes(currentSkuStatus)) {
      return {
        errorStatus: 409,
        error: `SKU状态不允许执行该操作：action=${action}, current=${currentSkuStatus}, allowed=${rule.from.join(",")}`,
      };
    }

    const selectedOptionIds = options.filter((o) => o.selectedAt != null).map((o) => o.id);
    const selectedSkus = selectedOptionIds.length > 0
      ? await tx
        .select({
          id: sampleSkuLinesTable.id,
          purchaseStatus: sampleSkuLinesTable.purchaseStatus,
          managerSelected: sampleSkuLinesTable.managerSelected,
        })
        .from(sampleSkuLinesTable)
        .where(inArray(sampleSkuLinesTable.sampleOptionId, selectedOptionIds))
      : [];
    const managerSelectedSkus = selectedSkus.filter((s) => s.managerSelected);
    const skuStatuses = managerSelectedSkus.map((s) =>
      s.id === skuLineId ? rule.to : ((s.purchaseStatus as string) || "pending_purchase"),
    );

    let nextProductStatus: string;
    if (action === "start_anomaly_handling") {
      if (!["inspection_anomaly", "anomaly_handling"].includes(existing.status)) {
        return { errorStatus: 400, error: `Invalid transition: action=${action}, from=${existing.status}, allowedFrom=inspection_anomaly,anomaly_handling` };
      }
      nextProductStatus = deriveAggregateProductStatus(skuStatuses, existing.status);
    } else if (action === "resolve_anomaly") {
      if (!["inspection_anomaly", "anomaly_handling"].includes(existing.status)) {
        return { errorStatus: 400, error: `Invalid transition: action=${action}, from=${existing.status}, allowedFrom=inspection_anomaly,anomaly_handling` };
      }
      nextProductStatus = deriveAggregateProductStatus(skuStatuses, existing.status);
    } else {
      nextProductStatus = deriveAggregateProductStatus(skuStatuses, existing.status);
      if (!isForwardAggregateTransition(existing.status, nextProductStatus)) {
        nextProductStatus = existing.status;
      }
    }

    const productUpdates: Record<string, unknown> = {};
    if (action === "confirm_order") productUpdates.orderedAt = now;
    if (action === "mark_arrived") productUpdates.goodsArrivedAt = now;
    if (action === "start_inspection") productUpdates.inspectingStartedAt = now;
    if (action === "pass_inspection") {
      productUpdates.goodsInspectedAt = now;
      productUpdates.goodsInspectionNote = data.goodsInspectionNote ?? null;
    }
    if (action === "report_anomaly") {
      productUpdates.anomalyTypes = data.anomalyTypes ?? null;
      productUpdates.anomalyQuantity = data.anomalyQuantity != null ? Number(data.anomalyQuantity) : null;
      productUpdates.anomalySeverity = data.anomalySeverity ?? null;
      productUpdates.anomalyNote = data.anomalyNote ?? null;
      productUpdates.anomalyReportedAt = now;
      productUpdates.anomalyReportedBy = operatorName;
    }
    if (action === "acknowledge_anomaly") {
      productUpdates.anomalyHandlingMethod = data.anomalyHandlingMethod ?? null;
      productUpdates.anomalyHandlingNote = data.anomalyHandlingNote ?? null;
      productUpdates.anomalyHandledBy = operatorName;
      productUpdates.anomalyHandledAt = now;
    }
    if (action === "resolve_anomaly") {
      productUpdates.anomalyResolvedAt = now;
      productUpdates.anomalyResolvedBy = operatorName;
    }

    const historyLog = addHistory(
      (existing.historyLog as unknown[]) || [],
      operatorName,
      rule.label,
      existing.status,
      nextProductStatus,
      (data.comment as string) ?? undefined,
    );

    const skuUpdates = {
      ...rule.skuUpdates(now, data, operatorName),
      anomalyHistory: buildSkuAnomalyHistory(sku as Record<string, unknown>, action, now, data, operatorName),
    };

    await tx.update(sampleSkuLinesTable)
      .set(skuUpdates as any)
      .where(eq(sampleSkuLinesTable.id, skuLineId));

    await tx.update(productsTable)
      .set({
        status: nextProductStatus,
        ...productUpdates,
        updatedAt: now,
        historyLog,
      } as any)
      .where(eq(productsTable.id, existing.id));

    const [updatedProduct] = await tx.select().from(productsTable).where(eq(productsTable.id, existing.id));
    const [updatedSku] = await tx.select().from(sampleSkuLinesTable).where(eq(sampleSkuLinesTable.id, skuLineId));
    return { product: updatedProduct, sku: updatedSku };
  });

  if ("error" in result) {
    res.status(result.errorStatus).json({ error: result.error });
    return true;
  }

  res.json({
    ...serializeProduct(result.product as Record<string, unknown>),
    updatedSku: serializeSkuLine(result.sku as Record<string, unknown>),
  });
  return true;
}

router.post("/products/:id/sample-action", async (req, res) => {
  const { action, skuLineId, ...data } = req.body as Record<string, unknown>;
  const operatorName = req.user!.name;
  const operatorRole = req.user!.role;

  if (!action) {
    res.status(400).json({ error: "action is required" });
    return;
  }

  // Role enforcement for manager-only actions
  if (MANAGER_ONLY_SAMPLE_ACTIONS.has(action as string) && operatorRole !== "product_manager") {
    res.status(403).json({
      error: `权限不足：操作「${action}」需要产品经理权限，产品专员无法执行此决策`,
    });
    return;
  }

  const [existing] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, String(req.params.id)));
  if (!existing) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  if (!canAccessProduct(req, existing)) {
    sendProductAccessDenied(res);
    return;
  }

  const now = new Date();
  let newStatus: string;
  let actionLabel: string;
  let transitionAction: ProductAction;
  const updates: Record<string, unknown> = {};
  let updatedSkuLineId: string | undefined;

  if (skuLineId && typeof skuLineId === "string" && SKU_PURCHASE_TRANSITIONS[action as string]) {
    const handled = await handleSkuPurchaseAction(
      req,
      res,
      existing,
      action as string,
      skuLineId,
      data,
      operatorName,
    );
    if (handled) return;
  }

  switch (action) {
    // ── 采样阶段 ──────────────────────────────────────────────────────────────
    case "start":
      // pending_sampling → sampling: 员工确认采样，联系供应商
      transitionAction = "start";
      actionLabel = "确认采样（联系供应商）";
      updates.samplingStartedBy = operatorName;
      updates.samplingStartedAt = now;
      break;
    case "start_sampling_collection":
      // pending_sampling → sampling_collection: 员工开始采样建档（多方案模式）
      transitionAction = "start_sampling_collection";
      actionLabel = "开始采样建档";
      updates.samplingStartedBy = operatorName;
      updates.samplingStartedAt = now;
      break;
    case "submit_sampling_review":
      // sampling_collection → sampling_review_submitted: 员工提交所有方案验样评价
      transitionAction = "submit_sampling_review";
      // 校验方案数量至少3个
      const readinessError = await validateSamplingReviewReady(existing.id);
      if (readinessError) {
        res.status(400).json({ error: readinessError });
        return;
      }
      actionLabel = "提交验样结果";
      updates.sampleReviewedBy = operatorName;
      updates.sampleReviewedAt = now;
      break;
    case "arrive":
      // sampling → sample_arrived: 员工标记样品已到，此前禁止填写评价
      transitionAction = "arrive";
      actionLabel = "标记样品已到";
      updates.sampleArrivedAt = now;
      break;
    case "start_review":
      // sample_arrived → sample_reviewing: 员工开始填写验样评价表（持久化，刷新后保留）
      transitionAction = "start_review";
      actionLabel = "开始验样";
      break;
    case "cancel_review":
      // sample_reviewing → sample_arrived: 员工取消填写，退回到"已到样"等待状态
      transitionAction = "cancel_review";
      actionLabel = "取消验样（退回）";
      break;
    case "submit":
      // sample_reviewing → sample_reviewed: 员工完成验样并提交评价表
      transitionAction = "submit";
      actionLabel = "提交验样结果";
      updates.sampleConsistentWithImage = data.sampleConsistentWithImage ?? null;
      updates.sampleMaterialEval = data.sampleMaterialEval ?? null;
      updates.sampleWorkmanshipEval = data.sampleWorkmanshipEval ?? null;
      updates.sampleFunctionEval = data.sampleFunctionEval ?? null;
      updates.sampleRemarks = data.sampleRemarks ?? null;
      updates.sampleReviewedBy = operatorName;
      updates.sampleReviewedAt = now;
      break;
    // ── 管理层决策 ────────────────────────────────────────────────────────────
    case "approve_purchase":
      // sample_reviewed → pending_purchase: 管理层同意采购并设定数量
      transitionAction = "approve_purchase";
      actionLabel = "管理层同意采购";
      updates.managerComment = data.comment ?? null;
      updates.managerReviewedBy = operatorName;
      updates.managerReviewedAt = now;
      updates.purchaseQuantity = data.purchaseQuantity != null ? Number(data.purchaseQuantity) : null;
      break;
    case "change_supplier": {
      // sample_reviewed → supplier_change_requested: 管理层要求更换供应商（员工确认后进入 supplier_changing）
      transitionAction = "change_supplier";
      actionLabel = "管理层要求更换供应商（待员工确认）";
      updates.managerComment = data.comment ?? null;
      updates.managerReviewedBy = operatorName;
      updates.managerReviewedAt = now;
      updates.supplierChangeCount = (Number(existing.supplierChangeCount) || 0) + 1;
      // ── 保留旧字段兼容性 ──────────────────────────────────────────────────
      updates.previousSupplierName = existing.supplierName ?? null;
      updates.previousPurchasePrice = existing.purchasePrice ?? null;
      updates.previousMoq = existing.moq ?? null;
      // ── 追加换供历史快照（数组追加，禁止覆盖）─────────────────────────────
      // 1. 查当前产品的 sample_option → SKU 列表
      const currentOption = await db
        .select()
        .from(sampleOptionsTable)
        .where(eq(sampleOptionsTable.productId, existing.id))
        .limit(1);
      let skuSnapshot: Array<{ skuName: string; unitPrice: string | null; moq: number | null; notes: string | null; imageUrl: string | null; hostedImageUrl: string | null }> = [];
      if (currentOption.length > 0) {
        const currentSkus = await db
          .select()
          .from(sampleSkuLinesTable)
          .where(eq(sampleSkuLinesTable.sampleOptionId, currentOption[0].id));
        skuSnapshot = currentSkus.map(sku => ({
          skuName:        sku.skuName   ?? '',
          unitPrice:      sku.unitPrice != null ? String(sku.unitPrice) : null,
          moq:            sku.moq       ?? null,
          notes:          sku.notes     ?? null,
          imageUrl:       sku.imageUrl  ?? null,
          hostedImageUrl: sku.hostedImageUrl ?? null,
        }));
      }
      // 2. 构造本轮快照，round = 当前日志长度（自动计算，无需手动维护）
      const existingLog = (existing.supplierChangeLog as unknown[] | null) ?? [];
      const snapshot = {
        round:         existingLog.length,
        supplierName:  existing.supplierName  ?? null,
        link1688:      existing.link1688       ?? null,
        purchasePrice: existing.purchasePrice != null ? String(existing.purchasePrice) : null,
        moq:           existing.moq            ?? null,
        managerReason: (data.comment as string) ?? null,
        changedAt:     now.toISOString(),
        skus:          skuSnapshot,
      };
      // 3. 追加（spread 保证不覆盖历史）
      updates.supplierChangeLog = [...existingLog, snapshot];
      break;
    }
    case "abandon":
      // sample_reviewed → rejected_unconfirmed: 管理层放弃，需员工确认知晓后才归档
      transitionAction = "abandon";
      actionLabel = "管理层放弃采购（待员工确认）";
      updates.managerComment = data.comment ?? null;
      updates.managerReviewedBy = operatorName;
      updates.managerReviewedAt = now;
      break;
    // ── 采购执行阶段 ──────────────────────────────────────────────────────────
    case "confirm_order":
      // pending_purchase → ordered: 员工确认已向供应商下单
      transitionAction = "confirm_order";
      actionLabel = "确认已下单";
      updates.orderedAt = now;
      // 更新SKU的purchaseStatus为ordered
      if (skuLineId) {
        await db.update(sampleSkuLinesTable).set({ purchaseStatus: "ordered", orderedAt: now, updatedAt: now }).where(eq(sampleSkuLinesTable.id, skuLineId as string));
      }
      break;
    case "mark_arrived":
      // ordered → goods_arrived: 员工标记货物已到
      transitionAction = "mark_arrived";
      actionLabel = "标记货物已到";
      updates.goodsArrivedAt = now;
      // 更新SKU的purchaseStatus为arrived
      if (skuLineId) {
        await db.update(sampleSkuLinesTable).set({ purchaseStatus: "arrived", arrivedAt: now, updatedAt: now }).where(eq(sampleSkuLinesTable.id, skuLineId as string));
      }
      break;
    // ── 验货流程（新流程：goods_arrived → inspecting → 正常/异常分支）─────────────
    case "start_inspection":
      // goods_arrived → inspecting: 员工开始验货
      transitionAction = "start_inspection";
      actionLabel = "开始验货";
      updates.inspectingStartedAt = now;
      // 更新SKU的purchaseStatus为inspecting
      if (skuLineId) {
        await db.update(sampleSkuLinesTable).set({ purchaseStatus: "inspecting", inspectingStartedAt: now, updatedAt: now }).where(eq(sampleSkuLinesTable.id, skuLineId as string));
      }
      break;
    case "start_anomaly_report":
      // inspecting → inspecting_anomaly_entry: 员工选择"发现异常"路径（持久化，刷新后表单保留）
      transitionAction = "start_anomaly_report";
      actionLabel = "开始填写异常报告";
      break;
    case "cancel_anomaly_report":
      // inspecting_anomaly_entry → inspecting: 员工取消填写，退回路径选择
      transitionAction = "cancel_anomaly_report";
      actionLabel = "取消异常报告（退回）";
      break;
    case "pass_inspection":
      // inspecting → goods_inspected: 员工确认验货正常
      transitionAction = "pass_inspection";
      actionLabel = "验货通过";
      updates.goodsInspectedAt = now;
      updates.goodsInspectionNote = data.goodsInspectionNote ?? null;
      // 更新SKU的purchaseStatus为passed
      if (skuLineId) {
        await db.update(sampleSkuLinesTable).set({ purchaseStatus: "passed", passedAt: now, updatedAt: now }).where(eq(sampleSkuLinesTable.id, skuLineId as string));
      }
      break;
    case "report_anomaly":
      // inspecting → inspection_anomaly: 员工报告异常，填写验货异常表单
      transitionAction = "report_anomaly";
      actionLabel = "报告验货异常";
      updates.anomalyTypes = data.anomalyTypes ?? null;
      updates.anomalyQuantity = data.anomalyQuantity != null ? Number(data.anomalyQuantity) : null;
      updates.anomalySeverity = data.anomalySeverity ?? null;
      updates.anomalyNote = data.anomalyNote ?? null;
      updates.anomalyReportedAt = now;
      updates.anomalyReportedBy = operatorName;
      // 更新SKU的purchaseStatus为anomaly_reported
      if (skuLineId) {
        await db.update(sampleSkuLinesTable).set({ 
          purchaseStatus: "anomaly_reported", 
          anomalyType: data.anomalyTypes as string || null,
          anomalyNote: data.anomalyNote as string || null,
          anomalyReportedAt: now,
          updatedAt: now 
        }).where(eq(sampleSkuLinesTable.id, skuLineId as string));
      }
      break;
    case "acknowledge_anomaly":
      // inspection_anomaly → anomaly_handling: 管理层确认异常并选择处理方案
      transitionAction = "acknowledge_anomaly";
      actionLabel = "管理层确认处理方案";
      updates.anomalyHandlingMethod = data.anomalyHandlingMethod ?? null;
      updates.anomalyHandlingNote = data.anomalyHandlingNote ?? null;
      updates.anomalyHandledBy = operatorName;
      updates.anomalyHandledAt = now;
      if (skuLineId) {
        updatedSkuLineId = skuLineId as string;
        await db.update(sampleSkuLinesTable)
          .set({
            anomalyHandlingMethod: data.anomalyHandlingMethod ?? null,
            anomalyHandlingNote: data.anomalyHandlingNote ?? null,
            anomalyHandledBy: operatorName,
            anomalyHandledAt: now,
            updatedAt: now,
          } as any)
          .where(eq(sampleSkuLinesTable.id, updatedSkuLineId));
      }
      break;
    case "resolve_anomaly":
      // anomaly_handling → anomaly_resolved: 员工确认异常已处理完毕
      transitionAction = "resolve_anomaly";
      actionLabel = "确认异常处理完毕";
      updates.anomalyResolvedAt = now;
      updates.anomalyResolvedBy = operatorName;
      // 更新SKU的purchaseStatus为anomaly_resolved
      if (skuLineId) {
        await db.update(sampleSkuLinesTable).set({ purchaseStatus: "anomaly_resolved", anomalyResolvedAt: now, updatedAt: now }).where(eq(sampleSkuLinesTable.id, skuLineId as string));
      }
      break;
    case "accept_goods":
      // anomaly_resolved → completed: 管理层决定接受入库
      transitionAction = "accept_goods";
      actionLabel = "接受入库（异常处理后）";
      updates.completedAt = now;
      break;
    case "terminate_order":
      // anomaly_resolved → rejected: 管理层决定终止
      transitionAction = "terminate_order";
      actionLabel = "终止采购订单";
      updates.managerComment = data.comment ?? null;
      updates.managerReviewedBy = operatorName;
      updates.managerReviewedAt = now;
      break;
    // ── MVP 异常采购链路 ──────────────────────────────────────────────────────────
    case "report_exception":
      // goods_arrived | inspecting → exception_reported: 专员上报异常
      transitionAction = "report_exception";
      actionLabel = "上报采购异常";
      updates.anomalyNote = data.anomalyNote ?? null;
      updates.anomalyReportedAt = now;
      updates.anomalyReportedBy = operatorName;
      break;
    case "accept_exception":
      // exception_reported → completed: 经理决定接受现货
      transitionAction = "accept_exception";
      actionLabel = "经理决策：接受现货入库";
      updates.anomalyHandlingMethod = "accept";
      updates.anomalyHandlingNote = (data.note as string) ?? null;
      updates.anomalyHandledBy = operatorName;
      updates.anomalyHandledAt = now;
      updates.completedAt = now;
      break;
    case "reorder_exception":
      // exception_reported → ordered: 经理要求补发（回到已下单，保留异常记录）
      transitionAction = "reorder_exception";
      actionLabel = "经理决策：要求补发";
      updates.anomalyHandlingMethod = "reorder";
      updates.anomalyHandlingNote = (data.note as string) ?? null;
      updates.anomalyHandledBy = operatorName;
      updates.anomalyHandledAt = now;
      break;
    case "terminate_exception":
      // exception_reported → terminated: 经理决定终止采购
      transitionAction = "terminate_exception";
      actionLabel = "经理决策：终止采购";
      updates.anomalyHandlingMethod = "terminate";
      updates.anomalyHandlingNote = (data.note as string) ?? null;
      updates.anomalyHandledBy = operatorName;
      updates.anomalyHandledAt = now;
      break;
    // ── 兼容旧流程：直接从 goods_arrived 验货（保留向后兼容）────────────────────
    case "inspect":
      // goods_arrived → goods_inspected（旧流程，保留兼容）
      transitionAction = "inspect";
      actionLabel = "完成验货（直接）";
      updates.goodsInspectedAt = now;
      updates.goodsInspectionNote = data.goodsInspectionNote ?? null;
      break;
    case "complete":
      // goods_inspected → completed: 员工确认入库完成
      transitionAction = "complete";
      actionLabel = "入库完成";
      updates.completedAt = now;
      break;

    // ── 负向决策回流机制（Package 2）──────────────────────────────────────────
    case "acknowledge_rejection":
      // rejected_unconfirmed → rejected: 员工确认知晓拒绝决定
      transitionAction = "acknowledge_rejection";
      actionLabel = "员工确认知晓拒绝";
      break;

    case "acknowledge_supplier_change":
      // supplier_change_requested → supplier_changing: 员工确认并开始换供应商
      transitionAction = "acknowledge_supplier_change";
      actionLabel = "员工确认换供应商，开始更换";
      break;

    case "resubmit_supplier":
      // supplier_changing → pending_sampling: 员工完成换供，进入采样
      transitionAction = "resubmit_supplier";
      actionLabel = `完成换供应商，进入采样（第${(Number(existing.supplierChangeCount) || 1)}次换供）`;
      if (data.supplierName) updates.supplierName = data.supplierName;
      if (data.link1688) updates.link1688 = data.link1688;
      if (data.remarks !== undefined) updates.remarks = data.remarks;
      if (data.purchasePrice != null) updates.purchasePrice = String(data.purchasePrice);
      if (data.moq != null) updates.moq = Number(data.moq);
      break;

    default:
      res.status(400).json({ error: "Invalid action" });
      return;
  }

  // ── 构造操作日志备注（仅 submit_sampling_review 时需要汇总信息）
  let _logNote: string | undefined = (data.comment as string) ?? undefined;
  if (action === 'submit_sampling_review') {
    // 查询该产品的方案数量和异常SKU数量
    const opts = await db.select().from(sampleOptionsTable).where(eq(sampleOptionsTable.productId, existing.id));
    let anomalyCount = 0;
    for (const opt of opts) {
      const skus = await db.select().from(sampleSkuLinesTable).where(eq(sampleSkuLinesTable.sampleOptionId, opt.id));
      anomalyCount += skus.filter((s: any) => s.anomalyType != null).length;
    }
    _logNote = opts.length + "个方案，" + anomalyCount + "个异常SKU";
  }

  if (skuLineId && AGGREGATE_SKU_ACTIONS.has(action as string)) {
    const selectedSkus = await getManagerSelectedSkus(existing.id);
    const skuStatuses = selectedSkus.map((s) => (s.purchaseStatus as string) || "pending_purchase");
    newStatus = deriveAggregateProductStatus(skuStatuses, existing.status);
    if (!isForwardAggregateTransition(existing.status, newStatus)) {
      res.status(400).json({
        error: `无效的产品状态推进：${existing.status} → ${newStatus}（请按顺序完成各 SKU 采购/验货）`,
      });
      return;
    }
  } else if (action === "complete") {
    const selectedSkus = await getManagerSelectedSkus(existing.id);
    if (
      selectedSkus.length > 0 &&
      !selectedSkus.every((s) => SKU_PASSED.has((s.purchaseStatus as string) || ""))
    ) {
      res.status(400).json({ error: "尚有 SKU 未完成验货通过，无法确认入库" });
      return;
    }
    try {
      newStatus = assertTransitOrThrow(existing.status as ProductFromStatus, transitionAction);
    } catch (err) {
      if (
        existing.status === "inspecting" &&
        selectedSkus.every((s) => SKU_PASSED.has((s.purchaseStatus as string) || ""))
      ) {
        newStatus = "completed";
      } else {
        res.status(400).json({ error: (err as Error).message });
        return;
      }
    }
  } else {
    try {
      newStatus = assertTransitOrThrow(existing.status as ProductFromStatus, transitionAction);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }
  }

  // ── 未读提醒时间戳（只在首次进入对应状态时写入，禁止覆盖）──────────────────
  if ((newStatus === "rejected" || newStatus === "completed") && !existing.enteredEndedAt) {
    updates.enteredEndedAt = now;
  }
  if (newStatus === "pending_purchase" && !existing.enteredPurchaseAt) {
    updates.enteredPurchaseAt = now;
  }

  const historyLog = addHistory(
    (existing.historyLog as unknown[]) || [],
    operatorName as string,
    actionLabel,
    existing.status,
    newStatus,
    _logNote,
  );

  await db
    .update(productsTable)
    .set({ status: newStatus, ...updates, updatedAt: now, historyLog })
    .where(eq(productsTable.id, String(req.params.id)));

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, String(req.params.id)));
  if (updatedSkuLineId) {
    const [updatedSku] = await db
      .select()
      .from(sampleSkuLinesTable)
      .where(eq(sampleSkuLinesTable.id, updatedSkuLineId));
    res.json({
      ...serializeProduct(product as Record<string, unknown>),
      updatedSku: updatedSku ? serializeSkuLine(updatedSku as Record<string, unknown>) : undefined,
    });
    return;
  }
  res.json(serializeProduct(product as Record<string, unknown>));
});

// ── 产品经理决策接口（原子操作）────────────────────────────────────────────────
router.post("/products/:id/manager-decision", async (req, res) => {
  const operatorRole = req.user?.role;
  if (operatorRole !== "product_manager") {
    res.status(403).json({
      error: "权限不足：此操作需要产品经理权限，产品专员无法执行样品决策",
    });
    return;
  }

  const { id } = req.params;
  const { action, selectedOptionId, selectedOptionIds, selectedSkuIds, comment, skuQuantities } = req.body;
  const operatorName = req.user!.name;

  if (!action) {
    res.status(400).json({ error: "action 为必填项" });
    return;
  }
  if (action !== "approve" && action !== "reject") {
    res.status(400).json({ error: "action 必须是 'approve' 或 'reject'" });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!product) {
    res.status(404).json({ error: "产品不存在" });
    return;
  }
  const now = new Date();

  if (action === "reject") {
    let nextStatus: string;
    try {
      nextStatus = assertTransitOrThrow(product.status as ProductFromStatus, "manager_decision_reject");
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }
    // 经理拒绝验样：进入 rejected_unconfirmed，需员工确认知晓后才归档
    const currentProduct = product; // already fetched above
    const rejHistoryLog = addHistory(
      (currentProduct.historyLog as unknown[]) || [],
      operatorName,
      "经理拒绝验样（待员工确认）",
      currentProduct.status,
      nextStatus,
      comment ?? undefined,
    );
    await db.update(productsTable).set({
      status: nextStatus,
      managerComment: comment ?? null,
      managerReviewedBy: operatorName,
      managerReviewedAt: now,
      updatedAt: now,
      historyLog: rejHistoryLog,
    }).where(eq(productsTable.id, id));

    const [updated] = await db.select().from(productsTable).where(eq(productsTable.id, id));
    res.json(serializeProduct(updated as Record<string, unknown>));
    return;
  }

  // action === "approve"
  // 解析选中的方案ID列表：优先使用 selectedOptionIds，否则 fallback 到 selectedOptionId
  const selectedOptionIdsList: string[] =
    Array.isArray(selectedOptionIds) && selectedOptionIds.length > 0
      ? selectedOptionIds
      : selectedOptionId
        ? [selectedOptionId]
        : [];

  if (selectedOptionIdsList.length === 0 || !Array.isArray(selectedSkuIds) || selectedSkuIds.length === 0) {
    res.status(400).json({ error: "批准时必须指定至少一个 selectedOptionId 及至少一个 selectedSkuId" });
    return;
  }

  const parsedSkuQty: Record<string, number> =
    skuQuantities && typeof skuQuantities === "object" ? skuQuantities : {};

  const allProductOptions = await db.select({
      id: sampleOptionsTable.id,
      sampleOrderStatus: sampleOptionsTable.sampleOrderStatus,
    })
    .from(sampleOptionsTable)
    .where(eq(sampleOptionsTable.productId, id));
  const allOptionIds = allProductOptions.map(o => o.id);
  const selectedSkuIdList = selectedSkuIds as string[];
  const selectedSkuIdSet = new Set(selectedSkuIdList);
  const selectedOptionIdSet = new Set(selectedOptionIdsList);
  if (selectedOptionIdsList.some((optionId) => !allOptionIds.includes(optionId))) {
    res.status(400).json({ error: "Selected sample option does not belong to this product" });
    return;
  }
  if (product.status !== "pending_purchase") {
    const unevaluatedSelectedOptions = allProductOptions.filter(
      (option) => selectedOptionIdSet.has(option.id) && (option.sampleOrderStatus || "pending") !== "evaluated",
    );
    if (unevaluatedSelectedOptions.length > 0) {
      res.status(400).json({ error: "Selected sample options must be evaluated before purchase approval" });
      return;
    }
  }
  const allSkuRowsForProduct = allOptionIds.length > 0
    ? await db.select({
        id: sampleSkuLinesTable.id,
        sampleOptionId: sampleSkuLinesTable.sampleOptionId,
        managerSelected: sampleSkuLinesTable.managerSelected,
        purchaseQuantity: sampleSkuLinesTable.purchaseQuantity,
        skuCode: sampleSkuLinesTable.skuCode,
        skuCodeSuffix: sampleSkuLinesTable.skuCodeSuffix,
      })
      .from(sampleSkuLinesTable)
      .where(inArray(sampleSkuLinesTable.sampleOptionId, allOptionIds))
    : [];
  const selectedSkuRowsForProduct = allSkuRowsForProduct.filter((s) => selectedSkuIdSet.has(s.id));

  if (selectedSkuRowsForProduct.length !== selectedSkuIdSet.size) {
    res.status(400).json({ error: "选中的 SKU 不属于该产品" });
    return;
  }
  const selectedOptionIdsWithSku = new Set(selectedSkuRowsForProduct.map((s) => s.sampleOptionId));
  if (selectedOptionIdsList.some((optionId) => !selectedOptionIdsWithSku.has(optionId))) {
    res.status(400).json({ error: "Each selected sample option must include at least one selected SKU" });
    return;
  }
  if (selectedSkuRowsForProduct.some((s) => !selectedOptionIdSet.has(s.sampleOptionId))) {
    res.status(400).json({ error: "选中的 SKU 必须属于本次批准的方案" });
    return;
  }

  if (product.status === "pending_purchase") {
    const existingSelectedRows = allSkuRowsForProduct.filter(s => s.managerSelected);
    const sameSkuSelection =
      selectedSkuIdSet.size === existingSelectedRows.length &&
      existingSelectedRows.every(s => selectedSkuIdSet.has(s.id));
    const sameQuantities = existingSelectedRows.every(s => {
      const requestedQty = parsedSkuQty[s.id];
      return requestedQty == null || Number(requestedQty) === Number(s.purchaseQuantity);
    });

    if (sameSkuSelection && sameQuantities) {
      res.json(serializeProduct(product as Record<string, unknown>));
      return;
    }

    res.status(409).json({ error: "该验样申请已批准并进入采购池，请刷新页面后查看最新状态" });
    return;
  }

  let nextStatus: string;
  try {
    nextStatus = assertTransitOrThrow(product.status as ProductFromStatus, "manager_decision_approve");
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }

  // 构造 approve 的 note，记录选中的方案信息
  const selectedOptionsForLog = await db.select({ id: sampleOptionsTable.id, label: sampleOptionsTable.optionLabel })
    .from(sampleOptionsTable)
    .where(inArray(sampleOptionsTable.id, selectedOptionIdsList));
  const approveNote = "选择方案：" + selectedOptionsForLog.map(o => o.label || "方案" + (selectedOptionsForLog.indexOf(o) + 1)).join("、");
  const approveActionLabel = "管理层同意采购";
  const approveHistoryLog = addHistory(
    (product.historyLog as unknown[]) || [],
    operatorName,
    approveActionLabel,
    product.status,
    nextStatus,
    approveNote,
  );

  await db.transaction(async (tx: any) => {
    const lockedResult = await tx.execute(sql`
      select status, spu_code, spu_code_period, spu_code_sequence, spu_code_assigned_at, entered_purchase_at
      from products
      where id = ${id}
      for update
    `);
    const lockedRows = Array.isArray((lockedResult as any)?.rows) ? (lockedResult as any).rows : [];
    const lockedProduct = lockedRows[0] as {
      status?: string;
      spu_code?: string | null;
      spu_code_period?: string | null;
      spu_code_sequence?: number | null;
      spu_code_assigned_at?: Date | string | null;
      entered_purchase_at?: Date | string | null;
    } | undefined;

    if (lockedProduct?.status === "pending_purchase") {
      return;
    }

    const spuAssignment = await ensureSpuCode(tx, lockedProduct ?? product, now);
    const skuRowsInTx = allOptionIds.length > 0
      ? await tx.select({
          id: sampleSkuLinesTable.id,
          sampleOptionId: sampleSkuLinesTable.sampleOptionId,
          skuCode: sampleSkuLinesTable.skuCode,
          skuCodeSuffix: sampleSkuLinesTable.skuCodeSuffix,
        })
        .from(sampleSkuLinesTable)
        .where(inArray(sampleSkuLinesTable.sampleOptionId, allOptionIds))
      : [];
    let nextSkuSuffix = skuRowsInTx.reduce((max, sku) => {
      const suffix = Number(sku.skuCodeSuffix);
      return Number.isFinite(suffix) && suffix > max ? suffix : max;
    }, 0);
    const skuCodeById = new Map<string, { skuCode: string; skuCodeSuffix: number; skuCodeAssignedAt: Date }>();

    for (const skuId of selectedSkuIdList) {
      const sku = skuRowsInTx.find((row) => row.id === skuId);
      if (!sku) continue;
      if (sku.skuCode) {
        skuCodeById.set(skuId, {
          skuCode: sku.skuCode,
          skuCodeSuffix: Number(sku.skuCodeSuffix) || Number(String(sku.skuCode).split("-").pop()) || 0,
          skuCodeAssignedAt: now,
        });
        continue;
      }
      nextSkuSuffix += 1;
      skuCodeById.set(skuId, {
        skuCode: `${spuAssignment.spuCode}-${nextSkuSuffix}`,
        skuCodeSuffix: nextSkuSuffix,
        skuCodeAssignedAt: now,
      });
    }

    // 1. 清零该产品所有 SKU 和方案选择，避免多次审核留下旧选中状态
    if (allOptionIds.length > 0) {
      await tx.update(sampleSkuLinesTable)
        .set({ managerSelected: false, purchaseQuantity: null, updatedAt: now })
        .where(inArray(sampleSkuLinesTable.sampleOptionId, allOptionIds));
      await tx.update(sampleOptionsTable)
        .set({ selectedBy: null, selectedAt: null, selectionNote: null, updatedAt: now })
        .where(eq(sampleOptionsTable.productId, id));
    }

    // 2. 逐一写入本次选中的 SKU（携带各自采购数量）
    for (const skuId of selectedSkuIdList) {
      const qty = parsedSkuQty[skuId] != null ? Number(parsedSkuQty[skuId]) : null;
      const skuCodeUpdate = skuCodeById.get(skuId);
      await tx.update(sampleSkuLinesTable)
        .set({
          managerSelected: true,
          purchaseQuantity: qty,
          ...(skuCodeUpdate ? {
            skuCode: skuCodeUpdate.skuCode,
            skuCodeSuffix: skuCodeUpdate.skuCodeSuffix,
            skuCodeAssignedAt: skuCodeUpdate.skuCodeAssignedAt,
          } : {}),
          updatedAt: now,
        })
        .where(eq(sampleSkuLinesTable.id, skuId));
    }

    // 3. 写入被选中的每个 SampleOption
    for (const optId of selectedOptionIdsList) {
      await tx.update(sampleOptionsTable)
        .set({
          selectedBy: operatorName,
          selectedAt: now,
          selectionNote: comment ?? null,
          updatedAt: now,
        })
        .where(eq(sampleOptionsTable.id, optId));
    }

    // 4. 更新 Product 状态
    await tx.update(productsTable)
      .set({
        status: nextStatus,
        spuCode: spuAssignment.spuCode,
        spuCodePeriod: spuAssignment.period,
        spuCodeSequence: spuAssignment.sequence,
        spuCodeAssignedAt: spuAssignment.assignedAt,
        managerComment: comment ?? null,
        managerReviewedBy: operatorName,
        managerReviewedAt: now,
        enteredPurchaseAt: product.enteredPurchaseAt ?? lockedProduct?.entered_purchase_at ?? now,
        historyLog: approveHistoryLog,
        updatedAt: now,
      })
      .where(eq(productsTable.id, id));
  });

  const [updated] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  res.json(serializeProduct(updated as Record<string, unknown>));
});

export default router;
