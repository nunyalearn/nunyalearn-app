import { Prisma, Role } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../../config/db";
import { recordAdminAction } from "../../services/auditService";

const SETTINGS_ID = 1;

const updateSchema = z.object({
  default_role: z.nativeEnum(Role).optional(),
  onboarding_message: z.string().optional(),
  notifications_enabled: z.boolean().optional(),
  xp_multiplier: z.coerce.number().positive().optional(),
});

const getOrCreateSettings = () =>
  prisma.platformSetting.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: {
      id: SETTINGS_ID,
      default_role: Role.USER,
      onboarding_message: null,
      notifications_enabled: true,
      xp_multiplier: 1,
    },
  });

export const getPlatformSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await getOrCreateSettings();
    return res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

export const updatePlatformSettings = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const payload = updateSchema.parse(req.body);

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ success: false, message: "No settings provided" });
    }

    const data: Prisma.PlatformSettingUpdateInput = {};
    if (payload.default_role !== undefined) {
      data.default_role = payload.default_role;
    }
    if (payload.onboarding_message !== undefined) {
      data.onboarding_message = payload.onboarding_message ?? null;
    }
    if (payload.notifications_enabled !== undefined) {
      data.notifications_enabled = payload.notifications_enabled;
    }
    if (payload.xp_multiplier !== undefined) {
      data.xp_multiplier = payload.xp_multiplier;
    }

    const settings = await prisma.platformSetting.update({
      where: { id: SETTINGS_ID },
      data,
    });

    await recordAdminAction(req.user?.id, "PlatformSetting", "UPDATE", SETTINGS_ID);

    return res.json({ success: true, data: settings });
  } catch (error) {
    if ((error as any).code === "P2025") {
      const created = await getOrCreateSettings();
      await recordAdminAction(req.user?.id, "PlatformSetting", "CREATE", SETTINGS_ID);
      return res.json({ success: true, data: created });
    }
    next(error);
  }
};
