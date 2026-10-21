import { AuthCard, AuthShell } from "@/components/AuthShell";
import { LoginForm } from "./LoginForm";

// Reads the ?inactive=1 notice, so this page is rendered per request.
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ inactive?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell>
      <AuthCard
        title="Sign in"
        subtitle="Use your email address or phone number, with the password from your administrator."
        footer="Lost your password? Ask an administrator to reset it."
      >
        {params.inactive ? (
          <p className="mb-4 rounded-control border border-warning/25 bg-warning-soft px-3 py-2 text-[12px] text-warning-ink">
            That account has been deactivated. Ask an administrator to reactivate it.
          </p>
        ) : null}
        <LoginForm />
      </AuthCard>
    </AuthShell>
  );
}
