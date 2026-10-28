import { useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, Redo2, RotateCw, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { Room, RoomEdit, RoomState } from "@/lib/suite/data";
import { FURNITURE, FURNITURE_KINDS, STEP, duplicateItem, footprint, moveItem, newItem, placeItem, roomLayout, rotateItem, screenToFloor, type FurnitureItem, type FurnitureKind } from "@/lib/suite/layout";
import { useSuite } from "@/lib/suite/store";
import { RoomInterior } from "./RoomInterior";

/** Current editable configuration of a room, so saving the layout keeps every other field */
export const editOf = (r: Room): RoomEdit => ({ type: r.type, rate: r.rate, capacity: r.capacity, beds: r.beds, bath: r.bath, terrace: r.terrace, view: r.view, sqm: r.sqm, notes: r.notes, extras: r.extras, window: r.window, layout: r.layout });

const U = 26; // must match RoomInterior's drawing scale

/** Select a piece of furniture, drag/rotate/duplicate/remove it with undo/redo, then save to the room */
export function LayoutEditor({ room, state, onDone }: { room: Room; state: RoomState; onDone: () => void }) {
  const { actions } = useSuite();
  const [items, setItemsRaw] = useState<FurnitureItem[]>(() => roomLayout(room));
  const [past, setPast] = useState<FurnitureItem[][]>([]);
  const [future, setFuture] = useState<FurnitureItem[][]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [add, setAdd] = useState<FurnitureKind>("silla");
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const dragStart = useRef<{ snapshot: FurnitureItem[]; item: FurnitureItem } | null>(null);
  const cur = items.find((i) => i.id === sel);

  const commit = (next: FurnitureItem[], before = items) => { setPast((p) => [...p.slice(-49), before]); setFuture([]); setItemsRaw(next); };
  const upd = (f: (i: FurnitureItem) => FurnitureItem) => commit(items.map((i) => (i.id === sel ? f(i) : i)));
  const undo = () => { const prev = past[past.length - 1]; if (!prev) return; setPast((p) => p.slice(0, -1)); setFuture((f) => [items, ...f]); setItemsRaw(prev); };
  const redo = () => { const nxt = future[0]; if (!nxt) return; setFuture((f) => f.slice(1)); setPast((p) => [...p, items]); setItemsRaw(nxt); };

  const onDrag = (id: string, dsx: number, dsy: number, phase: "start" | "move" | "end") => {
    if (phase === "start") { const it = items.find((i) => i.id === id); if (it) dragStart.current = { snapshot: items, item: it }; return; }
    const ds = dragStart.current; if (!ds || ds.item.id !== id) return;
    if (phase === "end") { dragStart.current = null; if (items !== ds.snapshot) { setPast((p) => [...p.slice(-49), ds.snapshot]); setFuture([]); } return; }
    const { dx, dy } = screenToFloor(dsx, dsy, U);
    const moved = placeItem(ds.item, ds.item.x + dx, ds.item.y + dy);
    setItemsRaw((l) => l.map((i) => (i.id === id ? moved : i)));
  };
  const setPos = (axis: "x" | "y", v: number) => { if (!Number.isFinite(v) || !cur) return; upd((i) => placeItem(i, axis === "x" ? v : i.x, axis === "y" ? v : i.y, false)); };
  const fp = cur ? footprint(cur) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-brand">Modo edición</span>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" aria-label="Deshacer" disabled={!past.length} onClick={undo}><Undo2 className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" aria-label="Rehacer" disabled={!future.length} onClick={redo}><Redo2 className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="rounded-xl bg-twin-bg p-2"><RoomInterior room={room} state={state} layout={items} selected={sel} onSelect={setSel} onDrag={onDrag} /></div>
      {!cur && <div className="text-xs text-muted-foreground">Toca un mueble para seleccionarlo y arrástralo para moverlo.</div>}
      {cur && fp && (
        <div className="space-y-2 rounded-lg border p-2">
          <div className="flex items-baseline justify-between text-sm"><span className="font-medium">{FURNITURE[cur.kind].label}</span><span className="text-xs text-muted-foreground">{fp.w.toFixed(2)} × {fp.d.toFixed(2)} m · {cur.rot}°</span></div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="flex items-center gap-1">X (m)<input aria-label="Posición X" type="number" step={STEP} className="h-8 w-full rounded-md border bg-background px-2" value={cur.x} onChange={(e) => setPos("x", parseFloat(e.target.value))} /></label>
            <label className="flex items-center gap-1">Y (m)<input aria-label="Posición Y" type="number" step={STEP} className="h-8 w-full rounded-md border bg-background px-2" value={cur.y} onChange={(e) => setPos("y", parseFloat(e.target.value))} /></label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button size="icon" variant="outline" aria-label="Mover al fondo" onClick={() => upd((i) => moveItem(i, 0, -STEP))}><ArrowUp className="h-4 w-4" /></Button>
            <Button size="icon" variant="outline" aria-label="Mover al frente" onClick={() => upd((i) => moveItem(i, 0, STEP))}><ArrowDown className="h-4 w-4" /></Button>
            <Button size="icon" variant="outline" aria-label="Mover a la izquierda" onClick={() => upd((i) => moveItem(i, -STEP, 0))}><ArrowLeft className="h-4 w-4" /></Button>
            <Button size="icon" variant="outline" aria-label="Mover a la derecha" onClick={() => upd((i) => moveItem(i, STEP, 0))}><ArrowRight className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => upd(rotateItem)}><RotateCw className="mr-1 h-3.5 w-3.5" />Girar 90°</Button>
            <Button size="sm" variant="outline" onClick={() => { const c = duplicateItem(cur, items); commit([...items, c]); setSel(c.id); }}><Copy className="mr-1 h-3.5 w-3.5" />Duplicar</Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmDel(true)}><Trash2 className="mr-1 h-3.5 w-3.5" />Eliminar</Button>
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <select aria-label="Mueble a añadir" className="h-9 flex-1 rounded-md border bg-background px-2 text-sm" value={add} onChange={(e) => setAdd(e.target.value as FurnitureKind)}>
          {FURNITURE_KINDS.map((k) => <option key={k} value={k}>{FURNITURE[k].label}</option>)}
        </select>
        <Button size="sm" variant="secondary" onClick={() => { const it = newItem(add, items); commit([...items, it]); setSel(it.id); }}>Añadir</Button>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onDone}>Salir sin guardar</Button>
        <Button className="flex-1" disabled={saving} onClick={async () => { setSaving(true); try { if (await actions.updateRoom(room.number, { ...editOf(room), layout: items })) onDone(); } finally { setSaving(false); } }}>{saving ? "Guardando…" : "Guardar distribución"}</Button>
      </div>
      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar {cur ? FURNITURE[cur.kind].label.toLowerCase() : "mueble"}?</AlertDialogTitle><AlertDialogDescription>Puedes recuperarlo con «Deshacer» mientras no salgas del editor.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { commit(items.filter((i) => i.id !== sel)); setSel(null); }}>Eliminar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
