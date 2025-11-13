"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import api, { fetcher } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

type SettingsPayload = {
  default_role?: string;
  onboarding_message?: string;
  notifications_enabled?: boolean;
};

const SettingsPage = () => {
  const { data, mutate } = useSWR<SettingsPayload>("/admin/settings", fetcher);
  const [form, setForm] = useState<SettingsPayload>(() => data ?? {});
  const { toast } = useToast();

  useEffect(() => {
    if (!data) {
      return;
    }
    const id = requestAnimationFrame(() => setForm(data));
    return () => cancelAnimationFrame(id);
  }, [data]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await api.put("/admin/settings", form);
    toast({ title: "Settings saved" });
    mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Settings</h1>
        <p className="text-muted-foreground">Update admin preferences and global defaults.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Platform Defaults</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Default Role</label>
              <Input
                value={form.default_role ?? ""}
                onChange={(event) => setForm((prev) => ({ ...prev, default_role: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Onboarding Message</label>
              <Textarea
                value={form.onboarding_message ?? ""}
                onChange={(event) => setForm((prev) => ({ ...prev, onboarding_message: event.target.value }))}
              />
            </div>
            <Button type="submit">Save Settings</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
