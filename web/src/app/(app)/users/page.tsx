import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { getUsers } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { UsersManager } from "@/components/UsersManager";
import { getT } from "@/i18n/server";

export default async function UsersPage() {
  const t = await getT();
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") {
    return (
      <div>
        <PageHeader title={t("Users")} />
        <p className="text-sm text-muted">{t("Only administrators can manage user accounts.")}</p>
      </div>
    );
  }

  const users = await getUsers();
  const waiting = users.filter((user) => user.status === "pending").length;

  return (
    <div>
      <PageHeader
        title={t("Accounts")}
        subtitle={
          waiting > 0
            ? t("Review {count} account requests, assign roles, deactivate or delete access.", {
                count: waiting,
              })
            : t("Approve requests, assign roles, deactivate or delete access.")
        }
      />
      <UsersManager initialUsers={users} currentUserId={profile.id} />
    </div>
  );
}
