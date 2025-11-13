import { RequestHandler } from "express";
import { ZodTypeAny } from "zod";

type RequestLocation = "body" | "query" | "params";

export const validateSchema =
  (schema: ZodTypeAny, location: RequestLocation = "body"): RequestHandler =>
  (req, _res, next) => {
    try {
      const parsed = schema.parse(req[location]);
      (req as Record<RequestLocation, unknown>)[location] = parsed;
      next();
    } catch (error) {
      next(error);
    }
  };
