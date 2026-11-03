import { googleEnabled } from "@/lib/auth";
import { SignupForm } from "./signup-form";

// Read per request: whether the Google button shows depends on environment settings,
// which a page rendered once at build time would freeze at whatever they were then.
export const dynamic = "force-dynamic";

export default function SignupPage() {
  return <SignupForm googleEnabled={googleEnabled()} />;
}
