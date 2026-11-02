import React, { useState, useEffect, useMemo } from 'react';
import {
  userRepository,
  eventRepository,
  questionRepository,
  participationRepository,
  unitRepository,
} from '../../../services/repositories';
import { AppUser, EventDay, Question, Participation, ParticipationAnswer, Unit } from '../../../types';
import { AdminShell } from '../../../components/layout/AdminShell';
import { Button } from '../../../components/ui/Button';
import { TextField } from '../../../components/ui/TextField';
import { Select } from '../../../components/ui/Select';
import { Drawer } from '../../../components/ui/Drawer';
import { Pagination } from '../../../components/ui/Pagination';
import { Table } from '../../../components/ui/table';
import { exportToCsv, copyTableToClipboard } from '../../../services/exports/csv-exporter';
import { exportMultiSheetExcel, exportToExcel } from '../../../services/exports/excel-exporter';
import { SendEmailReportModal } from './SendEmailReportModal';
import { toast } from '../../../components/feedback/ToastContainer';
import { formatDateToSaoPaulo } from '../../../utils/formatters';
import { indexParticipations } from './participation-map';
import {
  Search,
  Download,
  Copy,
  Printer,
  FileSpreadsheet,
  Eye,
  CheckCircle2,
  XCircle,
  Mail,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Calendar,
  Check,
  X,
  Sparkles,
  Info,
} from 'lucide-react';

const getRatingValue = (question: Question, answer?: ParticipationAnswer) => {
  if (answer?.rating !== undefined) return answer.rating;
  const optionIndex = question.alternatives.findIndex(option => option.id === answer?.alternativeId);
  if (optionIndex < 0) return undefined;
  return question.alternatives[optionIndex].ratingValue ?? optionIndex + 1;
};

export const AdminResultsPage: React.FC = () => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [days, setDays] = useState<EventDay[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'with_answers' | 'without_answers'>('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [dayFilter, setDayFilter] = useState('all');

  // Display mode
  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('compact');

  // Expanded row IDs for inline accordion breakdown
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  // Email modal state
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Drawer details
  const [selectedUserForDrawer, setSelectedUserForDrawer] = useState<AppUser | null>(null);

  useEffect(() => {
    const loadMatrix = async () => {
      try {
        setLoading(true);
        const [allUsers, allDays, allQuestions, allParts, allUnits] = await Promise.all([
          userRepository.list({ role: 'collaborator' }),
          eventRepository.list(),
          questionRepository.listAll(),
          participationRepository.listAll(),
          unitRepository.list(),
        ]);
        setUsers(allUsers);
        setDays(allDays);
        setQuestions(allQuestions);
        setParticipations(allParts);
        setUnits(allUnits);
      } catch (err) {
        console.error('Failed to load matrix:', err);
      } finally {
        setLoading(false);
      }
    };
    loadMatrix();
  }, []);

  // Map participations by `${userId}_${eventDayId}`
  const partMap = useMemo(() => {
    return indexParticipations(participations);
  }, [participations]);

  // Group questions by day
  const questionsByDay = useMemo(() => {
    const map: Record<string, Question[]> = {};
    days.forEach(d => {
      map[d.id] = questions.filter(q => q.eventDayId === d.id && q.active);
    });
    return map;
  }, [days, questions]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (unitFilter !== 'all' && u.unitId !== unitFilter) return false;

      const userParts = participations.filter(p => p.userId === u.id && p.status === 'submitted');
      if (statusFilter === 'with_answers' && userParts.length === 0) return false;
      if (statusFilter === 'without_answers' && userParts.length > 0) return false;

      if (dayFilter !== 'all') {
        const p = partMap.get(`${u.id}_${dayFilter}`);
        if (!p || p.status !== 'submitted') return false;
      }

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          u.displayName.toLowerCase().includes(q) ||
          u.employeeNumber.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [users, unitFilter, statusFilter, dayFilter, search, participations, partMap]);

  const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1;
  const paginatedUsers = useMemo(() => {
    return filteredUsers.slice((page - 1) * pageSize, page * pageSize);
  }, [filteredUsers, page, pageSize]);

  // Unique users with at least one response
  const usersWithResponsesCount = useMemo(() => {
    return new Set(
      participations.filter(p => p.status === 'submitted').map(p => p.userId)
    ).size;
  }, [participations]);

  const toggleRowExpansion = (userId: string) => {
    setExpandedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  /**
   * Generates datasets for Excel export
   */
  const prepareDetailedExcelData = () => {
    // Sheet 1: Visão Geral de Participação por Colaborador
    const summarySheet = filteredUsers.map(u => {
      const userParts = days
        .map(d => ({ day: d, part: partMap.get(`${u.id}_${d.id}`) }))
        .filter(item => item.part && item.part.status === 'submitted');

      const datesParticipated = userParts.map(item => item.day.name).join(', ') || 'Nenhum dia respondido';
      const avgPercentage = userParts.length > 0
        ? Math.round(userParts.reduce((acc, curr) => acc + (curr.part?.percentage || 0), 0) / userParts.length)
        : 0;

      const row: Record<string, any> = {
        Matrícula: u.employeeNumber,
        Nome: u.displayName,
        Email: u.email,
        Unidade: u.unitNameBackup || u.unitSlug?.toUpperCase() || '-',
        Empresa: u.company || 'Honda',
        'Total Dias Participados': `${userParts.length} de ${days.length}`,
        'Progresso Geral (%)': `${Math.round((userParts.length / (days.length || 1)) * 100)}%`,
        'Datas que Participou': datesParticipated,
        'Média de Acertos': userParts.length > 0 ? `${avgPercentage}%` : 'Sem respostas',
        Status: userParts.length === days.length ? 'Concluiu Todas' : userParts.length > 0 ? 'Parcial' : 'Não Iniciou',
      };

      days.forEach(d => {
        const p = partMap.get(`${u.id}_${d.id}`);
        row[`${d.name}_Status`] = p ? (p.status === 'submitted' ? 'Respondido' : 'Em Andamento') : 'Não Iniciado';
        row[`${d.name}_Nota`] = p?.percentage !== undefined ? `${p.percentage}%` : '-';
        row[`${d.name}_Gabaritou`] = p?.perfectScore ? 'SIM' : 'NÃO';
      });

      return row;
    });

    // Sheet 2: Matriz Geral de Respostas
    const matrixSheet = filteredUsers.map(u => {
      const row: Record<string, any> = {
        Matrícula: u.employeeNumber,
        Nome: u.displayName,
        Unidade: u.unitNameBackup || u.unitSlug?.toUpperCase() || '-',
      };

      days.forEach(d => {
        const dayQ = questionsByDay[d.id] || [];
        const part = partMap.get(`${u.id}_${d.id}`);

        dayQ.forEach((q, idx) => {
          const colName = `${d.name}_P${idx + 1}`;
          const ans = part?.answers?.[q.id];

          if (!ans || (!ans.alternativeId && !ans.text && ans.rating === undefined)) {
            row[colName] = '-';
            return;
          }

          if (q.type === 'single_choice') {
            const selectedAlt = q.alternatives.find(a => a.id === ans.alternativeId);
            const isCorrect = Boolean(selectedAlt?.isCorrect);
            const altLetter = selectedAlt ? String.fromCharCode(65 + q.alternatives.indexOf(selectedAlt)) : '?';

            if (q.scored) {
              row[colName] = isCorrect
                ? `[${altLetter}] CORRETA: ${selectedAlt?.text || ''}`
                : `[${altLetter}] INCORRETA: ${selectedAlt?.text || ''}`;
            } else {
              row[colName] = `[${altLetter}] ${selectedAlt?.text || ''}`;
            }
          } else if (q.type === 'rating') {
            row[colName] = `${getRatingValue(q, ans)} estrelas`;
          } else {
            row[colName] = ans.text || 'Respondido';
          }
        });
      });

      return row;
    });

    // Sheet 3: Detalhamento Linha a Linha (Raw Data Completo com Gabarito)
    const detailedSheet: Record<string, any>[] = [];

    filteredUsers.forEach(u => {
      days.forEach(d => {
        const dayQ = questionsByDay[d.id] || [];
        const part = partMap.get(`${u.id}_${d.id}`);
        const attendedThisDay = Boolean(part && part.status === 'submitted');

        dayQ.forEach((q, qIdx) => {
          const ans = part?.answers?.[q.id];

          let selectedAnswerText = 'Não respondeu';
          let correctnessStatus = 'Sem resposta';
          let correctGabaritoText = '-';

          if (q.type === 'single_choice') {
            const correctAlt = q.alternatives.find(a => a.isCorrect);
            if (correctAlt) {
              const cLetter = String.fromCharCode(65 + q.alternatives.indexOf(correctAlt));
              correctGabaritoText = `(${cLetter}) ${correctAlt.text}`;
            }

            if (ans?.alternativeId) {
              const selectedAlt = q.alternatives.find(a => a.id === ans.alternativeId);
              if (selectedAlt) {
                const sLetter = String.fromCharCode(65 + q.alternatives.indexOf(selectedAlt));
                selectedAnswerText = `(${sLetter}) ${selectedAlt.text}`;
                if (q.scored) {
                  correctnessStatus = selectedAlt.isCorrect ? 'CORRETA' : 'INCORRETA';
                } else {
                  correctnessStatus = 'PESQUISA';
                }
              }
            }
          } else if (q.type === 'rating') {
            const rating = getRatingValue(q, ans);
            if (rating !== undefined) {
              selectedAnswerText = `${rating} Estrelas`;
              correctnessStatus = 'AVALIAÇÃO';
            }
          } else if (q.type === 'free_text') {
            if (ans?.text) {
              selectedAnswerText = ans.text;
              correctnessStatus = 'TEXTO LIVRE';
            }
          }

          detailedSheet.push({
            Matrícula: u.employeeNumber,
            'Nome do Colaborador': u.displayName,
            Email: u.email,
            Unidade: u.unitNameBackup || u.unitSlug?.toUpperCase() || '-',
            'Dia / Sessão': d.name,
            'Data da Sessão': d.dateLabel,
            'Participou Deste Dia?': attendedThisDay ? 'SIM' : 'NÃO',
            Modalidade: attendedThisDay ? (part?.modality === 'in_person' ? 'Presencial' : 'Remoto') : '-',
            'Data Envio': part?.submittedAt ? formatDateToSaoPaulo(part.submittedAt, 'liberacao') : '-',
            'Nº Questão': `P${qIdx + 1}`,
            'Enunciado da Pergunta': q.title,
            'Tipo da Pergunta': q.scored ? 'Avaliativa' : 'Pesquisa',
            'Resposta Assinalada': selectedAnswerText,
            'Status da Resposta': correctnessStatus,
            'Gabarito Correto': correctGabaritoText,
            'Nota no Dia (%)': attendedThisDay && part?.percentage !== undefined ? `${part.percentage}%` : '-',
          });
        });
      });
    });

    return { summarySheet, matrixSheet, detailedSheet };
  };

  const handleExportCsv = () => {
    const { detailedSheet } = prepareDetailedExcelData();
    exportToCsv(detailedSheet, `matriz_respostas_detalhada_${Date.now()}.csv`, ';');
    toast.success('Arquivo CSV detalhado exportado com sucesso.');
  };

  const handleExportExcel = async () => {
    try {
      const { summarySheet, matrixSheet, detailedSheet } = prepareDetailedExcelData();
      await exportMultiSheetExcel(
        [
          { name: 'Resumo_Participacoes', data: summarySheet },
          { name: 'Matriz_Geral_Respostas', data: matrixSheet },
          { name: 'Detalhamento_Completo', data: detailedSheet },
        ],
        `matriz_geral_respostas_sipat_${Date.now()}`
      );
      toast.success('Planilha Excel multi-abas exportada com sucesso.');
    } catch {
      toast.error('Não foi possível gerar a planilha Excel.');
    }
  };

  const handleCopyClipboard = async () => {
    const { summarySheet } = prepareDetailedExcelData();
    await copyTableToClipboard(summarySheet);
    toast.success('Resumo de participantes copiado para a área de transferência.');
  };

  return (
    <AdminShell
      title="Matriz Geral de Resultados & Respostas"
      subtitle="Acompanhamento integral das respostas assinaladas, conferência de gabarito e datas de participação"
      actions={
        <div className="flex items-center flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEmailModal(true)}
            icon={<Mail className="w-3.5 h-3.5 text-purple-600" />}
          >
            Enviar por E-mail
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyClipboard}
            icon={<Copy className="w-3.5 h-3.5" />}
          >
            Copiar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            icon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />}
          >
            Excel Completo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            icon={<Download className="w-3.5 h-3.5 text-blue-600" />}
          >
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            icon={<Printer className="w-3.5 h-3.5" />}
          >
            Imprimir
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Purple Hero Header with Live Metrics */}
        <div className="rounded-3xl bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white p-6 sm:p-8 shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 px-2.5 py-1 rounded-full text-white">
                Métricas de Engajamento e Auditoria
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-display text-white mt-1">
                Matriz de Respostas dos Colaboradores
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-purple-200">
                Respostas em tempo real • Auditoria ativa
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-xl border border-white/10">
              <span className="text-xs text-purple-200 block">Total de Usuários</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono mt-0.5 block">
                {users.length}
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-xl border border-white/10">
              <span className="text-xs text-purple-200 block">Já Responderam</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-300 font-mono mt-0.5 block">
                {usersWithResponsesCount}
              </span>
              <span className="text-[10px] text-purple-200">
                {Math.round((usersWithResponsesCount / (users.length || 1)) * 100)}% da base
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-xl border border-white/10">
              <span className="text-xs text-purple-200 block">Pendentes (0 dias)</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-300 font-mono mt-0.5 block">
                {users.length - usersWithResponsesCount}
              </span>
              <span className="text-[10px] text-purple-200">Ainda não iniciaram</span>
            </div>
            <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-xl border border-white/10">
              <span className="text-xs text-purple-200 block">Total de Questões</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono mt-0.5 block">
                {questions.length}
              </span>
              <span className="text-[10px] text-purple-200">Em {days.length} sessões</span>
            </div>
          </div>

          {/* Badges for each date and questions count */}
          <div className="mt-6 pt-4 border-t border-white/15 flex flex-wrap items-center gap-2">
            <span className="text-xs text-purple-200 font-semibold mr-1">Sessões:</span>
            {days.map(d => (
              <span
                key={d.id}
                className="text-xs bg-white/15 px-3 py-1 rounded-lg text-white font-medium flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5 opacity-80" />
                {d.name}: <strong>{(questionsByDay[d.id] || []).length}</strong> questões
              </span>
            ))}
          </div>
        </div>

        {/* Filters and View Controls Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-2xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-full min-w-0 sm:flex-1">
              <TextField
                placeholder="Buscar por colaborador, matrícula ou email..."
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
                  { value: 'all', label: 'Todos os Status' },
                  { value: 'with_answers', label: 'Já Responderam (≥1)' },
                  { value: 'without_answers', label: 'Pendentes (Nenhum)' },
                ]}
                value={statusFilter}
                onChange={e => {
                  setStatusFilter(e.target.value as any);
                  setPage(1);
                }}
              />
            </div>

            <div className="w-full sm:w-44">
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

            <div className="w-full sm:w-48">
              <Select
                options={[
                  { value: 'all', label: 'Qualquer Sessão' },
                  ...days.map(d => ({ value: d.id, label: `${d.name} Respondido` })),
                ]}
                value={dayFilter}
                onChange={e => {
                  setDayFilter(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* View Mode Toggle */}
            <div className="flex w-full items-center rounded-lg border border-slate-200 bg-slate-100 p-1 sm:w-auto">
              <button
                type="button"
                onClick={() => setViewMode('compact')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  viewMode === 'compact'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Compacto
              </button>
              <button
                type="button"
                onClick={() => setViewMode('detailed')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  viewMode === 'detailed'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Texto Detalhado
              </button>
            </div>
          </div>

          {/* Table Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs text-slate-500">
            <div className="flex flex-wrap items-center gap-4">
              <span className="font-semibold text-slate-700">Legenda de Respostas:</span>
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                <span className="w-4 h-4 rounded bg-emerald-100 border border-emerald-300 flex items-center justify-center text-[10px] font-bold text-emerald-700">
                  ✓
                </span>
                Resposta Correta
              </span>
              <span className="inline-flex items-center gap-1.5 text-red-700 font-medium">
                <span className="w-4 h-4 rounded bg-red-100 border border-red-300 flex items-center justify-center text-[10px] font-bold text-red-700">
                  ✕
                </span>
                Resposta Incorreta
              </span>
              <span className="inline-flex items-center gap-1.5 text-purple-700 font-medium">
                <span className="w-4 h-4 rounded bg-purple-100 border border-purple-300 flex items-center justify-center text-[10px] font-bold text-purple-700">
                  ●
                </span>
                Pesquisa / Opinião
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-400">
                <span className="w-4 h-4 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-mono text-slate-400">
                  –
                </span>
                Não Respondeu
              </span>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              Clique na seta <ChevronRight className="w-3 h-3 inline text-slate-400" /> para ver todas as respostas daquele colaborador.
            </div>
          </div>
        </div>

        {/* Matrix Table with Sticky Columns and 2 Header Rows */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <Table className="min-w-max text-left text-xs border-collapse">
              {/* Header Row 1: Fixed Columns + Group by Date */}
              <thead>
                <tr className="bg-[#323f3c] text-white uppercase text-[10px] tracking-wider border-b border-slate-600">
                  <th
                    rowSpan={2}
                    className="py-3 px-2 sticky left-0 z-30 bg-[#323f3c] w-10 text-center border-r border-slate-600"
                  >
                    #
                  </th>
                  <th
                    rowSpan={2}
                    className="py-3 px-3 sticky left-10 z-30 bg-[#323f3c] w-28 border-r border-slate-600 shadow-xs"
                  >
                    Matrícula
                  </th>
                  <th
                    rowSpan={2}
                    className="py-3 px-4 sticky left-[152px] z-30 bg-[#323f3c] min-w-[190px] border-r border-slate-600 shadow-xs"
                  >
                    Nome do Colaborador
                  </th>
                  <th rowSpan={2} className="py-3 px-3 min-w-[120px] border-r border-slate-600">
                    Unidade
                  </th>
                  <th
                    rowSpan={2}
                    className="py-3 px-3 min-w-[170px] border-r border-slate-600 text-center bg-[#252f2d]"
                  >
                    Datas Participadas
                  </th>

                  {days.map(d => {
                    const dayQ = questionsByDay[d.id] || [];
                    const colSpan = Math.max(1, dayQ.length);
                    return (
                      <th
                        key={d.id}
                        colSpan={colSpan}
                        className="py-2.5 px-3 text-center border-r border-slate-600 bg-[#252f2d] font-bold"
                      >
                        {d.name} ({dayQ.length} Questões)
                      </th>
                    );
                  })}

                  <th rowSpan={2} className="py-3 px-3 text-center w-16 sticky right-0 bg-[#323f3c] z-20">
                    Ações
                  </th>
                </tr>

                {/* Header Row 2: Individual Questions P1, P2... with Tooltips */}
                <tr className="bg-[#2a3532] text-white text-[10px] uppercase tracking-wider">
                  {days.map(d => {
                    const dayQ = questionsByDay[d.id] || [];
                    if (dayQ.length === 0) {
                      return (
                        <th key={`${d.id}-empty`} className="py-1.5 px-2 text-center text-slate-400">
                          –
                        </th>
                      );
                    }
                    return dayQ.map((q, qIdx) => (
                      <th
                        key={q.id}
                        title={`P${qIdx + 1}: ${q.title} (${q.scored ? 'Avaliativa' : 'Pesquisa'})`}
                        className={`py-1.5 px-2 text-center border-r border-slate-600 hover:bg-slate-700 cursor-help ${
                          viewMode === 'detailed' ? 'min-w-[160px]' : 'min-w-[56px]'
                        }`}
                      >
                        P{qIdx + 1}
                      </th>
                    ));
                  })}
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-slate-100">
                {paginatedUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6 + questions.length}
                      className="py-12 text-center text-slate-400 text-xs"
                    >
                      Nenhum colaborador encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map(u => {
                    const isExpanded = expandedRowIds.has(u.id);

                    // User attended days
                    const userParticipatedDays = days.filter(d => {
                      const p = partMap.get(`${u.id}_${d.id}`);
                      return p && p.status === 'submitted';
                    });

                    return (
                      <React.Fragment key={u.id}>
                        <tr className="hover:bg-slate-50 transition-colors group">
                          {/* Expand chevron */}
                          <td className="py-3 px-2 sticky left-0 z-10 bg-white border-r border-slate-200 text-center">
                            <button
                              type="button"
                              onClick={() => toggleRowExpansion(u.id)}
                              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                              title="Expandir respostas do colaborador"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-[#028056]" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          </td>

                          {/* Fixed Columns */}
                          <td className="py-3 px-3 font-mono font-bold text-slate-900 sticky left-10 z-10 bg-white border-r border-slate-200">
                            {u.employeeNumber}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800 sticky left-[152px] z-10 bg-white border-r border-slate-200 truncate max-w-[200px]">
                            {u.displayName}
                          </td>
                          <td className="py-3 px-3 text-slate-600 border-r border-slate-100 truncate max-w-[140px]">
                            {u.unitNameBackup || u.unitSlug?.toUpperCase() || '-'}
                          </td>

                          {/* Column: Quais datas ele participou */}
                          <td className="py-2.5 px-3 border-r border-slate-100 text-center">
                            {userParticipatedDays.length === 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
                                Nenhum dia
                              </span>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                  userParticipatedDays.length === days.length
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {userParticipatedDays.length} de {days.length} dias
                                </span>
                                <div className="flex flex-wrap justify-center gap-1 max-w-[160px]">
                                  {userParticipatedDays.map(d => (
                                    <span
                                      key={d.id}
                                      className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-medium"
                                      title={`Participou no ${d.name} (${d.dateLabel})`}
                                    >
                                      {d.name.replace(/Dia\s*/i, 'D')}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Question Response Cells: Showing Selected Answer and Correct/Incorrect status */}
                          {days.map(d => {
                            const dayQ = questionsByDay[d.id] || [];
                            const part = partMap.get(`${u.id}_${d.id}`);

                            if (dayQ.length === 0) {
                              return (
                                <td key={`${d.id}-no-q`} className="py-2 px-2 text-center text-slate-300">
                                  –
                                </td>
                              );
                            }

                            return dayQ.map((q, qIdx) => {
                              const ans = part?.answers?.[q.id];
                              const hasAnswer = Boolean(ans && (ans.alternativeId || ans.text || ans.rating !== undefined));

                              if (!hasAnswer) {
                                return (
                                  <td
                                    key={q.id}
                                    className="py-2 px-2 text-center border-r border-slate-100 text-slate-300 select-none"
                                    title={`P${qIdx + 1} (${d.name}): Não respondeu`}
                                  >
                                    –
                                  </td>
                                );
                              }

                              // Single Choice Question
                              if (q.type === 'single_choice') {
                                const selectedAlt = q.alternatives.find(a => a.id === ans?.alternativeId);
                                const correctAlt = q.alternatives.find(a => a.isCorrect);
                                const isCorrect = Boolean(selectedAlt?.isCorrect);
                                const sLetter = selectedAlt
                                  ? String.fromCharCode(65 + q.alternatives.indexOf(selectedAlt))
                                  : '?';
                                const cLetter = correctAlt
                                  ? String.fromCharCode(65 + q.alternatives.indexOf(correctAlt))
                                  : '?';

                                const tooltipTitle = q.scored
                                  ? `P${qIdx + 1}: ${q.title}\nResposta Assinalada: (${sLetter}) ${selectedAlt?.text}\nStatus: ${
                                      isCorrect ? 'CORRETA ✓' : `INCORRETA ✕ (Gabarito: (${cLetter}) ${correctAlt?.text})`
                                    }`
                                  : `P${qIdx + 1}: ${q.title}\nOpção Escolhida: (${sLetter}) ${selectedAlt?.text}`;

                                if (q.scored) {
                                  return (
                                    <td
                                      key={q.id}
                                      className={`py-2 px-2 text-center border-r border-slate-100 ${
                                        isCorrect ? 'bg-emerald-50/30' : 'bg-red-50/30'
                                      }`}
                                      title={tooltipTitle}
                                    >
                                      {viewMode === 'compact' ? (
                                        <span
                                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-2xs ${
                                            isCorrect
                                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                              : 'bg-red-100 text-red-800 border border-red-300'
                                          }`}
                                        >
                                          {isCorrect ? (
                                            <Check className="w-3 h-3 stroke-[3]" />
                                          ) : (
                                            <X className="w-3 h-3 stroke-[3]" />
                                          )}
                                          {sLetter}
                                        </span>
                                      ) : (
                                        <div
                                          className={`px-1.5 py-1 rounded text-[10px] text-left leading-tight ${
                                            isCorrect
                                              ? 'bg-emerald-100/80 text-emerald-900 border border-emerald-300'
                                              : 'bg-red-100/80 text-red-900 border border-red-300'
                                          }`}
                                        >
                                          <div className="font-bold flex items-center gap-1">
                                            {isCorrect ? (
                                              <span className="text-emerald-700">✓ ({sLetter}) Correta</span>
                                            ) : (
                                              <span className="text-red-700">✕ ({sLetter}) Incorreta</span>
                                            )}
                                          </div>
                                          <span className="truncate block opacity-90 max-w-[150px]">
                                            {selectedAlt?.text}
                                          </span>
                                        </div>
                                      )}
                                    </td>
                                  );
                                }

                                // Pesquisa / Sem Gabarito
                                return (
                                  <td
                                    key={q.id}
                                    className="py-2 px-2 text-center border-r border-slate-100 bg-purple-50/20"
                                    title={tooltipTitle}
                                  >
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-800 border border-purple-200">
                                      ({sLetter})
                                    </span>
                                  </td>
                                );
                              }

                              // Rating question
                              if (q.type === 'rating') {
                                const rating = getRatingValue(q, ans);
                                return (
                                  <td
                                    key={q.id}
                                    className="py-2 px-2 text-center border-r border-slate-100"
                                    title={`Avaliação: ${rating} estrelas`}
                                  >
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                      ★ {rating}
                                    </span>
                                  </td>
                                );
                              }

                              // Free text
                              return (
                                <td
                                  key={q.id}
                                  className="py-2 px-2 text-center border-r border-slate-100"
                                  title={`Texto: ${ans?.text}`}
                                >
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 border border-blue-200 truncate max-w-[80px]">
                                    {ans?.text?.slice(0, 10)}...
                                  </span>
                                </td>
                              );
                            });
                          })}

                          {/* Drawer trigger action */}
                          <td className="py-3 px-3 text-center sticky right-0 bg-white z-10 border-l border-slate-200">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedUserForDrawer(u)}
                              title="Ver ficha completa do colaborador"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#028056]" />
                            </Button>
                          </td>
                        </tr>

                        {/* Expandable Accordion Row: Question-by-Question Detailed Breakdown */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80 border-b-2 border-slate-200">
                            <td colSpan={6 + questions.length} className="p-4 sm:p-6">
                              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 shadow-sm">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                  <div>
                                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                      <span>Detalhamento das Respostas de {u.displayName}</span>
                                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                        Matrícula {u.employeeNumber}
                                      </span>
                                    </h4>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                      Unidade: {u.unitNameBackup || u.unitSlug?.toUpperCase() || '-'} • Participou de{' '}
                                      <strong>{userParticipatedDays.length}</strong> de {days.length} dias
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setSelectedUserForDrawer(u)}
                                      icon={<Eye className="w-3.5 h-3.5" />}
                                    >
                                      Abrir Ficha Cadastral
                                    </Button>
                                  </div>
                                </div>

                                {/* Day by Day Answers Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {days.map(d => {
                                    const dayQ = questionsByDay[d.id] || [];
                                    const part = partMap.get(`${u.id}_${d.id}`);
                                    const attended = Boolean(part && part.status === 'submitted');

                                    return (
                                      <div
                                        key={d.id}
                                        className={`rounded-xl border p-3.5 space-y-2.5 transition-all ${
                                          attended
                                            ? 'bg-white border-slate-200'
                                            : 'bg-slate-50/70 border-dashed border-slate-300'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                          <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-900 text-xs">
                                              {d.name}
                                            </span>
                                            <span className="text-[10px] text-slate-500">
                                              ({d.dateLabel})
                                            </span>
                                          </div>
                                          {attended ? (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                              Participou • {part?.percentage}% de acerto
                                            </span>
                                          ) : (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
                                              Não Participou
                                            </span>
                                          )}
                                        </div>

                                        {dayQ.length === 0 ? (
                                          <p className="text-[11px] text-slate-400 italic">
                                            Nenhuma pergunta cadastrada neste dia.
                                          </p>
                                        ) : (
                                          <div className="space-y-2">
                                            {dayQ.map((q, idx) => {
                                              const ans = part?.answers?.[q.id];
                                              const selectedAlt = q.alternatives.find(
                                                a => a.id === ans?.alternativeId
                                              );
                                              const correctAlt = q.alternatives.find(a => a.isCorrect);
                                              const sLetter = selectedAlt
                                                ? String.fromCharCode(65 + q.alternatives.indexOf(selectedAlt))
                                                : '';
                                              const cLetter = correctAlt
                                                ? String.fromCharCode(65 + q.alternatives.indexOf(correctAlt))
                                                : '';

                                              return (
                                                <div
                                                  key={q.id}
                                                  className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs space-y-1"
                                                >
                                                  <div className="flex items-start justify-between gap-2">
                                                    <span className="font-semibold text-slate-800">
                                                      P{idx + 1}: {q.title}
                                                    </span>
                                                    {q.scored ? (
                                                      selectedAlt ? (
                                                        selectedAlt.isCorrect ? (
                                                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 shrink-0 flex items-center gap-1">
                                                            <Check className="w-3 h-3 stroke-[3]" /> Correta
                                                          </span>
                                                        ) : (
                                                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-800 shrink-0 flex items-center gap-1">
                                                            <X className="w-3 h-3 stroke-[3]" /> Incorreta
                                                          </span>
                                                        )
                                                      ) : (
                                                        <span className="px-2 py-0.5 rounded text-[9px] font-medium bg-slate-200 text-slate-600 shrink-0">
                                                          Sem resposta
                                                        </span>
                                                      )
                                                    ) : (
                                                      <span className="px-2 py-0.5 rounded text-[9px] font-medium bg-purple-100 text-purple-700 shrink-0">
                                                        Pesquisa
                                                      </span>
                                                    )}
                                                  </div>

                                                  {/* Selected Answer text */}
                                                  {selectedAlt ? (
                                                    <div className="text-[11px] text-slate-700 pt-0.5">
                                                      <span className="text-slate-500 font-medium">Resposta assinalada: </span>
                                                      <strong className="text-slate-900">
                                                        ({sLetter}) {selectedAlt.text}
                                                      </strong>
                                                    </div>
                                                  ) : ans?.rating !== undefined ? (
                                                    <div className="text-[11px] text-slate-700">
                                                      <span className="text-slate-500">Avaliação: </span>
                                                      <strong>★ {ans.rating} estrelas</strong>
                                                    </div>
                                                  ) : ans?.text ? (
                                                    <div className="text-[11px] text-slate-700">
                                                      <span className="text-slate-500">Texto: </span>
                                                      <span>{ans.text}</span>
                                                    </div>
                                                  ) : (
                                                    <div className="text-[11px] text-slate-400 italic">
                                                      O colaborador não assinalou nenhuma alternativa para esta questão.
                                                    </div>
                                                  )}

                                                  {/* Correct alternative if incorrect */}
                                                  {q.scored && selectedAlt && !selectedAlt.isCorrect && correctAlt && (
                                                    <div className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200/80">
                                                      <strong>Gabarito oficial:</strong> ({cLetter}) {correctAlt.text}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
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

      {/* User Details Deep-Dive Drawer */}
      <Drawer
        isOpen={Boolean(selectedUserForDrawer)}
        onClose={() => setSelectedUserForDrawer(null)}
        title={selectedUserForDrawer?.displayName || 'Detalhes do Colaborador'}
        description={`Matrícula: ${selectedUserForDrawer?.employeeNumber} • ${selectedUserForDrawer?.email}`}
        width="lg"
      >
        {selectedUserForDrawer && (
          <div className="space-y-6 text-xs">
            {/* General Info Card */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
              <span className="font-bold text-slate-800 block text-xs uppercase tracking-wider">
                Dados Cadastrais
              </span>
              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div>
                  <span className="text-slate-400 block text-[10px]">Unidade:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedUserForDrawer.unitNameBackup || selectedUserForDrawer.unitSlug || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Empresa:</span>
                  <span className="font-semibold text-slate-800">{selectedUserForDrawer.company || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Regulamento:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedUserForDrawer.regulationAcceptedVersion
                      ? `Aceito (v${selectedUserForDrawer.regulationAcceptedVersion})`
                      : 'Pendente'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Primeiro Acesso:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedUserForDrawer.mustChangePassword ? 'Senha inicial pendente' : 'Senha alterada'}
                  </span>
                </div>
              </div>
            </div>

            {/* Participations & Question by Question Detailed Timeline */}
            <div>
              <span className="font-bold text-slate-800 block text-xs uppercase tracking-wider mb-3">
                Histórico de Participação e Respostas Assinaladas
              </span>

              <div className="space-y-4">
                {days.map(d => {
                  const part = partMap.get(`${selectedUserForDrawer.id}_${d.id}`);
                  const dayQ = questionsByDay[d.id] || [];

                  return (
                    <div
                      key={d.id}
                      className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-xs">
                          {d.name} ({d.dateLabel})
                        </span>
                        {part?.status === 'submitted' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-[#015237]">
                            Submetido • {part.percentage}%
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
                            Não Submetido
                          </span>
                        )}
                      </div>

                      {part && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Modalidade:</span>
                            <span className="font-semibold text-slate-800">
                              {part.modality === 'in_person' ? 'Presencial (Código)' : 'Remoto (Vídeo)'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Progresso do Vídeo:</span>
                            <span className="font-semibold text-slate-800">{part.videoProgressPercent}%</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Gabarito 100%:</span>
                            <span className={`font-bold ${part.perfectScore ? 'text-[#028056]' : 'text-slate-700'}`}>
                              {part.perfectScore ? 'SIM (Apto)' : 'NÃO'}
                            </span>
                          </div>
                          <div className="col-span-2 sm:col-span-3 text-[10px] text-slate-400">
                            Enviado em:{' '}
                            {part.submittedAt ? formatDateToSaoPaulo(part.submittedAt, 'liberacao') : '-'}
                          </div>
                        </div>
                      )}

                      {/* Question by Question Review */}
                      {dayQ.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 space-y-2">
                          <span className="font-semibold text-slate-700 block text-[11px]">
                            Respostas Assinaladas:
                          </span>
                          <div className="space-y-1.5">
                            {dayQ.map((q, qIdx) => {
                              const ans = part?.answers?.[q.id];
                              const selectedAlt = q.alternatives.find(a => a.id === ans?.alternativeId);
                              const correctAlt = q.alternatives.find(a => a.isCorrect);
                              const sLetter = selectedAlt
                                ? String.fromCharCode(65 + q.alternatives.indexOf(selectedAlt))
                                : '';
                              const cLetter = correctAlt
                                ? String.fromCharCode(65 + q.alternatives.indexOf(correctAlt))
                                : '';

                              return (
                                <div
                                  key={q.id}
                                  className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="font-medium text-slate-800 text-[11px]">
                                      P{qIdx + 1}: {q.title}
                                    </span>
                                    {q.scored ? (
                                      selectedAlt ? (
                                        selectedAlt.isCorrect ? (
                                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                                            Correta ✓
                                          </span>
                                        ) : (
                                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-800">
                                            Incorreta ✕
                                          </span>
                                        )
                                      ) : (
                                        <span className="px-2 py-0.5 rounded text-[9px] font-medium bg-slate-200 text-slate-600">
                                          Pendente
                                        </span>
                                      )
                                    ) : null}
                                  </div>

                                  {selectedAlt ? (
                                    <div className="text-[11px] text-slate-700">
                                      <span className="text-slate-500">Opção marcada: </span>
                                      <strong>({sLetter}) {selectedAlt.text}</strong>
                                    </div>
                                  ) : ans?.text ? (
                                    <div className="text-[11px] text-slate-700">
                                      <span className="text-slate-500">Resposta: </span>
                                      <span>{ans.text}</span>
                                    </div>
                                  ) : (
                                    <div className="text-[11px] text-slate-400 italic">
                                      Não respondida
                                    </div>
                                  )}

                                  {q.scored && selectedAlt && !selectedAlt.isCorrect && correctAlt && (
                                    <div className="text-[10px] text-emerald-700 font-medium">
                                      Gabarito: ({cLetter}) {correctAlt.text}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Send by Email Interactive Modal */}
      <SendEmailReportModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        filteredUsers={filteredUsers}
        days={days}
        questions={questions}
        participations={participations}
        partMap={partMap}
        currentUserEmail="gestao.sesmt@honda.com.br"
      />
    </AdminShell>
  );
};
