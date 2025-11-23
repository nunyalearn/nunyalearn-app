"use client";

import { isAxiosError } from "axios";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const defaultErrorMessage = "Login failed. Please verify your credentials or try again shortly.";

const LoginPage = () => {
  const { login, loading } = useAuth();
  const [email, setEmail] = useState("admin@nunya.com");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resolveErrorMessage = (error: unknown) => {
    if (isAxiosError<{ message?: string }>(error)) {
      return error.response?.data?.message ?? error.message;
    }
    if (typeof error === "string") {
      return error;
    }
    if (error instanceof Error) {
      return error.message;
    }
    if (error && typeof error === "object" && "message" in error) {
      return (error as { message?: string }).message ?? null;
    }
    return null;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    try {
      await login(email, password);
    } catch (error) {
      const message = resolveErrorMessage(error) ?? defaultErrorMessage;
      setErrorMessage(message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-lime-100/60 to-accent/10 px-4 py-10">
      <Card className="w-full max-w-md border-none shadow-2xl">
        <CardHeader className="space-y-3 text-center">
          <CardTitle className="text-2xl font-semibold text-primary">Nunyalearn Admin</CardTitle>
          <CardDescription>Secure access for admin operators</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground" htmlFor="email">
                Email
              </label>
              <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {errorMessage ? (
              <p className="text-sm font-medium text-red-600" role="alert">
                {errorMessage}
              </p>
            ) : null}
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
