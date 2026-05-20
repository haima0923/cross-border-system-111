import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import authRouter from "./routes/auth";
import router from "./routes";
import imageServingRouter from "./routes/imageServing";
import adminRouter from "./routes/admin";
import { authenticate } from "./middleware/authenticate";
import uploadRouter from "./routes/upload";
import { logger } from "./lib/logger";

const app: Express = express();

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
  }),
);

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auth routes — no JWT required
app.use("/api", authRouter);

// Image serving — public, no JWT required (images are identified by opaque GCS paths)
app.use("/api", imageServingRouter);

// Admin routes — use own authenticate + requireAdmin internally
app.use("/api", adminRouter);

// Upload routes — JWT required
app.use("/api", authenticate, uploadRouter);

// All other API routes — JWT required
app.use("/api", authenticate, router);

export default app;
