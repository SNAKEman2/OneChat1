import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";

const app: Express = express();

// Build the allowed origins list from REPLIT_DOMAINS (comma-separated) at startup.
// In development the env var is absent, so we fall back to reflecting the request
// origin — safe because all routes require authentication.
const allowedOrigins: Set<string> | null = process.env.REPLIT_DOMAINS
  ? new Set(
      process.env.REPLIT_DOMAINS.split(",")
        .map((d) => d.trim())
        .filter(Boolean)
        .map((d) => `https://${d}`)
    )
  : null;

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  })
);

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      // Allow same-origin requests (origin is undefined for server-to-server)
      if (!origin) return callback(null, true);
      // In production restrict to known domains; in dev allow all
      if (!allowedOrigins || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
  })
);

app.use(cookieParser());
// Limit request body to 64kb to prevent memory exhaustion
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: true, limit: "64kb" }));
app.use(authMiddleware);

app.use("/api", router);

export default app;
