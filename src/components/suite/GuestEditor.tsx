import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSuite } from '@/lib/suite/store';
import type { Guest } from '@/lib/suite/data';

export function GuestEditor({ guest, onClose }: { guest: Guest; onClose: () => void }) {
  const { actions, cloud } = useSuite();
  const editable = (value: string) => value === '—' ? '' : value;
  const [draft, setDraft] = useState({ name: guest.name, doc: editable(guest.doc), phone: editable(guest.phone), email: editable(guest.email), lang: editable(guest.lang), notes: guest.notes });
  const fields = [['name', 'Nombre'], ['doc', 'Documento'], ['phone', 'Teléfono'], ['email', 'Correo'], ['lang', 'Idioma']] as const;
  return <form className="mt-4 grid gap-3" onSubmit={e => { e.preventDefault(); if (actions.updateGuest(guest.id, draft)) onClose(); }}>
    {fields.map(([key, label]) => <div key={key} className="grid gap-1.5"><Label htmlFor={`guest-${key}`}>{label}</Label><Input id={`guest-${key}`} value={draft[key]} required={key === 'name'} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} onChange={e => setDraft(p => ({ ...p, [key]: e.target.value }))} /></div>)}
    <div className="grid gap-1.5"><Label htmlFor="guest-notes">Notas</Label><Textarea id="guest-notes" value={draft.notes} onChange={e => setDraft(p => ({ ...p, notes: e.target.value }))} /></div>
    <div className="flex gap-2"><Button type="submit" disabled={!draft.name.trim() || cloud === 'pending'}>Guardar</Button><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button></div>
  </form>;
}