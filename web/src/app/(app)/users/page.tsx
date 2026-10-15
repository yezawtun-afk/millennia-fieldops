import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { getUsers } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { UsersManager } from "@/components/UsersManager";

export default async function UsersPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") {
    return (
      <div>
        <PageHeader title="Users" />
        <p className="text-sm text-muted">Only administrators can manage user accounts.</p>
      </div>
    );
  }

  const users = await getUsers();
  return (
    <div>
      <PageHeader
        title="User management"
        subtitle="Create accounts, assign roles and deactivate access."
      />
      <UsersManager initialUsers={users} currentUserId={profile.id} />
    </div>
  );
}
