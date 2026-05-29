import http from "node:http";

const CONNECTION_HEADERS_TIMEOUT_MS = 5_000;
const CONNECTION_REQUEST_TIMEOUT_MS = 25_000;
const CONNECTION_KEEP_ALIVE_TIMEOUT_MS = 5_000;

const dev = process.argv.includes("--dev");

if (dev) {
  process.env.NODE_ENV = "development";
} else if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "production";
}

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const hostname = process.env.HOST ?? process.env.HOSTNAME ?? "0.0.0.0";
const { default: next } = await import("next");

const app = next({
  dev,
  hostname,
  port,
});

const handle = app.getRequestHandler();

function patchResponseHeaders(res) {
  const originalSetHeader = res.setHeader.bind(res);
  const originalWriteHead = res.writeHead.bind(res);

  res.setHeader = (name, value) => {
    const headerName = String(name).toLowerCase();

    if (headerName === "server" || headerName === "x-powered-by") {
      return res;
    }

    return originalSetHeader(name, value);
  };

  res.writeHead = (...args) => {
    res.removeHeader("Server");
    res.removeHeader("X-Powered-By");
    return originalWriteHead(...args);
  };
}

await app.prepare();

const server = http.createServer((req, res) => {
  if (!req.headers["x-forwarded-for"] && req.socket.remoteAddress) {
    req.headers["x-forwarded-for"] = req.socket.remoteAddress;
  }

  if (!req.headers["x-real-ip"] && req.socket.remoteAddress) {
    req.headers["x-real-ip"] = req.socket.remoteAddress;
  }

  patchResponseHeaders(res);

  void Promise.resolve(handle(req, res)).catch(() => {
    if (res.headersSent) {
      res.end();
      return;
    }

    res.statusCode = 500;
    res.end("Internal Server Error");
  });
});

server.headersTimeout = CONNECTION_HEADERS_TIMEOUT_MS;
server.requestTimeout = CONNECTION_REQUEST_TIMEOUT_MS;
server.keepAliveTimeout = CONNECTION_KEEP_ALIVE_TIMEOUT_MS;

server.listen(port, hostname, () => {
  console.log(
    JSON.stringify({
      event: "server_started",
      timestamp: new Date().toISOString(),
      dev,
      hostname,
      port,
    }),
  );
});
