import React, { useState, useEffect } from 'react';
import { auditRepository } from '../../../services/repositories';
import { AuditLog, AccessLog } from '../../../types';
import { AdminShell } from '../../../components/layout/AdminShell';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { Table } from '../../../components/ui/table';
import { formatDateToSaoPaulo } from '../../../utils/formatters';
import { ShieldAlert, KeyRound, Clock, UserCheck, ShieldCheck, RefreshCw } from 'lucide-react';

export const AdminAuditPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'audit' | 'access'>('audit');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [actionFilter, setActionFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const [audit, access] = await Promise.all([
        auditRepository.listAuditLogs(150),
        auditRepository.listAccessLogs(150),
      ]);
      setAuditLogs(audit);
      setAccessLogs(access);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredAudit = auditLogs.filter(log => {
    if (actionFilter !== 'all' && log.action !== actionFilter) return false;
    return true;
  });

  return (
    <AdminShell
      title="Trilha de Auditoria & Segurança"
      subtitle="Registro imutável de autenticações, alterações administrativas, sorteios, importações e tentativas"
      actions={
        <Button variant="outline" size="sm" onClick={loadLogs} icon={<RefreshCw className="w-3.5 h-3.5" />}>
          Atualizar Logs
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Tab switch */}
        <div className="flex max-w-full items-center gap-2 overflow-x-auto border-b border-slate-200 pb-3 custom-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-[#028056] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Ações do Sistema & Gestão ({auditLogs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('access')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'access'
                ? 'bg-[#028056] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Tentativas de Acesso & Login ({accessLogs.length})
          </button>
        </div>

        {activeTab === 'audit' ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="w-full sm:w-64">
                <Select
                  options={[
                    { value: 'all', label: 'Todas as Ações' },
                    { value: 'EXECUTE_DRAW', label: 'Sorteios Executados' },
                    { value: 'VOID_DRAW', label: 'Sorteios Anulados' },
                    { value: 'BATCH_USER_IMPORT', label: 'Importações em Massa' },
                    { value: 'BULK_DEACTIVATE_USERS', label: 'Desativação em Massa' },
                    { value: 'SUBMIT_QUIZ', label: 'Submissões de Questionário' },
                    { value: 'ACCEPT_REGULATION', label: 'Aceites de Regulamento' },
                  ]}
                  value={actionFilter}
                  onChange={e => setActionFilter(e.target.value)}
                />
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {filteredAudit.length} registros auditados
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <Table className="min-w-[900px] text-left text-xs text-slate-700">
                <thead className="bg-[#323f3c] text-white uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Data / Hora (SP)</th>
                    <th className="py-3 px-4">Ator Responsável</th>
                    <th className="py-3 px-4">Ação Realizada</th>
                    <th className="py-3 px-4">Entidade / ID</th>
                    <th className="py-3 px-4">Detalhes Sanitizados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {filteredAudit.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {formatDateToSaoPaulo(log.timestamp, 'full')}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 font-sans">
                        {log.actorName}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-[#015237] font-bold text-[10px] uppercase">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {log.entity} / {log.entityId}
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                        {log.afterData ? JSON.stringify(log.afterData) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <Table className="min-w-[720px] text-left text-xs text-slate-700">
              <thead className="bg-[#323f3c] text-white uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Data / Hora (SP)</th>
                  <th className="py-3 px-4">Matrícula Informada</th>
                  <th className="py-3 px-4">Resultado</th>
                  <th className="py-3 px-4">Motivo / Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {accessLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {formatDateToSaoPaulo(log.timestamp, 'full')}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{log.employeeNumber}</td>
                    <td className="py-3 px-4">
                      {log.result === 'success' ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          SUCESSO
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 font-bold text-[10px]">
                          FALHA
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{log.failureReason || 'Login bem-sucedido'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </div>
    </AdminShell>
  );
};
