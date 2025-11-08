"use client";

import useSWR from "swr";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LineChart,
  Line,
} from "recharts";
import ChartCard from "@/components/ChartCard";
import Loader from "@/components/Loader";
import { DataTable } from "@/components/DataTable";
import { fetcher } from "@/lib/api";

type Attempt = {
  id: number;
  score: number;
  attemptDate: string;
  user?: { full_name?: string };
};

type ProgressSummary = {
  subjectName: string;
  averageCompletion: number;
  averageXp: number;
  quizzesCompleted: number;
};

const AnalyticsPage = () => {
  const { data: attemptsData, isLoading: attemptsLoading } = useSWR<Attempt[] | { attempts?: Attempt[] }>(
    "/admin/reporting/attempts?limit=25",
    fetcher,
  );
  const { data: progressData, isLoading: progressLoading } = useSWR<ProgressSummary[] | { subjects?: ProgressSummary[] }>(
    "/admin/reporting/progress",
    fetcher,
  );
  const attempts = Array.isArray(attemptsData) ? attemptsData : attemptsData?.attempts ?? [];
  const progress = Array.isArray(progressData) ? progressData : progressData?.subjects ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Analytics</h1>
        <p className="text-muted-foreground">Attempt performance and subject completion summaries.</p>
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Attempt Distribution" description="Recent attempt scores">
          {attemptsLoading ? (
            <Loader />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={attempts.map((attempt) => {
                  const date = attempt.attemptDate ?? (attempt as any).attempt_date;
                  return {
                    ...attempt,
                    attemptDate: date ? new Date(date).toLocaleDateString() : "—",
                  };
                })}
              >
                <defs>
                  <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#007a3e" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#007a3e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="attemptDate" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="score" stroke="#007a3e" fill="url(#scoreGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Subject Progress" description="Average completion per subject">
          {progressLoading ? (
            <Loader />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={progress}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="subjectName" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="averageCompletion" stroke="#004976" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </section>

      <DataTable
        columns={[
          {
            key: "attemptDate",
            label: "Date",
            render: (row) => {
              const date = row.attemptDate ?? (row as any).attempt_date;
              return date ? new Date(date).toLocaleString() : "—";
            },
          },
          { key: "score", label: "Score" },
          {
            key: "user",
            label: "Learner",
            render: (row) => row.user?.full_name ?? "—",
          },
        ]}
        data={attempts}
        isLoading={attemptsLoading}
      />
    </div>
  );
};

export default AnalyticsPage;
