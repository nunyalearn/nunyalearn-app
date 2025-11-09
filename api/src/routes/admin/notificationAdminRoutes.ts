import { Router } from "express";
import { Role } from "@prisma/client";
import {
  createNotification,
  deleteNotification,
  getNotification,
  listNotifications,
  updateNotification,
} from "../../controllers/admin/adminNotificationController";
import { verifyToken } from "../../middlewares/verifyToken";
import { verifyRole } from "../../middlewares/verifyRole";

const router = Router();

router.use(verifyToken, verifyRole(Role.ADMIN));

router.get("/", listNotifications);
router.get("/:id", getNotification);
router.post("/", createNotification);
router.put("/:id", updateNotification);
router.delete("/:id", deleteNotification);

export default router;
