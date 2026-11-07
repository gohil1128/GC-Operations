import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/** The top of a single-setting page: a way back to the Settings list, and the setting's name. */
export function SettingsBack({ title, hint }: { title?: string; hint?: string }) {
  return (
    <header className="px-0">
      <Link
        href="/settings"
        className="lg-press -ml-2 inline-flex h-10 items-center gap-1 rounded-full pl-1 pr-3 text-sm font-medium text-brand-ink hover:bg-muted"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden /> Settings
      </Link>
      {title && <h1 className="display-num mt-1 text-[28px] font-medium leading-tight tracking-[-0.02em]">{title}</h1>}
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </header>
  );
}
