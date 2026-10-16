import { LogIn } from "lucide-react";
import { AuthCard, AuthShell } from "@/components/AuthShell";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <AuthShell icon={LogIn}>
      <AuthCard title="Welcome back" subtitle="Log in to your account">
        <LoginForm />
      </AuthCard>
    </AuthShell>
  );
}
