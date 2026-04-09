import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1000;

router.post("/auth/login", async (req, res) => {
  if (!JWT_SECRET) {
    res.status(500).json({ error: "服务器配置错误：JWT_SECRET 未设置" });
    return;
  }

  const { employeeId, password } = req.body as {
    employeeId?: string;
    password?: string;
  };

  if (!employeeId || !password) {
    res.status(400).json({ error: "工号和密码为必填项" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.employeeId, employeeId));

  if (!user) {
    res.status(401).json({ error: "工号或密码错误" });
    return;
  }

  if (user.status === "disabled") {
    res.status(403).json({ error: "账号已被禁用，请联系管理员" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "工号或密码错误" });
    return;
  }

  const payload = {
    id: user.id,
    employeeId: user.employeeId,
    name: user.name,
    role: user.role,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });

  const isSecure =
    req.secure || req.headers["x-forwarded-proto"] === "https";

  res.cookie("token", token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
  });

  res.json({
    name: user.name,
    role: user.role,
    employeeId: user.employeeId,
  });
});

router.get("/auth/me", (req, res) => {
  if (!JWT_SECRET) {
    res.status(500).json({ error: "服务器配置错误：JWT_SECRET 未设置" });
    return;
  }

  const token = req.cookies?.token;
  if (!token) {
    res.status(401).json({ error: "未登录" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      employeeId: string;
      name: string;
      role: string;
    };
    res.json({
      name: decoded.name,
      role: decoded.role,
      employeeId: decoded.employeeId,
    });
  } catch {
    res.status(401).json({ error: "登录已过期，请重新登录" });
  }
});

router.post("/auth/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "lax",
  });
  res.json({ message: "已退出" });
});

export default router;
