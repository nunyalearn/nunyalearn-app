"use client";

import useSWR from "swr";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
import StatCard from "@/components/StatCard";
import ChartCard from "@/components/ChartCard";
import { DataTable } from "@/components/DataTable";
import Loader from "@/components/Loader";
import { fetcher } from "@/lib/api";

type MetricsResponse = {
  totalUsers?: number;
  totalBadges?: number;
  totalChallenges?: number;
  totalQuizzes?: number;
};

type EngagementResponse = {
  activeUsers: number;
  quizzesCompleted: number;
  averageXp: number;
  averageStreak: number;
};

type LeaderboardEntry = {
  userId: number;
  fullName: string;
  xp: number;
  completionPercent?: number;
  level?: number;
};

const DashboardPage = () => {
  const { data: metrics, isLoading: metricsLoading } = useSWR<MetricsResponse>(
    "/admin/reporting/metrics",
    fetcher,
    { refreshInterval: 60_000 },
  );
  const { data: engagement, isLoading: engagementLoading } = useSWR<EngagementResponse>(
    "/admin/reporting/engagement?range=30d",
    fetcher,
  );
  const { data: leaderboardData, isLoading: leaderboardLoading } = useSWR<LeaderboardEntry[] | { leaderboard?: LeaderboardEntry[] }>(
    "/admin/reporting/leaderboard?limit=6&sortBy=xp",
    fetcher,
  );
  const leaderboard = Array.isArray(leaderboardData) ? leaderboardData : leaderboardData?.leaderboard ?? [];

  if (metricsLoading && !metrics) {
    return <Loader fullscreen />;
  }

  const engagementSeries = engagement ? [{ label: "Last 30 days", ...engagement }] : [];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Operational Overview</p>
        <h1 className="mt-1 text-3xl font-semibold text-primary">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Real-time KPIs from the Nunyalearn platform.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Learners"
          value={metrics?.totalUsers?.toLocaleString() ?? "—"}
          change="+8% MoM"
          trend="up"
        />
        <StatCard
          title="Published Quizzes"
          value={metrics?.totalQuizzes ?? "—"}
          change="+12 this week"
          trend="up"
        />
        <StatCard title="Badges Live" value={metrics?.totalBadges ?? "—"} change="Gamification" trend="flat" />
        <StatCard title="Challenges" value={metrics?.totalChallenges ?? "—"} change="+2 cohorts" trend="up" />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Engagement Pulse" description="Active users and quizzes completed (30d)">
          {engagementLoading ? (
            <Loader />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={engagementSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="activeUsers" stroke="#007a3e" strokeWidth={3} />
                <Line type="monotone" dataKey="quizzesCompleted" stroke="#004976" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="XP Leaders" description="Top learners by XP totals">
          {leaderboardLoading ? (
            <Loader />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leaderboard ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="fullName" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="xp" fill="#00ad50" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Leaderboard Table</h2>
          <p className="text-sm text-muted-foreground">Live ranking with completion & levels</p>
        </div>
        <DataTable
          columns={[
            { key: "fullName", label: "Learner" },
            { key: "xp", label: "XP" },
            {
              key: "completionPercent",
              label: "Completion",
              render: (row) => `${row.completionPercent?.toFixed(1) ?? 0}%`,
            },
            { key: "level", label: "Level" },
          ]}
          data={leaderboard}
          isLoading={leaderboardLoading}
        />
      </section>
    </div>
  );
};

export default DashboardPage;
