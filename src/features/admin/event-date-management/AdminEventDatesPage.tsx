import React, { useEffect, useState } from 'react';
import { CalendarDays, Edit2, Plus, Trash2 } from 'lucide-react';
import { eventDateRepository } from '../../../services/repositories';
import type { EventDate } from '../../../types';
import { AdminShell } from '../../../components/layout/AdminShell';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Modal } from '../../../components/ui/Modal';
import { TextField } from '../../../components/ui/TextField';
import { DatePicker } from '../../../components/ui/date-picker';
import { toast } from '../../../components/feedback/ToastContainer';

const labelsForDate = (value: string) => {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return { name: '', label: '' };
  const name = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(date);
  const label = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(date);
  return {
    name: name.charAt(0).toUpperCase() + name.slice(1),
    label,
  };
};

export const AdminEventDatesPage: React.FC = () => {
  const [dates, setDates] = useState<EventDate[]>([]);
  const [editing, setEditing] = useState<EventDate | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [dateLabel, setDateLabel] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setDates(await eventDateRepository.list());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as datas.');
    }
  };

  useEffect(() => { void load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setEventDate('');
    setDateLabel('');
    setDescription('');
    setActive(true);
    setError('');
    setIsOpen(true);
  };

  const openEdit = (date: EventDate) => {
    setEditing(date);
    setName(date.name);
    setEventDate(date.eventDate);
    setDateLabel(date.dateLabel);
    setDescription(date.description || '');
    setActive(date.active);
    setError('');
    setIsOpen(true);
  };

  const changeDate = (value: string) => {
    setEventDate(value);
    const generated = labelsForDate(value);
    setName(generated.name);
    setDateLabel(generated.label);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name || !eventDate || !dateLabel) return setError('Nome, data e rótulo são obrigatórios.');
    setSaving(true);
    setError('');
    try {
      const payload = {
        name,
        eventDate,
        dateLabel,
        description: description || undefined,
        active,
        sortOrder: editing?.sortOrder ?? dates.length + 1,
      };
      if (editing) await eventDateRepository.update(editing.id, payload);
      else await eventDateRepository.create(payload);
      toast.success(editing ? 'Data atualizada com sucesso!' : 'Data criada com sucesso!');
      setIsOpen(false);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Erro ao salvar a data.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (date: EventDate) => {
    if (!window.confirm(`Excluir a categoria "${date.name} — ${date.dateLabel}"?`)) return;
    try {
      await eventDateRepository.delete(date.id);
      toast.success('Data excluída com sucesso!');
      await load();
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'Não foi possível excluir a data.');
    }
  };

  return (
    <AdminShell
      title="Datas da Programação"
      subtitle="Crie as categorias de data e depois associe as sessões em Gestão de Dias & Sessões"
      actions={<Button variant="action" onClick={openCreate} icon={<Plus className="w-4 h-4" />}>Nova Data</Button>}
    >
      {error && !isOpen && <Alert variant="danger">{error}</Alert>}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {dates.map(date => (
          <article key={date.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <span className="rounded-lg bg-emerald-50 p-2 text-[#028056]"><CalendarDays className="w-5 h-5" /></span>
                <div>
                  <h2 className="font-bold text-slate-900">{date.name}</h2>
                  <p className="text-sm text-slate-600">{date.dateLabel}</p>
                  <p className="mt-1 text-[11px] font-mono text-slate-400">{date.eventDate}</p>
                </div>
              </div>
              <Badge variant={date.active ? 'green' : 'gray'}>{date.active ? 'Ativa' : 'Inativa'}</Badge>
            </div>
            {date.description && <p className="mt-4 text-xs text-slate-500">{date.description}</p>}
            <div className="mt-4 flex justify-end gap-1 border-t border-slate-100 pt-3">
              <Button variant="ghost" size="sm" onClick={() => openEdit(date)} title="Editar data"><Edit2 className="w-4 h-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => void remove(date)} title="Excluir data" className="text-red-600"><Trash2 className="w-4 h-4" /></Button>
            </div>
          </article>
        ))}
        {!dates.length && !error && (
          <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            Nenhuma data cadastrada. Clique em “Nova Data” para criar a primeira categoria.
          </div>
        )}
      </div>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={editing ? 'Editar Data' : 'Criar Data da Programação'} maxWidth="lg">
        <form onSubmit={save} className="space-y-4">
          {error && <Alert variant="danger">{error}</Alert>}
          <DatePicker label="Data" value={eventDate} onChange={changeDate} required />
          <TextField label="Nome da categoria" placeholder="Ex: Segunda-feira" value={name} onChange={event => setName(event.target.value)} required />
          <TextField label="Rótulo exibido" placeholder="Ex: 9 de novembro de 2026" value={dateLabel} onChange={event => setDateLabel(event.target.value)} required />
          <TextField label="Descrição (opcional)" value={description} onChange={event => setDescription(event.target.value)} />
          <Checkbox id="event-date-active" label="Data ativa e visível na programação" checked={active} onChange={event => setActive(event.target.checked)} />
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" variant="action" loading={saving}>Salvar Data</Button>
          </div>
        </form>
      </Modal>
    </AdminShell>
  );
};
