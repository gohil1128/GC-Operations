import Link from "next/link";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/brand";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <span className="logo-plate mx-auto mb-8 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt={APP_NAME} className="h-14 w-auto" />
        </span>
        <div className="display-num text-[64px] font-medium leading-none text-brand">404</div>
        <h1 className="mt-4 text-xl font-semibold">This page doesn&apos;t exist</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The link may be out of date, or the record was deleted.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <Button asChild><Link href="/dashboard">Back to dashboard</Link></Button>
          <Button asChild variant="outline"><Link href="/reports">Reports</Link></Button>
        </div>
      </div>
    </div>
  );
}
