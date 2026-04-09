import { Storage } from "@google-cloud/storage";
import { randomUUID } from "crypto";

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

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 5000;

function getBucketId(): string {
  const id = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!id) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  return id;
}

function contentTypeToExt(ct: string): string {
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  return "jpg";
}

export async function fetchAndStoreImage(
  sourceUrl: string,
  gcsPath: string
): Promise<string | null> {
  if (!sourceUrl || !sourceUrl.startsWith("http")) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(sourceUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://www.1688.com/",
        Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });

    clearTimeout(timer);

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    const baseType = contentType.split(";")[0].trim().toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.some((t) => baseType.startsWith(t))) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BYTES) return null;

    const ext = contentTypeToExt(baseType);
    const timestamp = Date.now();
    const fullGcsPath = `images/${gcsPath}-${timestamp}.${ext}`;

    const bucket = gcs.bucket(getBucketId());
    const file = bucket.file(fullGcsPath);

    await file.save(Buffer.from(arrayBuffer), {
      contentType: baseType,
      resumable: false,
    });

    const servePath = `/api/storage/objects/${fullGcsPath}`;
    return servePath;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

export async function fetchAndStoreImages(
  items: Array<{ url: string; gcsPath: string }>
): Promise<Array<string | null>> {
  const results = await Promise.allSettled(
    items.map((item) => fetchAndStoreImage(item.url, item.gcsPath))
  );
  return results.map((r) => (r.status === "fulfilled" ? r.value : null));
}
