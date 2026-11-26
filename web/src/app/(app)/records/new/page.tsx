import { getZones } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { NewRecordForm } from "@/components/NewRecordForm";
import { getT } from "@/i18n/server";

export default async function NewRecordPage() {
  const [t, zones] = await Promise.all([getT(), getZones()]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t("Add record")}
        subtitle={t("New records wait for a supervisor to review them.")}
      />
      <NewRecordForm zones={zones.map((zone) => ({ id: zone.id, name: zone.name }))} />
    </div>
  );
}
