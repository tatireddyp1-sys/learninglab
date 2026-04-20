import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleGemini } from "./routes/gemini";
import {
  handleAdmin,
  handleAuth,
  handleCourses,
  handleEnrollments,
  handleLessons,
  handleProgress,
} from "./routes/moduleProxy";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);
  app.post("/api/gemini", handleGemini);

  /**
   * Learning Lab module APIs (action-driven).
   *
   * The product contract is POST /{module} (no /api prefix). We expose both
   * shapes so the SPA can call same-origin in dev/prod without caring.
   *
   * Set LEARNING_LAB_API_BASE_URL to forward to the upstream API Gateway / Lambdas.
   */
  app.post("/auth", handleAuth);
  app.post("/admin", handleAdmin);
  app.post("/courses", handleCourses);
  app.post("/lessons", handleLessons);
  app.post("/enrollments", handleEnrollments);
  app.post("/progress", handleProgress);

  // Back-compat / convenience (same handlers under /api/* as well).
  app.post("/api/auth", handleAuth);
  app.post("/api/admin", handleAdmin);
  app.post("/api/courses", handleCourses);
  app.post("/api/lessons", handleLessons);
  app.post("/api/enrollments", handleEnrollments);
  app.post("/api/progress", handleProgress);

  // API Gateway-style paths (same-origin when the SPA uses VITE_LMS_API_BASE_URL=/v1)
  app.post("/v1/auth", handleAuth);
  app.post("/v1/admin", handleAdmin);
  app.post("/v1/courses", handleCourses);
  app.post("/v1/lessons", handleLessons);
  app.post("/v1/enrollments", handleEnrollments);
  app.post("/v1/progress", handleProgress);

  return app;
}
