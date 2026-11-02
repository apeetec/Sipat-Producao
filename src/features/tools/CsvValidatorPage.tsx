import React, { useState, useRef } from 'react';
import { AdminShell } from '../../components/layout/AdminShell';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { Table } from '../../components/ui/table';
import { parseUserImportCsv, CsvValidationResult } from '../../utils/csv-parser';
import { exportToCsv } from '../../services/exports/csv-exporter';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileCheck,
} from 'lucide-react';

export const CsvValidatorPage: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<CsvValidationResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);

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
    ];
    exportToCsv(templateData, 'template_validacao_sipat.csv', ';');
  };

  const processFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.txt')) {
      alert('Selecione um arquivo .csv');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('O arquivo ultrapassa o limite de 10 MB.');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const content = e.target?.result as string;
      if (content) {
        const parsed = parseUserImportCsv(content);
        setResult(parsed);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  return (
    <AdminShell
      title="Validador CSV Standalone"
      subtitle="Audite planilhas de colaboradores localmente sem enviar dados ao servidor"
      actions={
        <Button variant="outline" size="sm" onClick={handleDownloadTemplate} icon={<Download className="w-4 h-4" />}>
          Baixar Template Oficial
        </Button>
      }
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) processFile(f);
            e.target.value = '';
          }}
          className="hidden"
        />

        {/* Drag and drop box */}
        <div
          onDragOver={e => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-10 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-[#028056] bg-emerald-50/60'
              : 'border-slate-300 hover:border-[#028056] bg-white'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[#028056] flex items-center justify-center mx-auto mb-4">
            <Upload className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 font-display">
            Arraste seu arquivo CSV aqui ou clique para selecionar
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Limite máximo de 10 MB • Suporta codificação UTF-8 com BOM e delimitadores ponto-e-vírgula (;) ou vírgula (,).
          </p>
        </div>

        {/* Validation Result */}
        {result && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-[#028056]" />
                <h3 className="text-base font-bold text-slate-900 font-display">
                  Relatório de Conformidade: {fileName}
                </h3>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <span className="text-2xl font-extrabold text-slate-900 font-mono block">
                  {result.totalRows}
                </span>
                <span className="text-xs text-slate-500">Total de Linhas</span>
              </div>

              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                <span className="text-2xl font-extrabold text-emerald-800 font-mono block">
                  {result.validRowsCount}
                </span>
                <span className="text-xs font-semibold text-emerald-700">Linhas 100% Válidas</span>
              </div>

              <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                <span className="text-2xl font-extrabold text-red-800 font-mono block">
                  {result.invalidRowsCount}
                </span>
                <span className="text-xs font-semibold text-red-700">Linhas com Erros</span>
              </div>
            </div>

            {/* Missing or unknown headers alerts */}
            {result.missingHeaders.length > 0 && (
              <Alert variant="danger" title="Cabeçalhos Obrigatórios Ausentes">
                O arquivo não contém as seguintes colunas obrigatórias: <code>{result.missingHeaders.join(', ')}</code>
              </Alert>
            )}

            {result.unknownHeaders.length > 0 && (
              <Alert variant="warning" title="Colunas Não Reconhecidas (Aviso)">
                As seguintes colunas extras foram identificadas e serão ignoradas pelo importador: <code>{result.unknownHeaders.join(', ')}</code>
              </Alert>
            )}

            {/* Rows details */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <Table className="min-w-[720px] text-left text-xs text-slate-700">
                <thead className="bg-[#323f3c] text-white uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 w-14 text-center">Linha</th>
                    <th className="py-2.5 px-3">Matrícula</th>
                    <th className="py-2.5 px-3">E-mail</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Diagnóstico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.rows.map(r => (
                    <tr
                      key={r.index}
                      className={`hover:bg-slate-50 ${!r.isValid ? 'bg-red-50/40' : ''}`}
                    >
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400">{r.index}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                        {r.employeeNumber || <span className="text-red-500 italic">Vazia</span>}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {r.email || <span className="text-red-500 italic">Vazio</span>}
                      </td>
                      <td className="py-2.5 px-3">
                        {r.isValid ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            <CheckCircle2 className="w-3 h-3 text-[#28a745]" />
                            <span>Válida</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                            <XCircle className="w-3 h-3 text-[#d32f2f]" />
                            <span>Incorreta</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                        {Object.keys(r.errors).length > 0 ? (
                          <span className="text-red-600 font-semibold">
                            {Object.values(r.errors).join('; ')}
                          </span>
                        ) : r.warnings.length > 0 ? (
                          <span className="text-amber-600">{r.warnings.join('; ')}</span>
                        ) : (
                          <span className="text-emerald-700">Pronta para importação</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
};
