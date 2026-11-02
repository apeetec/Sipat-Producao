import React, { useState, useEffect } from 'react';
import { userRepository, unitRepository } from '../../../services/repositories';
import { isNodeBackendEnabled } from '../../../services/api/node-backend-client';
import { AppUser, Unit } from '../../../types';
import { useAuth } from '../../auth/AuthContext';
import { AdminShell } from '../../../components/layout/AdminShell';
import { Button } from '../../../components/ui/Button';
import { TextField } from '../../../components/ui/TextField';
import { Select } from '../../../components/ui/Select';
import { Modal } from '../../../components/ui/Modal';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Alert } from '../../../components/ui/Alert';
import { Pagination } from '../../../components/ui/Pagination';
import { Table } from '../../../components/ui/table';
import { toast } from '../../../components/feedback/ToastContainer';
import {
  Users,
  Plus,
  Search,
  Edit2,
  KeyRound,
  ShieldCheck,
  UserCheck,
  UserX,
  FileCheck,
  RotateCcw,
  Trash2,
} from 'lucide-react';

export const AdminUsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [batchAction, setBatchAction] = useState<'reset' | 'delete' | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  // Form Fields
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [unitId, setUnitId] = useState('');
  const [company, setCompany] = useState('Honda Automóveis do Brasil');
  const [role, setRole] = useState<'admin' | 'collaborator'>('collaborator');
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [active, setActive] = useState(true);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [modalError, setModalError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [allUsers, allUnits] = await Promise.all([
        userRepository.list(),
        unitRepository.list(),
      ]);
      setUsers(allUsers);
      setUnits(allUnits);
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
    setEditingUser(null);
    setEmployeeNumber('');
    setEmail('');
    setFirstName('');
    setLastName('');
    setDisplayName('');
    setUnitId(units[0]?.id || '');
    setCompany('Honda Automóveis do Brasil');
    setRole('collaborator');
    setMustChangePassword(true);
    setActive(true);
    setTemporaryPassword('');
    setModalError('');
    setIsModalOpen(true);
  };

  const openEditModal = (u: AppUser) => {
    setEditingUser(u);
    setEmployeeNumber(u.employeeNumber);
    setEmail(u.email);
    setFirstName(u.firstName);
    setLastName(u.lastName);
    setDisplayName(u.displayName);
    setUnitId(u.unitId || '');
    setCompany(u.company || 'Honda Automóveis do Brasil');
    setRole(u.role);
    setMustChangePassword(u.mustChangePassword);
    setActive(u.active);
    setTemporaryPassword('');
    setModalError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeNumber.trim() || !email.trim()) {
      setModalError('Matrícula e e-mail são obrigatórios.');
      return;
    }

    const selectedUnit = units.find(u => u.id === unitId);

    try {
      if (editingUser) {
        await userRepository.update(editingUser.id, {
          employeeNumber: employeeNumber.trim().toLowerCase(),
          email: email.trim().toLowerCase(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          displayName: displayName.trim() || `${firstName} ${lastName}`.trim(),
          unitId: selectedUnit?.id,
          unitSlug: selectedUnit?.slug,
          unitNameBackup: selectedUnit?.name,
          company,
          role,
          mustChangePassword,
          active,
          ...(isNodeBackendEnabled && temporaryPassword.trim() ? { temporaryPassword: temporaryPassword.trim() } : {}),
        });

        if (!isNodeBackendEnabled && temporaryPassword.trim()) {
          localStorage.setItem(`pass_${editingUser.id}`, temporaryPassword.trim());
        }

        toast.success('Colaborador atualizado com sucesso!');
      } else {
        const newUser = await userRepository.create({
          employeeNumber: employeeNumber.trim().toLowerCase(),
          email: email.trim().toLowerCase(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          displayName: displayName.trim() || `${firstName} ${lastName}`.trim() || employeeNumber,
          unitId: selectedUnit?.id,
          unitSlug: selectedUnit?.slug,
          unitNameBackup: selectedUnit?.name,
          company,
          role,
          mustChangePassword,
          active,
          ...(isNodeBackendEnabled ? { temporaryPassword: temporaryPassword.trim() } : {}),
        });

        if (!isNodeBackendEnabled && temporaryPassword.trim()) {
          localStorage.setItem(`pass_${newUser.id}`, temporaryPassword.trim());
        }

        toast.success('Novo colaborador cadastrado!');
      }

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setModalError(err.message || 'Erro ao salvar colaborador.');
    }
  };

  const handleToggleActive = async (u: AppUser) => {
    if (u.id === currentUser?.id) {
      toast.error('Você não pode desativar seu próprio usuário em sessão.');
      return;
    }

    const admins = users.filter(usr => usr.role === 'admin' && usr.active);
    if (u.role === 'admin' && u.active && admins.length <= 1) {
      toast.error('Não é permitido desativar o último administrador do sistema.');
      return;
    }

    await userRepository.update(u.id, { active: !u.active });
    toast.info(`Usuário ${u.active ? 'desativado' : 'reativado'} com sucesso.`);
    loadData();
  };

  const handleForcePasswordReset = async (u: AppUser) => {
    await userRepository.update(u.id, { mustChangePassword: true });
    toast.success(`Senha de ${u.displayName} marcada para troca obrigatória no próximo acesso.`);
    loadData();
  };

  const toggleSelectedUser = (userId: string) => {
    setSelectedUserIds(current =>
      current.includes(userId)
        ? current.filter(id => id !== userId)
        : [...current, userId],
    );
  };

  const handleResetParticipations = async () => {
    if (!selectedUserIds.length) return;
    if (!window.confirm(`Resetar as respostas de ${selectedUserIds.length} usuário(s)? Eles poderão responder novamente sem perder a presença ou o progresso do vídeo.`)) return;
    try {
      setBatchAction('reset');
      const result = await userRepository.resetParticipations(selectedUserIds);
      toast.success(`${result.resetParticipations} participação(ões) resetada(s) com sucesso.`);
      setSelectedUserIds([]);
    } catch (error: any) {
      toast.error(error.message || 'Não foi possível resetar as respostas.');
    } finally {
      setBatchAction(null);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedUserIds.length) return;
    if (!window.confirm(`Excluir ${selectedUserIds.length} usuário(s)? O histórico será preservado para auditoria, mas eles perderão o acesso ao sistema.`)) return;
    try {
      setBatchAction('delete');
      const result = await userRepository.deleteMany(selectedUserIds);
      toast.success(`${result.affectedUsers} usuário(s) excluído(s) com sucesso.`);
      setSelectedUserIds([]);
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Não foi possível excluir os usuários.');
    } finally {
      setBatchAction(null);
    }
  };

  // Filter users
  const filteredUsers = users.filter(u => {
    if (unitFilter !== 'all' && u.unitId !== unitFilter) return false;
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.employeeNumber.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.unitNameBackup && u.unitNameBackup.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1;
  const paginatedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);
  const selectablePageIds = paginatedUsers.filter(user => user.id !== currentUser?.id).map(user => user.id);
  const allPageUsersSelected = selectablePageIds.length > 0 && selectablePageIds.every(id => selectedUserIds.includes(id));

  const toggleCurrentPage = () => {
    setSelectedUserIds(current => {
      if (allPageUsersSelected) return current.filter(id => !selectablePageIds.includes(id));
      return [...new Set([...current, ...selectablePageIds])];
    });
  };

  return (
    <AdminShell
      title="Gestão de Colaboradores & Acessos"
      subtitle="Cadastro individual, redefinição de senhas, controle de primeiro acesso e aceite do regulamento"
      actions={
        <Button variant="action" size="md" onClick={openCreateModal} icon={<Plus className="w-4 h-4" />}>
          Novo Colaborador
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Search & Filters */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-3">
          <div className="w-full min-w-0 sm:flex-1">
            <TextField
              placeholder="Buscar por matrícula, nome ou e-mail..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              icon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="w-full sm:w-48">
            <Select
              options={[
                { value: 'all', label: 'Todas as Unidades' },
                ...units.map(u => ({ value: u.id, label: u.name })),
              ]}
              value={unitFilter}
              onChange={e => {
                setUnitFilter(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="w-full sm:w-40">
            <Select
              options={[
                { value: 'all', label: 'Todos os Perfis' },
                { value: 'collaborator', label: 'Colaborador' },
                { value: 'admin', label: 'Administrador' },
              ]}
              value={roleFilter}
              onChange={e => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {selectedUserIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <span className="text-xs font-semibold text-emerald-900">
              {selectedUserIds.length} usuário(s) selecionado(s)
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                loading={batchAction === 'reset'}
                disabled={batchAction !== null}
                onClick={handleResetParticipations}
                icon={<RotateCcw className="h-3.5 w-3.5" />}
              >
                Resetar respostas
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={batchAction === 'delete'}
                disabled={batchAction !== null}
                onClick={handleDeleteSelected}
                icon={<Trash2 className="h-3.5 w-3.5" />}
              >
                Excluir selecionados
              </Button>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <Table className="min-w-[1100px] text-left text-xs text-slate-700">
            <thead className="bg-[#323f3c] text-white uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    aria-label="Selecionar usuários desta página"
                    checked={allPageUsersSelected}
                    onChange={toggleCurrentPage}
                    className="h-4 w-4 rounded border-slate-300 text-[#028056] focus:ring-[#028056]"
                  />
                </th>
                <th className="py-3 px-4">Matrícula</th>
                <th className="py-3 px-4">Nome Completo & E-mail</th>
                <th className="py-3 px-4">Unidade / Empresa</th>
                <th className="py-3 px-4">Perfil</th>
                <th className="py-3 px-4">1º Acesso</th>
                <th className="py-3 px-4">Regulamento</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedUsers.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${u.displayName}`}
                      checked={selectedUserIds.includes(u.id)}
                      disabled={u.id === currentUser?.id || batchAction !== null}
                      onChange={() => toggleSelectedUser(u.id)}
                      className="h-4 w-4 rounded border-slate-300 text-[#028056] focus:ring-[#028056] disabled:opacity-40"
                    />
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{u.employeeNumber}</td>
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-800 block">{u.displayName}</span>
                    <span className="text-[11px] text-slate-400 block font-mono">{u.email}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-700 block">
                      {u.unitNameBackup || u.unitSlug?.toUpperCase() || '-'}
                    </span>
                    <span className="text-[10px] text-slate-400 block">{u.company || 'Honda'}</span>
                  </td>
                  <td className="py-3 px-4">
                    {u.role === 'admin' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#028056]/15 text-[#014730]">
                        ADMIN
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                        Colaborador
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {u.mustChangePassword ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                        <KeyRound className="w-3 h-3" />
                        <span>Pendente</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-medium">
                        <UserCheck className="w-3.5 h-3.5 text-[#28a745]" />
                        <span>Criada</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {u.regulationAcceptedVersion ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
                        <FileCheck className="w-3.5 h-3.5 text-[#28a745]" />
                        <span>Aceito (v{u.regulationAcceptedVersion})</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">Pendente</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {u.active ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Ativo
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                        Inativo
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => openEditModal(u)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleForcePasswordReset(u)}
                      title="Exigir troca de senha no próximo login"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(u)}
                      title={u.active ? 'Desativar usuário' : 'Reativar usuário'}
                      className={u.active ? 'text-red-600' : 'text-emerald-600'}
                    >
                      {u.active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          <div className="p-4 border-t border-slate-100">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={filteredUsers.length}
              pageSize={pageSize}
            />
          </div>
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? `Editar Colaborador: ${editingUser.displayName}` : 'Cadastrar Novo Colaborador'}
        maxWidth="lg"
      >
        {modalError && (
          <div className="mb-4">
            <Alert variant="danger">{modalError}</Alert>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextField
              label="Matrícula Funcional (Login Único)"
              placeholder="Ex.: 101010"
              required
              value={employeeNumber}
              onChange={e => setEmployeeNumber(e.target.value)}
            />
            <TextField
              type="email"
              label="E-mail Corporativo"
              placeholder="nome@honda.com.br"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextField
              label="Primeiro Nome"
              placeholder="Ex.: Carlos"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
            />
            <TextField
              label="Sobrenome"
              placeholder="Ex.: Eduardo Silva"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Unidade Fabril / Concessionária"
              options={units.map(u => ({ value: u.id, label: u.name }))}
              value={unitId}
              onChange={e => setUnitId(e.target.value)}
            />
            <TextField
              label="Empresa"
              placeholder="Ex.: Honda Automóveis do Brasil"
              value={company}
              onChange={e => setCompany(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Perfil de Acesso"
              options={[
                { value: 'collaborator', label: 'Colaborador Comum' },
                { value: 'admin', label: 'Administrador do Sistema' },
              ]}
              value={role}
              onChange={e => setRole(e.target.value as any)}
            />

            <TextField
              label={editingUser ? 'Redefinir Senha Temporária (opcional)' : 'Senha Temporária de Acesso'}
              placeholder="Mínimo 8 caracteres, com letra e número"
              value={temporaryPassword}
              onChange={e => setTemporaryPassword(e.target.value)}
              helperText="Caso informada, substitui a senha atual"
            />
          </div>

          <div className="flex items-center gap-6 py-2">
            <Checkbox
              checked={mustChangePassword}
              onChange={e => setMustChangePassword(e.target.checked)}
              label="Exigir troca de senha no próximo acesso"
            />
            <Checkbox
              checked={active}
              onChange={e => setActive(e.target.checked)}
              label="Conta Ativa"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="action" size="md">
              Salvar Colaborador
            </Button>
          </div>
        </form>
      </Modal>
    </AdminShell>
  );
};
