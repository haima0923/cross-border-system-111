import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { productsTable, purchaseOrdersTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { CreatePurchaseOrderBody } from "@workspace/api-zod";

const router: IRouter = Router();

function canSeeAll(req: Request) {
  return req.user?.role === "product_manager" || req.user?.role === "admin";
}

function canAccessProduct(req: Request, product: { employeeId: string | null }) {
  if (canSeeAll(req)) return true;
  return req.user?.role === "product_specialist" && product.employeeId === req.user.employeeId;
}

function sendAccessDenied(res: Response) {
  res.status(403).json({ error: "No permission to access this employee's purchase order" });
}

async function loadProductForAccess(req: Request, res: Response, productId: string) {
  const [product] = await db
    .select({ id: productsTable.id, employeeId: productsTable.employeeId })
    .from(productsTable)
    .where(eq(productsTable.id, productId));

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return null;
  }

  if (!canAccessProduct(req, product)) {
    sendAccessDenied(res);
    return null;
  }

  return product;
}

function serialize(p: Record<string, unknown>) {
  return {
    ...p,
    purchasePrice: p.purchasePrice != null ? Number(p.purchasePrice) : null,
    quantity: p.quantity != null ? Number(p.quantity) : null,
    totalAmount: p.totalAmount != null ? Number(p.totalAmount) : null,
  };
}

router.get("/purchase-orders", async (req, res) => {
  if (canSeeAll(req)) {
    const rows = await db.select().from(purchaseOrdersTable);
    res.json(rows.map((r) => serialize(r as Record<string, unknown>)));
    return;
  }

  const visibleProducts = await db
    .select({ id: productsTable.id })
    .from(productsTable)
    .where(eq(productsTable.employeeId, req.user?.employeeId || ""));
  const productIds = visibleProducts.map((product) => product.id);
  const rows = productIds.length > 0
    ? await db.select().from(purchaseOrdersTable).where(inArray(purchaseOrdersTable.productId, productIds))
    : [];
  res.json(rows.map((r) => serialize(r as Record<string, unknown>)));
});

router.post("/purchase-orders", async (req, res) => {
  const body = CreatePurchaseOrderBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const now = new Date();
  const id = randomUUID();
  if (!(await loadProductForAccess(req, res, body.data.productId))) return;

  await db.insert(purchaseOrdersTable).values({
    id,
    productId: body.data.productId,
    productName: body.data.productName,
    supplierName: body.data.supplierName,
    purchasePrice: body.data.purchasePrice.toString(),
    quantity: body.data.quantity,
    totalAmount: body.data.totalAmount.toString(),
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });

  const [order] = await db
    .select()
    .from(purchaseOrdersTable)
    .where(eq(purchaseOrdersTable.id, id));
  res.status(201).json(serialize(order as Record<string, unknown>));
});

router.put("/purchase-orders/:id", async (req, res) => {
  const { id } = req.params;
  const body = req.body as Record<string, unknown>;

  const [existing] = await db
    .select()
    .from(purchaseOrdersTable)
    .where(eq(purchaseOrdersTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Purchase order not found" });
    return;
  }
  if (!(await loadProductForAccess(req, res, existing.productId))) return;

  const validStatuses = ["pending", "ordered", "arrived", "completed"];
  const newStatus = typeof body.status === "string" && validStatuses.includes(body.status)
    ? body.status
    : existing.status;
  const operatorName = req.user?.name || (typeof body.operator === "string" ? body.operator : undefined);

  const updates: Record<string, unknown> = {
    status: newStatus,
    updatedAt: new Date(),
  };

  if (operatorName) updates.operator = operatorName;
  if (typeof body.orderedAt === "string") updates.orderedAt = new Date(body.orderedAt);
  if (typeof body.arrivedAt === "string") updates.arrivedAt = new Date(body.arrivedAt);
  if (typeof body.completedAt === "string") updates.completedAt = new Date(body.completedAt);
  if (typeof body.quantity === "number") updates.quantity = body.quantity;
  if (typeof body.totalAmount === "number") updates.totalAmount = body.totalAmount.toString();

  await db
    .update(purchaseOrdersTable)
    .set(updates)
    .where(eq(purchaseOrdersTable.id, id));

  const [order] = await db
    .select()
    .from(purchaseOrdersTable)
    .where(eq(purchaseOrdersTable.id, id));
  res.json(serialize(order as Record<string, unknown>));
});

export default router;
