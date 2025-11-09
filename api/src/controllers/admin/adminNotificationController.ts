import { NotificationChannel, NotificationStatus, Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../../config/db";
import { recordAdminAction } from "../../services/auditService";

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  status: z.nativeEnum(NotificationStatus).optional(),
  channel: z.nativeEnum(NotificationChannel).optional(),
  search: z.string().optional(),
});

const notificationIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const baseSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  audience: z.string().optional(),
  status: z.nativeEnum(NotificationStatus).default(NotificationStatus.draft),
  channel: z.nativeEnum(NotificationChannel).default(NotificationChannel.app),
  scheduledAt: z.coerce.date().optional(),
});

const createSchema = baseSchema;
const updateSchema = baseSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required",
  });

export const listNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, status, channel, search } = listQuerySchema.parse(req.query);

    const where: Prisma.NotificationWhereInput = {};
    if (status) where.status = status;
    if (channel) where.channel = channel;
    if (search) {
      where.OR = [
        { title: { contains: search.trim(), mode: "insensitive" } },
        { message: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    const [total, notifications] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return res.json({
      success: true,
      data: { notifications },
      pagination: { page, limit, total },
    });
  } catch (error) {
    next(error);
  }
};

export const getNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = notificationIdSchema.parse(req.params);
    const notification = await prisma.notification.findUnique({ where: { id } });

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    return res.json({ success: true, data: { notification } });
  } catch (error) {
    next(error);
  }
};

export const createNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createSchema.parse(req.body);

    if (
      payload.status === NotificationStatus.scheduled &&
      payload.scheduledAt &&
      payload.scheduledAt < new Date()
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Scheduled notifications must be in the future" });
    }

    const notification = await prisma.notification.create({
      data: {
        title: payload.title,
        message: payload.message,
        status: payload.status,
        channel: payload.channel,
        audience: payload.audience ?? null,
        scheduled_at: payload.scheduledAt ?? null,
        published_at: payload.status === NotificationStatus.sent ? new Date() : null,
        created_by: req.user?.id ?? null,
      },
    });

    await recordAdminAction(req.user?.id, "Notification", "CREATE", notification.id, notification.title);

    return res.status(201).json({ success: true, data: { notification } });
  } catch (error) {
    next(error);
  }
};

export const updateNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = notificationIdSchema.parse(req.params);
    const payload = updateSchema.parse(req.body);

    if (
      payload.status === NotificationStatus.scheduled &&
      payload.scheduledAt &&
      payload.scheduledAt < new Date()
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Scheduled notifications must be in the future" });
    }

    const data: Prisma.NotificationUpdateInput = {};
    if (payload.title !== undefined) data.title = payload.title;
    if (payload.message !== undefined) data.message = payload.message;
    if (payload.audience !== undefined) data.audience = payload.audience ?? null;
    if (payload.status !== undefined) data.status = payload.status;
    if (payload.channel !== undefined) data.channel = payload.channel;
    if (payload.scheduledAt !== undefined) data.scheduled_at = payload.scheduledAt ?? null;

    if (payload.status === NotificationStatus.sent) {
      data.published_at = new Date();
    }

    const notification = await prisma.notification.update({
      where: { id },
      data,
    });

    await recordAdminAction(req.user?.id, "Notification", "UPDATE", id, notification.title);

    return res.json({ success: true, data: { notification } });
  } catch (error) {
    next(error);
  }
};

export const deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = notificationIdSchema.parse(req.params);
    const deleted = await prisma.notification.delete({ where: { id } });
    await recordAdminAction(req.user?.id, "Notification", "DELETE", id, deleted.title);
    return res.json({ success: true, message: "Notification deleted" });
  } catch (error) {
    next(error);
  }
};
