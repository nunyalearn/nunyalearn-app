"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { DataTable, TableColumn } from "@/components/DataTable";
import api, { downloadFile, fetcher } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

type AdminUser = {
  id: number;
  full_name: string;
  email: string;
  role: string;
  is_premium: boolean;
  is_active: boolean;
  xp_total: number;
  level: number;
  join_date?: string;
};

const csvTemplate = "fullName,email,password,role,isPremium\nJane Doe,jane@example.com,Password123,USER,false\n";

const parseCsvUsers = (text: string) => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length <= 1) {
    return [];
  }

  const headers = lines[0]
    .split(",")
    .map((header) => header.trim().toLowerCase());

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim());
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? "";
    });
    return record;
  });
};

const normalizeCsvRows = (rows: Record<string, string>[]) => {
  return rows
    .map((row) => {
      const fullName = row.fullname ?? row["full name"] ?? row.name ?? "";
      const email = row.email ?? "";
      const password = row.password ?? "";
      const role = (row.role ?? "USER").toUpperCase() === "ADMIN" ? "ADMIN" : "USER";
      const isPremium =
        ["true", "1", "yes"].includes((row.ispremium ?? row.premium ?? "").toLowerCase()) || false;

      return {
        fullName: fullName.trim(),
        email: email.trim(),
        password: password.trim(),
        role,
        isPremium,
      };
    })
    .filter((row) => row.fullName && row.email && row.password);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getErrorMessage = (error: unknown, fallback = "Please try again.") => {
  if (!error) {
    return fallback;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  const responseData = (error as { response?: { data?: unknown } })?.response?.data;
  if (isRecord(responseData)) {
    const { message, error: nestedError } = responseData as { message?: unknown; error?: unknown };
    if (typeof message === "string") {
      return message;
    }
    if (typeof nestedError === "string") {
      return nestedError;
    }
  }
  const fallbackMessage = (error as { message?: unknown }).message;
  return typeof fallbackMessage === "string" ? fallbackMessage : fallback;
};

const extractUsers = (raw: unknown): AdminUser[] => {
  if (!raw) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw as AdminUser[];
  }
  if (isRecord(raw)) {
    if (Array.isArray(raw.data)) {
      return raw.data as AdminUser[];
    }
    if (isRecord(raw.data) && Array.isArray((raw.data as { users?: AdminUser[] }).users)) {
      return (raw.data as { users?: AdminUser[] }).users ?? [];
    }
    if (Array.isArray((raw as { users?: AdminUser[] }).users)) {
      return (raw as { users?: AdminUser[] }).users ?? [];
    }
  }
  return [];
};

const UsersPage = () => {
  const { toast } = useToast();
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "USER",
    isPremium: false,
  });
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      setAppliedSearch(searchInput.trim());
    }, 400);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const query = appliedSearch ? `?search=${encodeURIComponent(appliedSearch)}` : "";
  const { data, isLoading, mutate } = useSWR(`/admin/users${query}`, fetcher);
  const users = useMemo(() => extractUsers(data), [data]);

  const userColumns: TableColumn<AdminUser>[] = useMemo(
    () => [
      { key: "full_name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "role", label: "Role" },
      {
        key: "is_premium",
        label: "Premium",
        render: (row) => (row.is_premium ? "Yes" : "No"),
      },
      {
        key: "is_active",
        label: "Status",
        render: (row) => (row.is_active ? "Active" : "Inactive"),
      },
      {
        key: "xp_total",
        label: "XP",
        render: (row) => row.xp_total?.toLocaleString() ?? "0",
      },
      { key: "level", label: "Level" },
      {
        key: "join_date",
        label: "Joined",
        render: (row) => (row.join_date ? new Date(row.join_date).toLocaleDateString() : "—"),
      },
    ],
    [],
  );

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newUser.fullName.trim() || !newUser.email.trim() || !newUser.password.trim()) {
      toast({ variant: "destructive", title: "All fields are required" });
      return;
    }
    setCreating(true);
    try {
      await api.post("/admin/users", {
        fullName: newUser.fullName.trim(),
        email: newUser.email.trim(),
        password: newUser.password,
        role: newUser.role,
        isPremium: newUser.isPremium,
      });
      toast({ title: "User created" });
      setDialogOpen(false);
      setNewUser({ fullName: "", email: "", password: "", role: "USER", isPremium: false });
      mutate();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Unable to create user",
        description: getErrorMessage(error),
      });
    } finally {
      setCreating(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadFile(`/admin/users/export.csv${query}`, "users.csv");
      toast({ title: "Export started" });
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Export failed",
        description: getErrorMessage(error),
      });
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([csvTemplate], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "user-import-template.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setImporting(true);
    try {
      const text = await file.text();
      const parsedRows = parseCsvUsers(text);
      const normalized = normalizeCsvRows(parsedRows);
      if (!normalized.length) {
        toast({ variant: "destructive", title: "No valid rows found in CSV." });
        return;
      }
      await api.post("/admin/users/import", { users: normalized });
      toast({ title: "Import completed" });
      mutate();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Import failed",
        description: getErrorMessage(error, "Please review your CSV and try again."),
      });
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Users</h1>
          <p className="text-muted-foreground">
            Provision admins, manage learner accounts, and keep CSV backups in sync.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search name or email..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="w-full min-w-[220px] md:w-64"
          />
          <Button variant="outline" onClick={() => mutate()}>
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            {exporting ? "Exporting..." : "Export CSV"}
          </Button>
          <Button variant="outline" onClick={handleDownloadTemplate}>
            Template CSV
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            {importing ? "Importing..." : "Import CSV"}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>Add User</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New User</DialogTitle>
                <DialogDescription>Invite a learner or admin with instant credentials.</DialogDescription>
              </DialogHeader>
              <form className="space-y-3" onSubmit={handleCreateUser}>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Full name</label>
                  <Input
                    value={newUser.fullName}
                    onChange={(event) => setNewUser((prev) => ({ ...prev, fullName: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <Input
                    type="email"
                    value={newUser.email}
                    onChange={(event) => setNewUser((prev) => ({ ...prev, email: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Temporary password</label>
                  <Input
                    type="password"
                    value={newUser.password}
                    onChange={(event) => setNewUser((prev) => ({ ...prev, password: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Role</label>
                  <select
                    value={newUser.role}
                    onChange={(event) => setNewUser((prev) => ({ ...prev, role: event.target.value }))}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="USER">Learner</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={newUser.isPremium}
                    onChange={(event) => setNewUser((prev) => ({ ...prev, isPremium: event.target.checked }))}
                  />
                  Premium access
                </label>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? "Saving..." : "Save"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Import files must use the template headers: <code>fullName,email,password,role,isPremium</code>. Role defaults to USER,
        and premium accepts true/false.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleImportFileChange}
      />

      <DataTable
        columns={userColumns}
        data={users}
        isLoading={isLoading}
        searchable={false}
        emptyLabel={appliedSearch ? "No users match your search." : "No users found."}
      />
    </div>
  );
};

export default UsersPage;
