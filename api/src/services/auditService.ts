import prisma from "../config/db";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "ARCHIVE"
  | "RESTORE";

export const recordAdminAction = async (
  adminId: number | undefined,
  entity: string,
  action: AuditAction | string,
  entityId?: number,
  details?: string,
) => {
  try {
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId ?? null,
        entity,
        action,
        entity_id: entityId ?? null,
        details: details ?? null,
      },
    });
  } catch (error) {
    // Audit logging must never block the primary request path
    console.error("Failed to record admin audit log", error);
  }
};
