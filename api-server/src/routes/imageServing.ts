import { Router, type IRouter } from "express";
import { Storage } from "@google-cloud/storage";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const gcs = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
} as ConstructorParameters<typeof Storage>[0]);

const router: IRouter = Router();

router.get("/storage/objects/*objectPath", async (req, res) => {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) {
    res.status(503).json({ error: "Storage not configured" });
    return;
  }

  // Express 5 / path-to-regexp v8: wildcard returns an array of path segments
  const rawParam = (req.params as Record<string, string | string[]>)["objectPath"];
  const objectPath = Array.isArray(rawParam) ? rawParam.join("/") : rawParam;
  if (!objectPath) {
    res.status(400).json({ error: "Missing object path" });
    return;
  }

  try {
    const file = gcs.bucket(bucketId).file(objectPath);

    // Try to get metadata first to detect missing files and get content type
    let contentType = "image/jpeg";
    try {
      const [meta] = await file.getMetadata();
      contentType = (meta.contentType as string) || "image/jpeg";
    } catch (metaErr: unknown) {
      const err = metaErr as { code?: number };
      if (err.code === 404) {
        res.status(404).json({ error: "Object not found" });
        return;
      }
      throw metaErr;
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    const stream = file.createReadStream();
    stream.on("error", (err: Error & { code?: number }) => {
      if (!res.headersSent) {
        res.status(500).json({ error: "Stream error" });
      }
    });
    stream.pipe(res);
  } catch (err) {
    console.error("Image serving error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to serve image" });
    }
  }
});



// 1688图片代理 — 公开访问，不需要JWT认证
router.get("/image-proxy", async (req, res) => {
  const { url } = req.query as { url?: string };
  if (!url) {
    res.status(400).json({ error: "url parameter required" });
    return;
  }

  try {
    const targetUrl = new URL(url);
    // 只允许代理1688和alicdn域名的图片
    if (!targetUrl.hostname.includes("1688.com") && !targetUrl.hostname.includes("alicdn.com")) {
      res.status(403).json({ error: "Only 1688 images are allowed" });
      return;
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://detail.1688.com/",
      },
    });

    if (!response.ok) {
      res.status(response.status).json({ error: "Failed to fetch image" });
      return;
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    const { Readable } = await import("stream");
    const nodeStream = response.body ? Readable.fromWeb(response.body as any) : null;
    if (nodeStream) {
      nodeStream.pipe(res);
    } else {
      res.status(500).json({ error: "No response body" });
    }
  } catch (err) {
    console.error("Image proxy error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to proxy image" });
    }
  }
});

export default router;
