import { Router } from "express";
import {
  createAchievement,
  deleteAchievement,
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
router.put("/:id", updateAchievement);
router.delete("/:id", deleteAchievement);

export default router;
