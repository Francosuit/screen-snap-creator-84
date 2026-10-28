import { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Room, RoomEdit, RoomState } from "@/lib/suite/data";
import { FURNITURE, FURNITURE_KINDS, STEP, moveItem, newItem, roomLayout, rotateItem, type FurnitureItem, type FurnitureKind } from "@/lib/suite/layout";
import { useSuite } from "@/lib/suite/store";
import { RoomInterior } from "./RoomInterior";

/** Current editable configuration of a room, so saving the layout keeps every other field */
export const editOf = (r: Room): RoomEdit => ({ type: r.type, rate: r.rate, capacity: r.capacity, beds: r.beds, bath: r.bath, terrace: r.terrace, view: r.view, sqm: r.sqm, notes: r.notes, extras: r.extras, window: r.window, layout: r.layout });

/** Select a piece of furniture in the drawing, move/rotate/remove it, add new ones, then save to the room */
export function LayoutEditor({ room, state, onDone }: { room: Room; state: RoomState; onDone: () => void }) {
  const { actions } = useSuite();
  const [items, setItems] = useState<FurnitureItem[]>(() => roomLayout(room));
  const [sel, setSel] = useState<string | null>(null);
  const [add, setAdd] = useState<FurnitureKind>("silla");
  const [saving, setSaving] = useState(false);
  const cur = items.find((i) => i.id === sel);
  const upd = (f: (i: FurnitureItem) => FurnitureItem) => setItems((l) => l.map((i) => (i.id === sel ? f(i) : i)));
  return (
    <div className="space-y-2">
      <div className="rounded-xl bg-twin-bg p-2"><RoomInterior room={room} state={state} layout={items} selected={sel} onSelect={setSel} /></div>
      <div className="text-xs text-muted-foreground">{cur ? `Seleccionado: ${FURNITURE[cur.kind].label}` : "Toca un mueble en el dibujo para moverlo o girarlo."}</div>
      {cur && (
        <div className="flex flex-wrap gap-1.5">
          <Button size="icon" variant="outline" aria-label="Mover al fondo" onClick={() => upd((i) => moveItem(i, 0, -STEP))}><ArrowUp className="h-4 w-4" /></Button>
          <Button size="icon" variant="outline" aria-label="Mover al frente" onClick={() => upd((i) => moveItem(i, 0, STEP))}><ArrowDown className="h-4 w-4" /></Button>
          <Button size="icon" variant="outline" aria-label="Mover a la izquierda" onClick={() => upd((i) => moveItem(i, -STEP, 0))}><ArrowLeft className="h-4 w-4" /></Button>
          <Button size="icon" variant="outline" aria-label="Mover a la derecha" onClick={() => upd((i) => moveItem(i, STEP, 0))}><ArrowRight className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => upd(rotateItem)}><RotateCw className="mr-1 h-3.5 w-3.5" />Girar</Button>
          <Button size="sm" variant="outline" onClick={() => { setItems((l) => l.filter((i) => i.id !== sel)); setSel(null); }}><Trash2 className="mr-1 h-3.5 w-3.5" />Quitar</Button>
        </div>
      )}
      <div className="flex gap-2">
        <select aria-label="Mueble a añadir" className="h-9 flex-1 rounded-md border bg-background px-2 text-sm" value={add} onChange={(e) => setAdd(e.target.value as FurnitureKind)}>
          {FURNITURE_KINDS.map((k) => <option key={k} value={k}>{FURNITURE[k].label}</option>)}
        </select>
        <Button size="sm" variant="secondary" onClick={() => { const it = newItem(add, items); setItems((l) => [...l, it]); setSel(it.id); }}>Añadir</Button>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onDone}>Cancelar</Button>
        <Button className="flex-1" disabled={saving} onClick={async () => { setSaving(true); try { if (await actions.updateRoom(room.number, { ...editOf(room), layout: items })) onDone(); } finally { setSaving(false); } }}>{saving ? "Guardando…" : "Guardar distribución"}</Button>
      </div>
    </div>
  );
}
