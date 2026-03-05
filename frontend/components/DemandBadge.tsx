import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Flame, TrendingUp, Snowflake } from "lucide-react";

export default function DemandBadge({ score }: { score: number }) {
  const level = score > 80 ? "high" : score > 50 ? "medium" : "low";
  const Icon = level === "high" ? Flame : level === "medium" ? TrendingUp : Snowflake;
  return (
    <Badge
      className={cn(
        "text-xs font-semibold gap-1",
        level === "high" && "bg-red-500/15 text-red-500 border-red-300/30",
        level === "medium" && "bg-amber-500/15 text-amber-500 border-amber-300/30",
        level === "low" && "bg-sky-500/15 text-sky-500 border-sky-300/30"
      )}
      variant="outline"
    >
      <Icon className="h-3 w-3" />
      {score}
    </Badge>
  );
}
