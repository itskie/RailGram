import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import http from "http";
import net from "net";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 4321;
const BACKEND = "http://localhost:8000";
const BACKEND_HOST = "localhost";
const BACKEND_PORT = 8000;

// Proxy /api/* HTTP requests to backend
app.use("/api", (req, res) => {
  const url = new URL(req.originalUrl, BACKEND);
  const proxyReq = http.request(url, {
    method: req.method,
    headers: { ...req.headers, host: url.host },
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on("error", () => res.status(502).json({ detail: "Backend unavailable" }));
  req.pipe(proxyReq);
});

// Serve static production build
app.use(express.static(join(__dirname, "dist")));

// SPA fallback — all routes serve index.html
app.get("/{*path}", (_req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

// Create raw HTTP server so we can intercept WebSocket upgrades
const server = http.createServer(app);

// Proxy WebSocket upgrade requests (/api/v1/ws/*) to backend
server.on("upgrade", (req, clientSocket, head) => {
  if (!req.url.startsWith("/api")) {
    clientSocket.destroy();
    return;
  }
  const backendSocket = net.connect(BACKEND_PORT, BACKEND_HOST, () => {
    // Forward the original HTTP upgrade request to the backend
    backendSocket.write(
      `${req.method} ${req.url} HTTP/1.1\r\n` +
      Object.entries(req.headers)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\r\n") +
      "\r\n\r\n"
    );
    if (head && head.length) backendSocket.write(head);
    backendSocket.pipe(clientSocket);
    clientSocket.pipe(backendSocket);
  });
  backendSocket.on("error", () => clientSocket.destroy());
  clientSocket.on("error", () => backendSocket.destroy());
});

server.listen(PORT, () => {
  console.log(`RailGram frontend → http://localhost:${PORT}/`);
});
