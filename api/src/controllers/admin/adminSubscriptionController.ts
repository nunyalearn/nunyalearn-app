import { Prisma, SubscriptionStatus } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../../config/db";
import { recordAdminAction } from "../../services/auditService";

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  status: z.nativeEnum(SubscriptionStatus).optional(),
  search: z.string().optional(),
});

const subscriptionIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const baseSchema = z
  .object({
    userId: z.coerce.number().int().positive().optional(),
    userEmail: z.string().email().optional(),
    plan: z.string().min(1),
    status: z.nativeEnum(SubscriptionStatus).default(SubscriptionStatus.active),
    renewsAt: z.coerce.date().optional(),
    expiresAt: z.coerce.date().optional(),
  })
  .refine((payload) => payload.userId !== undefined || payload.userEmail !== undefined, {
    message: "Either userId or userEmail is required",
    path: ["userEmail"],
  });

const updateSchema = baseSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required",
  });

const resolveEmail = async (userId?: number, fallback?: string | null) => {
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

export const listSubscriptions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, status, search } = listQuerySchema.parse(req.query);

    const where: Prisma.SubscriptionWhereInput = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { user_email: { contains: search.trim(), mode: "insensitive" } },
        { plan: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    const [total, subscriptions] = await Promise.all([
      prisma.subscription.count({ where }),
      prisma.subscription.findMany({
        where,
        orderBy: { updated_at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return res.json({
      success: true,
      data: { subscriptions },
      pagination: { page, limit, total },
    });
  } catch (error) {
    next(error);
  }
};

export const getSubscriptionById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = subscriptionIdSchema.parse(req.params);
    const subscription = await prisma.subscription.findUnique({ where: { id } });

    if (!subscription) {
      return res.status(404).json({ success: false, message: "Subscription not found" });
    }

    return res.json({ success: true, data: { subscription } });
  } catch (error) {
    next(error);
  }
};

export const createSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const payload = baseSchema.parse(req.body);
    const email = await resolveEmail(payload.userId, payload.userEmail ?? null);

    if (!email) {
      return res.status(400).json({ success: false, message: "User email is required" });
    }

    const subscription = await prisma.subscription.create({
      data: {
        user_id: payload.userId ?? null,
        user_email: email,
        plan: payload.plan,
        status: payload.status,
        renews_at: payload.renewsAt ?? null,
        expires_at: payload.expiresAt ?? null,
      },
    });

    await recordAdminAction(
      req.user?.id,
      "Subscription",
      "CREATE",
      subscription.id,
      `${subscription.user_email} - ${subscription.plan}`,
    );

    return res.status(201).json({ success: true, data: { subscription } });
  } catch (error) {
    next(error);
  }
};

export const updateSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = subscriptionIdSchema.parse(req.params);
    const payload = updateSchema.parse(req.body);

    let resolvedEmail: string | null | undefined = undefined;
    if (payload.userId !== undefined || payload.userEmail !== undefined) {
      resolvedEmail = await resolveEmail(payload.userId, payload.userEmail ?? null);
      if (!resolvedEmail) {
        return res.status(400).json({ success: false, message: "Unable to resolve user email" });
      }
    }

    const data: Prisma.SubscriptionUncheckedUpdateInput = {};
    if (payload.userId !== undefined) data.user_id = payload.userId;
    if (resolvedEmail !== undefined) data.user_email = resolvedEmail;
    if (payload.plan !== undefined) data.plan = payload.plan;
    if (payload.status !== undefined) data.status = payload.status;
    if (payload.renewsAt !== undefined) data.renews_at = payload.renewsAt ?? null;
    if (payload.expiresAt !== undefined) data.expires_at = payload.expiresAt ?? null;

    const subscription = await prisma.subscription.update({
      where: { id },
      data,
    });

    await recordAdminAction(
      req.user?.id,
      "Subscription",
      "UPDATE",
      id,
      `${subscription.user_email} - ${subscription.plan}`,
    );

    return res.json({ success: true, data: { subscription } });
  } catch (error) {
    next(error);
  }
};

export const deleteSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = subscriptionIdSchema.parse(req.params);
    const deleted = await prisma.subscription.delete({ where: { id } });
    await recordAdminAction(
      req.user?.id,
      "Subscription",
      "DELETE",
      id,
      `${deleted.user_email} - ${deleted.plan}`,
    );
    return res.json({ success: true, message: "Subscription deleted" });
  } catch (error) {
    next(error);
  }
};
