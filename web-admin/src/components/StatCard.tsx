type StatCardProps = {
  title: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "flat";
};

const trendColors: Record<NonNullable<StatCardProps["trend"]>, string> = {
  up: "text-emerald-600",
  down: "text-red-500",
  flat: "text-muted-foreground",
};

const StatCard = ({ title, value, change, trend = "flat" }: StatCardProps) => {
  return (
    <div className="rounded-3xl border border-border bg-white/90 p-4 shadow-sm dark:bg-card">
      <p className="text-sm font-semibold text-muted-foreground">{title}</p>
      <p className="mt-3 text-3xl font-semibold text-primary">{value}</p>
      {change ? <p className={`mt-1 text-xs font-medium ${trendColors[trend]}`}>{change}</p> : null}
    </div>
  );
};

export default StatCard;
