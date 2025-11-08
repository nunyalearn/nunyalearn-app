import { Router } from "express";
import { grantReward } from "../../controllers/admin/adminRewardsController";
import { verifyToken } from "../../middlewares/verifyToken";
import { verifyRole } from "../../middlewares/verifyRole";
import { Role } from "@prisma/client";

const router = Router();

router.use(verifyToken, verifyRole(Role.ADMIN));

router.post("/grant", grantReward);

export default router;
