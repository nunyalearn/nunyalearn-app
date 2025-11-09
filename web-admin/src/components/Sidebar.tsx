"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gauge,
  Users,
  BookOpen,
  ListTree,
  ShieldCheck,
  Layers3,
  BarChart3,
  Trophy,
  Bell,
  LifeBuoy,
  CreditCard,
  MonitorCog,
  Cog,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/users", label: "Users", icon: Users },
  { href: "/curriculum", label: "Curriculum", icon: GraduationCap },
  { href: "/flashcards", label: "Flashcards", icon: BookOpen },
  { href: "/quizzes", label: "Quizzes", icon: ListTree },
  { href: "/practice", label: "Practice Tests", icon: ShieldCheck },
  { href: "/questionbank", label: "Question Bank", icon: Layers3 },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/gamification", label: "Gamification", icon: Trophy },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/support", label: "Support", icon: LifeBuoy },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/system", label: "System", icon: MonitorCog },
  { href: "/settings", label: "Settings", icon: Cog },
];

const Sidebar = () => {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/95 p-5 text-sidebar-foreground shadow-lg md:flex">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
          NL
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Admin</p>
          <p className="text-xl font-semibold">Nunyalearn</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 text-sm">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 font-medium transition",
                active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <p className="mt-6 text-xs text-muted-foreground">© {new Date().getFullYear()} Nunyalearn</p>
    </aside>
  );
};

export default Sidebar;
