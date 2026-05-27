const baseUrl = (process.env.SMOKE_API_BASE_URL || "http://localhost:5000/api").replace(/\/+$/, "");
const employeeId = process.env.SMOKE_EMPLOYEE_ID || "admin";
const password = process.env.SMOKE_PASSWORD || "xborder2024";
const allowedImageUrl = process.env.SMOKE_IMAGE_URL;

function apiUrl(path) {
  return `${baseUrl}${path}`;
}

function sessionCookie(response) {
  const raw = response.headers.get("set-cookie");
  return raw ? raw.split(";")[0] : "";
}

async function request(path, options = {}, cookie = "") {
  const headers = {
    ...(options.body ? { "content-type": "application/json" } : {}),
    ...(cookie ? { cookie } : {}),
    ...(options.headers || {}),
  };

  return fetch(apiUrl(path), {
    ...options,
    headers,
    redirect: "manual",
  });
}

async function expectStatus(name, response, expected) {
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(response.status)) {
    const text = await response.text().catch(() => "");
    throw new Error(`${name}: expected ${allowed.join("/")}, got ${response.status}${text ? `: ${text}` : ""}`);
  }
}

async function expectJson(name, response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await response.text().catch(() => "");
    throw new Error(`${name}: expected JSON, got ${contentType || "unknown"}${text ? `: ${text}` : ""}`);
  }
  return response.json();
}

async function check(name, fn) {
  const start = Date.now();
  await fn();
  console.log(`OK ${name} (${Date.now() - start}ms)`);
}

async function main() {
  let cookie = "";

  await check("auth login", async () => {
    const response = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ employeeId, password }),
    });
    await expectStatus("auth login", response, 200);
    await expectJson("auth login", response);
    cookie = sessionCookie(response);
    if (!cookie) throw new Error("auth login did not return a session cookie");
  });

  await check("auth me", async () => {
    const response = await request("/auth/me", {}, cookie);
    await expectStatus("auth me", response, 200);
    await expectJson("auth me", response);
  });

  for (const [name, path] of [
    ["products", "/products"],
    ["sample options", "/sample-options"],
    ["sample sku lines", "/sample-sku-lines"],
    ["tasks", "/tasks"],
  ]) {
    await check(name, async () => {
      const response = await request(path, {}, cookie);
      await expectStatus(name, response, 200);
      await expectJson(name, response);
    });
  }

  await check("image proxy rejects untrusted host", async () => {
    const response = await request(`/image-proxy?url=${encodeURIComponent("https://example.com/not-allowed.jpg")}`);
    await expectStatus("image proxy rejects untrusted host", response, 403);
  });

  if (allowedImageUrl) {
    await check("image proxy allowed host", async () => {
      const response = await request(`/image-proxy?url=${encodeURIComponent(allowedImageUrl)}`);
      await expectStatus("image proxy allowed host", response, [200, 304]);
    });
  }
}

main().catch((error) => {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  console.error(`Base URL: ${baseUrl}`);
  process.exitCode = 1;
});
