import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      data: err.flatten(),
    });
  }

  const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
  const message = (err as { message?: string }).message ?? "Internal server error";

  if (process.env.NODE_ENV !== "production") {
    console.error(err);
  }

  return res.status(statusCode).json({
    success: false,
    message,
  });
};
