import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sampleOptionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const router: IRouter = Router();

function serializeSampleOption(r: Record<string, unknown>) {
  return {
    ...r,
    sampleReviewScore: r.sampleReviewScore != null ? Number(r.sampleReviewScore) : null,
    samplingStartedAt: r.samplingStartedAt ? (r.samplingStartedAt as Date).toISOString() : null,
    sampleArrivedAt: r.sampleArrivedAt ? (r.sampleArrivedAt as Date).toISOString() : null,
    sampleReviewedAt: r.sampleReviewedAt ? (r.sampleReviewedAt as Date).toISOString() : null,
    selectedAt: r.selectedAt ? (r.selectedAt as Date).toISOString() : null,
    createdAt: r.createdAt ? (r.createdAt as Date).toISOString() : null,
    updatedAt: r.updatedAt ? (r.updatedAt as Date).toISOString() : null,
  };
}

router.get("/sample-options", async (req, res) => {
  const { productId } = req.query as { productId?: string };
  const rows = await db.select().from(sampleOptionsTable);
  const filtered = productId ? rows.filter(r => r.productId === productId) : rows;
  res.json(filtered.map(r => serializeSampleOption(r as Record<string, unknown>)));
});

router.get("/sample-options/:id", async (req, res) => {
  const [row] = await db.select().from(sampleOptionsTable).where(eq(sampleOptionsTable.id, req.params.id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serializeSampleOption(row as Record<string, unknown>));
});

router.post("/sample-options", async (req, res) => {
  const now = new Date();
  const id = randomUUID();
  const { productId, supplierName, link1688, contactStatus, material, packagingNote,
          remarks, optionLabel, createdBy, status } = req.body;

  if (!productId) { res.status(400).json({ error: "productId required" }); return; }

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
    createdBy: createdBy || null,
    createdAt: now,
    updatedAt: now,
  });

  const [inserted] = await db.select().from(sampleOptionsTable).where(eq(sampleOptionsTable.id, id));
  res.status(201).json(serializeSampleOption(inserted as Record<string, unknown>));
});

router.put("/sample-options/:id", async (req, res) => {
  const now = new Date();
  const { id } = req.params;
  const {
    status, optionLabel, supplierName, link1688, contactStatus, material,
    packagingNote, remarks,
    sampleConsistentWithImage, sampleMaterialEval, sampleWorkmanshipEval,
    sampleFunctionEval, sampleRemarks, sampleReviewSummary, sampleReviewScore,
    sampleReviewedBy, sampleReviewedAt,
    samplingStartedBy, samplingStartedAt, sampleArrivedAt,
    selectionNote, selectedBy, selectedAt,
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

  await db.update(sampleOptionsTable).set(updates as any).where(eq(sampleOptionsTable.id, id));
  const [updated] = await db.select().from(sampleOptionsTable).where(eq(sampleOptionsTable.id, id));
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serializeSampleOption(updated as Record<string, unknown>));
});

export default router;
