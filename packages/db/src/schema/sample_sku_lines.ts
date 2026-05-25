import { pgTable, text, boolean, numeric, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod";

export type SkuAnomalyHistoryEntry = {
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

export const sampleSkuLinesTable = pgTable("sample_sku_lines", {
  id: text("id").primaryKey(),
  sampleOptionId: text("sample_option_id").notNull(),
  skuCode: text("sku_code"),
  skuCodeSuffix: integer("sku_code_suffix"),
  skuCodeAssignedAt: timestamp("sku_code_assigned_at"),
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
  // 采购池改造 - SKU级状态字段
  purchaseStatus: text("purchase_status").notNull().default("pending_purchase"),
  orderedAt: timestamp("ordered_at"),
  arrivedAt: timestamp("arrived_at"),
  inspectingStartedAt: timestamp("inspecting_started_at"),
  passedAt: timestamp("passed_at"),
  completedAt: timestamp("completed_at"),
  // 异常相关字段
  anomalyType: text("anomaly_type"),
  anomalyNote: text("anomaly_note"),
  anomalyReportedAt: timestamp("anomaly_reported_at"),
  anomalyReportedBy: text("anomaly_reported_by"),
  anomalyHandlingMethod: text("anomaly_handling_method"),
  anomalyHandlingNote: text("anomaly_handling_note"),
  anomalyHandledBy: text("anomaly_handled_by"),
  anomalyHandledAt: timestamp("anomaly_handled_at"),
  anomalyResolvedAt: timestamp("anomaly_resolved_at"),
  anomalyImages: jsonb("anomaly_images").$type<string[]>(),
  anomalyHistory: jsonb("anomaly_history").$type<SkuAnomalyHistoryEntry[]>().default([]),
  // SKU级验样评价字段
  skuConsistentWithImage: boolean("sku_consistent_with_image"),
  skuMaterialEval: text("sku_material_eval"),
  skuWorkmanshipEval: text("sku_workmanship_eval"),
  skuFunctionEval: text("sku_function_eval"),
  skuRemarks: text("sku_remarks"),
  packingQuantity: integer("packing_quantity"),
});

export type InsertSampleSkuLine = Omit<typeof sampleSkuLinesTable.$inferInsert, "id">;
export const insertSampleSkuLineSchema = z.object({}).passthrough() as z.ZodType<InsertSampleSkuLine>;
export type SampleSkuLine = typeof sampleSkuLinesTable.$inferSelect;
