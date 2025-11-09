import { Prisma, TicketPriority, TicketStatus } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../../config/db";
import { recordAdminAction } from "../../services/auditService";

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  search: z.string().optional(),
});

const ticketIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const createTicketSchema = z
  .object({
    subject: z.string().min(1),
    message: z.string().optional(),
    userId: z.coerce.number().int().positive().optional(),
    userEmail: z.string().email().optional(),
    priority: z.nativeEnum(TicketPriority).default(TicketPriority.medium),
  })
  .refine((data) => data.userId !== undefined || data.userEmail !== undefined, {
    message: "Either userId or userEmail is required",
    path: ["userEmail"],
  });

const updateTicketSchema = z
  .object({
    subject: z.string().min(1).optional(),
    message: z.string().optional(),
    status: z.nativeEnum(TicketStatus).optional(),
    priority: z.nativeEnum(TicketPriority).optional(),
    assignedTo: z.coerce.number().int().positive().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required",
  });

const respondSchema = z.object({
  message: z.string().min(1),
});

export const listSupportTickets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, status, priority, search } = listQuerySchema.parse(req.query);

    const where: Prisma.SupportTicketWhereInput = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { subject: { contains: search.trim(), mode: "insensitive" } },
        { user_email: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    const [total, tickets] = await Promise.all([
      prisma.supportTicket.count({ where }),
      prisma.supportTicket.findMany({
        where,
        orderBy: [
          { status: "asc" },
          { priority: "desc" },
          { created_at: "desc" },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return res.json({
      success: true,
      data: { tickets },
      pagination: { page, limit, total },
    });
  } catch (error) {
    next(error);
  }
};

export const getSupportTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = ticketIdSchema.parse(req.params);

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        responses: {
          orderBy: { created_at: "asc" },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    return res.json({ success: true, data: { ticket } });
  } catch (error) {
    next(error);
  }
};

export const createSupportTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createTicketSchema.parse(req.body);

    let userEmail = payload.userEmail ?? null;
    if (payload.userId && !userEmail) {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { email: true },
      });
      userEmail = user?.email ?? null;
    }

    if (!userEmail) {
      return res
        .status(400)
        .json({ success: false, message: "Unable to resolve user email for ticket" });
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        subject: payload.subject,
        message: payload.message ?? null,
        user_id: payload.userId ?? null,
        user_email: userEmail,
        priority: payload.priority,
        status: TicketStatus.open,
      },
    });

    await recordAdminAction(req.user?.id, "SupportTicket", "CREATE", ticket.id, ticket.subject);

    return res.status(201).json({ success: true, data: { ticket } });
  } catch (error) {
    next(error);
  }
};

export const updateSupportTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = ticketIdSchema.parse(req.params);
    const payload = updateTicketSchema.parse(req.body);

    const data: Prisma.SupportTicketUncheckedUpdateInput = {};
    if (payload.subject !== undefined) data.subject = payload.subject;
    if (payload.message !== undefined) data.message = payload.message ?? null;
    if (payload.status !== undefined) data.status = payload.status;
    if (payload.priority !== undefined) data.priority = payload.priority;
    if (payload.assignedTo !== undefined) data.assigned_to = payload.assignedTo;

    if (payload.status === TicketStatus.closed) {
      data.closed_at = new Date();
    } else if (payload.status) {
      data.closed_at = null;
    }

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data,
    });

    await recordAdminAction(req.user?.id, "SupportTicket", "UPDATE", id, ticket.subject);

    return res.json({ success: true, data: { ticket } });
  } catch (error) {
    next(error);
  }
};

export const respondToTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = ticketIdSchema.parse(req.params);
    const payload = respondSchema.parse(req.body);

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    const responseRecord = await prisma.supportResponse.create({
      data: {
        ticket_id: id,
        author_id: req.user?.id ?? null,
        message: payload.message,
      },
    });

    await recordAdminAction(req.user?.id, "SupportTicketResponse", "CREATE", responseRecord.ticket_id, payload.message);

    return res
      .status(201)
      .json({ success: true, data: { response: responseRecord }, message: "Response recorded" });
  } catch (error) {
    next(error);
  }
};

export const deleteSupportTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = ticketIdSchema.parse(req.params);
    const deleted = await prisma.supportTicket.delete({ where: { id } });
    await recordAdminAction(req.user?.id, "SupportTicket", "DELETE", id, deleted.subject);
    return res.json({ success: true, message: "Ticket deleted" });
  } catch (error) {
    next(error);
  }
};
