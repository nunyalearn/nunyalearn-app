import { PaymentStatus, Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../../config/db";
import { recordAdminAction } from "../../services/auditService";

const listPaymentsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  status: z.nativeEnum(PaymentStatus).optional(),
  search: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

const paymentIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const createPaymentSchema = z
  .object({
    userId: z.coerce.number().int().positive().optional(),
    userEmail: z.string().email().optional(),
    amount: z.coerce.number().int(),
    currency: z.string().min(3).max(5).default("USD"),
    status: z.nativeEnum(PaymentStatus).default(PaymentStatus.pending),
    method: z.string().optional(),
    reference: z.string().optional(),
  })
  .refine((payload) => payload.userId !== undefined || payload.userEmail !== undefined, {
    message: "Either userId or userEmail is required",
    path: ["userEmail"],
  });

const updatePaymentSchema = createPaymentSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required",
  });

const resolveUserEmail = async (userId?: number, fallback?: string | null) => {
  if (fallback) {
    return fallback;
  }
  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  return user?.email ?? null;
};

export const listPayments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, status, search, startDate, endDate } = listPaymentsSchema.parse(
      req.query,
    );

    const where: Prisma.PaymentWhereInput = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { user_email: { contains: search.trim(), mode: "insensitive" } },
        { reference: { contains: search.trim(), mode: "insensitive" } },
      ];
    }
    if (startDate || endDate) {
      where.created_at = {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {}),
      };
    }

    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return res.json({
      success: true,
      data: { payments },
      pagination: { page, limit, total },
    });
  } catch (error) {
    next(error);
  }
};

export const getPaymentById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = paymentIdSchema.parse(req.params);
    const payment = await prisma.payment.findUnique({ where: { id } });

    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    return res.json({ success: true, data: { payment } });
  } catch (error) {
    next(error);
  }
};

export const createPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createPaymentSchema.parse(req.body);
    const userEmail = await resolveUserEmail(payload.userId, payload.userEmail ?? null);

    if (!userEmail) {
      return res.status(400).json({ success: false, message: "User email is required" });
    }

    const payment = await prisma.payment.create({
      data: {
        user_id: payload.userId ?? null,
        user_email: userEmail,
        amount: payload.amount,
        currency: payload.currency,
        status: payload.status,
        method: payload.method ?? null,
        reference: payload.reference ?? null,
      },
    });

    await recordAdminAction(req.user?.id, "Payment", "CREATE", payment.id, payment.reference ?? payment.user_email);

    return res.status(201).json({ success: true, data: { payment } });
  } catch (error) {
    next(error);
  }
};

export const updatePayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = paymentIdSchema.parse(req.params);
    const payload = updatePaymentSchema.parse(req.body);

    const userEmail = await resolveUserEmail(payload.userId, payload.userEmail ?? null);
    if (payload.userId && !userEmail) {
      return res.status(400).json({ success: false, message: "Unable to resolve user email" });
    }

    const data: Prisma.PaymentUncheckedUpdateInput = {};
    if (payload.userId !== undefined) data.user_id = payload.userId;
    if (userEmail !== null) data.user_email = userEmail;
    if (payload.amount !== undefined) data.amount = payload.amount;
    if (payload.currency !== undefined) data.currency = payload.currency;
    if (payload.status !== undefined) data.status = payload.status;
    if (payload.method !== undefined) data.method = payload.method ?? null;
    if (payload.reference !== undefined) data.reference = payload.reference ?? null;

    const payment = await prisma.payment.update({
      where: { id },
      data,
    });

    await recordAdminAction(req.user?.id, "Payment", "UPDATE", id, payment.reference ?? payment.user_email);

    return res.json({ success: true, data: { payment } });
  } catch (error) {
    next(error);
  }
};

export const deletePayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = paymentIdSchema.parse(req.params);
    const deleted = await prisma.payment.delete({ where: { id } });
    await recordAdminAction(req.user?.id, "Payment", "DELETE", id, deleted.reference ?? deleted.user_email);
    return res.json({ success: true, message: "Payment deleted" });
  } catch (error) {
    next(error);
  }
};
