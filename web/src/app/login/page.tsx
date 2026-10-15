import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-forest px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold">
            M
          </div>
          <h1 className="text-2xl font-semibold">Millennia FieldOps</h1>
          <p className="mt-1 text-sm text-white/70">Supervisor &amp; administrator dashboard</p>
        </div>
        <LoginForm />
        <p className="mt-4 text-center text-xs text-white/50">
          Field workers use the Millennia FieldOps mobile app to capture records.
        </p>
      </div>
    </main>
  );
}
