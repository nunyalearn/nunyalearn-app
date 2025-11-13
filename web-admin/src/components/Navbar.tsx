"use client";

import { Menu, Moon, Search, Sun } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";

const getInitialTheme = (): "light" | "dark" => {
  if (typeof document === "undefined") {
    return "light";
  }
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
};

const Navbar = () => {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState<"light" | "dark">(() => getInitialTheme());

  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark");
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b bg-white/80 px-4 py-3 backdrop-blur dark:bg-background md:px-8">
      <div className="flex flex-1 items-center gap-3">
        <Button size="icon" variant="ghost" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="relative hidden flex-1 items-center md:flex">
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
          <Input className="rounded-full pl-10" placeholder="Search modules, learners, analytics..." />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 rounded-full border border-border bg-white px-3 py-1.5 text-left shadow-sm dark:bg-card">
              <span className="hidden text-sm md:block">
                <span className="block font-semibold">{user?.full_name ?? "Admin User"}</span>
                <span className="text-xs text-muted-foreground">{user?.email}</span>
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                {(user?.full_name ?? user?.email ?? "A")[0]?.toUpperCase()}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 rounded-2xl border border-border bg-card">
            <DropdownMenuLabel>Profile</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={logout}>Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Navbar;
