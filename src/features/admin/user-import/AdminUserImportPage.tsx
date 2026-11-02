import React, { useState, useRef } from 'react';
import { AdminShell } from '../../../components/layout/AdminShell';
import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Alert } from '../../../components/ui/Alert';
import { Table } from '../../../components/ui/table';
import { toast } from '../../../components/feedback/ToastContainer';
import { parseUserImportCsv, UserImportRow, EXPECTED_IMPORT_COLUMNS, COLUMN_LABELS_PT } from '../../../utils/csv-parser';
import { exportToCsv } from '../../../services/exports/csv-exporter';
import { userRepository, unitRepository, auditRepository } from '../../../services/repositories';
import { isNodeBackendEnabled } from '../../../services/api/node-backend-client';
import { useAuth } from '../../auth/AuthContext';
import {
  Upload,
  Download,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Check,
  X,
  Play,
  RotateCcw,
} from 'lucide-react';

const EMPTY_ROW_COUNT = 8;

function createEmptyRow(index: number): UserImportRow {
  return {
    index,
    employeeNumber: '',
    email: '',
    temporaryPassword: '',
    firstName: '',
    lastName: '',
    displayName: '',
    unit: '',
    unitNameBackup: '',
    company: 'Honda Automóveis do Brasil',
    adminComment: '',
    mustChangePassword: true,
    description: '',
    isValid: false,
    errors: {},
    warnings: [],
  };
}

export const AdminUserImportPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<UserImportRow[]>(() =>
    Array.from({ length: EMPTY_ROW_COUNT }, (_, idx) => createEmptyRow(idx + 1))
  );

  const [showPasswords, setShowPasswords] = useState(false);
  const [createMissingUnits, setCreateMissingUnits] = useState(true);
  const [confirmUpdates, setConfirmUpdates] = useState(true);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [importSummary, setImportSummary] = useState<{
    totalProcessed: number;
    createdCount: number;
    updatedCount: number;
    errorCount: number;
    results: Array<{ row: number; employee: string; status: 'created' | 'updated' | 'error'; message: string }>;
  } | null>(null);

  // Download Sample CSV template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        employeeNumber: '109001',
        email: 'joao.silva@honda.com.br',
        temporaryPassword: 'SenhaProvisoria1',
        firstName: 'João',
        lastName: 'Silva',
        displayName: 'João Silva',
        unit: 'PROD-SUM',
        unitNameBackup: 'PROD-SUM',
        company: 'Honda Automóveis do Brasil',
        adminComment: 'Operador Linha 1',
        mustChangePassword: 'true',
        description: 'Técnico de Produção',
      },
      {
        employeeNumber: '109002',
        email: 'ana.pereira@honda.com.br',
        temporaryPassword: 'SenhaProvisoria2',
        firstName: 'Ana',
        lastName: 'Pereira',
        displayName: 'Ana Pereira',
        unit: 'SAO-HDA SUMARE ADM',
        unitNameBackup: 'SAO-HDA SUMARE ADM',
        company: 'Honda Automóveis do Brasil',
        adminComment: 'Analista CIPA',
        mustChangePassword: 'true',
        description: 'Analista de Segurança',
      },
    ];
    exportToCsv(templateData, 'template_importacao_sipat_honda.csv', ';');
  };

  // Upload and parse CSV
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('O arquivo selecionado excede o limite máximo de 10 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      if (!content) return;

      const parsed = parseUserImportCsv(content);
      if (parsed.missingHeaders.length > 0) {
        toast.error(`Cabeçalhos obrigatórios ausentes no arquivo: ${parsed.missingHeaders.join(', ')}`);
      }

      setRows(parsed.rows.length > 0 ? parsed.rows : [createEmptyRow(1)]);
      toast.success(`${parsed.rows.length} linha(s) importada(s) do CSV.`);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  // Add line to grid
  const handleAddRow = () => {
    setRows(prev => [...prev, createEmptyRow(prev.length + 1)]);
  };

  // Clear grid
  const handleClearGrid = () => {
    if (window.confirm('Deseja limpar todos os dados da grade?')) {
      setRows(Array.from({ length: EMPTY_ROW_COUNT }, (_, idx) => createEmptyRow(idx + 1)));
      setImportSummary(null);
    }
  };

  // Cell edit
  const handleCellChange = (rowIndex: number, field: keyof UserImportRow, value: any) => {
    setRows(prev => {
      const next = [...prev];
      const target = { ...next[rowIndex], [field]: value };

      // Re-validate row
      const errors: Record<string, string> = {};
      if (!target.employeeNumber.trim()) errors.employeeNumber = 'Obrigatório';
      if (!target.email.trim()) errors.email = 'Obrigatório';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target.email)) errors.email = 'E-mail inválido';
      if (!target.temporaryPassword?.trim()) errors.temporaryPassword = 'Obrigatório';

      target.errors = errors;
      target.isValid = Object.keys(errors).length === 0;
      next[rowIndex] = target;
      return next;
    });
  };

  // Handle Excel paste (TSV)
  const handlePaste = (e: React.ClipboardEvent, startRowIndex: number, startColKey: string) => {
    const clipboardData = e.clipboardData.getData('text');
    if (!clipboardData || !clipboardData.includes('\t')) return; // standard paste if not TSV

    e.preventDefault();
    const lines = clipboardData.trim().split(/\r?\n/);
    const startColIndex = EXPECTED_IMPORT_COLUMNS.indexOf(startColKey as any);

    if (startColIndex === -1) return;

    setRows(prev => {
      const next = [...prev];
      lines.forEach((line, rOffset) => {
        const targetRowIdx = startRowIndex + rOffset;
        if (targetRowIdx >= next.length) {
          next.push(createEmptyRow(next.length + 1));
        }

        const values = line.split('\t');
        values.forEach((val, cOffset) => {
          const colKey = EXPECTED_IMPORT_COLUMNS[startColIndex + cOffset];
          if (colKey) {
            (next[targetRowIdx] as any)[colKey] = val.trim();
          }
        });

        // Re-validate row
        const row = next[targetRowIdx];
        const errors: Record<string, string> = {};
        if (!row.employeeNumber.trim()) errors.employeeNumber = 'Obrigatório';
        if (!row.email.trim()) errors.email = 'Obrigatório';
        if (!row.temporaryPassword?.trim()) errors.temporaryPassword = 'Obrigatório';
        row.errors = errors;
        row.isValid = Object.keys(errors).length === 0;
      });
      return next;
    });

    toast.info('Dados colados com sucesso da planilha.');
  };

  // Execution: Batch processing in batches of 50
  const handleProcessImport = async () => {
    const validRows = rows.filter(r => r.employeeNumber.trim() && r.email.trim() && r.temporaryPassword?.trim());

    if (validRows.length === 0) {
      toast.error('Nenhuma linha válida para importar. Preencha ao menos matrícula, e-mail e senha temporária.');
      return;
    }

    if (!confirmUpdates) {
      toast.error('Marque a confirmação de atualização de contas existentes para prosseguir.');
      return;
    }

    setIsProcessing(true);
    setProgressPercent(0);

    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(validRows.length / BATCH_SIZE);

    let createdCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const results: Array<{ row: number; employee: string; status: 'created' | 'updated' | 'error'; message: string }> = [];

    const existingUnits = await unitRepository.list();
    const unitMap = new Map<string, string>(); // name/slug -> unitId
    existingUnits.forEach(u => {
      unitMap.set(u.name.toLowerCase(), u.id);
      unitMap.set(u.slug.toLowerCase(), u.id);
    });

    for (let b = 0; b < totalBatches; b++) {
      const batchRows = validRows.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);

      for (const row of batchRows) {
        try {
          const empNorm = row.employeeNumber.trim().toLowerCase();
          const emailNorm = row.email.trim().toLowerCase();

          // Resolve unit
          let targetUnitId: string | undefined;
          let targetUnitSlug: string | undefined;
          let targetUnitName = row.unit.trim();

          if (targetUnitName) {
            const key = targetUnitName.toLowerCase();
            if (unitMap.has(key)) {
              targetUnitId = unitMap.get(key);
              const u = existingUnits.find(unit => unit.id === targetUnitId);
              targetUnitSlug = u?.slug;
              targetUnitName = u?.name || targetUnitName;
            } else if (createMissingUnits) {
              // Create unit automatically
              const newUnit = await unitRepository.create({
                name: targetUnitName,
                slug: targetUnitName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                active: true,
                sortOrder: existingUnits.length + 1,
              });
              targetUnitId = newUnit.id;
              targetUnitSlug = newUnit.slug;
              unitMap.set(key, newUnit.id);
              existingUnits.push(newUnit);
            }
          }

          // Check if user exists by employee number or email
          const existingByEmp = await userRepository.getByEmployeeNumber(empNorm);
          const existingByEmail = await userRepository.getByEmail(emailNorm);

          // Conflict check: employee and email pointing to different existing accounts
          if (existingByEmp && existingByEmail && existingByEmp.id !== existingByEmail.id) {
            errorCount++;
            results.push({
              row: row.index,
              employee: row.employeeNumber,
              status: 'error',
              message: `Conflito de chave: matrícula pertence a ${existingByEmp.displayName} mas e-mail pertence a ${existingByEmail.displayName}.`,
            });
            continue;
          }

          const existingUser = existingByEmp || existingByEmail;

          if (existingUser) {
            // Update
            await userRepository.update(existingUser.id, {
              employeeNumber: empNorm,
              email: emailNorm,
              firstName: row.firstName.trim() || existingUser.firstName,
              lastName: row.lastName.trim() || existingUser.lastName,
              displayName:
                row.displayName.trim() ||
                `${row.firstName} ${row.lastName}`.trim() ||
                existingUser.displayName,
              unitId: targetUnitId || existingUser.unitId,
              unitSlug: targetUnitSlug || existingUser.unitSlug,
              unitNameBackup: targetUnitName || existingUser.unitNameBackup,
              company: row.company?.trim() || existingUser.company,
              adminComment: row.adminComment?.trim() || existingUser.adminComment,
              mustChangePassword: row.mustChangePassword,
              ...(isNodeBackendEnabled && row.temporaryPassword ? { temporaryPassword: row.temporaryPassword } : {}),
            });

            // Set temporary password
            if (!isNodeBackendEnabled && row.temporaryPassword) {
              localStorage.setItem(`pass_${existingUser.id}`, row.temporaryPassword);
            }

            updatedCount++;
            results.push({
              row: row.index,
              employee: row.employeeNumber,
              status: 'updated',
              message: 'Conta existente atualizada com novos dados e senha temporária.',
            });
          } else {
            // Create
            const created = await userRepository.create({
              employeeNumber: empNorm,
              email: emailNorm,
              firstName: row.firstName.trim(),
              lastName: row.lastName.trim(),
              displayName:
                row.displayName.trim() || `${row.firstName} ${row.lastName}`.trim() || row.employeeNumber,
              unitId: targetUnitId,
              unitSlug: targetUnitSlug,
              unitNameBackup: targetUnitName,
              company: row.company?.trim() || 'Honda Automóveis do Brasil',
              adminComment: row.adminComment?.trim(),
              mustChangePassword: row.mustChangePassword,
              role: 'collaborator',
              active: true,
              ...(isNodeBackendEnabled ? { temporaryPassword: row.temporaryPassword } : {}),
            });

            if (!isNodeBackendEnabled && row.temporaryPassword) {
              localStorage.setItem(`pass_${created.id}`, row.temporaryPassword);
            }

            createdCount++;
            results.push({
              row: row.index,
              employee: row.employeeNumber,
              status: 'created',
              message: 'Novo colaborador cadastrado com sucesso.',
            });
          }
        } catch (err: any) {
          errorCount++;
          results.push({
            row: row.index,
            employee: row.employeeNumber,
            status: 'error',
            message: err.message || 'Erro inesperado na persistência.',
          });
        }
      }

      setProgressPercent(Math.round(((b + 1) / totalBatches) * 100));
    }

    // Audit the batch execution
    await auditRepository.logAudit({
      actorUserId: currentUser?.id || 'admin',
      actorName: currentUser?.displayName || 'Administrador',
      action: 'BATCH_USER_IMPORT',
      entity: 'users',
      entityId: `batch-${Date.now()}`,
      afterData: { totalProcessed: validRows.length, createdCount, updatedCount, errorCount },
    });

    setImportSummary({
      totalProcessed: validRows.length,
      createdCount,
      updatedCount,
      errorCount,
      results,
    });

    setIsProcessing(false);
    toast.success(`Importação concluída: ${createdCount} criados, ${updatedCount} atualizados.`);
  };

  // Download Import Report CSV (never leaks passwords)
  const handleDownloadReport = () => {
    if (!importSummary) return;
    const reportData = importSummary.results.map(r => ({
      Linha: r.row,
      Matricula: r.employee,
      Resultado: r.status === 'created' ? 'Criado' : r.status === 'updated' ? 'Atualizado' : 'Erro',
      Detalhes: r.message,
    }));
    exportToCsv(reportData, `relatorio_importacao_${Date.now()}.csv`, ';');
  };

  const validCount = rows.filter(r => r.employeeNumber.trim() && r.email.trim() && r.temporaryPassword?.trim()).length;

  return (
    <AdminShell
      title="Importar Colaboradores em Massa"
      subtitle="Carga via planilha CSV/TSV com validação de colunas, senhas temporárias e resolução automática de unidades"
      actions={
        <Button variant="outline" size="md" onClick={handleDownloadTemplate} icon={<Download className="w-4 h-4" />}>
          Baixar CSV Exemplo
        </Button>
      }
    >
      <div className="space-y-6">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="action"
              size="md"
              onClick={() => fileInputRef.current?.click()}
              icon={<Upload className="w-4 h-4" />}
            >
              Carregar Arquivo CSV
            </Button>

            <Button variant="outline" size="md" onClick={handleAddRow} icon={<Plus className="w-4 h-4" />}>
              Adicionar Linha
            </Button>

            <Button
              variant="outline"
              size="md"
              onClick={() => setShowPasswords(prev => !prev)}
              icon={showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            >
              {showPasswords ? 'Ocultar Senhas' : 'Exibir Senhas'}
            </Button>

            <Button variant="ghost" size="md" onClick={handleClearGrid} icon={<Trash2 className="w-4 h-4" />}>
              Limpar Grade
            </Button>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="text-slate-500">
              Total de Linhas: <strong className="text-slate-900">{rows.length}</strong>
            </span>
            <span className="text-emerald-700">
              Prontas para Envio: <strong>{validCount}</strong>
            </span>
          </div>
        </div>

        {/* Options & Warnings */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
          <div className="space-y-2">
            <Checkbox
              checked={createMissingUnits}
              onChange={e => setCreateMissingUnits(e.target.checked)}
              label="Criar unidades automaticamente caso não existam no sistema"
            />
            <Checkbox
              checked={confirmUpdates}
              onChange={e => setConfirmUpdates(e.target.checked)}
              label="Confirmar atualização: contas existentes com mesma matrícula/e-mail terão dados e senha temporária atualizados"
            />
          </div>

          <Button
            variant="primary"
            size="lg"
            disabled={validCount === 0 || isProcessing || !confirmUpdates}
            loading={isProcessing}
            onClick={handleProcessImport}
            icon={<Play className="w-4 h-4" />}
            className="w-full sm:w-auto font-bold tracking-wide"
          >
            {isProcessing ? `PROCESSANDO (${progressPercent}%)` : `PROCESSAR ${validCount} LINHAS`}
          </Button>
        </div>

        {/* Result summary cards if completed */}
        {importSummary && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display">Relatório da Importação</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lote processado em {new Date().toLocaleTimeString('pt-BR')} • {importSummary.totalProcessed} registros analisados
                </p>
              </div>

              <Button variant="outline" size="sm" onClick={handleDownloadReport} icon={<Download className="w-4 h-4" />}>
                Exportar Relatório CSV
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-2xl font-extrabold text-emerald-800 font-mono block">
                  {importSummary.createdCount}
                </span>
                <span className="text-xs font-semibold text-emerald-700">Novos Colaboradores Criados</span>
              </div>

              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                <span className="text-2xl font-extrabold text-blue-800 font-mono block">
                  {importSummary.updatedCount}
                </span>
                <span className="text-xs font-semibold text-blue-700">Contas Existentes Atualizadas</span>
              </div>

              <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                <span className="text-2xl font-extrabold text-red-800 font-mono block">
                  {importSummary.errorCount}
                </span>
                <span className="text-xs font-semibold text-red-700">Erros / Conflitos de Chave</span>
              </div>
            </div>
          </div>
        )}

        {/* Editable Grid */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="flex flex-col gap-1 border-b border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              💡 <strong>Dica de Produtividade:</strong> Você pode copiar blocos de células no Excel ou Google Planilhas e colar diretamente em qualquer célula da grade.
            </span>
            <span className="font-mono">12 Colunas Oficiais</span>
          </div>

            <Table containerClassName="max-h-[500px]" className="min-w-[1500px] text-left text-xs border-collapse">
              <thead className="bg-[#323f3c] text-white uppercase text-[10px] tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  {EXPECTED_IMPORT_COLUMNS.map(col => (
                    <th key={col} className="py-2.5 px-3 min-w-[130px] whitespace-nowrap">
                      {COLUMN_LABELS_PT[col]}
                      {['employeeNumber', 'email', 'temporaryPassword'].includes(col) && (
                        <span className="text-red-400 ml-0.5">*</span>
                      )}
                    </th>
                  ))}
                  <th className="py-2.5 px-3 w-16 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, rIdx) => {
                  const hasError = Object.keys(row.errors).length > 0;
                  const isFilled = row.employeeNumber.trim() || row.email.trim();

                  return (
                    <tr
                      key={rIdx}
                      className={`hover:bg-slate-50 transition-colors ${
                        isFilled && hasError ? 'bg-red-50/40' : ''
                      }`}
                    >
                      <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px] select-none">
                        {rIdx + 1}
                      </td>

                      {EXPECTED_IMPORT_COLUMNS.map(col => {
                        const cellVal = (row as any)[col];
                        const cellErr = row.errors[col];

                        if (col === 'mustChangePassword') {
                          return (
                            <td key={col} className="py-1 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={Boolean(cellVal)}
                                onChange={e => handleCellChange(rIdx, col, e.target.checked)}
                                className="w-4 h-4 rounded text-[#028056] border-slate-300 focus:ring-[#028056]"
                              />
                            </td>
                          );
                        }

                        const isPass = col === 'temporaryPassword';

                        return (
                          <td key={col} className="p-1">
                            <input
                              type={isPass && !showPasswords ? 'password' : 'text'}
                              value={cellVal ?? ''}
                              onChange={e => handleCellChange(rIdx, col, e.target.value)}
                              onPaste={e => handlePaste(e, rIdx, col)}
                              placeholder={isPass ? '••••••••' : ''}
                              className={`w-full h-8 px-2 text-xs rounded border transition-colors focus:outline-none focus:ring-1 focus:ring-[#028056] ${
                                cellErr
                                  ? 'border-red-400 bg-red-50 text-red-900'
                                  : 'border-slate-200 hover:border-slate-300 bg-white text-slate-800'
                              }`}
                              title={cellErr}
                            />
                          </td>
                        );
                      })}

                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (rows.length > 1) {
                              setRows(prev => prev.filter((_, idx) => idx !== rIdx));
                            } else {
                              setRows([createEmptyRow(1)]);
                            }
                          }}
                          className="p-1 text-slate-300 hover:text-red-500 rounded cursor-pointer transition-colors"
                          title="Remover linha"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
        </div>
      </div>
    </AdminShell>
  );
};
