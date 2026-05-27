import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sampleSkuLinesTable, productsTable, sampleOptionsTable } from "@workspace/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

const router: IRouter = Router();
const BASIC_SKU_EDIT_PRODUCT_STATUSES = new Set([
  "draft",
  "pending_info",
  "pending_analysis",
  "screening_submitted",
  "completed",
  "rejected",
  "returned",
  "supplier_changing",
]);
const SAMPLE_COLLECTION_STATUS = "sampling_collection";
const LOCKED_SAMPLE_SKU_OPTION_STATUSES = new Set(["ordered", "arrived", "evaluating", "evaluated"]);

function canSeeAllProducts(req: Request) {
  return req.user?.role === "product_manager" || req.user?.role === "admin";
}

function canAccessProduct(req: Request, product: { employeeId: string | null }) {
  if (canSeeAllProducts(req)) return true;
  return req.user?.role === "product_specialist" && product.employeeId === req.user.employeeId;
}

function sendProductAccessDenied(res: Response) {
  res.status(403).json({ error: "No permission to access this employee's SKU data" });
}

function sendForbiddenSkuContext(req: Request, res: Response, product: { employeeId: string | null }) {
  if (canAccessProduct(req, product)) return false;
  sendProductAccessDenied(res);
  return true;
}

async function loadSkuContextByOptionId(sampleOptionId: string) {
  const [option] = await db
    .select()
    .from(sampleOptionsTable)
    .where(eq(sampleOptionsTable.id, sampleOptionId));
  if (!option) return { option: null, product: null };

  const [product] = await db
    .select({ id: productsTable.id, status: productsTable.status, employeeId: productsTable.employeeId })
    .from(productsTable)
    .where(eq(productsTable.id, option.productId));

  return { option, product: product ?? null };
}

async function loadSkuContextBySkuId(id: string) {
  const [sku] = await db
    .select()
    .from(sampleSkuLinesTable)
    .where(eq(sampleSkuLinesTable.id, id));
  if (!sku) return { sku: null, option: null, product: null };

  const context = await loadSkuContextByOptionId(sku.sampleOptionId);
  return { sku, ...context };
}

function canEditBasicSku(productStatus: string | null | undefined, optionStatus: string | null | undefined) {
  if (!productStatus) return false;
  if (BASIC_SKU_EDIT_PRODUCT_STATUSES.has(productStatus)) return true;
  if (productStatus === SAMPLE_COLLECTION_STATUS) {
    return !LOCKED_SAMPLE_SKU_OPTION_STATUSES.has(optionStatus || "pending");
  }
  return false;
}

function canEditSkuEvaluation(productStatus: string | null | undefined, optionStatus: string | null | undefined) {
  return productStatus === SAMPLE_COLLECTION_STATUS && (optionStatus || "pending") === "evaluating";
}

function canReportSamplingAnomaly(productStatus: string | null | undefined, optionStatus: string | null | undefined) {
  return productStatus === SAMPLE_COLLECTION_STATUS && (optionStatus || "pending") === "arrived";
}

function sendMissingSkuContext(res: any, sku: unknown, option: unknown, product: unknown) {
  if (!sku) {
    res.status(404).json({ error: "SKU line not found" });
    return true;
  }
  if (!option) {
    res.status(404).json({ error: "Sample option not found" });
    return true;
  }
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return true;
  }
  return false;
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
    anomalyType: r.anomalyType ?? null,
    anomalyNote: r.anomalyNote ?? null,
    anomalyReportedAt: r.anomalyReportedAt ? (r.anomalyReportedAt as Date).toISOString() : null,
    anomalyReportedBy: r.anomalyReportedBy ?? null,
    anomalyHandlingMethod: r.anomalyHandlingMethod ?? null,
    anomalyHandlingNote: r.anomalyHandlingNote ?? null,
    anomalyHandledBy: r.anomalyHandledBy ?? null,
    anomalyHandledAt: r.anomalyHandledAt ? (r.anomalyHandledAt as Date).toISOString() : null,
    anomalyResolvedAt: r.anomalyResolvedAt ? (r.anomalyResolvedAt as Date).toISOString() : null,
    anomalyHistory: Array.isArray(r.anomalyHistory) ? r.anomalyHistory : [],
    createdAt: r.createdAt ? (r.createdAt as Date).toISOString() : null,
    updatedAt: r.updatedAt ? (r.updatedAt as Date).toISOString() : null,
    skuConsistentWithImage: r.skuConsistentWithImage ?? null,
    skuMaterialEval: r.skuMaterialEval ?? null,
    skuWorkmanshipEval: r.skuWorkmanshipEval ?? null,
    skuFunctionEval: r.skuFunctionEval ?? null,
    skuRemarks: r.skuRemarks ?? null,
    packingQuantity: r.packingQuantity != null ? Number(r.packingQuantity) : null,
    anomalyImages: r.anomalyImages ?? null,
  };
}

router.get("/sample-sku-lines", async (req, res) => {
  const { sampleOptionId } = req.query as { sampleOptionId?: string };
  let rows: Array<typeof sampleSkuLinesTable.$inferSelect> = [];
  if (sampleOptionId) {
    const { option, product } = await loadSkuContextByOptionId(sampleOptionId);
    if (sendMissingSkuContext(res, true, option, product)) return;
    if (sendForbiddenSkuContext(req, res, product!)) return;
    rows = await db.select().from(sampleSkuLinesTable)
      .where(eq(sampleSkuLinesTable.sampleOptionId, sampleOptionId))
      .orderBy(asc(sampleSkuLinesTable.sampleOptionId), asc(sampleSkuLinesTable.createdAt));
  } else if (canSeeAllProducts(req)) {
    rows = await db.select().from(sampleSkuLinesTable)
      .orderBy(asc(sampleSkuLinesTable.sampleOptionId), asc(sampleSkuLinesTable.createdAt));
  } else {
    const visibleProducts = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(eq(productsTable.employeeId, req.user?.employeeId || ""));
    const productIds = visibleProducts.map((product) => product.id);
    const options = productIds.length > 0
      ? await db.select({ id: sampleOptionsTable.id }).from(sampleOptionsTable).where(inArray(sampleOptionsTable.productId, productIds))
      : [];
    const optionIds = options.map((option) => option.id);
    rows = optionIds.length > 0
      ? await db.select().from(sampleSkuLinesTable)
        .where(inArray(sampleSkuLinesTable.sampleOptionId, optionIds))
        .orderBy(asc(sampleSkuLinesTable.sampleOptionId), asc(sampleSkuLinesTable.createdAt))
      : [];
  }
  res.json(rows.map(r => serializeSkuLine(r as Record<string, unknown>)));
});

router.get("/sample-sku-lines/:id", async (req, res) => {
  const context = await loadSkuContextBySkuId(req.params.id);
  if (sendMissingSkuContext(res, context.sku, context.option, context.product)) return;
  if (sendForbiddenSkuContext(req, res, context.product!)) return;
  res.json(serializeSkuLine(context.sku as Record<string, unknown>));
});

router.post("/sample-sku-lines", async (req, res) => {
  const now = new Date();
  const { sampleOptionId, skuName, attributes, unitPrice, moq, weight, dimensions,
          imageUrl, recommended, purchaseQuantity, notes } = req.body;

  if (!sampleOptionId) { res.status(400).json({ error: "sampleOptionId required" }); return; }
  if (!imageUrl) { res.status(400).json({ error: "imageUrl required" }); return; }
  const { option, product } = await loadSkuContextByOptionId(sampleOptionId);
  if (sendMissingSkuContext(res, true, option, product)) return;
  if (sendForbiddenSkuContext(req, res, product!)) return;
  if (!canEditBasicSku(product!.status, option!.sampleOrderStatus)) {
    res.status(409).json({ error: `SKU lines cannot be edited in product status=${product!.status}, option status=${option!.sampleOrderStatus || "pending"}` });
    return;
  }

  const id = randomUUID();
  await db.insert(sampleSkuLinesTable).values({
    id,
    sampleOptionId,
    skuName: skuName || null,
    attributes: attributes || null,
    unitPrice: unitPrice != null ? String(unitPrice) : null,
    moq: moq != null ? Number(moq) : null,
    weight: weight != null ? String(weight) : null,
    dimensions: dimensions || null,
    imageUrl: imageUrl || null,
    recommended: recommended ?? false,
    purchaseQuantity: purchaseQuantity != null ? Number(purchaseQuantity) : null,
    notes: notes || null,
    createdAt: now,
    updatedAt: now,
    purchaseStatus: "pending_purchase",
  });

  const [inserted] = await db.select().from(sampleSkuLinesTable).where(eq(sampleSkuLinesTable.id, id));
  res.status(201).json(serializeSkuLine(inserted as Record<string, unknown>));
});

router.put("/sample-sku-lines/:id", async (req, res) => {
  const now = new Date();
  const { id } = req.params;
  const {
    skuName, attributes, unitPrice, moq, weight, dimensions,
    imageUrl, recommended, managerSelected, purchaseQuantity, notes,
    purchaseStatus, orderedAt, arrivedAt, inspectingStartedAt, passedAt, completedAt,
    anomalyType, anomalyNote, anomalyReportedAt, anomalyReportedBy,
    anomalyHandlingMethod, anomalyHandlingNote, anomalyHandledBy, anomalyHandledAt,
    anomalyResolvedAt, anomalyHistory,
    skuConsistentWithImage, skuMaterialEval, skuWorkmanshipEval, skuFunctionEval, skuRemarks,
    anomalyImages,
  } = req.body;

  const context = await loadSkuContextBySkuId(id);
  if (sendMissingSkuContext(res, context.sku, context.option, context.product)) return;
  if (sendForbiddenSkuContext(req, res, context.product!)) return;
  if (!canEditBasicSku(context.product!.status, context.option!.sampleOrderStatus)) {
    res.status(409).json({ error: `SKU lines cannot be edited in product status=${context.product!.status}, option status=${context.option!.sampleOrderStatus || "pending"}` });
    return;
  }

  const updates: Record<string, unknown> = { updatedAt: now };
  if (skuName !== undefined) updates.skuName = skuName;
  if (attributes !== undefined) updates.attributes = attributes;
  if (unitPrice !== undefined) updates.unitPrice = unitPrice != null ? String(unitPrice) : null;
  if (moq !== undefined) updates.moq = moq != null ? Number(moq) : null;
  if (weight !== undefined) updates.weight = weight != null ? String(weight) : null;
  if (dimensions !== undefined) updates.dimensions = dimensions;
  if (imageUrl !== undefined) updates.imageUrl = imageUrl;
  if (recommended !== undefined) updates.recommended = recommended;
  if (managerSelected !== undefined) updates.managerSelected = managerSelected;
  if (purchaseQuantity !== undefined) updates.purchaseQuantity = purchaseQuantity != null ? Number(purchaseQuantity) : null;
  if (notes !== undefined) updates.notes = notes;
  if (purchaseStatus !== undefined) updates.purchaseStatus = purchaseStatus;
  if (orderedAt !== undefined) updates.orderedAt = orderedAt ? new Date(orderedAt) : null;
  if (arrivedAt !== undefined) updates.arrivedAt = arrivedAt ? new Date(arrivedAt) : null;
  if (inspectingStartedAt !== undefined) updates.inspectingStartedAt = inspectingStartedAt ? new Date(inspectingStartedAt) : null;
  if (passedAt !== undefined) updates.passedAt = passedAt ? new Date(passedAt) : null;
  if (completedAt !== undefined) updates.completedAt = completedAt ? new Date(completedAt) : null;
  if (anomalyType !== undefined) updates.anomalyType = anomalyType;
  if (anomalyNote !== undefined) updates.anomalyNote = anomalyNote;
  if (anomalyReportedAt !== undefined) updates.anomalyReportedAt = anomalyReportedAt ? new Date(anomalyReportedAt) : null;
  if (anomalyReportedBy !== undefined) updates.anomalyReportedBy = anomalyReportedBy;
  if (anomalyHandlingMethod !== undefined) updates.anomalyHandlingMethod = anomalyHandlingMethod;
  if (anomalyHandlingNote !== undefined) updates.anomalyHandlingNote = anomalyHandlingNote;
  if (anomalyHandledBy !== undefined) updates.anomalyHandledBy = anomalyHandledBy;
  if (anomalyHandledAt !== undefined) updates.anomalyHandledAt = anomalyHandledAt ? new Date(anomalyHandledAt) : null;
  if (anomalyResolvedAt !== undefined) updates.anomalyResolvedAt = anomalyResolvedAt ? new Date(anomalyResolvedAt) : null;
  if (anomalyHistory !== undefined) updates.anomalyHistory = Array.isArray(anomalyHistory) ? anomalyHistory : [];
  if (skuConsistentWithImage !== undefined) updates.skuConsistentWithImage = skuConsistentWithImage;
  if (skuMaterialEval !== undefined) updates.skuMaterialEval = skuMaterialEval;
  if (skuWorkmanshipEval !== undefined) updates.skuWorkmanshipEval = skuWorkmanshipEval;
  if (skuFunctionEval !== undefined) updates.skuFunctionEval = skuFunctionEval;
  if (skuRemarks !== undefined) updates.skuRemarks = skuRemarks;
  if (anomalyImages !== undefined) updates.anomalyImages = anomalyImages;

  await db.update(sampleSkuLinesTable).set(updates as any).where(eq(sampleSkuLinesTable.id, id));
  const [updated] = await db.select().from(sampleSkuLinesTable).where(eq(sampleSkuLinesTable.id, id));
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serializeSkuLine(updated as Record<string, unknown>));
});

router.delete("/sample-sku-lines/:id", async (req, res) => {
  const context = await loadSkuContextBySkuId(req.params.id);
  if (sendMissingSkuContext(res, context.sku, context.option, context.product)) return;
  if (sendForbiddenSkuContext(req, res, context.product!)) return;
  if (!canEditBasicSku(context.product!.status, context.option!.sampleOrderStatus)) {
    res.status(409).json({ error: `SKU lines cannot be edited in product status=${context.product!.status}, option status=${context.option!.sampleOrderStatus || "pending"}` });
    return;
  }
  await db.delete(sampleSkuLinesTable).where(eq(sampleSkuLinesTable.id, req.params.id));
  res.json({ ok: true });
});

router.put("/sample-sku-lines/:id/evaluation", async (req, res) => {
  const now = new Date();
  const { id } = req.params;
  const {
    skuConsistentWithImage,
    skuMaterialEval,
    skuWorkmanshipEval,
    skuFunctionEval,
    skuRemarks,
    packingQuantity,
    operator,
  } = req.body;

  const context = await loadSkuContextBySkuId(id);
  if (sendMissingSkuContext(res, context.sku, context.option, context.product)) return;
  if (sendForbiddenSkuContext(req, res, context.product!)) return;
  if (!canEditSkuEvaluation(context.product!.status, context.option!.sampleOrderStatus)) {
    res.status(409).json({ error: `SKU evaluation can only be edited while option is evaluating; product status=${context.product!.status}, option status=${context.option!.sampleOrderStatus || "pending"}` });
    return;
  }

  const updates: Record<string, unknown> = { updatedAt: now };
  if (skuConsistentWithImage !== undefined) updates.skuConsistentWithImage = skuConsistentWithImage;
  if (skuMaterialEval !== undefined) updates.skuMaterialEval = skuMaterialEval;
  if (skuWorkmanshipEval !== undefined) updates.skuWorkmanshipEval = skuWorkmanshipEval;
  if (skuFunctionEval !== undefined) updates.skuFunctionEval = skuFunctionEval;
  if (skuRemarks !== undefined) updates.skuRemarks = skuRemarks;
  if (packingQuantity !== undefined) updates.packingQuantity = packingQuantity;
  await db.update(sampleSkuLinesTable).set(updates as any).where(eq(sampleSkuLinesTable.id, id));

  const [updated] = await db.select().from(sampleSkuLinesTable).where(eq(sampleSkuLinesTable.id, id));
  res.json(serializeSkuLine(updated as Record<string, unknown>));
});

// 员工提交采样异常（仅记录，无需审批）
router.post("/sample-sku-lines/:id/sampling-anomaly", async (req, res) => {
  const { id } = req.params;
  const { anomalyType, anomalyNote, anomalyImages, operator } = req.body;
  const actorName = req.user?.name || operator || null;
  
  if (!anomalyType || !anomalyNote) {
    res.status(400).json({ error: "anomalyType and anomalyNote required" });
    return;
  }
  
  const now = new Date();
  
  const context = await loadSkuContextBySkuId(id);
  if (sendMissingSkuContext(res, context.sku, context.option, context.product)) return;
  if (sendForbiddenSkuContext(req, res, context.product!)) return;
  if (!canReportSamplingAnomaly(context.product!.status, context.option!.sampleOrderStatus)) {
    res.status(409).json({ error: `Sampling anomalies can only be recorded after sample arrival and before evaluation starts; product status=${context.product!.status}, option status=${context.option!.sampleOrderStatus || "pending"}` });
    return;
  }
  const sku = context.sku!;
  
  // 只更新SKU的异常字段，不修改option和product的状态（保持evaluating流程）
  await db.update(sampleSkuLinesTable).set({
    anomalyType,
    anomalyNote,
    anomalyImages: anomalyImages || null,
    anomalyReportedAt: now,
    anomalyReportedBy: actorName,
    anomalyHandlingMethod: "recorded",
    anomalyHandledAt: now,
    updatedAt: now,
  }).where(eq(sampleSkuLinesTable.id, id));
  
  // 获取option信息并只更新product的historyLog
  const [option] = await db.select().from(sampleOptionsTable).where(eq(sampleOptionsTable.id, sku.sampleOptionId));
  if (option) {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, option.productId));
    if (product) {
      const skuName = sku.skuName || '未命名SKU';
      const anomalyTypeLabels: Record<string,string> = {
        'damaged': '损坏',
        'color_spec_mismatch': '颜色规格不对',
        'shortage': '缺货',
        'quality_issue': '质量差',
        'other': '其他',
      };
      const labels = {damaged:'损坏','color_spec_mismatch':'颜色规格不对',shortage:'缺货',quality_issue:'质量差',other:'其他'};
      const historyLog = [
        ...(product.historyLog as unknown[] || []),
        {
          action: "report_sampling_anomaly",
          actor: actorName || '未知',
          fromStatus: product.status,
          toStatus: product.status,
          note: "采样异常 - SKU: " + skuName + ", 类型: " + (labels[anomalyType] || anomalyType) + ", 描述: " + anomalyNote,
          timestamp: now.toISOString(),
        }
      ];
      
      await db.update(productsTable).set({
        historyLog,
        updatedAt: now,
      }).where(eq(productsTable.id, option.productId));
    }
  }
  
  const [updated] = await db.select().from(sampleSkuLinesTable).where(eq(sampleSkuLinesTable.id, id));
  res.json(serializeSkuLine(updated as Record<string, unknown>));
});

// 经理审批采样异常
router.post("/sample-sku-lines/:id/approve-sampling-anomaly", async (req, res) => {
  const { id } = req.params;
  const { approved, note, operator } = req.body; // approved: boolean
  const actorName = req.user?.name || operator || null;
  
  const now = new Date();
  
  const context = await loadSkuContextBySkuId(id);
  if (sendMissingSkuContext(res, context.sku, context.option, context.product)) return;
  if (sendForbiddenSkuContext(req, res, context.product!)) return;
  if (!canEditSkuEvaluation(context.product!.status, context.option!.sampleOrderStatus)) {
    res.status(409).json({ error: `Sampling anomalies can only be approved while option is evaluating; product status=${context.product!.status}, option status=${context.option!.sampleOrderStatus || "pending"}` });
    return;
  }
  const sku = context.sku!;
  
  if (approved) {
    // 清除SKU异常标记，保持option状态为evaluating（让员工继续评价）
    await db.update(sampleSkuLinesTable).set({
      anomalyType: null,
      anomalyNote: null,
      anomalyReportedAt: null,
      anomalyReportedBy: null,
      anomalyHandlingMethod: 'approved',
      anomalyHandlingNote: note || null,
      anomalyHandledBy: actorName,
      anomalyHandledAt: now,
      anomalyResolvedAt: now,
      updatedAt: now,
    }).where(eq(sampleSkuLinesTable.id, id));
    // 不修改option状态，保持evaluating
  } else {
    // 驳回，保持异常状态
    await db.update(sampleSkuLinesTable).set({
      anomalyHandlingMethod: 'rejected',
      anomalyHandlingNote: note || null,
      anomalyHandledBy: actorName,
      anomalyHandledAt: now,
      updatedAt: now,
    }).where(eq(sampleSkuLinesTable.id, id));
  }
  
  // 只更新product的historyLog，不修改product状态
  const [option] = await db.select().from(sampleOptionsTable).where(eq(sampleOptionsTable.id, sku.sampleOptionId));
  if (option) {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, option.productId));
    if (product) {
      const skuName = sku.skuName || '未命名SKU';
      const historyLog = [
        ...(product.historyLog as unknown[] || []),
        {
          action: "approve_sampling_anomaly",
          actor: actorName || '未知',
          fromStatus: product.status,
          toStatus: product.status,
          note: (approved ? '审批通过' : '驳回') + " - SKU: " + skuName + (note ? ', 备注: ' + note : ''),
          timestamp: now.toISOString(),
        }
      ];
      
      await db.update(productsTable).set({
        historyLog,
        updatedAt: now,
      }).where(eq(productsTable.id, option.productId));
    }
  }
  
  const [updated] = await db.select().from(sampleSkuLinesTable).where(eq(sampleSkuLinesTable.id, id));
  res.json(serializeSkuLine(updated as Record<string, unknown>));
});

export default router;
