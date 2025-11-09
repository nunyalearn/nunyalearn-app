import { Router } from "express";
import { Role } from "@prisma/client";
import { createSubject, getSubjects } from "../controllers/subjectController";
import { verifyToken } from "../middlewares/verifyToken";
import { verifyRole } from "../middlewares/verifyRole";

const router = Router();

router.get("/", getSubjects);
router.post("/", verifyToken, verifyRole(Role.ADMIN), createSubject);

export default router;
