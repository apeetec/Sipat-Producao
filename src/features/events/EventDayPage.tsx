import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { settingsRepository } from '../../services/repositories';
import { backendService } from '../../services/api/backend-service';
import { EventDay, Question, Participation, AppSettings } from '../../types';
import { AppShell } from '../../components/layout/AppShell';
import { ReleaseNotice } from './ReleaseNotice';
import { AttendanceChoice } from './AttendanceChoice';
import { AttendanceCodeForm } from './AttendanceCodeForm';
import { VideoPlayer } from './VideoPlayer';
import { QuestionCard } from '../quizzes/QuestionCard';
import { QuizResult } from '../quizzes/QuizResult';
import { ReadOnlyAnswerReview } from '../quizzes/ReadOnlyAnswerReview';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { toast } from '../../components/feedback/ToastContainer';
import {
  Calendar,
  ArrowLeft,
  Lock,
  CheckCircle2,
  Users,
  Send,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export const EventDayPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [day, setDay] = useState<EventDay | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [participation, setParticipation] = useState<Participation | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const [selectedModalityTab, setSelectedModalityTab] = useState<'video' | 'in_person'>('video');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showReviewMode, setShowReviewMode] = useState(false);
  const quizIdempotencyKeyRef = useRef<string | null>(null);

  // Form answers state
  const [answers, setAnswers] = useState<Record<string, { alternativeId?: string; text?: string; rating?: number }>>({});
  const [suggestions, setSuggestions] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadSession = async () => {
      if (!slug || !user) return;
      try {
        setLoading(true);
        const [data, appSettings] = await Promise.all([
          backendService.getParticipantEventBySlug(user.id, slug),
          settingsRepository.getSettings(),
        ]);
        if (!data) {
          navigate('/', { replace: true });
          return;
        }
        const eventDay = data.eventDay;
        setDay(eventDay);
        setSettings(appSettings);
        setParticipation(data.participation);
        setIsUnlocked(data.isUnlocked);

        // If user already validated in_person, select in_person tab
        if (data.participation?.modality === 'in_person') {
          setSelectedModalityTab('in_person');
        }

        // Questions: if already submitted, get questions with answer keys for review if permitted
        setQuestions((data.questions as Question[]).filter(q => q.active));

        // Restore draft answers from localStorage if in progress
        const draftKey = `draft_quiz_${user.id}_${eventDay.id}`;
        const draft = localStorage.getItem(draftKey);
        if (draft && data.participation?.status !== 'submitted') {
          try {
            const parsed = JSON.parse(draft);
            setAnswers(parsed.answers || {});
            setSuggestions(parsed.suggestions || {});
          } catch (e) {}
        }
      } catch (err) {
        console.error('Failed to load session:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [slug, user, navigate]);

  // Save answers to draft
  const handleAnswerChange = (qId: string, val: { alternativeId?: string; text?: string; rating?: number }) => {
    const nextAnswers = { ...answers, [qId]: val };
    setAnswers(nextAnswers);

    // Clear inline error for this question
    if (validationErrors[qId]) {
      const nextErrors = { ...validationErrors };
      delete nextErrors[qId];
      setValidationErrors(nextErrors);
    }

    if (user && day) {
      localStorage.setItem(
        `draft_quiz_${user.id}_${day.id}`,
        JSON.stringify({ answers: nextAnswers, suggestions })
      );
    }
  };

  const handleSuggestionChange = (qId: string, text: string) => {
    const nextSuggestions = { ...suggestions, [qId]: text };
    setSuggestions(nextSuggestions);

    if (user && day) {
      localStorage.setItem(
        `draft_quiz_${user.id}_${day.id}`,
        JSON.stringify({ answers, suggestions: nextSuggestions })
      );
    }
  };

  const handleAttendanceCodeValidate = async (code: string) => {
    if (!user || !day) return { valid: false, message: 'Usuário não autenticado' };
    const res = await backendService.validateAttendanceCode(user.id, day.id, code);
    if (res.valid) {
      setIsUnlocked(true);
      setSelectedModalityTab('in_person');
      const freshPart = await backendService.getParticipantEvent(user.id, day.id);
      setParticipation(freshPart.participation);
      toast.success('Presença presencial registrada! Questionário liberado.');
    }
    return res;
  };

  const handleVideoProgressUpdate = async (current: number, duration: number, clientEventId: string) => {
    if (!user || !day) return { videoProgressPercent: 0, questionnaireUnlocked: false };
    const res = await backendService.reportVideoProgress(user.id, day.id, current, duration, clientEventId);
    if (res.questionnaireUnlocked && !isUnlocked) {
      setIsUnlocked(true);
      toast.success('Vídeo concluído! O questionário está liberado abaixo.');
    }
    return res;
  };

  const handleSubmitQuiz = async () => {
    if (!user || !day) return;

    // Validate required questions
    const errors: Record<string, string> = {};
    questions.forEach(q => {
      if (q.required) {
        const a = answers[q.id];
        if (!a) {
          errors[q.id] = 'Esta pergunta é obrigatória.';
        } else if (q.type === 'single_choice' && !a.alternativeId) {
          errors[q.id] = 'Selecione uma das alternativas.';
        } else if (q.type === 'rating' && !a.alternativeId) {
          errors[q.id] = 'Selecione sua avaliação.';
        }
      }
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setSubmitError('Por favor, responda a todas as perguntas obrigatórias antes de enviar.');
      // Scroll to first error
      window.scrollTo({ top: 600, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      quizIdempotencyKeyRef.current ??= crypto.randomUUID();
      const res = await backendService.submitQuiz({
        userId: user.id,
        eventDayId: day.id,
        answers,
        suggestions,
        idempotencyKey: quizIdempotencyKeyRef.current,
      });

      if (res.success && res.data) {
        // Clear draft
        localStorage.removeItem(`draft_quiz_${user.id}_${day.id}`);
        quizIdempotencyKeyRef.current = null;

        // Update local participation state
        const updatedPart = await backendService.getParticipantEvent(user.id, day.id);
        setParticipation(updatedPart.participation);

        // Fetch questions with keys for review
        setQuestions((updatedPart.questions as Question[]).filter(q => q.active));

        toast.success('Respostas enviadas com sucesso!');
      } else {
        setSubmitError(res.message || 'Erro ao processar questionário.');
      }
    } catch (err) {
      const requestError = err as { status?: number; code?: string; message?: string };
      if (requestError.status === 409 && requestError.code === 'ALREADY_SUBMITTED') {
        const updatedPart = await backendService.getParticipantEvent(user.id, day.id);
        setParticipation(updatedPart.participation);
        setQuestions((updatedPart.questions as Question[]).filter(q => q.active));
        localStorage.removeItem(`draft_quiz_${user.id}_${day.id}`);
        quizIdempotencyKeyRef.current = null;
        toast.success('O servidor confirmou que suas respostas já foram recebidas.');
      } else {
        // Rede, 429 e 5xx preservam a chave: o próximo clique repete a mesma
        // operação de forma segura. Erros definitivos permitem um novo payload.
        if (requestError.status && requestError.status < 500 && requestError.status !== 429) {
          quizIdempotencyKeyRef.current = null;
        }
        setSubmitError(requestError.message || 'Erro ao comunicar com o servidor. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !day) {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
          <div className="h-64 bg-slate-200 rounded-2xl animate-pulse" />
        </div>
      </AppShell>
    );
  }

  const now = new Date().getTime();
  const opensAtTime = new Date(day.opensAt).getTime();
  const closesAtTime = new Date(day.closesAt).getTime();
  const isFuture = now < opensAtTime;
  const isClosed = now > closesAtTime;
  const isSubmitted = participation?.status === 'submitted';

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back navigation */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#028056] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para todas as palestras</span>
        </Link>

        {/* 1. Card de Data & Nome */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="bg-[#323f3c] text-white p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <Calendar className="w-6 h-6 text-[#66bd39]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold tracking-widest uppercase bg-[#66bd39] text-[#014730] px-2 py-0.5 rounded-sm">
                    Sessão
                  </span>
                  <span className="text-xs text-slate-300">{day.dateLabel}</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold font-display text-white mt-0.5">
                  {day.name}: {day.attraction}
                </h1>
              </div>
            </div>

            {/* Status Pill */}
            {isSubmitted ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-[#66bd39] border border-emerald-500/30 text-xs font-bold shrink-0">
                <CheckCircle2 className="w-4 h-4" />
                <span>Questionário Enviado</span>
              </div>
            ) : isClosed ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-xs font-bold shrink-0">
                <Lock className="w-4 h-4" />
                <span>Sessão Encerrada</span>
              </div>
            ) : isFuture ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold shrink-0">
                <Lock className="w-4 h-4" />
                <span>Abertura em Breve</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#028056]/30 text-emerald-200 border border-[#028056] text-xs font-bold shrink-0">
                <span className="w-2 h-2 rounded-full bg-[#66bd39]" />
                <span>Sessão Aberta</span>
              </div>
            )}
          </div>

          {/* Theme & Speakers info */}
          <div className="p-5 sm:p-6 bg-slate-50/70 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Tema Central da Palestra
              </span>
              <p className="text-sm font-semibold text-slate-800">{day.theme || 'Palestra Oficial da SIPAT'}</p>
            </div>

            {day.speakers && day.speakers.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-slate-700 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs">
                <Users className="w-4 h-4 text-[#028056]" />
                <span>
                  <strong>Palestrante{day.speakers.length > 1 ? 's' : ''}:</strong>{' '}
                  {day.speakers.map(s => s.name).join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Se ainda não abriu: Notícia de Liberação */}
        {isFuture && <ReleaseNotice opensAt={day.opensAt} />}

        {/* 3. Se já enviou: Banner de Agradecimento e Elegibilidade */}
        {isSubmitted && participation && (
          <QuizResult
            correctCount={participation.correctCount || 0}
            scoredQuestionCount={participation.scoredQuestionCount || 0}
            percentage={participation.percentage || 0}
            perfectScore={participation.perfectScore}
            onReviewAnswers={() => setShowReviewMode(prev => !prev)}
          />
        )}

        {/* 4. Se aberto e não enviado: Banner de incentivo */}
        {!isFuture && !isSubmitted && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between gap-4 text-xs text-[#015237]">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-[#028056] shrink-0" />
              <span>
                Você ainda <strong>não está concorrendo aos sorteios deste dia</strong>. Assista à palestra ou informe seu código presencial para desbloquear e responder ao questionário avaliativo!
              </span>
            </div>
          </div>
        )}

        {/* 5. Modality Choice & Video / Presença (se não for futuro) */}
        {!isFuture && !isSubmitted && (
          <>
            <AttendanceChoice
              selectedTab={selectedModalityTab}
              onSelectTab={setSelectedModalityTab}
              isValidatedInPerson={participation?.modality === 'in_person'}
              isVideoCompleted={Boolean(participation?.videoProgressPercent && participation.videoProgressPercent >= 99)}
            />

            {selectedModalityTab === 'in_person' ? (
              <AttendanceCodeForm
                daySortOrder={day.sortOrder}
                isValidated={participation?.modality === 'in_person'}
                onValidate={handleAttendanceCodeValidate}
              />
            ) : (
              <VideoPlayer
                videoUrl={day.videoUrl || ''}
                initialProgressPercent={participation?.videoProgressPercent || 0}
                onProgressUpdate={handleVideoProgressUpdate}
                isUnlocked={isUnlocked}
              />
            )}
          </>
        )}

        {/* 6. Questionário Avaliativo */}
        {!isFuture && !isSubmitted && (
          <div className="space-y-6 pt-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-[#028056]" />
                <h3 className="text-lg font-bold font-display text-slate-900">
                  Questionário Oficial da Sessão
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                {questions.length} pergunta{questions.length !== 1 ? 's' : ''} ({questions.filter(q => q.scored).length} avaliativa{questions.filter(q => q.scored).length !== 1 ? 's' : ''})
              </span>
            </div>

            {!isUnlocked ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 shadow-xs">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <Lock className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-slate-800 font-display">Questionário Bloqueado</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                  Para liberar as perguntas, você precisa <strong>validar seu código de presença presencial</strong> acima ou <strong>assistir ao vídeo da palestra até 99%</strong>.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {submitError && (
                  <Alert variant="danger" title="Atenção">
                    {submitError}
                  </Alert>
                )}

                {questions.map((question, idx) => (
                  <QuestionCard
                    key={question.id}
                    index={idx}
                    question={question}
                    value={answers[question.id]}
                    onChange={val => handleAnswerChange(question.id, val)}
                    suggestionValue={suggestions[question.id]}
                    onSuggestionChange={txt => handleSuggestionChange(question.id, txt)}
                    error={validationErrors[question.id]}
                  />
                ))}

                {/* Submit button */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-slate-500">
                    <p className="font-semibold text-slate-800">Atenção ao envio:</p>
                    <p>As respostas são finais e não poderão ser alteradas após o envio.</p>
                  </div>

                  <Button
                    variant="action"
                    size="lg"
                    loading={submitting}
                    onClick={handleSubmitQuiz}
                    icon={<Send className="w-4 h-4" />}
                    className="w-full sm:w-auto font-bold tracking-wider px-8"
                  >
                    ENVIAR MINHAS RESPOSTAS
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Read-Only Review Mode if submitted and user toggled review */}
        {isSubmitted && participation && showReviewMode && (
          <div className="pt-4">
            <h4 className="text-base font-bold font-display text-slate-900 mb-4">
              Revisão de Respostas Enviadas
            </h4>
            <ReadOnlyAnswerReview
              questions={questions}
              participation={participation}
              showCorrectAnswers={Boolean(settings?.showCorrectAnswersAfterSubmit)}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
};
