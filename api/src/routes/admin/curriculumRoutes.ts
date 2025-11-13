import { Router } from "express";
import { Role } from "@prisma/client";
import {
  createGradeLevel,
  createSubject,
  createTopic,
  deleteGrade,
  deleteSubject,
  deleteTopic,
  getCurriculumTree,
  listGrades,
  listSubjects,
  listTopics,
} from "../../controllers/curriculumController";
import { gradeLevelSchema, subjectSchema, topicSchema } from "../../validation/curriculumSchema";
import { validateSchema } from "../../middlewares/validateSchema";
import { verifyToken } from "../../middlewares/verifyToken";
import { verifyRole } from "../../middlewares/verifyRole";

const router = Router();

router.use(verifyToken, verifyRole(Role.ADMIN));

router.get("/grades", listGrades);
router.get("/subjects", listSubjects);
router.get("/topics", listTopics);
router.get("/tree", getCurriculumTree);

router.post("/grades", validateSchema(gradeLevelSchema), createGradeLevel);
router.post("/subjects", validateSchema(subjectSchema), createSubject);
router.post("/topics", validateSchema(topicSchema), createTopic);

router.delete("/grades/:id", deleteGrade);
router.delete("/subjects/:id", deleteSubject);
router.delete("/topics/:id", deleteTopic);

export default router;
