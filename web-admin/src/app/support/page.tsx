"use client";

import useSWR from "swr";
import { DataTable } from "@/components/DataTable";
import { fetcher } from "@/lib/api";

type Ticket = {
  id: number;
  subject: string;
  status: string;
  priority?: string;
  user_email?: string;
};

const SupportPage = () => {
  const { data, isLoading } = useSWR<Ticket[] | { tickets?: Ticket[] }>("/admin/support", fetcher);
  const tickets = Array.isArray(data) ? data : data?.tickets ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Support & Feedback</h1>
        <p className="text-muted-foreground">Track open tickets and learner conversations.</p>
      </div>

      <DataTable
        columns={[
          { key: "subject", label: "Subject" },
          { key: "user_email", label: "User" },
          { key: "status", label: "Status" },
          { key: "priority", label: "Priority" },
        ]}
        data={tickets}
        isLoading={isLoading}
      />
    </div>
  );
};

export default SupportPage;
