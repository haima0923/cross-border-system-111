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

export default router;
