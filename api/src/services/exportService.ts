import ExcelJS from "exceljs";
import { Parser } from "json2csv";
import {
  AttemptExportFilter,
  ProgressExportFilter,
  getAttemptsForExport,
  getProgressForExport,
} from "./analyticsService";

export const generateAttemptsCsv = async (filter: AttemptExportFilter = {}) => {
  const attempts = await getAttemptsForExport(filter);

  const parser = new Parser({
    fields: [
      { label: "Attempt ID", value: "attemptId" },
      { label: "Quiz ID", value: "quizId" },
      { label: "User ID", value: "userId" },
      { label: "Score", value: "score" },
      { label: "Attempt Date", value: "attemptDate" },
    ],
  });

  const payload = attempts.map((attempt) => ({
    ...attempt,
    attemptDate: attempt.attemptDate.toISOString(),
  }));

  const csv = parser.parse(payload);
  return Buffer.from(csv, "utf-8");
};

export const generateProgressXlsx = async (filter: ProgressExportFilter = {}) => {
  const progressRecords = await getProgressForExport(filter);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Progress");

  sheet.columns = [
    { header: "User ID", key: "userId", width: 12 },
    { header: "Topic ID", key: "topicId", width: 12 },
    { header: "Topic Name", key: "topicName", width: 32 },
    { header: "Subject ID", key: "subjectId", width: 12 },
    { header: "Subject Name", key: "subjectName", width: 32 },
    { header: "Completion %", key: "completionPercent", width: 15 },
    { header: "XP Earned", key: "xpEarned", width: 12 },
    { header: "Last Updated", key: "lastUpdated", width: 24 },
  ];

  progressRecords.forEach((record) => {
    sheet.addRow({
      ...record,
      lastUpdated: record.lastUpdated.toISOString(),
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};
