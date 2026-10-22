import { AuthCard, AuthShell } from "@/components/AuthShell";
import { getT } from "@/i18n/server";
import { LoginForm } from "./LoginForm";

// Reads the ?inactive=1 notice and the language cookie, so this page is
// rendered per request.
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ inactive?: string }>;
}) {
  const params = await searchParams;
  const t = await getT();

  return (
    <AuthShell>
      <AuthCard
        title={t("Sign in")}
        subtitle={t(
          "Use your email address or phone number, with the password from your administrator."
        )}
        footer={t("Lost your password? Ask an administrator to reset it.")}
      >
        {params.inactive ? (
          <p className="mb-4 rounded-control border border-warning/25 bg-warning-soft px-3 py-2 text-[12px] text-warning-ink">
            {t("That account has been deactivated. Ask an administrator to reactivate it.")}
          </p>
        ) : null}
        <LoginForm />
      </AuthCard>
    </AuthShell>
  );
}
