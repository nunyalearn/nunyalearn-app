import { Prisma, Role } from "@prisma/client";
import bcrypt from "bcrypt";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../../config/db";
import { Parser } from "json2csv";
import { recordAdminAction } from "../../services/auditService";
import { mapUserDto } from "../../utils/dtoMappers";

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  role: z.nativeEnum(Role).optional(),
  premium: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => (typeof value === "boolean" ? value : value === "true"))
    .optional(),
  status: z.enum(["active", "inactive", "all"]).optional(),
  sort: z.enum(["recent", "xp", "name"]).default("recent"),
});

const importUsersSchema = z.object({
  users: z
    .array(
      z.object({
        fullName: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.nativeEnum(Role).default(Role.USER),
        isPremium: z.boolean().optional().default(false),
      }),
    )
    .min(1, "At least one user is required"),
});

const userIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const createUserSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(Role).default(Role.USER),
  isPremium: z.boolean().optional(),
});

const updateUserSchema = z
  .object({
    fullName: z.string().min(1).optional(),
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    role: z.nativeEnum(Role).optional(),
    isPremium: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required",
  });

const sanitizeUser = (user: any) => {
  const { password_hash, ...rest } = user;
  return mapUserDto(rest);
};

const buildUserWhere = (params: z.infer<typeof listQuerySchema>): Prisma.UserWhereInput => {
  const where: Prisma.UserWhereInput = {};

  if (params.search) {
    const term = params.search.trim();
    where.OR = [
      { full_name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
    ];
  }

  if (params.role) {
    where.role = params.role;
  }

  if (params.premium !== undefined) {
    where.is_premium = params.premium;
  }

  if (params.status === "active") {
    where.is_active = true;
  } else if (params.status === "inactive") {
    where.is_active = false;
  }

  return where;
};

const resolveUserOrderBy = (sort?: string) => {
  if (sort === "xp") {
    return { xp_total: "desc" as const };
  }
  if (sort === "name") {
    return { full_name: "asc" as const };
  }
  return { join_date: "desc" as const };
};

const baseUserSelect = {
  id: true,
  full_name: true,
  email: true,
  join_date: true,
  is_premium: true,
  is_active: true,
  role: true,
  xp_total: true,
  level: true,
};

export const listUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = listQuerySchema.parse(req.query);
    const { page, limit } = params;
    const where = buildUserWhere(params);
    const orderBy = resolveUserOrderBy(params.sort);

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: baseUserSelect,
      }),
    ]);

    const normalizedUsers = users.map((entry) => mapUserDto(entry));

    return res.json({
      success: true,
      data: { users: normalizedUsers },
      pagination: { page, limit, total },
    });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = userIdParamSchema.parse(req.params);

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        full_name: true,
        email: true,
        join_date: true,
        is_premium: true,
        is_active: true,
        role: true,
        xp_total: true,
        level: true,
        streak_days: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, data: { user: mapUserDto(user) } });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createUserSchema.parse(req.body);
    const password_hash = await bcrypt.hash(payload.password, 10);

    const user = await prisma.user.create({
      data: {
        full_name: payload.fullName,
        email: payload.email,
        password_hash,
        role: payload.role,
        is_premium: payload.isPremium ?? false,
      },
    });

    await recordAdminAction(req.user?.id, "User", "CREATE", user.id, user.email);

    return res.status(201).json({
      success: true,
      data: { user: sanitizeUser(user) },
    });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = userIdParamSchema.parse(req.params);
    const payload = updateUserSchema.parse(req.body);

    const data: Prisma.UserUpdateInput = {};
    if (payload.fullName !== undefined) data.full_name = payload.fullName;
    if (payload.email !== undefined) data.email = payload.email;
    if (payload.role !== undefined) data.role = payload.role;
    if (payload.isPremium !== undefined) data.is_premium = payload.isPremium;
    if (payload.isActive !== undefined) data.is_active = payload.isActive;
    if (payload.password) {
      data.password_hash = await bcrypt.hash(payload.password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        full_name: true,
        email: true,
        join_date: true,
        is_premium: true,
        is_active: true,
        role: true,
        xp_total: true,
        level: true,
      },
    });

    await recordAdminAction(req.user?.id, "User", "UPDATE", id, user.email);

    return res.json({
      success: true,
      data: { user: mapUserDto(user) },
    });
  } catch (error) {
    next(error);
  }
};

export const deactivateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = userIdParamSchema.parse(req.params);

    const user = await prisma.user.update({
      where: { id },
      data: { is_active: false },
      select: {
        id: true,
        full_name: true,
        email: true,
        is_active: true,
      },
    });

    await recordAdminAction(req.user?.id, "User", "DEACTIVATE", id, user.email);

    return res.json({
      success: true,
      data: null,
      message: "User deactivated",
    });
  } catch (error) {
    next(error);
  }
};

export const exportUsersCsv = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = listQuerySchema.parse(req.query);
    const where = buildUserWhere(params);
    const orderBy = resolveUserOrderBy(params.sort);

    const users = await prisma.user.findMany({
      where,
      orderBy,
      select: baseUserSelect,
    });

    const rows = users.map((user) => ({
      Name: user.full_name,
      Email: user.email,
      Role: user.role,
      Premium: user.is_premium ? "Yes" : "No",
      Active: user.is_active ? "Yes" : "No",
      XP: user.xp_total,
      Level: user.level,
      Joined: user.join_date.toISOString(),
    }));

    const parser = new Parser();
    const csv = parser.parse(rows);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="users.csv"');

    await recordAdminAction(
      req.user?.id,
      "User",
      "EXPORT",
      undefined,
      `${rows.length} rows`,
    );

    return res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};

export const importUsersBulk = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = importUsersSchema.parse(req.body);
    const summary = {
      created: 0,
      skipped: [] as string[],
    };

    for (const entry of payload.users) {
      const exists = await prisma.user.findUnique({
        where: { email: entry.email },
        select: { id: true },
      });

      if (exists) {
        summary.skipped.push(entry.email);
        continue;
      }

      const password_hash = await bcrypt.hash(entry.password, 10);
      await prisma.user.create({
        data: {
          full_name: entry.fullName,
          email: entry.email,
          password_hash,
          role: entry.role,
          is_premium: entry.isPremium ?? false,
        },
      });

      summary.created += 1;
    }

    await recordAdminAction(
      req.user?.id,
      "User",
      "IMPORT",
      undefined,
      `${summary.created} created, ${summary.skipped.length} skipped`,
    );

    return res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};
