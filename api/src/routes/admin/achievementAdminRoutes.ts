import { Router } from "express";
import {
  createAchievement,
  deleteAchievement,
  getAchievement,
  listAchievements,
  updateAchievement,
} from "../../controllers/admin/adminAchievementController";
import { verifyToken } from "../../middlewares/verifyToken";
import { verifyRole } from "../../middlewares/verifyRole";
import { Role } from "@prisma/client";

const router = Router();

router.use(verifyToken, verifyRole(Role.ADMIN));

router.post("/", createAchievement);
router.get("/", listAchievements);
router.get("/:id", getAchievement);
router.put("/:id", updateAchievement);
router.delete("/:id", deleteAchievement);

export default router;
