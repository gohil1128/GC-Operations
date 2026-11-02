import Link from "next/link";
import { APP_NAME } from "@/lib/brand";
import { BrandLogo } from "@/components/brand-logo";

/*
  The frame every signed-out page shares — change password, reset, forgot.
  The sign-in page keeps its own two-panel brand layout; these are short,
  one-purpose forms and a centred card suits them better than half a screen
  of espresso gradient.
*/
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <Link href="/login" className="mb-6 inline-block">
          <BrandLogo alt={APP_NAME} className="h-14 w-auto" />
        </Link>
        <h1 className="display-num text-[26px] font-medium leading-tight">{title}</h1>
        {description && (
          <div className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{description}</div>
        )}
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-5 text-center text-xs text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}
