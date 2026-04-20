import type { RequestHandler } from "express";

type ModuleName = "auth" | "admin" | "courses" | "lessons" | "enrollments" | "progress";

function getBaseUrl() {
  // Expected to be the API Gateway / public base, e.g. https://api.example.com
  const raw = process.env.LEARNING_LAB_API_BASE_URL;
  if (!raw) return null;
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

async function forwardModuleRequest(req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1], moduleName: ModuleName) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return res.status(500).json({
      success: false,
      message:
        "Server misconfiguration: missing LEARNING_LAB_API_BASE_URL. Set it to your upstream API base URL (no trailing slash).",
    });
  }

  const url = `${baseUrl}/${moduleName}`;

  // Forward Authorization header (Bearer token).
  const auth = req.header("authorization");

  // Important: do NOT mutate the upstream response envelope. Preserve HTTP status codes.
  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(auth ? { authorization: auth } : {}),
    },
    body: JSON.stringify(req.body ?? {}),
  });

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await upstream.text();
    return res.status(upstream.status).send(text);
  }

  const json = await upstream.json();
  return res.status(upstream.status).json(json);
}

export const handleAuth: RequestHandler = async (req, res) => {
  try {
    return await forwardModuleRequest(req, res, "auth");
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message ?? String(err) });
  }
};

export const handleAdmin: RequestHandler = async (req, res) => {
  try {
    return await forwardModuleRequest(req, res, "admin");
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message ?? String(err) });
  }
};

export const handleCourses: RequestHandler = async (req, res) => {
  try {
    return await forwardModuleRequest(req, res, "courses");
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message ?? String(err) });
  }
};

export const handleLessons: RequestHandler = async (req, res) => {
  try {
    return await forwardModuleRequest(req, res, "lessons");
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message ?? String(err) });
  }
};

export const handleEnrollments: RequestHandler = async (req, res) => {
  try {
    return await forwardModuleRequest(req, res, "enrollments");
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message ?? String(err) });
  }
};

export const handleProgress: RequestHandler = async (req, res) => {
  try {
    return await forwardModuleRequest(req, res, "progress");
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message ?? String(err) });
  }
};

