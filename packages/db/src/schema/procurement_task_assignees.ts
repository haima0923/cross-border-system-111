import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const procurementTaskAssigneesTable = pgTable(
  "procurement_task_assignees",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").notNull(),
    employeeId: text("employee_id").notNull(),
    employeeName: text("employee_name"),
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
    readAt: timestamp("read_at"),
  },
  table => ({
    taskEmployeeUnique: uniqueIndex("procurement_task_assignees_task_employee_uq").on(table.taskId, table.employeeId),
  }),
);

export type ProcurementTaskAssignee = typeof procurementTaskAssigneesTable.$inferSelect;
export type NewProcurementTaskAssignee = typeof procurementTaskAssigneesTable.$inferInsert;
