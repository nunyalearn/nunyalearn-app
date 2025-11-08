import { Router } from "express";
import { Role } from "@prisma/client";
import { verifyToken } from "../../middlewares/verifyToken";
import { verifyRole } from "../../middlewares/verifyRole";
import { exportAttemptsCsv, exportProgressXlsx } from "../../controllers/admin/exportController";

const router = Router();

router.use(verifyToken, verifyRole(Role.ADMIN));

router.get("/attempts.csv", exportAttemptsCsv);
router.get("/progress.xlsx", exportProgressXlsx);

export default router;
