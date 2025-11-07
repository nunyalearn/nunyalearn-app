import { NextFunction, Request, Response } from "express";
import prisma from "../config/db";
import { verifyToken as verifyJwtToken } from "../utils/jwtHelper";
import { Role } from "@prisma/client";

interface DecodedToken {
  userId: number;
  email: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        fullName: string;
        isPremium: boolean;
        level: number;
        role: Role;
      };
    }
  }
}

export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Authorization header missing" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Authorization header malformed" });
    }
    const decoded = verifyJwtToken<DecodedToken>(token, "access");

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        full_name: true,
        is_premium: true,
        level: true,
        role: true,
      },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      isPremium: user.is_premium,
      level: user.level,
      role: user.role,
    };

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};
