import { Router } from "express";
import { createSubject, getSubjects } from "../controllers/subjectController";
import { verifyToken } from "../middlewares/verifyToken";

const router = Router();

router.get("/", getSubjects);
router.post("/", verifyToken, createSubject);

export default router;
