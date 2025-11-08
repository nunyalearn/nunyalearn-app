import { Router } from "express";
import { createBadge, deleteBadge, listBadges, updateBadge } from "../../controllers/admin/adminBadgeController";
import { verifyToken } from "../../middlewares/verifyToken";
import { verifyRole } from "../../middlewares/verifyRole";
import { Role } from "@prisma/client";

const router = Router();

router.use(verifyToken, verifyRole(Role.ADMIN));

router.post("/", createBadge);
router.get("/", listBadges);
router.put("/:id", updateBadge);
router.delete("/:id", deleteBadge);

export default router;
