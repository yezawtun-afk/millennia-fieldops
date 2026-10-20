import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { getZones } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { ZonesManager } from "@/components/ZonesManager";

export default async function ZonesPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") {
    return (
      <div>
        <PageHeader title="Zones" />
        <p className="text-sm text-muted">Only administrators can manage monitoring zones.</p>
      </div>
    );
  }

  const zones = await getZones();
  return (
    <div>
      <PageHeader
        title="Zones"
        subtitle="Zones are drawn as circles on the site map and group field records."
      />
      <ZonesManager initialZones={zones} />
    </div>
  );
}
