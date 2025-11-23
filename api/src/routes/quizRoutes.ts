/**
 * 🚫 LEGACY MODULE — FROZEN 🚫
 * -------------------------------------------------------------------
 * This file is part of the OLD quiz/practice-test system.
 *
 * DO NOT MODIFY THIS FILE unless you are fixing a critical bug.
 * DO NOT add new logic, new fields, or new features here.
 * DO NOT refactor this file.
 *
 * This module will be safely deprecated once the new Quiz v2 and
 * Practice Test v2 APIs are fully implemented and the mobile app
 * migrates off the legacy flows.
 *
 * Safe actions allowed:
 *   - Documentation updates
 *   - Bug fixes that preserve existing behavior
 *   - No new features or structural changes
 *
 * Purpose:
 *   Preserve historical logic during migration to new models.
 * -------------------------------------------------------------------
 */
import { Router } from "express";
import { getQuizzes, submitAttempt } from "../controllers/quizController";
import { verifyToken } from "../middlewares/verifyToken";

const router = Router();

// ⚠️ Legacy quiz endpoints — keep untouched until Quiz v2 migrates learners.
router.get("/", getQuizzes);
router.post("/attempts", verifyToken, submitAttempt);

export default router;
