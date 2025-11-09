import { Router } from "express";
import { Role } from "@prisma/client";
import {
  createSubscription,
  deleteSubscription,
  getSubscriptionById,
  listSubscriptions,
  updateSubscription,
} from "../../controllers/admin/adminSubscriptionController";
import { verifyToken } from "../../middlewares/verifyToken";
import { verifyRole } from "../../middlewares/verifyRole";

const router = Router();

router.use(verifyToken, verifyRole(Role.ADMIN));

router.get("/", listSubscriptions);
router.get("/:id", getSubscriptionById);
router.post("/", createSubscription);
router.put("/:id", updateSubscription);
router.delete("/:id", deleteSubscription);

export default router;
