import axios from "axios";
import compression from "compression";
import dotenv from "dotenv";
import express from "express";
import { createServer } from "http";
import { monitorEventLoopDelay } from "perf_hooks";
import path from "path";
import swaggerUi from "swagger-ui-express";
import { fileURLToPath } from "url";
import { OnayClient, loadOnayConfig } from "./onayClient";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

let onayClient: OnayClient | null = null;

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toMb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)}MB`;

const resolveOnayError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const timeoutMs = error.config?.timeout;
    if (error.code === "ECONNABORTED" || /timeout/i.test(error.message)) {
      return {
        status: 504,
        message: `Onay upstream timeout${timeoutMs ? ` after ${timeoutMs}ms` : ""}`,
      };
    }

    const upstreamStatus = error.response?.status;
    if (typeof upstreamStatus === "number") {
      return {
        status: 502,
        message: `Onay upstream responded with status ${upstreamStatus}`,
      };
    }

    return { status: 502, message: "Onay upstream network error" };
  }

  if (error instanceof Error) {
    return { status: 500, message: error.message };
  }

  return { status: 500, message: "Unexpected Onay error" };
};

const getOnayClient = () => {
  if (!onayClient) {
    onayClient = new OnayClient(loadOnayConfig());
  }
  return onayClient;
};

async function startServer() {
  const app = express();
  const server = createServer(app);
  const shouldLogEveryRequest = process.env.HTTP_LOG_EVERY_REQUEST === "true";
  const slowRequestMs = parsePositiveInt(process.env.SLOW_REQUEST_MS, 1000);
  const perfLogsEnabled = process.env.PERF_LOGS !== "false";

  app.use(express.json());
  app.use(compression());

  // Allow cross-origin calls from deployed frontend (Netlify) to Render
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept"
    );
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });

  // Guard against malformed encoded URLs (e.g., "/%VITE_ANALYTICS_ENDPOINT%/umami")
  app.use((req, res, next) => {
    try {
      decodeURIComponent(req.path);
      next();
    } catch (err) {
      console.warn("Bad request path", req.url);
      res.status(400).send("Bad request");
    }
  });

  // Request duration logging to track slow endpoints in production.
  app.use((req, res, next) => {
    const startedAt = process.hrtime.bigint();
    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const isSlow = durationMs >= slowRequestMs;
      if (shouldLogEveryRequest || isSlow || res.statusCode >= 500) {
        console.log(
          `[http] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms`,
        );
      }
    });
    next();
  });

  if (perfLogsEnabled) {
    const perfIntervalMs = parsePositiveInt(process.env.PERF_INTERVAL_MS, 60000);
    const loopDelay = monitorEventLoopDelay({ resolution: 20 });
    loopDelay.enable();

    setInterval(() => {
      const memory = process.memoryUsage();
      const lagMeanMs = loopDelay.mean / 1_000_000;
      const lagP99Ms = loopDelay.percentile(99) / 1_000_000;
      const lagMaxMs = loopDelay.max / 1_000_000;
      console.log(
        `[perf] rss=${toMb(memory.rss)} heapUsed=${toMb(memory.heapUsed)} eventLoopLagMean=${lagMeanMs.toFixed(2)}ms eventLoopLagP99=${lagP99Ms.toFixed(2)}ms eventLoopLagMax=${lagMaxMs.toFixed(2)}ms`,
      );
      loopDelay.reset();
    }, perfIntervalMs).unref();
  }

  const docs = {
    openapi: "3.0.1",
    info: {
      title: "Onay helper API",
      version: "1.0.0",
      description:
        "Визуальный playground для /api/onay/qr-start. Секреты из .env на сервере, на клиент не попадают.",
    },
    servers: [{ url: process.env.PUBLIC_BASE_URL || "http://localhost:3000" }],
    paths: {
      "/api/onay/qr-start": {
        post: {
          summary: "Запросить маршрут/госномер/цену по коду терминала",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    terminal: { type: "string", example: "1234" },
                  },
                  required: ["terminal"],
                },
              },
            },
          },
          responses: {
            200: {
              description: "Успех",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          route: { type: "string", nullable: true },
                          plate: { type: "string", nullable: true },
                          cost: { type: "integer", nullable: true, example: 12000 },
                          terminal: { type: "string" },
                          pan: { type: "string", nullable: true },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: { description: "Не указан terminal" },
            504: { description: "Таймаут внешнего Onay API" },
            500: { description: "Ошибка Onay" },
          },
        },
      },
      "/api/onay/sign-in": {
        post: {
          summary: "Принудительно получить новый token/shortToken",
          responses: {
            200: {
              description: "Успех",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          token: { type: "string" },
                          shortToken: { type: "string" },
                          deviceId: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
            504: { description: "Таймаут внешнего Onay API" },
            500: { description: "Ошибка Onay" },
          },
        },
      },
    },
  } as const;

  app.use("/docs", swaggerUi.serve, swaggerUi.setup(docs));
  app.get("/docs.json", (_req, res) => res.json(docs));
  app.get("/healthz", (_req, res) =>
    res.json({ success: true, uptimeSec: Math.floor(process.uptime()) }),
  );

  app.post("/api/onay/qr-start", async (req, res) => {
    const terminal = String(req.body?.terminal || "").trim();

    if (!terminal) {
      return res
        .status(400)
        .json({ success: false, message: "terminal is required" });
    }

    try {
      const client = getOnayClient();
      const trip = await client.qrStart(terminal);

      return res.json({
        success: true,
        data: {
          route: trip.route || null,
          plate: trip.plate || null,
          cost: trip.cost ?? null,
          terminal: trip.terminalCode || terminal,
          pan: trip.pan || null,
        },
      });
    } catch (error) {
      const { status, message } = resolveOnayError(error);
      console.error("/api/onay/qr-start failed", message);
      return res.status(status).json({ success: false, message });
    }
  });

  app.post("/api/onay/sign-in", async (_req, res) => {
    try {
      const client = getOnayClient();
      const tokens = await client.signIn(true);

      return res.json({
        success: true,
        data: {
          token: tokens.token,
          shortToken: tokens.shortToken,
          deviceId: tokens.deviceId,
        },
      });
    } catch (error) {
      const { status, message } = resolveOnayError(error);
      console.error("/api/onay/sign-in failed", message);
      return res.status(status).json({ success: false, message });
    }
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;
  const keepAliveTimeoutMs = parsePositiveInt(
    process.env.SERVER_KEEPALIVE_TIMEOUT_MS,
    65000,
  );
  const headersTimeoutMs = parsePositiveInt(
    process.env.SERVER_HEADERS_TIMEOUT_MS,
    keepAliveTimeoutMs + 5000,
  );
  const requestTimeoutMs = parsePositiveInt(
    process.env.SERVER_REQUEST_TIMEOUT_MS,
    30000,
  );

  server.keepAliveTimeout = keepAliveTimeoutMs;
  server.headersTimeout = headersTimeoutMs;
  server.requestTimeout = requestTimeoutMs;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(
      `[config] onayBaseUrl=${process.env.ONAY_BASE_URL || "default"} timeoutMs=${process.env.ONAY_REQUEST_TIMEOUT_MS || "15000"} keepAliveTimeoutMs=${keepAliveTimeoutMs}`,
    );
  });
}

startServer().catch(console.error);
