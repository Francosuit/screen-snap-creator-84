import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/suite/ui";
import { TeamPanel } from "@/components/suite/TeamPanel";
import { useSuite } from "@/lib/suite/store";

export const Route = createFileRoute("/personal")({
  head: () => ({
    meta: [
      { title: "Equipo y accesos — Suite Hotel OS" },
      { name: "description", content: "Gestiona el equipo del hotel e invita empleados con enlaces seguros." },
      { property: "og:title", content: "Equipo y accesos — Suite Hotel OS" },
      { property: "og:description", content: "Equipo del hotel, invitaciones y permisos por rol." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Personal,
});

function Personal() {
  const { s } = useSuite();
  return (
    <div>
      <PageHeader title="Equipo y accesos" sub="Empleados reales del hotel, invitaciones y permisos por rol" />
      <TeamPanel hotelKey={s.hotel} />
    </div>
  );
}
