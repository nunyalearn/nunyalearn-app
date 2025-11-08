import { NextFunction, Request, Response } from "express";
import path from "path";
import { promises as fs } from "fs";
import { z } from "zod";
import prisma from "../../config/db";
import pkg from "../../../package.json";

const logsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).default(100),
});

const LOG_FILE_PATH = path.resolve(process.cwd(), "logs", "app.log");

export const getSystemHealth = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    let databaseStatus: "connected" | "error" = "connected";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      databaseStatus = "error";
    }

    return res.json({
      success: true,
      data: {
        serverTime: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        version: pkg.version ?? "0.0.0",
        database: databaseStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getSystemLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit } = logsQuerySchema.parse(req.query);
    let logs: string[] = [];

    try {
      const contents = await fs.readFile(LOG_FILE_PATH, "utf-8");
      const lines = contents.split(/\r?\n/).filter((line) => line.trim().length > 0);
      logs = lines.slice(-limit);
    } catch (error: any) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }

    return res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
};
