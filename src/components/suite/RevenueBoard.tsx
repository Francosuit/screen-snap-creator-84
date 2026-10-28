import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { dayDate, eur, useSuite } from "@/lib/suite/store";
import { DEMO_DATE } from "@/lib/suite/data";
import { deviation, forecastYear, monthlyAdr, monthlyRevenue, nights, splitBudget, yoy, type Period } from "@/lib/suite/revenue";
import { Card, SectionTitle } from "@/components/suite/ui";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const PERIODS: [Period, string][] = [["mes", "Mes en curso"], ["trimestre", "Trimestre"], ["ytd", "Año hasta hoy"], ["anio", "Año completo"]];
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const ax = { fontSize: 11, fill: "var(--muted-foreground)" };
const tip = { contentStyle: { borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 } };
const pct = (n: number | null) => (n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(1).replace(".", ",")}%`);
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${eur(Math.abs(n))}`;
const Na = () => <span className="text-muted-foreground">No disponible</span>;

function Sel<T extends string | number>({ value, onChange, opts, label }: { value: T; onChange: (v: T) => void; opts: [T, string][]; label: string }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">{label}
      <select aria-label={label} value={String(value)} onChange={(e) => onChange((typeof value === "number" ? Number(e.target.value) : e.target.value) as T)}
        className="rounded-md border bg-background px-2 py-1 text-sm text-foreground">
        {opts.map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}
      </select>
    </label>
  );
}

export function RevenueBoard() {
  const { s, hotel, hotels, actions, cloudHotelId } = useSuite();
  const today = DEMO_DATE;
  const ns = useMemo(() => nights(s.reservations, dayDate), [s.reservations]);
  const years = useMemo(() => [...new Set([today.getFullYear(), ...ns.map((n) => n.date.getFullYear())])].sort(), [ns, today]);
  const [year, setYear] = useState(today.getFullYear());
  const [period, setPeriod] = useState<Period>("ytd");
  const [shown, setShown] = useState<number[]>(years);
  const canEdit = ["owner", "director", "revenue"].includes(String(s.role));

  // Budget: database for cloud hotels; this browser only for demo hotels.
  const lsKey = `suite-budget-${hotel.id}-${year}`;
  const [budget, setBudget] = useState<number[] | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let off = false;
    setBudget(null); setEditing(false);
    if (cloudHotelId) {
      supabase.from("hotel_budgets").select("months").eq("hotel_id", cloudHotelId).eq("year", year).maybeSingle()
        .then(({ data, error }) => { if (off) return; if (error) toast.error("No se pudo leer el presupuesto"); setBudget(data ? data.months.map(Number) : null); });
    } else {
      const raw = localStorage.getItem(lsKey);
      setBudget(raw ? (JSON.parse(raw) as number[]) : null);
    }
    return () => { off = true; };
  }, [cloudHotelId, year, lsKey]);

  const startEdit = () => { setDraft((budget ?? Array(12).fill(0)).map((v) => (v ? String(v) : ""))); setEditing(true); };
  const save = async () => {
    const months = draft.map((v) => Number(v.replace(",", ".")) || 0);
    if (months.some((v) => v < 0)) { toast.error("Los importes no pueden ser negativos"); return; }
    setSaving(true);
    if (cloudHotelId) {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("hotel_budgets").upsert({ hotel_id: cloudHotelId, year, months, updated_by: u.user?.id ?? null, updated_at: new Date().toISOString() });
      setSaving(false);
      if (error) { toast.error("No tienes permiso o no se pudo guardar el presupuesto"); return; }
      toast.success("Presupuesto guardado en la nube");
    } else {
      localStorage.setItem(lsKey, JSON.stringify(months));
      setSaving(false);
      toast.success("Presupuesto guardado solo en este navegador (hotel de demostración)");
    }
    setBudget(months); setEditing(false);
  };

  const rev = monthlyRevenue(ns, year);
  const y = yoy(ns, period, year, today);
  const fc = forecastYear(ns, year, today);
  const budgetTotal = budget?.reduce((a, b) => a + b, 0) ?? 0;
  const ytdMonth = year === today.getFullYear() ? today.getMonth() : 11;
  const budgetYtd = budget?.slice(0, ytdMonth + 1).reduce((a, b) => a + b, 0) ?? 0;
  const realYtd = rev.slice(0, ytdMonth + 1).reduce<number>((a, b) => a + (b ?? 0), 0);
  const dYtd = deviation(budgetYtd, realYtd);
  const dFc = deviation(budgetTotal, fc.total);
  const adrRows = MONTHS.map((m, i) => Object.fromEntries([["m", m], ...years.map((yy) => [String(yy), monthlyAdr(ns, yy)[i]])]));
  const yoyRows = MONTHS.map((m, i) => ({ m, actual: rev[i], previo: monthlyRevenue(ns, year - 1)[i] }));

  return (
    <div className="mt-6 space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">SUIT REVENUE · Dirección</div>
            <div className="text-sm text-muted-foreground">Calculado con las reservas guardadas de {hotel.name}. {cloudHotelId ? "Presupuesto en la nube." : "Hotel de demostración: reservas y presupuesto en este navegador."}</div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Sel label="Hotel" value={hotel.id} onChange={(v) => actions.setHotel(v)} opts={hotels.map((h) => [h.id, h.name])} />
            <Sel label="Año" value={year} onChange={setYear} opts={years.map((v) => [v, String(v)])} />
            <Sel label="Período" value={period} onChange={setPeriod} opts={PERIODS} />
          </div>
        </div>
      </Card>

      <div>
        <SectionTitle>Facturación · {PERIODS.find((p) => p[0] === period)![1]} {year} vs {year - 1}</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card className="p-4"><div className="text-xs text-muted-foreground">{year}</div><div className="tnum text-xl font-semibold">{eur(y.current)}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Mismo período {year - 1}</div><div className="tnum text-xl font-semibold">{y.previous == null ? <Na /> : eur(y.previous)}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Diferencia</div><div className={cn("tnum text-xl font-semibold", y.diff != null && (y.diff >= 0 ? "text-st-ready" : "text-st-maint"))}>{y.diff == null ? <Na /> : signed(y.diff)}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Variación</div><div className={cn("tnum text-xl font-semibold", y.pct != null && (y.pct >= 0 ? "text-st-ready" : "text-st-maint"))}>{y.pct == null ? <Na /> : pct(y.pct)}</div></Card>
        </div>
        <Card className="mt-3">
          <div style={{ height: 220 }}><ResponsiveContainer>
            <BarChart data={yoyRows}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="m" tick={ax} axisLine={false} tickLine={false} /><YAxis tick={ax} axisLine={false} tickLine={false} width={48} /><Tooltip {...tip} formatter={(v) => (v == null ? "No disponible" : eur(Number(v)))} /><Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="previo" name={String(year - 1)} fill="var(--chart-5)" radius={[4, 4, 0, 0]} /><Bar dataKey="actual" name={String(year)} fill="var(--chart-1)" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer></div>
          {y.previous == null && <p className="mt-2 text-xs text-muted-foreground">No hay reservas guardadas de {year - 1}: la comparativa se mostrará cuando existan datos reales de ese año.</p>}
        </Card>
      </div>

      <Card>
        <SectionTitle right={canEdit && !editing ? <Button size="sm" variant="outline" onClick={startEdit}>{budget ? "Editar presupuesto" : "Definir presupuesto"}</Button> : undefined}>Presupuesto comercial {year}</SectionTitle>
        {editing ? (
          <div>
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <label className="text-xs text-muted-foreground">Total anual
                <Input id="budget-total" type="number" min={0} className="mt-1 w-40" placeholder="p. ej. 900000" /></label>
              <Button size="sm" variant="outline" onClick={() => { const t = Number((document.getElementById("budget-total") as HTMLInputElement).value); if (t > 0) setDraft(splitBudget(t).map(String)); }}>Repartir por meses</Button>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {MONTHS.map((m, i) => (
                <label key={m} className="text-xs text-muted-foreground">{m}
                  <Input aria-label={`Presupuesto ${m}`} inputMode="decimal" value={draft[i] ?? ""} onChange={(e) => setDraft((d) => d.map((v, j) => (j === i ? e.target.value : v)))} className="mt-1" /></label>
              ))}
            </div>
            <div className="mt-3 flex gap-2"><Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar presupuesto"}</Button><Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button></div>
          </div>
        ) : !budget ? (
          <p className="text-sm text-muted-foreground">Sin presupuesto definido para {year}.{!canEdit && " Solo propietario, dirección o revenue pueden definirlo."}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl border p-3"><div className="text-xs text-muted-foreground">Presupuesto hasta {MONTHS[ytdMonth]}</div><div className="tnum text-lg font-semibold">{eur(budgetYtd)}</div></div>
              <div className="rounded-xl border p-3"><div className="text-xs text-muted-foreground">Facturación real</div><div className="tnum text-lg font-semibold">{eur(realYtd)}</div></div>
              <div className="rounded-xl border p-3"><div className="text-xs text-muted-foreground">Desviación</div><div className={cn("tnum text-lg font-semibold", dYtd.diff >= 0 ? "text-st-ready" : "text-st-maint")}>{signed(dYtd.diff)} · {pct(dYtd.pct)}</div></div>
              <div className="rounded-xl border p-3"><div className="text-xs text-muted-foreground">Previsión de cierre</div><div className="tnum text-lg font-semibold">{eur(fc.total)}</div><div className={cn("text-xs", dFc.diff >= 0 ? "text-st-ready" : "text-st-maint")}>{pct(dFc.pct)} vs {eur(budgetTotal)}</div></div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-xs text-muted-foreground"><tr>{["Mes", "Presupuesto", "Real", "Desviación €", "Desviación %", ""].map((h) => <th key={h} className="py-1.5 pr-3 font-medium">{h}</th>)}</tr></thead>
                <tbody>{MONTHS.map((m, i) => { const real = rev[i]; const d = real == null ? null : deviation(budget[i] ?? 0, real); return (
                  <tr key={m} className="border-t">
                    <td className="py-1.5 pr-3">{m}</td><td className="tnum pr-3">{eur(budget[i] ?? 0)}</td>
                    <td className="tnum pr-3">{real == null ? <Na /> : eur(real)}</td>
                    <td className={cn("tnum pr-3", d && (d.diff >= 0 ? "text-st-ready" : "text-st-maint"))}>{d ? signed(d.diff) : "—"}</td>
                    <td className="tnum pr-3">{d ? pct(d.pct) : "—"}</td>
                    <td>{d && <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", d.diff >= 0 ? "bg-st-ready/15 text-st-ready" : "bg-st-maint/15 text-st-maint")}>{d.diff >= 0 ? "Cumplido" : "Por debajo"}</span>}</td>
                  </tr>); })}</tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Previsión de cierre = facturación ya devengada hasta hoy ({eur(fc.actual)}) + reservas confirmadas para el resto de {year} ({eur(fc.otb)}). No incluye estimaciones de reservas futuras aún no hechas.</p>
          </>
        )}
      </Card>

      <Card>
        <SectionTitle right={<div className="flex flex-wrap gap-1">{years.map((yy, i) => (
          <button key={yy} onClick={() => setShown((v) => (v.includes(yy) ? v.filter((x) => x !== yy) : [...v, yy]))}
            className={cn("rounded-full border px-2 py-0.5 text-xs", shown.includes(yy) ? "font-semibold" : "opacity-50")} style={{ borderColor: COLORS[i % 5] }}>{yy}</button>))}</div>}>
          Tarifa media (ADR) · enero–diciembre
        </SectionTitle>
        <div style={{ height: 240 }}><ResponsiveContainer>
          <LineChart data={adrRows}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="m" tick={ax} axisLine={false} tickLine={false} /><YAxis tick={ax} axisLine={false} tickLine={false} width={40} /><Tooltip {...tip} formatter={(v) => (v == null ? "No disponible" : eur(Number(v)))} /><Legend wrapperStyle={{ fontSize: 12 }} />
            {years.map((yy, i) => shown.includes(yy) && <Line key={yy} dataKey={String(yy)} name={String(yy)} stroke={COLORS[i % 5]} strokeWidth={2} connectNulls={false} />)}
          </LineChart>
        </ResponsiveContainer></div>
        <p className="mt-2 text-xs text-muted-foreground">ADR = ingresos de habitación ÷ noches vendidas de cada mes. Meses sin noches vendidas aparecen vacíos (no disponible).</p>
      </Card>

      <p className="text-xs text-muted-foreground">Reglas: cuentan solo reservas confirmadas (pendientes, en casa o finalizadas). Cancelaciones y no-shows se excluyen porque no hay cobros ni devoluciones registrados. Cada reserva cuenta una vez con su importe actual (si se modifica, se sustituye). Los ingresos se reparten por noche en su fecha. Importes tal como se guardan, impuestos incluidos.</p>
    </div>
  );
}
