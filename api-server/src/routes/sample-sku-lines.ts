import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sampleSkuLinesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const router: IRouter = Router();

function serializeSkuLine(r: Record<string, unknown>) {
  return {
    ...r,
    unitPrice: r.unitPrice != null ? Number(r.unitPrice) : null,
    moq: r.moq != null ? Number(r.moq) : null,
    weight: r.weight != null ? Number(r.weight) : null,
    createdAt: r.createdAt ? (r.createdAt as Date).toISOString() : null,
    updatedAt: r.updatedAt ? (r.updatedAt as Date).toISOString() : null,
  };
}

router.get("/sample-sku-lines", async (req, res) => {
  const { sampleOptionId } = req.query as { sampleOptionId?: string };
  const rows = await db.select().from(sampleSkuLinesTable);
  const filtered = sampleOptionId ? rows.filter(r => r.sampleOptionId === sampleOptionId) : rows;
  res.json(filtered.map(r => serializeSkuLine(r as Record<string, unknown>)));
});

router.post("/sample-sku-lines", async (req, res) => {
  const now = new Date();
  const { sampleOptionId, skuName, attributes, unitPrice, moq, weight, dimensions,
          imageUrl, recommended, purchaseQuantity, notes } = req.body;

  if (!sampleOptionId) { res.status(400).json({ error: "sampleOptionId required" }); return; }

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
  });

  const [inserted] = await db.select().from(sampleSkuLinesTable).where(eq(sampleSkuLinesTable.id, id));
  res.status(201).json(serializeSkuLine(inserted as Record<string, unknown>));
});

router.put("/sample-sku-lines/:id", async (req, res) => {
  const now = new Date();
  const { id } = req.params;
  const { skuName, attributes, unitPrice, moq, weight, dimensions,
          imageUrl, recommended, managerSelected, purchaseQuantity, notes } = req.body;

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

  await db.update(sampleSkuLinesTable).set(updates as any).where(eq(sampleSkuLinesTable.id, id));
  const [updated] = await db.select().from(sampleSkuLinesTable).where(eq(sampleSkuLinesTable.id, id));
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serializeSkuLine(updated as Record<string, unknown>));
});

router.delete("/sample-sku-lines/:id", async (req, res) => {
  await db.delete(sampleSkuLinesTable).where(eq(sampleSkuLinesTable.id, req.params.id));
  res.json({ ok: true });
});

export default router;
