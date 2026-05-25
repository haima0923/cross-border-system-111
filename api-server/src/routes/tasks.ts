import { Router, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  procurementTasksTable,
  procurementTaskAssigneesTable,
  usersTable,
} from "@workspace/db";

const router = Router();

function requireManager(req: Request, res: Response) {
  if (req.user?.role !== "product_manager") {
    res.status(403).json({ error: "仅产品经理可操作采购任务" });
    return false;
  }
  return true;
}

function requireSpecialist(req: Request, res: Response) {
  if (req.user?.role !== "product_specialist") {
    res.status(403).json({ error: "仅产品专员可读取采购任务" });
    return false;
  }
  return true;
}

function serializeTask(task: Record<string, unknown>, extras: Record<string, unknown> = {}) {
  return {
    ...task,
    ...extras,
  };
}

async function getEligibleTask(taskId: string, employeeId: string) {
  const [task] = await db
    .select()
    .from(procurementTasksTable)
    .where(eq(procurementTasksTable.id, taskId));

  if (!task || task.status !== "published") return null;
  if (task.assigneeMode === "all") return task;

  const [assignee] = await db
    .select()
    .from(procurementTaskAssigneesTable)
    .where(and(
      eq(procurementTaskAssigneesTable.taskId, taskId),
      eq(procurementTaskAssigneesTable.employeeId, employeeId),
    ));

  return assignee ? task : null;
}

router.get("/tasks/specialists", async (req, res) => {
  if (!requireManager(req, res)) return;

  const users = await db
    .select({
      employeeId: usersTable.employeeId,
      name: usersTable.name,
      status: usersTable.status,
    })
    .from(usersTable)
    .where(eq(usersTable.role, "product_specialist"));

  res.json(users);
});

router.get("/tasks", async (req, res) => {
  const role = req.user?.role;

  if (role === "product_manager") {
    const [tasks, assignees] = await Promise.all([
      db.select().from(procurementTasksTable).orderBy(desc(procurementTasksTable.createdAt)),
      db.select().from(procurementTaskAssigneesTable),
    ]);

    res.json(tasks.map(task => serializeTask(task as Record<string, unknown>, {
      assignees: assignees.filter(item => item.taskId === task.id),
    })));
    return;
  }

  if (role === "product_specialist") {
    const employeeId = req.user!.employeeId;
    const [tasks, assignees] = await Promise.all([
      db.select().from(procurementTasksTable).orderBy(desc(procurementTasksTable.createdAt)),
      db.select().from(procurementTaskAssigneesTable).where(eq(procurementTaskAssigneesTable.employeeId, employeeId)),
    ]);
    const assigneeByTask = new Map(assignees.map(item => [item.taskId, item]));
    const explicitTaskIds = new Set(assignees.map(item => item.taskId));

    const visibleTasks = tasks.filter(task =>
      task.status !== "draft" &&
      (task.assigneeMode === "all" || explicitTaskIds.has(task.id))
    );

    res.json(visibleTasks.map(task => serializeTask(task as Record<string, unknown>, {
      readAt: assigneeByTask.get(task.id)?.readAt ?? null,
    })));
    return;
  }

  res.status(403).json({ error: "当前角色不可读取采购任务" });
});

router.post("/tasks", async (req, res) => {
  if (!requireManager(req, res)) return;

  const {
    title,
    category,
    detail,
    referenceImageUrl,
    referenceLink,
    assigneeMode,
    assigneeEmployeeIds,
  } = req.body as {
    title?: string;
    category?: string;
    detail?: string;
    referenceImageUrl?: string | null;
    referenceLink?: string | null;
    assigneeMode?: "all" | "specific";
    assigneeEmployeeIds?: string[];
  };

  if (!title?.trim()) {
    res.status(400).json({ error: "任务标题不能为空" });
    return;
  }
  if (!detail?.trim()) {
    res.status(400).json({ error: "任务详情不能为空" });
    return;
  }
  const mode = assigneeMode === "specific" ? "specific" : "all";
  const employeeIds = Array.isArray(assigneeEmployeeIds)
    ? Array.from(new Set(assigneeEmployeeIds.filter(Boolean)))
    : [];
  if (mode === "specific" && employeeIds.length === 0) {
    res.status(400).json({ error: "指定员工发布时，请至少选择一名产品专员" });
    return;
  }

  const now = new Date();
  const taskId = randomUUID();
  const specialists = mode === "specific"
    ? (await db
        .select()
        .from(usersTable)
        .where(inArray(usersTable.employeeId, employeeIds)))
        .filter(user => user.role === "product_specialist" && user.status === "active")
    : [];

  if (mode === "specific" && specialists.length === 0) {
    res.status(400).json({ error: "没有找到可分配的产品专员" });
    return;
  }

  await db.insert(procurementTasksTable).values({
    id: taskId,
    title: title.trim(),
    category: category?.trim() || null,
    detail: detail.trim(),
    referenceImageUrl: referenceImageUrl || null,
    referenceLink: referenceLink?.trim() || null,
    assigneeMode: mode,
    status: "published",
    createdById: req.user?.employeeId ?? null,
    createdByName: req.user?.name ?? "产品经理",
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
  });

  if (mode === "specific") {
    await db.insert(procurementTaskAssigneesTable).values(specialists.map(user => ({
      id: randomUUID(),
      taskId,
      employeeId: user.employeeId,
      employeeName: user.name,
      assignedAt: now,
    })));
  }

  const [created] = await db
    .select()
    .from(procurementTasksTable)
    .where(eq(procurementTasksTable.id, taskId));
  const assignees = await db
    .select()
    .from(procurementTaskAssigneesTable)
    .where(eq(procurementTaskAssigneesTable.taskId, taskId));

  res.status(201).json(serializeTask(created as Record<string, unknown>, { assignees }));
});

router.patch("/tasks/:id", async (req, res) => {
  if (!requireManager(req, res)) return;

  const [existing] = await db
    .select()
    .from(procurementTasksTable)
    .where(eq(procurementTasksTable.id, req.params.id));
  if (!existing) {
    res.status(404).json({ error: "任务不存在" });
    return;
  }

  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };
  const { title, category, detail, referenceImageUrl, referenceLink, status } = req.body as Record<string, unknown>;

  if (typeof title === "string") updates.title = title.trim();
  if (typeof category === "string" || category === null) updates.category = category ? String(category).trim() : null;
  if (typeof detail === "string") updates.detail = detail.trim();
  if (typeof referenceImageUrl === "string" || referenceImageUrl === null) updates.referenceImageUrl = referenceImageUrl || null;
  if (typeof referenceLink === "string" || referenceLink === null) updates.referenceLink = referenceLink ? String(referenceLink).trim() : null;
  if (status === "closed") {
    updates.status = "closed";
    updates.closedAt = now;
  }
  if (status === "published") {
    updates.status = "published";
    updates.closedAt = null;
    updates.publishedAt = existing.publishedAt ?? now;
  }

  const [updated] = await db
    .update(procurementTasksTable)
    .set(updates)
    .where(eq(procurementTasksTable.id, req.params.id))
    .returning();
  const assignees = await db
    .select()
    .from(procurementTaskAssigneesTable)
    .where(eq(procurementTaskAssigneesTable.taskId, req.params.id));

  res.json(serializeTask(updated as Record<string, unknown>, { assignees }));
});

router.post("/tasks/:id/read", async (req, res) => {
  if (!requireSpecialist(req, res)) return;

  const task = await getEligibleTask(req.params.id, req.user!.employeeId);
  if (!task) {
    res.status(404).json({ error: "任务不存在或未分配给当前员工" });
    return;
  }

  const now = new Date();
  const [updated] = await db
    .insert(procurementTaskAssigneesTable)
    .values({
      id: randomUUID(),
      taskId: task.id,
      employeeId: req.user!.employeeId,
      employeeName: req.user!.name,
      assignedAt: now,
      readAt: now,
    })
    .onConflictDoUpdate({
      target: [procurementTaskAssigneesTable.taskId, procurementTaskAssigneesTable.employeeId],
      set: {
        employeeName: req.user!.name,
        readAt: now,
      },
    })
    .returning();

  res.json(updated);
});

export default router;
