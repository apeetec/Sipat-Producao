import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  className = '',
}) => {
  if (totalPages <= 1) return null;

  return (
    <div className={`flex flex-col items-center justify-between gap-3 py-3 text-center text-xs text-slate-600 sm:flex-row sm:text-left ${className}`}>
      {totalItems !== undefined && pageSize !== undefined ? (
        <span>
          Mostrando {Math.min((currentPage - 1) * pageSize + 1, totalItems)} a{' '}
          {Math.min(currentPage * pageSize, totalItems)} de {totalItems} registros
        </span>
      ) : (
        <span>
          Página {currentPage} de {totalPages}
        </span>
      )}

      <div className="flex w-full items-center justify-center gap-1 sm:w-auto">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
          aria-label="Página anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-semibold text-slate-800">
          {currentPage}
        </span>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
          aria-label="Próxima página"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
