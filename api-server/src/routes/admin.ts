import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate } from "../middleware/authenticate";

const router = Router();

const VALID_ROLES = ["product_specialist", "product_manager", "admin"];

function requireAdmin(req: Parameters<typeof authenticate>[0], res: Parameters<typeof authenticate>[1], next: Parameters<typeof authenticate>[2]) {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "仅管理员可操作" });
    return;
  }
  next();
}

// GET /admin/users — list all users
router.get("/admin/users", authenticate, requireAdmin, async (_req, res) => {
  const users = await db
    .select({
      id: usersTable.id,
      employeeId: usersTable.employeeId,
      name: usersTable.name,
      role: usersTable.role,
      status: usersTable.status,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(usersTable.createdAt);

  res.json(users);
});

// POST /admin/users — create user
router.post("/admin/users", authenticate, requireAdmin, async (req, res) => {
  const { employeeId, name, password, role } = req.body as {
    employeeId?: string;
    name?: string;
    password?: string;
    role?: string;
  };

  if (!employeeId || !employeeId.trim()) {
    res.status(400).json({ error: "账号不能为空" });
    return;
  }
  if (!name || !name.trim()) {
    res.status(400).json({ error: "姓名不能为空" });
    return;
  }
  if (!password || password.length < 6) {
    res.status(400).json({ error: "密码不能为空且至少 6 位" });
    return;
  }
  if (!role || !VALID_ROLES.includes(role)) {
    res.status(400).json({ error: `角色必须是以下之一：${VALID_ROLES.join(", ")}` });
    return;
  }

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.employeeId, employeeId.trim()));

  if (existing) {
    res.status(409).json({ error: "账号已存在，请换一个" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();

  const [created] = await db
    .insert(usersTable)
    .values({
      id: randomUUID(),
      employeeId: employeeId.trim(),
      name: name.trim(),
      role,
      passwordHash,
      status: "active",
      createdAt: now,
      updatedAt: now,
    })
    .returning({
      id: usersTable.id,
      employeeId: usersTable.employeeId,
      name: usersTable.name,
      role: usersTable.role,
      status: usersTable.status,
      createdAt: usersTable.createdAt,
    });

  res.status(201).json(created);
});

// PATCH /admin/users/:id/status — enable or disable
router.patch("/admin/users/:id/status", authenticate, requireAdmin, async (req, res) => {
  const id = String(req.params.id);
  const { status } = req.body as { status?: string };

  if (status !== "active" && status !== "disabled") {
    res.status(400).json({ error: "状态只能是 active 或 disabled" });
    return;
  }

  // Prevent disabling own account
  if (req.user!.id === id) {
    res.status(400).json({ error: "不能禁用自己的账号" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(usersTable.id, id))
    .returning({ id: usersTable.id, status: usersTable.status });

  if (!updated) {
    res.status(404).json({ error: "用户不存在" });
    return;
  }

  res.json(updated);
});

// PATCH /admin/self — admin updates own employeeId and/or password
router.patch("/admin/self", authenticate, requireAdmin, async (req, res) => {
  const { newEmployeeId, newPassword } = req.body as {
    newEmployeeId?: string;
    newPassword?: string;
  };

  if (!newEmployeeId && !newPassword) {
    res.status(400).json({ error: "请至少提供新账号名或新密码" });
    return;
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (newEmployeeId && newEmployeeId.trim()) {
    const trimmed = newEmployeeId.trim();
    // Check uniqueness (excluding self)
    const [conflict] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.employeeId, trimmed));

    if (conflict && conflict.id !== req.user!.id) {
      res.status(409).json({ error: "该账号名已被占用" });
      return;
    }
    updates.employeeId = trimmed;
  }

  if (newPassword) {
    if (newPassword.length < 6) {
      res.status(400).json({ error: "密码至少 6 位" });
      return;
    }
    updates.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.user!.id))
    .returning({
      id: usersTable.id,
      employeeId: usersTable.employeeId,
      name: usersTable.name,
      role: usersTable.role,
    });

  if (!updated) {
    res.status(404).json({ error: "用户不存在" });
    return;
  }

  res.json({ ...updated, message: "修改成功，请重新登录" });
});

export default router;
