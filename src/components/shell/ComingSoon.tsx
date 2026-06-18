import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export function ComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      </header>
      <Card className="flex flex-col items-center gap-4 p-10 text-center shadow-card">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <Icon className="h-6 w-6" />
        </span>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          Em breve
        </span>
      </Card>
    </div>
  );
}
