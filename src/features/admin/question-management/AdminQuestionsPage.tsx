import React, { useState, useEffect } from 'react';
import { questionRepository, eventRepository } from '../../../services/repositories';
import { Question, EventDay, QuestionType, Alternative } from '../../../types';
import { AdminShell } from '../../../components/layout/AdminShell';
import { Button } from '../../../components/ui/Button';
import { TextField } from '../../../components/ui/TextField';
import { Select } from '../../../components/ui/Select';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Modal } from '../../../components/ui/Modal';
import { Alert } from '../../../components/ui/Alert';
import { Table } from '../../../components/ui/table';
import { toast } from '../../../components/feedback/ToastContainer';
import {
  HelpCircle,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  MoveUp,
  MoveDown,
  Layers,
} from 'lucide-react';

export const AdminQuestionsPage: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [days, setDays] = useState<EventDay[]>([]);
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [selectedScoredFilter, setSelectedScoredFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Edit / Create Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // Form fields
  const [eventDayId, setEventDayId] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<QuestionType>('single_choice');
  const [required, setRequired] = useState(true);
  const [scored, setScored] = useState(true);
  const [active, setActive] = useState(true);
  const [suggestionPrompt, setSuggestionPrompt] = useState('');
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [modalError, setModalError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [allQ, allD] = await Promise.all([
        questionRepository.listAll(),
        eventRepository.list(),
      ]);
      setQuestions(allQ);
      setDays(allD);
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
    setEditingQuestion(null);
    setEventDayId(days[0]?.id || 'day-1');
    setTitle('');
    setType('single_choice');
    setRequired(true);
    setScored(true);
    setActive(true);
    setSuggestionPrompt('');
    setAlternatives([
      { id: `alt-${Date.now()}-1`, text: '', isCorrect: true },
      { id: `alt-${Date.now()}-2`, text: '', isCorrect: false },
    ]);
    setModalError('');
    setIsModalOpen(true);
  };

  const openEditModal = (q: Question) => {
    setEditingQuestion(q);
    setEventDayId(q.eventDayId);
    setTitle(q.title);
    setType(q.type);
    setRequired(q.required);
    setScored(q.scored);
    setActive(q.active);
    setSuggestionPrompt(q.suggestionPrompt || '');
    setAlternatives(q.alternatives || []);
    setModalError('');
    setIsModalOpen(true);
  };

  const handleAddAlternative = () => {
    setAlternatives(prev => [
      ...prev,
      { id: `alt-${Date.now()}-${prev.length + 1}`, text: '', isCorrect: false },
    ]);
  };

  const handleRemoveAlternative = (id: string) => {
    if (alternatives.length <= 2 && type === 'single_choice') {
      toast.error('Questões de múltipla escolha necessitam de pelo menos 2 alternativas.');
      return;
    }
    setAlternatives(prev => prev.filter(a => a.id !== id));
  };

  const handleSetCorrectAlternative = (id: string) => {
    setAlternatives(prev =>
      prev.map(a => ({
        ...a,
        isCorrect: a.id === id,
      }))
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setModalError('O enunciado da pergunta é obrigatório.');
      return;
    }

    if (type === 'single_choice') {
      if (alternatives.length < 2) {
        setModalError('Adicione pelo menos 2 alternativas.');
        return;
      }
      if (alternatives.some(a => !a.text.trim())) {
        setModalError('Todas as alternativas devem ter um texto preenchido.');
        return;
      }
      if (scored) {
        const correctCount = alternatives.filter(a => a.isCorrect).length;
        if (correctCount !== 1) {
          setModalError('Em questões avaliativas (scored=true), exatamente UMA alternativa deve ser marcada como correta.');
          return;
        }
      }
    }

    try {
      if (editingQuestion) {
        await questionRepository.update(editingQuestion.id, {
          eventDayId,
          title: title.trim(),
          type,
          required,
          scored,
          active,
          suggestionPrompt: suggestionPrompt.trim() || undefined,
          alternatives: type === 'single_choice' || type === 'rating' ? alternatives : [],
        });
        toast.success('Pergunta atualizada com sucesso!');
      } else {
        await questionRepository.create({
          eventDayId,
          title: title.trim(),
          type,
          required,
          scored,
          active,
          suggestionPrompt: suggestionPrompt.trim() || undefined,
          alternatives: type === 'single_choice' || type === 'rating' ? alternatives : [],
          sortOrder: questions.length + 1,
        });
        toast.success('Nova pergunta adicionada com sucesso!');
      }

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setModalError(err.message || 'Erro ao salvar pergunta.');
    }
  };

  const handleDelete = async (q: Question) => {
    const confirm = window.confirm(`Deseja realmente excluir a pergunta "${q.title}"?`);
    if (!confirm) return;
    await questionRepository.delete(q.id);
    toast.info('Pergunta excluída.');
    loadData();
  };

  // Duplicate detection
  const duplicateAlerts: Array<{ title: string; count: number }> = [];
  const titleCounts: Record<string, number> = {};
  questions.forEach(q => {
    const norm = q.title.trim().toLowerCase();
    titleCounts[norm] = (titleCounts[norm] || 0) + 1;
  });
  Object.entries(titleCounts).forEach(([titleStr, cnt]) => {
    if (cnt > 1) duplicateAlerts.push({ title: titleStr, count: cnt });
  });

  const filteredQuestions = questions.filter(q => {
    if (selectedDayFilter !== 'all' && q.eventDayId !== selectedDayFilter) return false;
    if (selectedTypeFilter !== 'all' && q.type !== selectedTypeFilter) return false;
    if (selectedScoredFilter === 'scored' && !q.scored) return false;
    if (selectedScoredFilter === 'unscored' && q.scored) return false;
    return true;
  });

  return (
    <AdminShell
      title="Gestão de Perguntas & Gabarito"
      subtitle="Edite o banco de questões, alternativas, respostas corretas e pesquisas de opinião"
      actions={
        <Button variant="action" size="md" onClick={openCreateModal} icon={<Plus className="w-4 h-4" />}>
          Nova Pergunta
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Duplicate detection warning */}
        {duplicateAlerts.length > 0 && (
          <Alert variant="warning" title="Possíveis Perguntas Duplicadas Identificadas">
            <p>
              O sistema detectou {duplicateAlerts.length} pergunta(s) com enunciados idênticos. A exclusão automática não foi executada para preservar os dados, mas recomenda-se a revisão:
            </p>
            <ul className="list-disc pl-5 mt-1 space-y-0.5 text-xs">
              {duplicateAlerts.map(d => (
                <li key={d.title}>
                  <em>"{d.title}"</em> — {d.count} ocorrências no banco de dados.
                </li>
              ))}
            </ul>
          </Alert>
        )}

        {/* Filter bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-3">
          <div className="w-full sm:w-48">
            <Select
              options={[
                { value: 'all', label: 'Todos os Dias' },
                ...days.map(d => ({ value: d.id, label: `${d.dateLabel} — ${d.name} (/${d.slug})` })),
              ]}
              value={selectedDayFilter}
              onChange={e => setSelectedDayFilter(e.target.value)}
            />
          </div>

          <div className="w-full sm:w-44">
            <Select
              options={[
                { value: 'all', label: 'Todos os Tipos' },
                { value: 'single_choice', label: 'Múltipla Escolha' },
                { value: 'rating', label: 'Avaliação / Rating' },
                { value: 'free_text', label: 'Texto Livre' },
              ]}
              value={selectedTypeFilter}
              onChange={e => setSelectedTypeFilter(e.target.value)}
            />
          </div>

          <div className="w-full sm:w-44">
            <Select
              options={[
                { value: 'all', label: 'Todas as Finalidades' },
                { value: 'scored', label: 'Apenas Avaliativas' },
                { value: 'unscored', label: 'Apenas Pesquisa' },
              ]}
              value={selectedScoredFilter}
              onChange={e => setSelectedScoredFilter(e.target.value)}
            />
          </div>

          <span className="w-full text-xs text-slate-500 sm:ml-auto sm:w-auto">
            {filteredQuestions.length} de {questions.length} perguntas
          </span>
        </div>

        {/* Questions Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <Table className="min-w-[1000px] text-left text-xs text-slate-700">
            <thead className="bg-[#323f3c] text-white uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Dia</th>
                <th className="py-3 px-4">Enunciado da Pergunta</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Critério</th>
                <th className="py-3 px-4">Gabarito Definido?</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQuestions.map(q => {
                const day = days.find(d => d.id === q.eventDayId);
                const hasCorrect = q.alternatives.some(a => a.isCorrect);

                return (
                  <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {day?.name || q.eventDayId}
                    </td>
                    <td className="py-3.5 px-4 max-w-md">
                      <span className="font-bold text-slate-800 block">{q.title}</span>
                      {q.suggestionPrompt && (
                        <span className="text-[10px] text-slate-400 italic block mt-0.5">
                          Prompt: {q.suggestionPrompt}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px]">
                      {q.type === 'single_choice' && 'Múltipla Escolha'}
                      {q.type === 'rating' && 'Escala / Rating'}
                      {q.type === 'free_text' && 'Texto Livre'}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {q.scored ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-[#015237]">
                          Avaliativa
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                          Pesquisa
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {q.scored && q.type === 'single_choice' ? (
                        hasCorrect ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#28a745]" />
                            <span>1 Correta</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Sem Gabarito!</span>
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400 text-[11px]">N/A (Pesquisa)</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {q.active ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Ativa
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          Rascunho
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => openEditModal(q)}>
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(q)} className="text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      </div>

      {/* Edit / Create Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingQuestion ? 'Editar Pergunta' : 'Criar Nova Pergunta'}
        maxWidth="lg"
      >
        {modalError && (
          <div className="mb-4">
            <Alert variant="danger">{modalError}</Alert>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Dia / Sessão Vinculada"
              options={days.map(d => ({ value: d.id, label: `${d.name} (${d.dateLabel.split(' de ')[0]})` }))}
              value={eventDayId}
              onChange={e => setEventDayId(e.target.value)}
              required
            />
            <Select
              label="Tipo de Questão"
              options={[
                { value: 'single_choice', label: 'Múltipla Escolha (1 alternativa correta)' },
                { value: 'rating', label: 'Avaliação / Escala de Satisfação' },
                { value: 'free_text', label: 'Texto Livre (Opinião / Feedback)' },
              ]}
              value={type}
              onChange={e => {
                const newT = e.target.value as QuestionType;
                setType(newT);
                if (newT !== 'single_choice') {
                  setScored(false); // Non single_choice is non-scored by default
                }
              }}
            />
          </div>

          <TextField
            label="Enunciado da Pergunta"
            placeholder="Ex.: Qual foi o principal tema abordado por Emanuel Curi?"
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
          />

          {type === 'rating' && (
            <TextField
              label="Prompt para sugestão opcional (exibido abaixo da avaliação)"
              placeholder="Ex.: Deixe um comentário opcional com sugestões de melhoria:"
              value={suggestionPrompt}
              onChange={e => setSuggestionPrompt(e.target.value)}
            />
          )}

          <div className="flex items-center gap-6 py-2">
            <Checkbox
              checked={required}
              onChange={e => setRequired(e.target.checked)}
              label="Resposta Obrigatória"
            />
            <Checkbox
              checked={scored}
              disabled={type !== 'single_choice'}
              onChange={e => setScored(e.target.checked)}
              label="Avaliativa (entra no cálculo da nota 100% para concorrer a brindes)"
            />
            <Checkbox
              checked={active}
              onChange={e => setActive(e.target.checked)}
              label="Pergunta Ativa e Publicada"
            />
          </div>

          {/* Alternatives Editor (if single_choice or rating) */}
          {(type === 'single_choice' || type === 'rating') && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 block text-xs">
                    Alternativas de Resposta
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {scored
                      ? 'Marque o botão de rádio na alternativa que corresponde à resposta correta.'
                      : 'Adicione as opções de pesquisa disponíveis para o participante.'}
                  </span>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleAddAlternative}>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Opção</span>
                </Button>
              </div>

              <div className="space-y-2">
                {alternatives.map((alt, idx) => (
                  <div key={alt.id} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
                    {scored && type === 'single_choice' && (
                      <input
                        type="radio"
                        name="correctAlternativeGroup"
                        checked={Boolean(alt.isCorrect)}
                        onChange={() => handleSetCorrectAlternative(alt.id)}
                        className="text-[#028056] focus:ring-[#028056] cursor-pointer"
                        title="Marcar como alternativa correta"
                      />
                    )}
                    <span className="w-5 text-center text-slate-400 font-mono text-[11px]">
                      {String.fromCharCode(65 + idx)})
                    </span>
                    <input
                      type="text"
                      value={alt.text}
                      onChange={e => {
                        const next = [...alternatives];
                        next[idx].text = e.target.value;
                        setAlternatives(next);
                      }}
                      placeholder={`Texto da alternativa ${String.fromCharCode(65 + idx)}`}
                      className="flex-1 text-xs border-0 focus:outline-none text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveAlternative(alt.id)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                      title="Remover alternativa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="action" size="md">
              Salvar Pergunta
            </Button>
          </div>
        </form>
      </Modal>
    </AdminShell>
  );
};
