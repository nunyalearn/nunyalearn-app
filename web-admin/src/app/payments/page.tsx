"use client";

import useSWR from "swr";
import { DataTable } from "@/components/DataTable";
import { fetcher } from "@/lib/api";

type Payment = {
  id: number;
  user_email: string;
  amount: number;
  status: string;
  created_at: string;
};

type Subscription = {
  id: number;
  user_email: string;
  plan: string;
  status: string;
  renews_at?: string;
};

const PaymentsPage = () => {
  const { data: paymentsData, isLoading: paymentsLoading } = useSWR<Payment[] | { payments?: Payment[] }>(
    "/admin/payments",
    fetcher,
  );
  const { data: subscriptionsData, isLoading: subscriptionsLoading } = useSWR<Subscription[] | { subscriptions?: Subscription[] }>(
    "/admin/subscriptions",
    fetcher,
  );
  const payments = Array.isArray(paymentsData) ? paymentsData : paymentsData?.payments ?? [];
  const subscriptions = Array.isArray(subscriptionsData) ? subscriptionsData : subscriptionsData?.subscriptions ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Payments & Subscriptions</h1>
        <p className="text-muted-foreground">Monitor premium conversions and recurring revenue.</p>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Recent Payments</h2>
        <DataTable
          columns={[
            { key: "user_email", label: "User" },
            {
              key: "amount",
              label: "Amount",
              render: (row) => `$${(row.amount / 100).toFixed(2)}`,
            },
            { key: "status", label: "Status" },
            { key: "created_at", label: "Date" },
          ]}
          data={payments}
          isLoading={paymentsLoading}
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Subscriptions</h2>
        <DataTable
          columns={[
            { key: "user_email", label: "User" },
            { key: "plan", label: "Plan" },
            { key: "status", label: "Status" },
            { key: "renews_at", label: "Renews" },
          ]}
          data={subscriptions}
          isLoading={subscriptionsLoading}
        />
      </div>
    </div>
  );
};

export default PaymentsPage;
