"use client";

import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/DataTable";
import { fetcher } from "@/lib/api";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

type Notification = {
  id: number;
  title: string;
  message: string;
  status?: string;
  scheduled_at?: string;
};

const NotificationsPage = () => {
  const { data, isLoading, mutate } = useSWR<Notification[] | { notifications?: Notification[] }>(
    "/admin/notifications",
    fetcher,
  );
  const notifications = Array.isArray(data) ? data : data?.notifications ?? [];
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Notifications</h1>
          <p className="text-muted-foreground">Announcements, push campaigns, and email digests.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => mutate()}>
            Refresh
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Create Announcement</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Announcement</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Title" />
                <Textarea placeholder="Message body" />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setOpen(false)}>Schedule</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <DataTable
        columns={[
          { key: "title", label: "Title" },
          { key: "message", label: "Message" },
          { key: "status", label: "Status" },
          { key: "scheduled_at", label: "Scheduled" },
        ]}
        data={notifications}
        isLoading={isLoading}
      />
    </div>
  );
};

export default NotificationsPage;
