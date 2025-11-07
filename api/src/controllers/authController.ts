import { Prisma, Role } from "@prisma/client";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/db";
import {
  getRefreshExpiryDate,
  signAccessToken,
  signRefreshToken,
  verifyToken,
} from "../utils/jwtHelper";

const SALT_ROUNDS = 10;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const registerSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

const requestResetSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(6),
});

type PrismaExecutor = Prisma.TransactionClient | typeof prisma;

const sanitizeUser = (user: {
  id: number;
  full_name: string;
  email: string;
  level: number;
  xp_total: number;
  is_premium: boolean;
  role: Role;
}) => ({
  id: user.id,
  fullName: user.full_name,
  email: user.email,
  level: user.level,
  xpTotal: user.xp_total,
  isPremium: user.is_premium,
  role: user.role,
});

const createTokenPair = async (
  client: PrismaExecutor,
  user: { id: number; email: string; role: Role },
) => {
  const accessPayload = { userId: user.id, email: user.email, role: user.role };
  const accessToken = signAccessToken(accessPayload);
  const refreshToken = signRefreshToken({ userId: user.id });

  await client.userToken.create({
    data: {
      user_id: user.id,
      token: refreshToken,
      expires_at: getRefreshExpiryDate(),
    },
  });

  return { accessToken, refreshToken };
};

const successAuthResponse = (user: ReturnType<typeof sanitizeUser>, tokens: { accessToken: string; refreshToken: string }) => ({
  user,
  token: tokens.accessToken,
  accessToken: tokens.accessToken,
  refreshToken: tokens.refreshToken,
});

export const registerUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: payload.email },
      select: { id: true },
    });

    if (existingUser) {
      return res.status(409).json({ success: false, message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(payload.password, SALT_ROUNDS);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          full_name: payload.fullName,
          email: payload.email,
          password_hash: passwordHash,
        },
      });

      const tokens = await createTokenPair(tx, {
        id: user.id,
        email: user.email,
        role: user.role,
      });

      return { user, tokens };
    });

    return res.status(201).json({
      success: true,
      data: successAuthResponse(sanitizeUser(result.user), result.tokens),
    });
  } catch (error) {
    next(error);
  }
};

export const loginUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(payload.password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    await prisma.userToken.deleteMany({
      where: { user_id: user.id, expires_at: { lt: new Date() } },
    });

    const tokens = await createTokenPair(prisma, {
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return res.json({
      success: true,
      data: successAuthResponse(sanitizeUser(user), tokens),
    });
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({
      success: true,
      data: {
        user: sanitizeUser(user),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const refreshAccessToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = refreshSchema.parse(req.body);
    const decoded = verifyToken<{ userId: number }>(payload.refreshToken, "refresh");

    const storedToken = await prisma.userToken.findUnique({
      where: { token: payload.refreshToken },
    });

    if (!storedToken || storedToken.user_id !== decoded.userId || storedToken.expires_at < new Date()) {
      return res.status(401).json({ success: false, message: "Invalid refresh token" });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return res.json({
      success: true,
      data: {
        accessToken,
        token: accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logoutUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const payload = refreshSchema.parse(req.body);

    const deleted = await prisma.userToken.deleteMany({
      where: {
        token: payload.refreshToken,
        user_id: req.user.id,
      },
    });

    if (deleted.count === 0) {
      return res.status(400).json({ success: false, message: "Refresh token not found" });
    }

    return res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
};

export const requestPasswordReset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = requestResetSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: payload.email },
      select: { id: true },
    });

    if (!user) {
      return res.json({
        success: true,
        message: "If the account exists, a reset link has been sent",
      });
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await prisma.passwordReset.updateMany({
      where: { user_id: user.id, used: false },
      data: { used: true },
    });

    await prisma.passwordReset.create({
      data: {
        user_id: user.id,
        token,
        expires_at: expiresAt,
      },
    });

    return res.json({
      success: true,
      message: "Password reset token generated",
      data: {
        resetToken: token,
        expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = resetSchema.parse(req.body);

    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token: payload.token },
    });

    if (
      !resetRecord ||
      resetRecord.used ||
      resetRecord.expires_at.getTime() < Date.now()
    ) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
    }

    const passwordHash = await bcrypt.hash(payload.password, SALT_ROUNDS);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: resetRecord.user_id },
        data: { password_hash: passwordHash },
      });

      await tx.passwordReset.update({
        where: { id: resetRecord.id },
        data: { used: true },
      });

      await tx.userToken.deleteMany({
        where: { user_id: resetRecord.user_id },
      });
    });

    return res.json({ success: true, message: "Password reset successful" });
  } catch (error) {
    next(error);
  }
};
