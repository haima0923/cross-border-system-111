import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const procurementTasksTable = pgTable("procurement_tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category"),
  detail: text("detail").notNull(),
  referenceImageUrl: text("reference_image_url"),
  referenceLink: text("reference_link"),
  assigneeMode: text("assignee_mode").notNull().default("all"),
  status: text("status").notNull().default("published"),
  createdById: text("created_by_id"),
  createdByName: text("created_by_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  publishedAt: timestamp("published_at"),
  closedAt: timestamp("closed_at"),
});

export type ProcurementTask = typeof procurementTasksTable.$inferSelect;
export type NewProcurementTask = typeof procurementTasksTable.$inferInsert;
