import { Router } from "express";
import { Role } from "@prisma/client";
import {
  createUser,
  deactivateUser,
  exportUsersCsv,
  getUserById,
  importUsersBulk,
  listUsers,
  updateUser,
} from "../../controllers/admin/adminUserController";
import { verifyToken } from "../../middlewares/verifyToken";
import { verifyRole } from "../../middlewares/verifyRole";

const router = Router();

router.use(verifyToken, verifyRole(Role.ADMIN));

router.get("/", listUsers);
router.get("/export.csv", exportUsersCsv);
router.post("/import", importUsersBulk);
router.get("/:id", getUserById);
router.post("/", createUser);
router.put("/:id", updateUser);
router.delete("/:id", deactivateUser);

export default router;
