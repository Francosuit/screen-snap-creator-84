import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell, BedDouble, CalendarRange, ChevronDown, ClipboardList, Home, LineChart, Menu, MessageSquare, Plug, Settings, Users, UserRound, Building2, Check, Globe2,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ROLES, type RoleKey } from "@/lib/suite/data";
import { NAV_ACCESS, fmtClock, useSuite } from "@/lib/suite/store";
import { NoAccess } from "./ui";

const NAV = [
  { to: "/mundo", label: "Mi mundo", icon: Globe2 },
  { to: "/hotel", label: "Hotel en vivo", icon: Building2 },
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/reservas", label: "Reservas", icon: CalendarRange },
  { to: "/habitaciones", label: "Habitaciones", icon: BedDouble },
  { to: "/control", label: "Control", icon: LineChart },
  { to: "/personal", label: "Personal", icon: Users },
  { to: "/tareas", label: "Tareas", icon: ClipboardList },
  { to: "/huespedes", label: "Huéspedes", icon: UserRound },
  { to: "/mensajes", label: "Mensajes", icon: MessageSquare },
  { to: "/integraciones", label: "Integraciones", icon: Plug },
  { to: "/configuracion", label: "Configuración", icon: Settings },
] as const;

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">S</div>
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-tight">Suite</div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Hotel OS</div>
      </div>
    </div>
  );
}

function NavList({ onNav }: { onNav?: () => void }) {
  const { s, alerts } = useSuite();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const allowed = NAV_ACCESS[s.role];
  const label = (to: string, l: string) =>
    to === "/" && s.role === "housekeeping" ? "Mis habitaciones" : to === "/" && s.role === "maintenance" ? "Mis incidencias" : l;
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.filter((n) => allowed.includes(n.to)).map((n) => {
        const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
        const Icon = n.icon;
        return (
          <Link key={n.to} to={n.to} onClick={onNav}
            className={cn("group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              active ? "bg-card font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-border" : "text-sidebar-foreground hover:bg-sidebar-accent")}>
            <Icon className={cn("h-4 w-4", active ? "text-brand" : "text-muted-foreground group-hover:text-foreground")} />
            <span className="flex-1">{label(n.to, n.label)}</span>
            {n.to === "/" && alerts.filter((a) => a.level === "URGENTE").length > 0 && s.role !== "housekeeping" && s.role !== "maintenance" && (
              <span className="tnum rounded-full bg-st-maint px-1.5 text-[10px] font-semibold text-primary-foreground">{alerts.filter((a) => a.level === "URGENTE").length}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function Sidebar() {
  const { hotel } = useSuite();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 border-r bg-sidebar px-3 py-5 lg:flex">
      <Logo />
      <NavList />
      <div className="mt-auto rounded-xl border bg-card p-3 text-xs">
        <div className="text-muted-foreground">Grupo Suite</div>
        <div className="mt-0.5 font-medium">{hotel.name}</div>
        <div className="mt-2 flex items-center gap-1.5 text-muted-foreground"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-st-ready" /> Modo demo · datos ficticios</div>
      </div>
    </aside>
  );
}

function Topbar() {
  const { s, actions, hotel, hotels } = useSuite();
  const [open, setOpen] = useState(false);
  const notifs = s.notifications.filter((n) => n.roles.includes(s.role));
  const unread = notifs.filter((n) => !n.read).length;
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="flex h-14 items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <button className="rounded-lg p-2 hover:bg-accent lg:hidden" onClick={() => setOpen(true)} aria-label="Menú"><Menu className="h-5 w-5" /></button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-64 bg-sidebar p-4">
            <SheetTitle className="sr-only">Navegación</SheetTitle>
            <div className="mb-6"><Logo /></div>
            <NavList onNav={() => setOpen(false)} />
          </SheetContent>
        </Sheet>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-accent">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{hotel.name}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Grupo Suite</DropdownMenuLabel>
            {hotels.map((h) => (
              <DropdownMenuItem key={h.id} onClick={() => actions.setHotel(h.id)} className="flex items-center justify-between">
                <div><div className="font-medium">{h.name}</div><div className="text-xs text-muted-foreground">{h.city} · {h.rooms} hab. · {h.category}</div></div>
                {s.hotel === h.id && <Check className="h-4 w-4 text-brand" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto hidden text-sm text-muted-foreground md:block">
          <span className="mr-3 text-xs">{{ local: "Guardado solo en este navegador", loading: "Cargando…", saved: "Guardado en la nube", pending: "Guardando…", error: "Error al guardar" }[cloud]}</span>
          Martes, 10 nov 2026 · <span className="tnum font-medium text-foreground">{fmtClock(s.clock)}</span>
        </div>

        <Popover onOpenChange={(o) => !o && actions.readAll()}>
          <PopoverTrigger className="relative ml-auto rounded-lg p-2 hover:bg-accent md:ml-0" aria-label="Notificaciones">
            <Bell className="h-[18px] w-[18px]" />
            {unread > 0 && <span className="tnum absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-st-maint px-1 text-[10px] font-semibold text-primary-foreground">{unread}</span>}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="border-b px-4 py-3 text-sm font-semibold">Notificaciones · {ROLES[s.role].label}</div>
            <div className="max-h-80 overflow-y-auto">
              {notifs.length === 0 && <div className="p-4 text-sm text-muted-foreground">Sin notificaciones.</div>}
              {notifs.map((n) => (
                <div key={n.id} className={cn("flex gap-3 border-b px-4 py-3 text-sm last:border-0", !n.read && "bg-accent/60")}>
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.tone === "urgent" ? "bg-st-maint" : n.tone === "ok" ? "bg-st-ready" : "bg-st-occupied")} />
                  <div className="min-w-0 flex-1">{n.text}<div className="tnum mt-0.5 text-xs text-muted-foreground">{n.time}</div></div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-accent">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-xs font-semibold ring-1 ring-border">
              {ROLES[s.role].person.split(" ").map((x) => x[0]).join("")}
            </div>
            <div className="hidden text-left leading-tight sm:block">
              <div className="text-sm font-medium">{ROLES[s.role].person}</div>
              <div className="text-[11px] text-muted-foreground">{ROLES[s.role].title}</div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Cambiar usuario (demo)</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(ROLES) as RoleKey[]).map((k) => (
              <DropdownMenuItem key={k} onClick={() => actions.setRole(k)} className="flex items-center justify-between">
                <div><div className="font-medium">{ROLES[k].person}</div><div className="text-xs text-muted-foreground">{ROLES[k].label.toUpperCase()}</div></div>
                {s.role === k && <Check className="h-4 w-4 text-brand" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => actions.resetDemo()} className="text-muted-foreground">Reiniciar demo</DropdownMenuItem>
            <DropdownMenuItem onClick={() => actions.signOut()}>Cerrar sesión</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { s } = useSuite();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const base = "/" + (path.split("/")[1] ?? "");
  const known = NAV.some((n) => n.to === base);
  const allowed = !known || NAV_ACCESS[s.role].includes(base);
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {allowed ? children : <NoAccess />}
        </main>
      </div>
    </div>
  );
}
