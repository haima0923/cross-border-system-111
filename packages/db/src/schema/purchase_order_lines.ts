import { pgTable, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";

export const purchaseOrderLinesTable = pgTable("purchase_order_lines", {
  id: text("id").primaryKey(),
  purchaseOrderId: text("purchase_order_id").notNull(),
  sampleSkuLineId: text("sample_sku_line_id"),
  skuDescription: text("sku_description"),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price").notNull(),
  totalAmount: numeric("total_amount").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertPurchaseOrderLine = Omit<typeof purchaseOrderLinesTable.$inferInsert, "id">;
export const insertPurchaseOrderLineSchema = z.object({}).passthrough() as z.ZodType<InsertPurchaseOrderLine>;
export type PurchaseOrderLine = typeof purchaseOrderLinesTable.$inferSelect;