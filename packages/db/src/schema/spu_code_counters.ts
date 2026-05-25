import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const spuCodeCountersTable = pgTable("spu_code_counters", {
  period: text("period").primaryKey(),
  currentSequence: integer("current_sequence").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SpuCodeCounter = typeof spuCodeCountersTable.$inferSelect;
