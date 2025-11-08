"use client";

import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/DataTable";
import { fetcher } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useState } from "react";

type AdminUser = {
  id: number;
  full_name: string;
  email: string;
  role?: string;
  is_premium?: boolean;
  join_date?: string;
};

const UsersPage = () => {
  const { data, isLoading, mutate } = useSWR<AdminUser[] | { users?: AdminUser[] }>("/admin/users", fetcher);
  const users = Array.isArray(data) ? data : data?.users ?? [];
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Users</h1>
          <p className="text-muted-foreground">Search, filter, and manage Nunyalearn learner accounts.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => mutate()}>
            Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>Add User</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Quick Add</DialogTitle>
                <DialogDescription>Provision a new learner (demo only).</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Full name" />
                <Input placeholder="Email" type="email" />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setDialogOpen(false)}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <DataTable
        columns={[
          { key: "full_name", label: "Name" },
          { key: "email", label: "Email" },
          { key: "role", label: "Role" },
          {
            key: "is_premium",
            label: "Premium",
            render: (row) => (row.is_premium ? "Yes" : "No"),
          },
          { key: "join_date", label: "Joined" },
        ]}
        data={users}
        isLoading={isLoading}
      />
    </div>
  );
};

export default UsersPage;
