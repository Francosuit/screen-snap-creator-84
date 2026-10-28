import { createFileRoute } from "@tanstack/react-router";
import { Phone } from "lucide-react";
import { externals, staff } from "@/lib/suite/data";
import { Card, PageHeader, Pill, SectionTitle } from "@/components/suite/ui";

export const Route = createFileRoute("/personal")({
  head: () => ({
    meta: [
      { title: "Personal — Suite Hotel OS" },
      { name: "description", content: "Equipo del hotel y profesionales externos con disponibilidad." },
      { property: "og:title", content: "Personal — Suite Hotel OS" },
      { property: "og:description", content: "Equipo del hotel y profesionales externos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Personal,
});

function Personal() {
  return (
    <div>
      <PageHeader title="Personal" sub="Equipo interno y red de profesionales externos" />
      <SectionTitle>Equipo</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {staff.map((p) => (
          <Card key={p.name} className="flex items-center gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold ring-1 ring-border">{p.name.split(" ").map((x) => x[0]).join("")}</div>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{p.name}</div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{p.role}</div>
              <div className="mt-1 text-xs text-muted-foreground">{p.dept} · turno {p.shift} · rol Suite: {p.roleKey.toUpperCase()}</div>
            </div>
            <Pill className="border-st-ready/30 bg-st-ready/10 text-st-ready">{p.status}</Pill>
          </Card>
        ))}
      </div>
      <div className="mt-8"><SectionTitle>Profesionales externos</SectionTitle></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {externals.map((e) => (
          <Card key={e.name}>
            <div className="flex items-start justify-between gap-2">
              <div><div className="font-medium">{e.name}</div><div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{e.specialty}</div></div>
              <Pill className={e.availability.startsWith("Disponible") ? "border-st-ready/30 bg-st-ready/10 text-st-ready" : "bg-muted"}>{e.availability}</Pill>
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{e.phone}</div>
            <p className="mt-1 text-sm text-muted-foreground">{e.notes}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
