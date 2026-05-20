import { pgTable, text, boolean, numeric, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";

export const sampleOptionsTable = pgTable("sample_options", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  status: text("status").notNull().default("draft"),
  optionLabel: text("option_label"),
  supplierName: text("supplier_name"),
  link1688: text("link_1688"),
  shippingCost: numeric("shipping_cost"),
  contactStatus: text("contact_status"),
  material: text("material"),
  packagingNote: text("packaging_note"),
  remarks: text("remarks"),
  sampleConsistentWithImage: boolean("sample_consistent_with_image"),
  sampleMaterialEval: text("sample_material_eval"),
  sampleWorkmanshipEval: text("sample_workmanship_eval"),
  sampleFunctionEval: text("sample_function_eval"),
  sampleRemarks: text("sample_remarks"),
  sampleReviewSummary: text("sample_review_summary"),
  sampleReviewScore: numeric("sample_review_score"),
  sampleReviewedBy: text("sample_reviewed_by"),
  sampleReviewedAt: timestamp("sample_reviewed_at"),
  samplingStartedBy: text("sampling_started_by"),
  samplingStartedAt: timestamp("sampling_started_at"),
  sampleOrderStatus: text("sample_order_status").notNull().default("pending"),
  sampleOrderedAt: timestamp("sample_ordered_at"),
  sampleArrivedAt: timestamp("sample_arrived_at"),
  selectionNote: text("selection_note"),
  selectedBy: text("selected_by"),
  selectedAt: timestamp("selected_at"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InsertSampleOption = Omit<typeof sampleOptionsTable.$inferInsert, "id">;
export const insertSampleOptionSchema = z.object({}).passthrough() as z.ZodType<InsertSampleOption>;
export type SampleOption = typeof sampleOptionsTable.$inferSelect;