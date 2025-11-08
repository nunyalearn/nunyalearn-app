import { Router } from "express";
import { Role } from "@prisma/client";
import { verifyToken } from "../../middlewares/verifyToken";
import { verifyRole } from "../../middlewares/verifyRole";
import { getSystemHealth, getSystemLogs } from "../../controllers/admin/metricsController";

const router = Router();

router.use(verifyToken, verifyRole(Role.ADMIN));

router.get("/health", getSystemHealth);
router.get("/logs", getSystemLogs);

export default router;
