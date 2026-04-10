import { pgTable, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";

export const purchaseOrdersTable = pgTable("purchase_orders", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  productName: text("product_name").notNull(),
  supplierName: text("supplier_name").notNull(),
  sampleOptionId: text("sample_option_id"),
  purchasePrice: numeric("purchase_price").notNull(),
  quantity: integer("quantity").notNull(),
  totalAmount: numeric("total_amount").notNull(),
  status: text("status").notNull().default("pending"),
  operator: text("operator"),
  orderedAt: timestamp("ordered_at"),
  arrivedAt: timestamp("arrived_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InsertPurchaseOrder = Omit<typeof purchaseOrdersTable.$inferInsert, "id">;
export const insertPurchaseOrderSchema = z.object({}).passthrough() as z.ZodType<InsertPurchaseOrder>;
export type PurchaseOrder = typeof purchaseOrdersTable.$inferSelect;