import { Router } from "express";
import {
  createReward,
  deleteReward,
  getReward,
  grantReward,
  listRewards,
  updateReward,
} from "../../controllers/admin/adminRewardsController";
import { verifyToken } from "../../middlewares/verifyToken";
import { verifyRole } from "../../middlewares/verifyRole";
import { Role } from "@prisma/client";

const router = Router();

router.use(verifyToken, verifyRole(Role.ADMIN));

router.get("/", listRewards);
router.post("/", createReward);
router.post("/grant", grantReward);
router.get("/:id", getReward);
router.put("/:id", updateReward);
router.delete("/:id", deleteReward);

export default router;
