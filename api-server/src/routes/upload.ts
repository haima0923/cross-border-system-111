import { Router, type IRouter } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";

const router: IRouter = Router();

// 确保上传目录存在
const UPLOAD_ROOT = process.env.UPLOAD_ROOT || path.resolve(process.cwd(), "uploads");
const ANOMALY_DIR = path.join(UPLOAD_ROOT, "anomaly");
const SKU_DIR = path.join(UPLOAD_ROOT, "sku");
const TASK_DIR = path.join(UPLOAD_ROOT, "tasks");
if (!fs.existsSync(ANOMALY_DIR)) {
  fs.mkdirSync(ANOMALY_DIR, { recursive: true });
}
if (!fs.existsSync(SKU_DIR)) {
  fs.mkdirSync(SKU_DIR, { recursive: true });
}
if (!fs.existsSync(TASK_DIR)) {
  fs.mkdirSync(TASK_DIR, { recursive: true });
}

function makeStorage(dir: string) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, randomUUID() + ext);
    },
  });
}

function makeUpload(dir: string) {
  return multer({
    storage: makeStorage(dir),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("只支持 jpg/png/gif/webp 格式图片"));
      }
    },
  });
}

router.post("/upload/sku-image", makeUpload(SKU_DIR).single("image"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "未收到文件" });
    return;
  }
  const url = "/uploads/sku/" + req.file.filename;
  res.json({ url, filename: req.file.filename });
});

router.post("/upload/anomaly-image", makeUpload(ANOMALY_DIR).single("image"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "未收到文件" });
    return;
  }
  const url = "/uploads/anomaly/" + req.file.filename;
  res.json({ url, filename: req.file.filename });
});

router.post("/upload/task-reference-image", makeUpload(TASK_DIR).single("image"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "未收到文件" });
    return;
  }
  const url = "/uploads/tasks/" + req.file.filename;
  res.json({ url, filename: req.file.filename });
});

export default router;
