import { Router } from "express";
import { Role } from "@prisma/client";
import {
  createPayment,
  deletePayment,
  getPaymentById,
  listPayments,
  updatePayment,
} from "../../controllers/admin/adminPaymentController";
import { verifyToken } from "../../middlewares/verifyToken";
import { verifyRole } from "../../middlewares/verifyRole";

const router = Router();

router.use(verifyToken, verifyRole(Role.ADMIN));

router.get("/", listPayments);
router.get("/:id", getPaymentById);
router.post("/", createPayment);
router.put("/:id", updatePayment);
router.delete("/:id", deletePayment);

export default router;
