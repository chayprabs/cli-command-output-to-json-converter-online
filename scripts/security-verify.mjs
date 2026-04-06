const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";

const lsInput = `total 48
drwxr-xr-x  6 user user 4096 Apr  1 10:00 .
drwxr-xr-x 20 user user 4096 Apr  1 09:00 ..
-rw-r--r--  1 user user 1234 Apr  1 10:00 README.md
-rwxr-xr-x  1 user user 5678 Apr  1 10:00 script.sh
drwxr-xr-x  2 user user 4096 Apr  1 10:00 src`;

function buildHeaders(ip, extraHeaders = {}) {
  return {
    "X-Forwarded-For": ip,
    ...extraHeaders,
  };
}

async function request(path, options = {}, timeoutMs = 20_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      signal: controller.signal,
    });
    const text = await response.text();
    let body = null;

    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    return { response, body };
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyBurstRateLimit() {
  const statuses = [];

  for (let index = 0; index < 35; index += 1) {
    const { response } = await request("/api/parse", {
      method: "POST",
      headers: buildHeaders("203.0.113.50", {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ parser: "ls", input: lsInput }),
    });
    statuses.push(response.status);
  }

  console.log("burst-rate-limit", JSON.stringify(statuses));
}

async function verifyConcurrencyLimit() {
  const requests = Array.from({ length: 15 }, (_, index) =>
    request("/api/parse", {
      method: "POST",
      headers: buildHeaders(`203.0.113.${60 + index}`, {
        "Content-Type": "application/json",
        "X-Request-Id": `concurrency-${index}`,
      }),
      body: JSON.stringify({
        parser: "ls",
        input: `${lsInput}\n${"file.txt\n".repeat(3_000)}`,
      }),
    }).then(({ response }) => response.status),
  );

  console.log("concurrency-limit", JSON.stringify(await Promise.all(requests)));
}

async function verifyMinuteRateLimit() {
  const statuses = [];

  for (let index = 0; index < 31; index += 1) {
    const { response } = await request("/api/parse", {
      method: "POST",
      headers: buildHeaders("203.0.113.120", {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ parser: "ls", input: lsInput }),
    });
    statuses.push(response.status);

    if (index < 30) {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }

  console.log("minute-rate-limit", JSON.stringify(statuses));
}

async function verifyOversizedPayload() {
  const { response, body } = await request("/api/parse", {
    method: "POST",
    headers: buildHeaders("203.0.113.52", {
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      parser: "ls",
      input: "x".repeat(110_000),
    }),
  });

  console.log(
    "oversized-payload",
    JSON.stringify({ status: response.status, body }),
  );
}

async function verifyHeaders() {
  const response = await fetch(`${baseUrl}/api/parse`, {
    method: "OPTIONS",
    headers: buildHeaders("203.0.113.53"),
  });

  console.log(
    "response-headers",
    JSON.stringify({
      status: response.status,
      cacheControl: response.headers.get("cache-control"),
      referrerPolicy: response.headers.get("referrer-policy"),
      xContentTypeOptions: response.headers.get("x-content-type-options"),
      xFrameOptions: response.headers.get("x-frame-options"),
      xXssProtection: response.headers.get("x-xss-protection"),
      xPoweredBy: response.headers.get("x-powered-by"),
      server: response.headers.get("server"),
    }),
  );
}

await verifyBurstRateLimit();
await verifyConcurrencyLimit();
await verifyMinuteRateLimit();
await verifyOversizedPayload();
await verifyHeaders();
