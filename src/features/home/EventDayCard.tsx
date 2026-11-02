import React from 'react';
import { Link } from 'react-router-dom';
import { EventDay, Participation } from '../../types';
import { Calendar, CheckCircle2, Clock, PlayCircle, Lock, Film } from 'lucide-react';

export interface EventDayCardProps {
  day: EventDay;
  participation?: Participation | null;
  sessionNumber?: number;
}

export const EventDayCard: React.FC<EventDayCardProps> = ({ day, participation, sessionNumber = 1 }) => {
  const now = new Date().getTime();
  const opensAtTime = new Date(day.opensAt).getTime();
  const closesAtTime = new Date(day.closesAt).getTime();

  // Status calculation
  const isFuture = now < opensAtTime;
  const isClosed = now > closesAtTime;
  const isSubmitted = participation?.status === 'submitted';
  const isOpen = !isFuture && !isClosed;

  let badge = {
    label: 'Aberto',
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    icon: <PlayCircle className="w-3.5 h-3.5 text-[var(--brand-primary)]" />,
  };

  if (isSubmitted) {
    badge = {
      label: participation.perfectScore ? '100% Acertos' : 'Concluído',
      bg: participation.perfectScore
        ? 'bg-amber-50 text-amber-900 border-amber-300 font-bold'
        : 'bg-slate-100 text-slate-700 border-slate-200',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#28a745]" />,
    };
  } else if (isClosed) {
    badge = {
      label: 'Encerrado',
      bg: 'bg-slate-100 text-slate-600 border-slate-200',
      icon: <Clock className="w-3.5 h-3.5 text-slate-400" />,
    };
  } else if (isFuture) {
    badge = {
      label: 'Em Breve',
      bg: 'bg-slate-100 text-slate-500 border-slate-200',
      icon: <Lock className="w-3.5 h-3.5 text-slate-400" />,
    };
  }

  const coverImage = day.cardCoverImageUrl || day.bannerImageUrl;

  return (
    <Link
      to={`/dias/${day.slug}`}
      className={`group flex flex-col justify-between bg-white rounded-xl border transition-all duration-200 overflow-hidden shadow-xs hover:shadow-md hover:-translate-y-0.5 ${
        isSubmitted
          ? 'border-emerald-300 ring-1 ring-emerald-300/40'
          : isOpen
          ? 'border-slate-200 hover:border-[var(--brand-primary)]'
          : 'border-slate-200 opacity-85'
      }`}
    >
      <div>
        {/* Cover Art if present, else fallback header strip */}
        {coverImage ? (
          <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
            <img
              src={coverImage}
              alt={day.attraction || day.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex items-end justify-between p-3.5">
              <div className="flex items-center gap-1.5 text-white">
                <Calendar className="w-3.5 h-3.5 text-[#66bd39]" />
                <span className="font-bold text-xs sm:text-sm tracking-tight drop-shadow-xs">{day.name}</span>
              </div>
              <span className="text-[10px] text-emerald-300 font-bold bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-xs">
                Sessão {String(sessionNumber).padStart(2, '0')}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-[#323f3c] text-white p-4 group-hover:bg-[#015237] transition-colors flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#66bd39]" />
              <span className="font-bold text-sm tracking-tight">{day.name}</span>
            </div>
            <span className="text-[11px] text-emerald-200 font-medium">
              Sessão {String(sessionNumber).padStart(2, '0')}
            </span>
          </div>
        )}

        {/* Body */}
        <div className="p-4 sm:p-5 flex flex-col gap-3">
          {/* Status & Date */}
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badge.bg}`}
            >
              {badge.icon}
              <span>{badge.label}</span>
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              {day.dateLabel.split(' de ')[0]}
            </span>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-[var(--brand-primary)] transition-colors leading-snug font-display line-clamp-2">
              {day.attraction || day.theme}
            </h3>
            {day.theme && day.attraction && (
              <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                {day.theme}
              </p>
            )}
          </div>

          {/* Video Attachment Pill if video is attached */}
          {(day.videoAttachmentName || day.videoType === 'attachment') && (
            <div className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md self-start font-medium">
              <Film className="w-3 h-3 text-emerald-600" />
              <span>Vídeo Exclusivo Gravado</span>
            </div>
          )}

          {/* Speakers */}
          {day.speakers && day.speakers.length > 0 && (
            <div className="pt-3 border-t border-slate-100 mt-auto">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                Palestrante{day.speakers.length > 1 ? 's' : ''}:
              </span>
              <p className="text-xs font-semibold text-slate-700 truncate">
                {day.speakers.map(s => s.name).join(' e ')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Card Action Footer */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[var(--brand-primary)] group-hover:text-[var(--brand-primary-dark)]">
        <span>{isSubmitted ? 'Ver Participação & Gabarito' : 'Acessar Sessão'}</span>
        <span className="transition-transform group-hover:translate-x-1">→</span>
      </div>
    </Link>
  );
};
