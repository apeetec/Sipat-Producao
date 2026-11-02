import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { eventRepository, participationRepository } from '../../services/repositories';
import { EventDay, Participation } from '../../types';
import { EventDayCard } from './EventDayCard';
import { AppShell } from '../../components/layout/AppShell';
import { Trophy, CheckCircle, Calendar, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { groupSessionsByDate } from '../../utils/event-sessions';

export const HomePage: React.FC = () => {
  const { user } = useAuth();
  const [days, setDays] = useState<EventDay[]>([]);
  const [participations, setParticipations] = useState<Record<string, Participation>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const eventDays = await eventRepository.list();
        setDays(eventDays);

        if (user) {
          const userParts = await participationRepository.listByUser(user.id);
          const map: Record<string, Participation> = {};
          userParts.forEach(p => {
            map[p.eventDayId] = p;
          });
          setParticipations(map);
        }
      } catch (err) {
        console.error('Error loading home data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  const dateGroups = useMemo(() => groupSessionsByDate(days), [days]);
  const completedCount = days.filter(day => participations[day.id]?.status === 'submitted').length;
  const perfectCount = days.filter(day => participations[day.id]?.status === 'submitted' && participations[day.id]?.perfectScore).length;
  const eligibleSessions = days.filter(day => day.active && day.countsForFullWeek);
  const completedFullProgram = eligibleSessions.length > 0 && eligibleSessions.every(
    day => participations[day.id]?.status === 'submitted' && participations[day.id]?.perfectScore,
  );

  return (
    <AppShell>
      {/* Colaborador Progress Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-7 mb-8">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#028056] bg-emerald-50 px-2 py-0.5 rounded-sm">
                Painel do Colaborador
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-500 font-medium">Matrícula: {user?.employeeNumber}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-display text-slate-900">
              Bem-vindo(a), {user?.firstName || user?.displayName}!
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl leading-relaxed">
              Assista às palestras ou valide sua presença presencial para responder aos questionários. Acerte 100% das questões avaliativas para concorrer aos prêmios oficiais da SIPAT Honda!
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 sm:gap-4 w-full lg:w-auto">
            <div className="flex-1 lg:flex-initial p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3 min-w-[140px]">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-[#028056] flex items-center justify-center shrink-0">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-lg font-extrabold text-slate-900 block leading-tight">
                  {completedCount} / {days.length}
                </span>
                <span className="text-[11px] text-slate-500">Sessões Respondidas</span>
              </div>
            </div>

            <div className="flex-1 lg:flex-initial p-3.5 sm:p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center gap-3 min-w-[140px]">
              <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <span className="text-lg font-extrabold text-amber-900 block leading-tight">
                  {perfectCount}
                </span>
                <span className="text-[11px] text-amber-800 font-medium">Gabaritados (100%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Motivation strip */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              {completedFullProgram ? (
                <strong className="text-emerald-700">Parabéns! Você gabaritou todas as sessões elegíveis e está concorrendo ao Grande Prêmio da Semana Completa!</strong>
              ) : (
                <span>Complete todas as sessões para maximizar suas chances nos sorteios diários e da semana.</span>
              )}
            </span>
          </div>

          <Link
            to="/ganhadores"
            className="font-bold text-[#028056] hover:text-[#015237] hover:underline"
          >
            Ver Galeria de Sorteados →
          </Link>
        </div>
      </div>

      {/* Sessions are grouped by their calendar date; any date may contain several sessions. */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#028056]" />
            <h3 className="text-lg font-bold font-display text-slate-900">Programação Semanal SIPAT</h3>
          </div>
          <span className="text-xs text-slate-500">Horário Oficial de Brasília (America/Sao_Paulo)</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-64 bg-white rounded-2xl animate-pulse border border-slate-200/80" />
            ))}
          </div>
        ) : dateGroups.length > 0 ? (
          <div className="space-y-7">
            {dateGroups.map(group => (
              <section key={group.key} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <div>
                    <h4 className="font-bold text-slate-900">{group.weekdayLabel}</h4>
                    <p className="text-xs text-slate-500">{group.dateLabel}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                    {group.sessions.length} {group.sessions.length === 1 ? 'sessão' : 'sessões'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {group.sessions.map((day, index) => (
                    <EventDayCard
                      key={day.id}
                      day={day}
                      sessionNumber={index + 1}
                      participation={participations[day.id]}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            Nenhuma sessão está disponível na programação.
          </div>
        )}
      </div>
    </AppShell>
  );
};
