"use client";

import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ExportButton from "@/components/ExportButton";
import { fetcher } from "@/lib/api";

type Health = {
  serverTime: string;
  uptimeSeconds: number;
  version: string;
  database: "connected" | "error";
};

const SystemPage = () => {
  const { data: health } = useSWR<Health>("/admin/system/health", fetcher, { refreshInterval: 30_000 });
  const { data: logData } = useSWR<string[] | { logs?: string[] }>("/admin/system/logs?limit=100", fetcher, {
    refreshInterval: 30_000,
  });
  const logs = Array.isArray(logData) ? logData : logData?.logs ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">System Monitoring</h1>
          <p className="text-muted-foreground">API uptime, database status, and export utilities.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton label="Attempts CSV" endpoint="/admin/export/attempts.csv" filename="attempts.csv" />
          <ExportButton label="Progress XLSX" endpoint="/admin/export/progress.xlsx" filename="progress.xlsx" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Runtime</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Server Time: </span>
              {health?.serverTime ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Uptime:</span>{" "}
              {health ? `${(health.uptimeSeconds / 3600).toFixed(1)} hrs` : "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Version:</span> {health?.version ?? "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Database</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Status:</span>{" "}
              <span className={health?.database === "connected" ? "text-emerald-600" : "text-red-500"}>
                {health?.database ?? "unknown"}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Recent Logs</h2>
        <div className="max-h-[320px] overflow-y-auto rounded-3xl border bg-black p-4 font-mono text-xs text-lime-200">
          {logs.length ? logs.map((line, index) => <p key={index}>{line}</p>) : "No logs available."}
        </div>
      </div>
    </div>
  );
};

export default SystemPage;
