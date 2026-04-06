const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";

const lsInput = `total 48
drwxr-xr-x  6 user user 4096 Apr  1 10:00 .
drwxr-xr-x 20 user user 4096 Apr  1 09:00 ..
-rw-r--r--  1 user user 1234 Apr  1 10:00 README.md
-rwxr-xr-x  1 user user 5678 Apr  1 10:00 script.sh
drwxr-xr-x  2 user user 4096 Apr  1 10:00 src`;

const psInput = `USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root         1  0.0  0.1 225344  9000 ?        Ss   09:00   0:01 /sbin/init
user      1234  0.5  2.3 512000 45000 pts/0    Sl   09:30   0:45 node server.js
root      5678  0.0  0.0  14224  1024 ?        S    09:00   0:00 /sbin/syslogd`;

function summarize(value) {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 0);
  return text.length > 320 ? `${text.slice(0, 320)}...` : text;
}

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

function asParseSuccess(body) {
  return body && typeof body === "object" && body.success === true ? body : null;
}

const tests = [
  {
    id: "P1",
    expected: "GET /api/parsers returns 200 with 50+ parsers",
    run: async () => {
      const { response, body } = await request("/api/parsers");
      return {
        pass: response.status === 200 && Array.isArray(body) && body.length >= 50,
        actual: summarize({ status: response.status, length: Array.isArray(body) ? body.length : null }),
      };
    },
  },
  {
    id: "P2",
    expected: "POST /api/parse with ls input returns 200 and an array",
    run: async () => {
      const { response, body } = await request("/api/parse", {
        method: "POST",
        headers: buildHeaders("198.51.100.1", {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ parser: "ls", input: lsInput }),
      });
      const success = asParseSuccess(body);
      return {
        pass: response.status === 200 && Array.isArray(success?.data),
        actual: summarize({ status: response.status, body }),
      };
    },
  },
  {
    id: "P3",
    expected: "POST /api/parse with ps input returns 200 and an array",
    run: async () => {
      const { response, body } = await request("/api/parse", {
        method: "POST",
        headers: buildHeaders("198.51.100.2", {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ parser: "ps", input: psInput }),
      });
      const success = asParseSuccess(body);
      return {
        pass: response.status === 200 && Array.isArray(success?.data),
        actual: summarize({ status: response.status, body }),
      };
    },
  },
  {
    id: "P4",
    expected: "POST /api/parse with empty input returns 400",
    run: async () => {
      const { response, body } = await request("/api/parse", {
        method: "POST",
        headers: buildHeaders("198.51.100.3", {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ parser: "ls", input: "" }),
      });
      return {
        pass: response.status === 400,
        actual: summarize({ status: response.status, body }),
      };
    },
  },
  {
    id: "P5",
    expected: "POST /api/parse with invalid parser returns 400",
    run: async () => {
      const { response, body } = await request("/api/parse", {
        method: "POST",
        headers: buildHeaders("198.51.100.4", {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ parser: "notaparser", input: "hello" }),
      });
      return {
        pass: response.status === 400,
        actual: summarize({ status: response.status, body }),
      };
    },
  },
  {
    id: "P6",
    expected: "POST /api/parse with oversized body returns 413",
    run: async () => {
      const { response, body } = await request("/api/parse", {
        method: "POST",
        headers: buildHeaders("198.51.100.5", {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          parser: "ls",
          input: "x".repeat(110_000),
        }),
      });
      return {
        pass: response.status === 413,
        actual: summarize({ status: response.status, body }),
      };
    },
  },
  {
    id: "P7",
    expected: "GET /api/parse returns 405",
    run: async () => {
      const { response, body } = await request("/api/parse", {
        headers: buildHeaders("198.51.100.6"),
      });
      return {
        pass: response.status === 405,
        actual: summarize({ status: response.status, body }),
      };
    },
  },
  {
    id: "P8",
    expected: "POST /api/parse with non-JSON body returns 415",
    run: async () => {
      const { response, body } = await request("/api/parse", {
        method: "POST",
        headers: buildHeaders("198.51.100.7", {
          "Content-Type": "text/plain",
        }),
        body: "hello",
      });
      return {
        pass: response.status === 415,
        actual: summarize({ status: response.status, body }),
      };
    },
  },
  {
    id: "P9",
    expected: "GET /api/health returns 200 with status ok",
    run: async () => {
      const { response, body } = await request("/api/health");
      return {
        pass: response.status === 200 && body?.status === "ok",
        actual: summarize({ status: response.status, body }),
      };
    },
  },
  {
    id: "P10",
    expected: "35 parse requests in under 30 seconds hit 429 before request 31",
    run: async () => {
      const statuses = [];

      for (let index = 0; index < 35; index += 1) {
        const { response } = await request("/api/parse", {
          method: "POST",
          headers: buildHeaders("203.0.113.10", {
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({ parser: "ls", input: lsInput }),
        });
        statuses.push(response.status);
      }

      const first429Index = statuses.findIndex((status) => status === 429);

      return {
        pass: first429Index !== -1 && first429Index < 30,
        actual: summarize({ statuses, first429Request: first429Index + 1 }),
      };
    },
  },
];

const failures = [];

for (const test of tests) {
  try {
    const result = await test.run();
    const status = result.pass ? "PASS" : "FAIL";
    console.log(`${status} ${test.id}: ${test.expected} | actual=${result.actual}`);

    if (!result.pass) {
      failures.push(test.id);
    }
  } catch (error) {
    const actual = error instanceof Error ? error.message : String(error);
    console.log(`FAIL ${test.id}: ${test.expected} | actual=${actual}`);
    failures.push(test.id);
  }
}

if (failures.length > 0) {
  process.exitCode = 1;
}
