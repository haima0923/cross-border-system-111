import { pgTable, text, boolean, numeric, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod";

export const sampleSkuLinesTable = pgTable("sample_sku_lines", {
  id: text("id").primaryKey(),
  sampleOptionId: text("sample_option_id").notNull(),
  skuName: text("sku_name"),
  attributes: jsonb("attributes").$type<Record<string, string>>(),
  unitPrice: numeric("unit_price"),
  moq: integer("moq"),
  weight: numeric("weight"),
  dimensions: jsonb("dimensions").$type<{ length?: number; width?: number; height?: number }>(),
  imageUrl: text("image_url"),
  hostedImageUrl: text("hosted_image_url"),
  recommended: boolean("recommended").default(false),
  managerSelected: boolean("manager_selected").default(false),
  purchaseQuantity: integer("purchase_quantity"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InsertSampleSkuLine = Omit<typeof sampleSkuLinesTable.$inferInsert, "id">;
export const insertSampleSkuLineSchema = z.object({}).passthrough() as z.ZodType<InsertSampleSkuLine>;
export type SampleSkuLine = typeof sampleSkuLinesTable.$inferSelect;