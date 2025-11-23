import { NextFunction, Request, Response } from "express";

type ResponseBody = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

const ensureMessage = (body: ResponseBody) => {
  if (!("message" in body) || typeof body.message !== "string") {
    body.message = body.success === false ? "Request failed" : "OK";
  }
  return body;
};

export const adminResponseEnvelope = (_req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res);
  res.json = (payload?: unknown) => {
    if (payload && typeof payload === "object" && "success" in (payload as ResponseBody)) {
      return originalJson(ensureMessage(payload as ResponseBody));
    }
    return originalJson({
      success: true,
      message: "OK",
      data: payload ?? null,
    });
  };
  next();
};
