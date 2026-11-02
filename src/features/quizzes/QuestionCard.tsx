import React from 'react';
import { Question } from '../../types';
import { RadioGroup } from '../../components/ui/RadioGroup';
import { TextField } from '../../components/ui/TextField';
import { HelpCircle, Star } from 'lucide-react';

export interface QuestionCardProps {
  index: number;
  question: Question;
  value: { alternativeId?: string; text?: string; rating?: number } | undefined;
  onChange: (val: { alternativeId?: string; text?: string; rating?: number }) => void;
  suggestionValue?: string;
  onSuggestionChange?: (text: string) => void;
  error?: string;
  disabled?: boolean;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  index,
  question,
  value,
  onChange,
  suggestionValue,
  onSuggestionChange,
  error,
  disabled = false,
}) => {
  return (
    <div
      className={`bg-white rounded-2xl border shadow-xs overflow-hidden transition-all ${
        error ? 'border-red-400 ring-1 ring-red-300' : 'border-slate-200'
      }`}
    >
      {/* Question Header */}
      <div className="bg-[#323f3c] text-white p-4 sm:p-5 flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0 font-mono text-xs font-bold text-[#66bd39]">
          Q{index + 1}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {question.scored ? (
              <span className="text-[10px] uppercase font-bold tracking-wider bg-[#028056] px-2 py-0.5 rounded-sm text-white">
                Avaliativa • Concorre a Sorteio
              </span>
            ) : (
              <span className="text-[10px] uppercase font-bold tracking-wider bg-slate-700 px-2 py-0.5 rounded-sm text-slate-200">
                Pesquisa de Opinião
              </span>
            )}
            {question.required && (
              <span className="text-[10px] text-amber-300 font-semibold">• Obrigatória</span>
            )}
          </div>
          <h4 className="text-sm sm:text-base font-bold font-display leading-snug">
            {question.title}
          </h4>
        </div>
      </div>

      {/* Question Body */}
      <div className="p-5 sm:p-6 space-y-4">
        {/* Single Choice */}
        {question.type === 'single_choice' && (
          <RadioGroup
            name={`question_${question.id}`}
            disabled={disabled}
            value={value?.alternativeId}
            onChange={altId => onChange({ ...value, alternativeId: altId })}
            options={question.alternatives.map(a => ({
              value: a.id,
              label: a.text,
            }))}
          />
        )}

        {/* Rating Question */}
        {question.type === 'rating' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {question.alternatives.map((alt, altIndex) => {
                const isSelected = value?.alternativeId === alt.id;
                return (
                  <button
                    key={alt.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange({
                      ...value,
                      alternativeId: alt.id,
                      rating: alt.ratingValue ?? altIndex + 1,
                    })}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 border-[#028056] text-[#015237] ring-1 ring-[#028056]'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Star className={`w-4 h-4 ${isSelected ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
                    <span>{alt.text}</span>
                  </button>
                );
              })}
            </div>

            {/* Optional suggestion prompt */}
            {question.suggestionPrompt && (
              <div className="pt-2">
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {question.suggestionPrompt}
                </label>
                <textarea
                  disabled={disabled}
                  rows={2}
                  value={suggestionValue || ''}
                  onChange={e => onSuggestionChange?.(e.target.value)}
                  placeholder="Escreva sua sugestão..."
                  className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#028056] text-slate-800 bg-white"
                />
              </div>
            )}
          </div>
        )}

        {/* Free Text */}
        {question.type === 'free_text' && (
          <div>
            <textarea
              disabled={disabled}
              rows={4}
              value={value?.text || ''}
              onChange={e => onChange({ ...value, text: e.target.value })}
              placeholder="Digite sua resposta ou considerações aqui..."
              className="w-full text-xs sm:text-sm p-3.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#028056] text-slate-800 bg-white leading-relaxed"
            />
          </div>
        )}

        {/* Inline error */}
        {error && (
          <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5 pt-1">
            <HelpCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </p>
        )}
      </div>
    </div>
  );
};
