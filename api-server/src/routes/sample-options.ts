import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { productsTable, sampleOptionsTable, sampleSkuLinesTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

const router: IRouter = Router();
const SAMPLE_EDITABLE_PRODUCT_STATUSES = new Set(["sampling_collection"]);
const SAMPLE_ORDER_STATUS_FLOW = ["pending", "ordered", "arrived", "evaluating", "evaluated"] as const;

function sampleOptionEditBlockedMessage(status: string | null | undefined) {
  return `Sample options can only be edited while product is in sampling_collection; current status=${status || "unknown"}`;
}

function canSeeAllProducts(req: Request) {
  return req.user?.role === "product_manager" || req.user?.role === "admin";
}

function canAccessProduct(req: Request, product: { employeeId: string | null }) {
  if (canSeeAllProducts(req)) return true;
  return req.user?.role === "product_specialist" && product.employeeId === req.user.employeeId;
}

function sendProductAccessDenied(res: Response) {
  res.status(403).json({ error: "No permission to access this employee's sample data" });
}

async function loadProductForAccess(productId: string, req: Request, res: Response) {
  const [product] = await db
    .select({ id: productsTable.id, status: productsTable.status, employeeId: productsTable.employeeId })
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

async function ensureProductCanEditSamples(productId: string, req: Request, res: Response) {
  const product = await loadProductForAccess(productId, req, res);
  if (!product) return null;

  if (!SAMPLE_EDITABLE_PRODUCT_STATUSES.has(product.status)) {
    res.status(409).json({ error: sampleOptionEditBlockedMessage(product.status) });
    return null;
  }

  return product;
}

async function loadOptionForAccess(optionId: string, req: Request, res: Response) {
  const [option] = await db
    .select()
    .from(sampleOptionsTable)
    .where(eq(sampleOptionsTable.id, optionId));

  if (!option) {
    res.status(404).json({ error: "Sample option not found" });
    return null;
  }

  const product = await loadProductForAccess(option.productId, req, res);
  return product ? option : null;
}

async function ensureOptionCanEditSamples(optionId: string, req: Request, res: Response) {
  const [option] = await db
    .select()
    .from(sampleOptionsTable)
    .where(eq(sampleOptionsTable.id, optionId));

  if (!option) {
    res.status(404).json({ error: "Sample option not found" });
    return null;
  }

  const product = await ensureProductCanEditSamples(option.productId, req, res);
  return product ? option : null;
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

function serializeSampleOption(r: Record<string, unknown>) {
  return {
    ...r,
    sampleReviewScore: r.sampleReviewScore != null ? Number(r.sampleReviewScore) : null,
    samplingStartedAt: r.samplingStartedAt ? (r.samplingStartedAt as Date).toISOString() : null,
    sampleOrderedAt: r.sampleOrderedAt ? (r.sampleOrderedAt as Date).toISOString() : null,
    sampleArrivedAt: r.sampleArrivedAt ? (r.sampleArrivedAt as Date).toISOString() : null,
    sampleReviewStartedAt: r.sampleReviewStartedAt ? (r.sampleReviewStartedAt as Date).toISOString() : null,
    sampleReviewedAt: r.sampleReviewedAt ? (r.sampleReviewedAt as Date).toISOString() : null,
    selectedAt: r.selectedAt ? (r.selectedAt as Date).toISOString() : null,
    createdAt: r.createdAt ? (r.createdAt as Date).toISOString() : null,
    updatedAt: r.updatedAt ? (r.updatedAt as Date).toISOString() : null,
    shippingCost: r.shippingCost != null ? Number(r.shippingCost) : null,
  };
}

router.get("/sample-options", async (req, res) => {
  const { productId } = req.query as { productId?: string };
  let rows: Array<typeof sampleOptionsTable.$inferSelect> = [];
  if (productId) {
    if (!(await loadProductForAccess(productId, req, res))) return;
    rows = await db.select().from(sampleOptionsTable).where(eq(sampleOptionsTable.productId, productId));
  } else if (canSeeAllProducts(req)) {
    rows = await db.select().from(sampleOptionsTable);
  } else {
    const visibleProducts = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(eq(productsTable.employeeId, req.user?.employeeId || ""));
    const productIds = visibleProducts.map((product) => product.id);
    rows = productIds.length > 0
      ? await db.select().from(sampleOptionsTable).where(inArray(sampleOptionsTable.productId, productIds))
      : [];
  }
  res.json(rows.map(r => serializeSampleOption(r as Record<string, unknown>)));
});

router.get("/sample-options/:id", async (req, res) => {
  const row = await loadOptionForAccess(req.params.id, req, res);
  if (!row) return;
  res.json(serializeSampleOption(row as Record<string, unknown>));
});

router.post("/sample-options", async (req, res) => {
  const now = new Date();
  const id = randomUUID();
  const { productId, supplierName, link1688, contactStatus, material, packagingNote,
          remarks, optionLabel, createdBy, status, shippingCost } = req.body;

  if (!productId) { res.status(400).json({ error: "productId required" }); return; }
  if (!(await ensureProductCanEditSamples(productId, req, res))) return;

  await db.insert(sampleOptionsTable).values({
    id,
    productId,
    status: status || "draft",
    optionLabel: optionLabel || null,
    supplierName: supplierName || null,
    link1688: link1688 || null,
    contactStatus: contactStatus || null,
    material: material || null,
    packagingNote: packagingNote || null,
    remarks: remarks || null,
    shippingCost: shippingCost != null ? String(shippingCost) : null,
    createdBy: req.user?.name || createdBy || null,
    createdAt: now,
    updatedAt: now,
  });

  const [inserted] = await db.select().from(sampleOptionsTable).where(eq(sampleOptionsTable.id, id));
  res.status(201).json(serializeSampleOption(inserted as Record<string, unknown>));
});

router.put("/sample-options/:id", async (req, res) => {
  const now = new Date();
  const { id } = req.params;
  if (!(await ensureOptionCanEditSamples(id, req, res))) return;
  const {
    status, optionLabel, supplierName, link1688, contactStatus, material,
    packagingNote, remarks,
    sampleConsistentWithImage, sampleMaterialEval, sampleWorkmanshipEval,
    sampleFunctionEval, sampleRemarks, sampleReviewSummary, sampleReviewScore,
    sampleReviewedBy, sampleReviewedAt,
    samplingStartedBy, samplingStartedAt, sampleArrivedAt,
    selectionNote, selectedBy, selectedAt,
    shippingCost,
  } = req.body;

  const updates: Record<string, unknown> = { updatedAt: now };
  if (status !== undefined) updates.status = status;
  if (optionLabel !== undefined) updates.optionLabel = optionLabel;
  if (supplierName !== undefined) updates.supplierName = supplierName;
  if (link1688 !== undefined) updates.link1688 = link1688;
  if (contactStatus !== undefined) updates.contactStatus = contactStatus;
  if (material !== undefined) updates.material = material;
  if (packagingNote !== undefined) updates.packagingNote = packagingNote;
  if (remarks !== undefined) updates.remarks = remarks;
  if (sampleConsistentWithImage !== undefined) updates.sampleConsistentWithImage = sampleConsistentWithImage;
  if (sampleMaterialEval !== undefined) updates.sampleMaterialEval = sampleMaterialEval;
  if (sampleWorkmanshipEval !== undefined) updates.sampleWorkmanshipEval = sampleWorkmanshipEval;
  if (sampleFunctionEval !== undefined) updates.sampleFunctionEval = sampleFunctionEval;
  if (sampleRemarks !== undefined) updates.sampleRemarks = sampleRemarks;
  if (sampleReviewSummary !== undefined) updates.sampleReviewSummary = sampleReviewSummary;
  if (sampleReviewScore !== undefined) updates.sampleReviewScore = String(sampleReviewScore);
  if (sampleReviewedBy !== undefined) updates.sampleReviewedBy = sampleReviewedBy;
  if (sampleReviewedAt !== undefined) updates.sampleReviewedAt = sampleReviewedAt ? new Date(sampleReviewedAt) : null;
  if (samplingStartedBy !== undefined) updates.samplingStartedBy = samplingStartedBy;
  if (samplingStartedAt !== undefined) updates.samplingStartedAt = samplingStartedAt ? new Date(samplingStartedAt) : null;
  if (sampleArrivedAt !== undefined) updates.sampleArrivedAt = sampleArrivedAt ? new Date(sampleArrivedAt) : null;
  if (selectionNote !== undefined) updates.selectionNote = selectionNote;
  if (selectedBy !== undefined) updates.selectedBy = selectedBy;
  if (selectedAt !== undefined) updates.selectedAt = selectedAt ? new Date(selectedAt) : null;
  if (shippingCost !== undefined) updates.shippingCost = shippingCost != null ? String(shippingCost) : null;

  await db.update(sampleOptionsTable).set(updates as any).where(eq(sampleOptionsTable.id, id));
  const [updated] = await db.select().from(sampleOptionsTable).where(eq(sampleOptionsTable.id, id));
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serializeSampleOption(updated as Record<string, unknown>));
});

router.delete("/sample-options/:id", async (req, res) => {
  const { id } = req.params;

  if (!(await ensureOptionCanEditSamples(id, req, res))) return;

  // 级联删除：先删该方案下所有SKU行，再删方案本身
  await db.delete(sampleSkuLinesTable).where(eq(sampleSkuLinesTable.sampleOptionId, id));
  await db.delete(sampleOptionsTable).where(eq(sampleOptionsTable.id, id));

  res.json({ ok: true });
});

// 图片代理路由 - 用于解决跨域问题和CORS限制
router.patch("/sample-options/:id/status", async (req, res) => {
  const { id } = req.params;
  const { sampleOrderStatus } = req.body;

  if (!sampleOrderStatus) {
    res.status(400).json({ error: "sampleOrderStatus required" });
    return;
  }

  if (!SAMPLE_ORDER_STATUS_FLOW.includes(sampleOrderStatus)) {
    res.status(400).json({ error: "Invalid sampleOrderStatus" });
    return;
  }

  const option = await ensureOptionCanEditSamples(id, req, res);
  if (!option) return;

  const currentStatus = option.sampleOrderStatus || "pending";
  const currentIndex = SAMPLE_ORDER_STATUS_FLOW.indexOf(currentStatus as any);
  const nextIndex = SAMPLE_ORDER_STATUS_FLOW.indexOf(sampleOrderStatus);
  if (currentIndex < 0 || nextIndex <= currentIndex) {
    res.status(409).json({ error: `Invalid sample order status transition: ${currentStatus} -> ${sampleOrderStatus}` });
    return;
  }

  const allowedNextByStatus: Record<string, string[]> = {
    pending: ["ordered", "arrived"],
    ordered: ["arrived"],
    arrived: ["evaluating"],
    evaluating: ["evaluated"],
    evaluated: [],
  };
  if (!allowedNextByStatus[currentStatus]?.includes(sampleOrderStatus)) {
    res.status(409).json({ error: `Invalid sample order status transition: ${currentStatus} -> ${sampleOrderStatus}` });
    return;
  }

  if (sampleOrderStatus === "evaluated") {
    const skuRows = await db
      .select({
        anomalyType: sampleSkuLinesTable.anomalyType,
        skuConsistentWithImage: sampleSkuLinesTable.skuConsistentWithImage,
        skuMaterialEval: sampleSkuLinesTable.skuMaterialEval,
        skuWorkmanshipEval: sampleSkuLinesTable.skuWorkmanshipEval,
        skuFunctionEval: sampleSkuLinesTable.skuFunctionEval,
      })
      .from(sampleSkuLinesTable)
      .where(eq(sampleSkuLinesTable.sampleOptionId, id));
    const incompleteSku = skuRows.find((sku) => !isSampleSkuEvaluationComplete(sku));
    if (incompleteSku) {
      res.status(400).json({ error: "All non-anomaly SKUs must have complete evaluation before option can be evaluated" });
      return;
    }
  }

  const now = new Date();
  const updates: Record<string, unknown> = { sampleOrderStatus, updatedAt: now };
  if (sampleOrderStatus === "ordered" && !option.sampleOrderedAt) {
    updates.sampleOrderedAt = now;
  }
  if (sampleOrderStatus === "arrived" && !option.sampleArrivedAt) {
    updates.sampleArrivedAt = now;
  }
  
  // 当状态从 arrived 改为 evaluating 时，记录评价开始时间
  if (sampleOrderStatus === "evaluating") {
    updates.sampleReviewStartedAt = now;
  }
  
  // 当状态设为 evaluated 时，记录评价完成时间
  if (sampleOrderStatus === "evaluated") {
    updates.sampleReviewedAt = now;
  }
  
  await db.update(sampleOptionsTable)
    .set(updates as any)
    .where(eq(sampleOptionsTable.id, id));

  const [updated] = await db.select().from(sampleOptionsTable).where(eq(sampleOptionsTable.id, id));
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serializeSampleOption(updated as Record<string, unknown>));
});

export default router;
