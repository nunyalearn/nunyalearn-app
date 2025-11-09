import { Router } from "express";
import { Role } from "@prisma/client";
import {
  getPlatformSettings,
  updatePlatformSettings,
} from "../../controllers/admin/adminSettingsController";
import { verifyToken } from "../../middlewares/verifyToken";
import { verifyRole } from "../../middlewares/verifyRole";

const router = Router();

router.use(verifyToken, verifyRole(Role.ADMIN));

router.get("/", getPlatformSettings);
router.put("/", updatePlatformSettings);

export default router;
