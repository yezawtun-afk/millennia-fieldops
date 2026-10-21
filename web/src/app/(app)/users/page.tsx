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
  const waiting = users.filter((user) => user.status === "pending").length;

  return (
    <div>
      <PageHeader
        title="Accounts"
        subtitle={
          waiting > 0
            ? `Review ${waiting} account request${waiting === 1 ? "" : "s"}, assign roles, deactivate or delete access.`
            : "Approve requests, assign roles, deactivate or delete access."
        }
      />
      <UsersManager initialUsers={users} currentUserId={profile.id} />
    </div>
  );
}
