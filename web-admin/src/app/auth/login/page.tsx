"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const LoginPage = () => {
  const { login, loading } = useAuth();
  const [email, setEmail] = useState("admin@nunya.com");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await login(email, password);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-lime-100/60 to-accent/10 px-4 py-10">
      <Card className="w-full max-w-md border-none shadow-2xl">
        <CardHeader className="space-y-3 text-center">
          <CardTitle className="text-2xl font-semibold text-primary">Nunyalearn Admin</CardTitle>
          <CardDescription>Secure access for admin operators</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Password</label>
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
