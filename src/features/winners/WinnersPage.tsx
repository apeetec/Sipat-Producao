import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useAuth } from '../auth/AuthContext';
import { drawRepository, eventRepository, settingsRepository } from '../../services/repositories';
import { Draw, EventDay, AppSettings } from '../../types';
import { AppShell } from '../../components/layout/AppShell';
import { maskEmployeeNumber } from '../../utils/security';
import { formatDateToSaoPaulo } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { Trophy, Gift, Calendar, Sparkles, Medal, Award, Users } from 'lucide-react';

export const WinnersPage: React.FC = () => {
  const { user } = useAuth();
  const [draws, setDraws] = useState<Draw[]>([]);
  const [days, setDays] = useState<EventDay[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [allDraws, allDays, appSettings] = await Promise.all([
          drawRepository.listPublished(),
          eventRepository.list(),
          settingsRepository.getSettings(),
        ]);
        setDraws(allDraws);
        setDays(allDays);
        setSettings(appSettings);
      } catch (err) {
        console.error('Failed to load draws:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const triggerCelebration = () => {
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#028056', '#66bd39', '#f59e0b', '#764ba2'],
      });
    } catch (e) {}
  };

  // Filter draws
  const filteredDraws = draws.filter(d => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'full_week') return d.scope.type === 'full_week';
    if (d.scope.type === 'day') return d.scope.eventDayId === selectedFilter;
    return false;
  });

  const totalWinnersAwarded = draws.reduce((acc, d) => acc + d.actualWinnerCount, 0);

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Hero Section */}
        <div className="rounded-3xl bg-gradient-to-r from-[#014730] via-[#028056] to-[#015237] text-white p-6 sm:p-10 shadow-lg relative overflow-hidden">
          <div className="max-w-2xl relative z-10">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase bg-[#66bd39] text-[#014730] px-3 py-1 rounded-full mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>SIPAT HONDA • PREMIAÇÕES</span>
            </span>

            <h1 className="text-2xl sm:text-4xl font-extrabold font-display tracking-tight text-white">
              Galeria de Ganhadores & Sorteios
            </h1>

            <p className="text-xs sm:text-sm text-emerald-100/90 mt-2 leading-relaxed">
              Todos os colaboradores que completam os questionários diários e atingem <strong>100% de acertos nas questões avaliativas</strong> concorrem automaticamente aos brindes exclusivos da nossa SIPAT.
            </p>

            <div className="mt-6 flex items-center gap-3">
              <Button
                variant="action"
                size="md"
                onClick={triggerCelebration}
                icon={<Sparkles className="w-4 h-4" />}
                className="font-bold tracking-wide shadow-md"
              >
                Celebrar Ganhadores!
              </Button>
            </div>
          </div>

          {/* Metrics Badges */}
          <div className="mt-8 pt-6 border-t border-white/15 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur-xs p-4 rounded-2xl border border-white/10 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <span className="text-2xl font-extrabold text-white block font-mono">{draws.length}</span>
                <span className="text-[11px] text-emerald-200">Sorteios Realizados</span>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-xs p-4 rounded-2xl border border-white/10 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#66bd39]/20 text-[#66bd39] flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <span className="text-2xl font-extrabold text-white block font-mono">{totalWinnersAwarded}</span>
                <span className="text-[11px] text-emerald-200">Ganhadores Premiados</span>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-xs p-4 rounded-2xl border border-white/10 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-400/20 text-blue-300 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <span className="text-2xl font-extrabold text-white block font-mono">{days.length}</span>
                <span className="text-[11px] text-emerald-200">Dias de Palestra</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2 overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedFilter('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
              selectedFilter === 'all'
                ? 'bg-[#028056] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Todos os Prêmios ({draws.length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedFilter('full_week')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
              selectedFilter === 'full_week'
                ? 'bg-[#028056] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Semana Completa (Gabaritou Todos)
          </button>

          {days.map(d => (
            <button
              key={d.id}
              type="button"
              onClick={() => setSelectedFilter(d.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                selectedFilter === d.id
                  ? 'bg-[#028056] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {d.dateLabel} — {d.name}
            </button>
          ))}
        </div>

        {/* Draws Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-96 bg-white rounded-2xl border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : filteredDraws.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 shadow-xs">
            <Gift className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 font-display">Nenhum sorteio encontrado</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Os sorteios para este filtro ainda não foram realizados ou publicados pela comissão organizadora.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDraws.map(draw => {
              const dayObj = draw.scope.type === 'day' ? days.find(d => d.id === (draw.scope as { type: 'day'; eventDayId: string }).eventDayId) : null;
              const scopeLabel = dayObj ? `${dayObj.name} (${dayObj.dateLabel.split(' de ')[0]})` : 'Semana Completa (Todas as Datas)';

              return (
                <div
                  key={draw.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow"
                >
                  <div>
                    {/* Header Strip */}
                    <div className="bg-[#323f3c] text-white px-5 py-3 flex items-center justify-between text-xs">
                      <span className="font-semibold text-emerald-300">{scopeLabel}</span>
                      <span className="font-mono text-[11px] text-slate-300">
                        {draw.actualWinnerCount} ganhador{draw.actualWinnerCount !== 1 ? 'es' : ''}
                      </span>
                    </div>

                    {/* Prize Media Container */}
                    <div className="relative h-48 bg-slate-100 flex items-center justify-center overflow-hidden">
                      {draw.prizeImageUrl ? (
                        <img
                          src={draw.prizeImageUrl}
                          alt={draw.prizeName}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-emerald-100/60 to-amber-100/40 flex items-center justify-center">
                          <Gift className="w-16 h-16 text-[#028056]/60" />
                        </div>
                      )}

                      {/* Ribbon */}
                      <div className="absolute top-3 right-3 bg-amber-500 text-white font-extrabold text-[10px] tracking-wider uppercase px-2.5 py-1 rounded shadow-sm flex items-center gap-1">
                        <Award className="w-3 h-3" />
                        <span>PREMIADO</span>
                      </div>

                      {/* Group band */}
                      <div className="absolute bottom-0 inset-x-0 bg-black/70 backdrop-blur-xs px-4 py-1.5 text-white text-[11px] font-semibold flex items-center justify-between">
                        <span>GRUPO CONTEMPLADO:</span>
                        <span className="text-amber-300 font-bold">{draw.groupName}</span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-5">
                      <h3 className="text-lg font-bold font-display text-slate-900 leading-snug">
                        {draw.prizeName}
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Sorteio realizado em {formatDateToSaoPaulo(draw.createdAt, 'short')}
                      </p>

                      {/* Winners List */}
                      <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Colaboradores Contemplados:
                        </span>

                        {draw.winners.map(w => {
                          const medalIcons: Record<number, React.ReactNode> = {
                            1: <Medal className="w-4 h-4 text-amber-500 shrink-0" />,
                            2: <Medal className="w-4 h-4 text-slate-400 shrink-0" />,
                            3: <Medal className="w-4 h-4 text-amber-700 shrink-0" />,
                          };

                          const masked = maskEmployeeNumber(
                            w.employeeNumber,
                            settings?.maskEmployeeNumberInWinners ?? true
                          );

                          return (
                            <div
                              key={w.userId}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                {medalIcons[w.position] || (
                                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                                    {w.position}
                                  </span>
                                )}
                                <div>
                                  <span className="font-bold text-slate-800 block">{w.name}</span>
                                  <span className="text-[10px] text-slate-500">
                                    Matrícula: {masked} • {w.unitName}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Auditado por gerador criptográfico</span>
                    <span>Pool: {draw.eligibleCount} aptos</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
};
