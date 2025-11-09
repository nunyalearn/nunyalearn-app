import prisma from "../config/db";

export const ensureGradeLevelContext = async (
  gradeLevelId?: number,
  gradeLevelName?: string,
) => {
  if (gradeLevelId) {
    const level = await prisma.gradeLevel.findFirst({
      where: { id: gradeLevelId },
    });
    if (!level) {
      throw new Error("Grade level not found");
    }
    return { gradeLevelName: level.name, gradeLevelId: level.id };
  }

  if (gradeLevelName) {
    const existing = await prisma.gradeLevel.findFirst({
      where: {
        name: { equals: gradeLevelName, mode: "insensitive" },
      },
    });

    if (existing) {
      return { gradeLevelName: existing.name, gradeLevelId: existing.id };
    }
    return { gradeLevelName, gradeLevelId: null };
  }

  throw new Error("Grade level information missing");
};
