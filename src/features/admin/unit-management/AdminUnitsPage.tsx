import React, { useState, useEffect } from 'react';
import { unitRepository, userRepository } from '../../../services/repositories';
import { Unit } from '../../../types';
import { AdminShell } from '../../../components/layout/AdminShell';
import { Button } from '../../../components/ui/Button';
import { TextField } from '../../../components/ui/TextField';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Modal } from '../../../components/ui/Modal';
import { Alert } from '../../../components/ui/Alert';
import { Table } from '../../../components/ui/table';
import { toast } from '../../../components/feedback/ToastContainer';
import { Building2, Plus, Edit2, Trash2, Users } from 'lucide-react';

function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

export const AdminUnitsPage: React.FC = () => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [active, setActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(1);
  const [modalError, setModalError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const allUnits = await unitRepository.list();
      if (allUnits.every(unit => unit.userCount !== undefined)) {
        setUnits(allUnits);
      } else {
        // Fallback de rollout para a API anterior. Após o backend novo entrar,
        // a tela deixa de baixar todos os usuários e usa a agregação do banco.
        const allUsers = await userRepository.list();
        const counts = allUsers.reduce<Record<string, number>>((result, user) => {
          if (user.unitId) result[user.unitId] = (result[user.unitId] || 0) + 1;
          return result;
        }, {});
        setUnits(allUnits.map(unit => ({ ...unit, userCount: counts[unit.id] || 0 })));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingUnit(null);
    setName('');
    setSlug('');
    setActive(true);
    setSortOrder(units.length + 1);
    setModalError('');
    setIsModalOpen(true);
  };

  const openEditModal = (u: Unit) => {
    setEditingUnit(u);
    setName(u.name);
    setSlug(u.slug);
    setActive(u.active);
    setSortOrder(u.sortOrder);
    setModalError('');
    setIsModalOpen(true);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!editingUnit) {
      setSlug(slugify(val));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setModalError('O nome da unidade é obrigatório.');
      return;
    }

    const cleanSlug = slugify(slug || name);
    // Duplicate slug check
    const duplicate = units.find(
      u => u.slug === cleanSlug && (!editingUnit || u.id !== editingUnit.id)
    );
    if (duplicate) {
      setModalError(`O slug "${cleanSlug}" já está em uso pela unidade "${duplicate.name}".`);
      return;
    }

    try {
      if (editingUnit) {
        await unitRepository.update(editingUnit.id, {
          name: name.trim(),
          slug: cleanSlug,
          active,
          sortOrder,
        });
        toast.success('Unidade atualizada com sucesso!');
      } else {
        await unitRepository.create({
          name: name.trim(),
          slug: cleanSlug,
          active,
          sortOrder,
        });
        toast.success('Unidade cadastrada com sucesso!');
      }

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setModalError(err.message || 'Erro ao salvar unidade.');
    }
  };

  const handleDelete = async (u: Unit) => {
    const count = u.userCount || 0;
    if (count > 0) {
      toast.error(`Esta unidade possui ${count} colaboradores vinculados e não pode ser excluída.`);
      return;
    }
    const confirm = window.confirm(`Deseja excluir a unidade "${u.name}"?`);
    if (!confirm) return;
    await unitRepository.delete(u.id);
    toast.info('Unidade excluída.');
    loadData();
  };

  return (
    <AdminShell
      title="Gestão de Unidades Fabris & Concessionárias"
      subtitle="Gerenciamento de localidades oficiais da Honda para segmentação de sorteios e relatórios"
      actions={
        <Button variant="action" size="md" onClick={openCreateModal} icon={<Plus className="w-4 h-4" />}>
          Nova Unidade
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <Table className="min-w-[780px] text-left text-xs text-slate-700">
            <thead className="bg-[#323f3c] text-white uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Ordem</th>
                <th className="py-3 px-4">Nome da Unidade</th>
                <th className="py-3 px-4">Slug Identificador</th>
                <th className="py-3 px-4">Usuários Vinculados</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {units.map(unit => (
                <tr key={unit.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-400">{unit.sortOrder}</td>
                  <td className="py-3 px-4 font-bold text-slate-900">{unit.name}</td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-500">{unit.slug}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span className="tabular-nums">{unit.userCount || 0}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {unit.active ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Ativa
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">
                        Inativa
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditModal(unit)}>
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(unit)}
                      className="text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUnit ? 'Editar Unidade' : 'Cadastrar Nova Unidade'}
        maxWidth="md"
      >
        {modalError && (
          <div className="mb-4">
            <Alert variant="danger">{modalError}</Alert>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <TextField
            label="Nome Oficial da Unidade"
            placeholder="Ex.: PROD-SUM ou SAO-HDA SUMARE ADM"
            required
            value={name}
            onChange={e => handleNameChange(e.target.value)}
          />

          <TextField
            label="Slug Canônico"
            placeholder="Ex.: prod-sum"
            required
            value={slug}
            onChange={e => setSlug(slugify(e.target.value))}
            helperText="Usado em URLs e identificadores de integração"
          />

          <TextField
            type="number"
            label="Ordem de Exibição"
            value={sortOrder}
            onChange={e => setSortOrder(parseInt(e.target.value, 10) || 1)}
          />

          <div className="py-2">
            <Checkbox
              checked={active}
              onChange={e => setActive(e.target.checked)}
              label="Unidade Ativa para Vínculo e Sorteios"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="action" size="md">
              Salvar Unidade
            </Button>
          </div>
        </form>
      </Modal>
    </AdminShell>
  );
};
