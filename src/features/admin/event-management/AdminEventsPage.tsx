import React, { useState, useEffect, useRef } from 'react';
import { eventDateRepository, eventRepository, unitRepository, participationRepository } from '../../../services/repositories';
import { EventDate, EventDay, Unit } from '../../../types';
import { AdminShell } from '../../../components/layout/AdminShell';
import { Button } from '../../../components/ui/Button';
import { TextField } from '../../../components/ui/TextField';
import { Select } from '../../../components/ui/Select';
import { Modal } from '../../../components/ui/Modal';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Table } from '../../../components/ui/table';
import { DateTimePicker } from '../../../components/ui/date-time-picker';
import { ConfirmDialog } from '../../../components/ui/alert-dialog';
import { toast } from '../../../components/feedback/ToastContainer';
import { sha256Hex } from '../../../utils/security';
import { isNodeBackendEnabled, NodeUploadsApi } from '../../../services/api/node-backend-client';
import { formatDateToSaoPaulo } from '../../../utils/formatters';
import { fromZonedTime } from 'date-fns-tz';
import {
  makeUniqueSessionSlug,
  slugifySessionName,
  toDateTimeLocalValue,
} from '../../../utils/event-sessions';
import {
  Calendar,
  Plus,
  Edit2,
  Video,
  KeyRound,
  Archive,
  Image as ImageIcon,
  Upload,
  Play,
  Trash2,
  Film,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

export const AdminEventsPage: React.FC = () => {
  const [days, setDays] = useState<EventDay[]>([]);
  const [eventDates, setEventDates] = useState<EventDate[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit/create modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDay, setEditingDay] = useState<EventDay | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [dateLabel, setDateLabel] = useState('');
  const [eventDateId, setEventDateId] = useState('');
  const [attraction, setAttraction] = useState('');
  const [theme, setTheme] = useState('');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  
  // Video fields (URL vs Attachment)
  const [videoSourceType, setVideoSourceType] = useState<'url' | 'attachment'>('url');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoAttachmentName, setVideoAttachmentName] = useState('');
  const [videoAttachmentDataUrl, setVideoAttachmentDataUrl] = useState('');
  const [videoAttachmentSize, setVideoAttachmentSize] = useState<number | undefined>(undefined);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  // Card Cover Art fields
  const [coverArtSourceType, setCoverArtSourceType] = useState<'upload' | 'url'>('upload');
  const [cardCoverImageUrl, setCardCoverImageUrl] = useState('');
  const [cardCoverImageName, setCardCoverImageName] = useState('');
  const [coverArtFile, setCoverArtFile] = useState<File | null>(null);

  const [active, setActive] = useState(true);
  const [countsForFullWeek, setCountsForFullWeek] = useState(true);
  const [speakersText, setSpeakersText] = useState('');
  const [newAttendanceCode, setNewAttendanceCode] = useState('');
  const [modalError, setModalError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const coverArtFileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allDays, allDates, allUnits] = await Promise.all([
        eventRepository.list(),
        eventDateRepository.list(),
        unitRepository.list(),
      ]);
      setDays(allDays);
      setEventDates(allDates);
      setUnits(allUnits);
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
    setEditingDay(null);
    setName('');
    setSlug('');
    setDateLabel('');
    setEventDateId('');
    setAttraction('');
    setTheme('');
    setOpensAt(toDateTimeLocalValue(new Date().toISOString()));
    setClosesAt(toDateTimeLocalValue(new Date(Date.now() + 86400000).toISOString()));
    setVideoSourceType('url');
    setVideoUrl('');
    setVideoAttachmentName('');
    setVideoAttachmentDataUrl('');
    setVideoAttachmentSize(undefined);
    setVideoFile(null);
    setCoverArtSourceType('upload');
    setCardCoverImageUrl('');
    setCardCoverImageName('');
    setCoverArtFile(null);
    setActive(true);
    setCountsForFullWeek(true);
    setSpeakersText('');
    setNewAttendanceCode('');
    setModalError('');
    setIsModalOpen(true);
  };

  const openEditModal = (day: EventDay) => {
    setVideoFile(null);
    setCoverArtFile(null);
    setEditingDay(day);
    setName(day.name);
    setSlug(day.slug);
    setDateLabel(day.dateLabel);
    setEventDateId(day.eventDateId || '');
    setAttraction(day.attraction || '');
    setTheme(day.theme || '');
    setOpensAt(toDateTimeLocalValue(day.opensAt));
    setClosesAt(toDateTimeLocalValue(day.closesAt));
    
    // Video
    if (day.videoAttachmentDataUrl || day.videoType === 'attachment') {
      setVideoSourceType('attachment');
      setVideoAttachmentDataUrl(day.videoAttachmentDataUrl || day.videoUrl || '');
      setVideoAttachmentName(day.videoAttachmentName || 'video_anexado.mp4');
      setVideoUrl('');
    } else {
      setVideoSourceType('url');
      setVideoUrl(day.videoUrl || '');
      setVideoAttachmentDataUrl('');
      setVideoAttachmentName('');
    }

    // Cover Art
    if (day.cardCoverImageUrl || day.bannerImageUrl) {
      setCardCoverImageUrl(day.cardCoverImageUrl || day.bannerImageUrl || '');
      setCardCoverImageName(day.cardCoverImageName || 'arte_card.jpg');
    } else {
      setCardCoverImageUrl('');
      setCardCoverImageName('');
    }

    setActive(day.active);
    setCountsForFullWeek(day.countsForFullWeek);
    setSpeakersText(day.speakers.map(s => s.name).join(', '));
    setNewAttendanceCode('');
    setModalError('');
    setIsModalOpen(true);
  };

  // Handle Video File Attachment
  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'].includes(file.type)) {
      setModalError('Por favor selecione um arquivo de vídeo válido (.mp4, .webm, .mov, etc.).');
      return;
    }

    setVideoAttachmentName(file.name);
    setVideoAttachmentSize(file.size);
    setVideoFile(file);

    // Read video as object URL for local preview and as DataURL for persistent local storage
    const blobUrl = URL.createObjectURL(file);
    setVideoAttachmentDataUrl(blobUrl);

    // Also read DataURL asynchronously if under reasonable size for localStorage persistence
    if (!isNodeBackendEnabled && file.size < 25 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setVideoAttachmentDataUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }

    setModalError('');
    toast.success(`Vídeo "${file.name}" anexado! Confira o preview abaixo.`);
  };

  // Handle Cover Art Attachment
  const handleCoverArtChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setModalError('Por favor selecione um arquivo de imagem válido (.png, .jpg, .webp).');
      return;
    }

    setCardCoverImageName(file.name);
    setCoverArtFile(file);
    if (isNodeBackendEnabled) {
      setCardCoverImageUrl(URL.createObjectURL(file));
      setModalError('');
      toast.success('Arte do card selecionada. Salve para enviar ao servidor!');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCardCoverImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
    setModalError('');
    toast.success('Arte do card carregada!');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!name || !slug || !eventDateId) {
      setModalError('Data da programação, nome e slug são obrigatórios.');
      return;
    }

    const selectedEventDate = eventDates.find(date => date.id === eventDateId);
    if (!selectedEventDate) {
      setModalError('Selecione uma data da programação válida.');
      return;
    }

    // Os controles exibem sempre o horário oficial do evento. A conversão explícita
    // evita que um administrador em outro fuso envie um instante incorreto à API.
    const openDate = fromZonedTime(opensAt, 'America/Sao_Paulo');
    const closeDate = fromZonedTime(closesAt, 'America/Sao_Paulo');

    if (Number.isNaN(openDate.getTime()) || Number.isNaN(closeDate.getTime())) {
      setModalError('Informe datas e horários válidos para a sessão.');
      return;
    }

    const finalSlug = makeUniqueSessionSlug(slug || name, days, openDate.toISOString(), editingDay?.id);

    if (openDate.getTime() >= closeDate.getTime()) {
      setModalError('A data/hora de abertura deve ser anterior ao encerramento.');
      return;
    }

    const speakers = speakersText
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => ({ name: s }));

    let attendanceCodeHash = editingDay?.attendanceCodeHash;
    let attendanceCodeLength = editingDay?.attendanceCodeLength || 7;

    if (newAttendanceCode.trim()) {
      attendanceCodeHash = await sha256Hex(newAttendanceCode.trim().toUpperCase());
      attendanceCodeLength = newAttendanceCode.trim().length;
    }

    try {
      setIsSaving(true);
      setModalError('');
      let finalVideoUrl = videoSourceType === 'attachment'
        ? (videoAttachmentDataUrl || '')
        : (videoUrl.trim() || '');
      let finalCoverImageUrl = cardCoverImageUrl || '';
      if (isNodeBackendEnabled && videoSourceType === 'attachment' && videoFile) {
        finalVideoUrl = (await NodeUploadsApi.upload(videoFile, 'video')).url;
      }
      if (isNodeBackendEnabled && coverArtSourceType === 'upload' && coverArtFile) {
        finalCoverImageUrl = (await NodeUploadsApi.upload(coverArtFile, 'image')).url;
      }
      if (editingDay) {
        await eventRepository.update(editingDay.id, {
          eventDateId,
          name,
          slug: finalSlug,
          dateLabel: selectedEventDate.dateLabel,
          attraction,
          theme,
          opensAt: openDate.toISOString(),
          closesAt: closeDate.toISOString(),
          videoUrl: finalVideoUrl,
          videoType: videoSourceType,
          videoAttachmentName: videoSourceType === 'attachment' ? videoAttachmentName : undefined,
          videoAttachmentDataUrl: videoSourceType === 'attachment' ? videoAttachmentDataUrl : undefined,
          cardCoverImageUrl: finalCoverImageUrl || undefined,
          cardCoverImageName: cardCoverImageName || undefined,
          active,
          countsForFullWeek,
          speakers,
          attendanceCodeHash,
          attendanceCodeLength,
          ...(isNodeBackendEnabled && newAttendanceCode.trim() ? { attendanceCode: newAttendanceCode.trim().toUpperCase() } : {}),
        });
        toast.success('Sessão atualizada com sucesso!');
      } else {
        await eventRepository.create({
          eventDateId,
          name,
          slug: finalSlug,
          dateLabel: selectedEventDate.dateLabel,
          attraction,
          theme,
          timezone: 'America/Sao_Paulo',
          opensAt: openDate.toISOString(),
          closesAt: closeDate.toISOString(),
          videoUrl: finalVideoUrl,
          videoType: videoSourceType,
          videoAttachmentName: videoSourceType === 'attachment' ? videoAttachmentName : undefined,
          videoAttachmentDataUrl: videoSourceType === 'attachment' ? videoAttachmentDataUrl : undefined,
          cardCoverImageUrl: finalCoverImageUrl || undefined,
          cardCoverImageName: cardCoverImageName || undefined,
          active,
          countsForFullWeek,
          speakers,
          attendanceCodeHash: attendanceCodeHash || '',
          attendanceCodeLength,
          sortOrder: days.length + 1,
          ...(isNodeBackendEnabled && newAttendanceCode.trim() ? { attendanceCode: newAttendanceCode.trim().toUpperCase() } : {}),
        });
        toast.success('Nova sessão cadastrada com sucesso!');
      }

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setModalError(err.message || 'Erro ao salvar dia.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleArchive = async (day: EventDay) => {
    const parts = await participationRepository.listByDay(day.id);
    if (parts.length > 0 && day.active) {
      const confirmArchive = window.confirm(
        `Este dia possui ${parts.length} participação(ões). Para manter a integridade histórica dos dados, o dia será arquivado/desativado em vez de excluído. Deseja continuar?`
      );
      if (!confirmArchive) return;
    }

    await eventRepository.update(day.id, { active: !day.active });
    toast.info(`Dia ${day.active ? 'arquivado' : 'reativado'} com sucesso.`);
    loadData();
  };

  const allEventsSelected = days.length > 0 && days.every(day => selectedEventIds.includes(day.id));

  const toggleAllEvents = () => {
    setSelectedEventIds(allEventsSelected ? [] : days.map(day => day.id));
  };

  const toggleEvent = (eventId: string) => {
    setSelectedEventIds(current => current.includes(eventId)
      ? current.filter(id => id !== eventId)
      : [...current, eventId]);
  };

  const confirmDeletion = async () => {
    if (!pendingDeleteIds.length || isDeleting) return;
    setIsDeleting(true);
    try {
      if (pendingDeleteIds.length === 1) {
        await eventRepository.delete(pendingDeleteIds[0]);
      } else {
        await eventRepository.deleteMany(pendingDeleteIds);
      }
      const removed = pendingDeleteIds.length;
      setSelectedEventIds(current => current.filter(id => !pendingDeleteIds.includes(id)));
      setPendingDeleteIds([]);
      toast.success(removed === 1 ? 'Sessão excluída com sucesso!' : `${removed} sessões excluídas com sucesso!`);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível excluir as sessões.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AdminShell
      title="Gestão de Dias & Sessões"
      subtitle="Cadastre horários de abertura e fechamento, palestrantes, vídeos anexados com preview, artes do card e códigos de presença"
      actions={
        <Button variant="action" size="md" onClick={openCreateModal} icon={<Plus className="w-4 h-4" />}>
          Nova Sessão
        </Button>
      }
    >
      <div className="space-y-6">
        {selectedEventIds.length > 0 && (
          <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-red-900">
              <span className="tabular-nums">{selectedEventIds.length}</span> sessão(ões) selecionada(s)
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="outline" size="sm" onClick={() => setSelectedEventIds([])}>
                Limpar seleção
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 className="size-4" />}
                onClick={() => setPendingDeleteIds(selectedEventIds)}
              >
                Excluir selecionadas
              </Button>
            </div>
          </div>
        )}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <Table className="min-w-[1120px] text-left text-xs text-slate-700">
              <thead className="bg-[#323f3c] text-white uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todas as sessões"
                      checked={allEventsSelected}
                      onChange={toggleAllEvents}
                      className="size-4 rounded border-slate-300 text-[#028056] focus:ring-[#028056]"
                    />
                  </th>
                  <th className="py-3 px-4">Arte / Dia</th>
                  <th className="py-3 px-4">Tema & Palestrantes</th>
                  <th className="py-3 px-4">Período de Abertura</th>
                  <th className="py-3 px-4">Vídeo da Sessão</th>
                  <th className="py-3 px-4">Código Presença</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {days.map(day => (
                  <tr key={day.id} data-state={selectedEventIds.includes(day.id) ? 'selected' : undefined} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Selecionar sessão ${day.name}`}
                        checked={selectedEventIds.includes(day.id)}
                        onChange={() => toggleEvent(day.id)}
                        className="size-4 rounded border-slate-300 text-[#028056] focus:ring-[#028056]"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {/* Cover Art Miniature */}
                        {day.cardCoverImageUrl || day.bannerImageUrl ? (
                          <div className="w-12 h-8 rounded-md overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                            <img
                              src={day.cardCoverImageUrl || day.bannerImageUrl}
                              alt={day.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-8 rounded-md bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 text-slate-400">
                            <ImageIcon className="w-4 h-4" />
                          </div>
                        )}
                        <div>
                          <strong className="text-slate-900 font-bold block text-sm">{day.name}</strong>
                          <span className="text-[11px] font-semibold text-emerald-700 block">
                            {day.eventDate?.name || day.dateLabel}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">/{day.slug}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-800 line-clamp-1">{day.attraction || day.theme}</p>
                      <span className="text-[11px] text-slate-500 block">
                        {day.speakers.length > 0
                          ? `Palestrante(s): ${day.speakers.map(s => s.name).join(', ')}`
                          : 'Sem palestrante cadastrado'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-[11px] space-y-0.5">
                        <p className="text-emerald-700 font-medium">
                          Abre: {formatDateToSaoPaulo(day.opensAt, 'liberacao')}
                        </p>
                        <p className="text-slate-500">
                          Fecha: {formatDateToSaoPaulo(day.closesAt, 'liberacao')}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {day.videoAttachmentName || day.videoAttachmentDataUrl ? (
                        <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
                          <Film className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="truncate max-w-[130px]" title={day.videoAttachmentName || 'Vídeo anexado'}>
                            {day.videoAttachmentName || 'Arquivo de vídeo'}
                          </span>
                        </div>
                      ) : day.videoUrl ? (
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Video className="w-3.5 h-3.5 text-[#028056]" />
                          <span className="truncate max-w-[130px]" title={day.videoUrl}>
                            Link Online
                          </span>
                        </div>
                      ) : (
                        <span className="text-amber-600 text-[11px] font-semibold">Sem vídeo</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 text-[11px] font-mono text-slate-600">
                        <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                        <span>SHA-256 ({day.attendanceCodeLength || 7} chars)</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={day.active ? 'green' : 'gray'}>
                        {day.active ? 'Ativo' : 'Arquivado'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(day)}
                          title="Editar dia, vídeo ou arte"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleArchive(day)}
                          title={day.active ? 'Arquivar dia' : 'Reativar dia'}
                          className={day.active ? 'text-amber-700' : 'text-emerald-700'}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setPendingDeleteIds([day.id])}
                          aria-label={`Excluir sessão ${day.name}`}
                          title="Excluir sessão"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
        </div>
      </div>

      <ConfirmDialog
        open={pendingDeleteIds.length > 0}
        onOpenChange={open => { if (!open && !isDeleting) setPendingDeleteIds([]); }}
        title={pendingDeleteIds.length === 1 ? 'Excluir esta sessão?' : `Excluir ${pendingDeleteIds.length} sessões?`}
        description="As sessões deixarão de aparecer na programação. Esta ação preserva o histórico no banco, mas não poderá ser desfeita pelo painel."
        confirmLabel={pendingDeleteIds.length === 1 ? 'Excluir sessão' : 'Excluir sessões'}
        onConfirm={confirmDeletion}
        loading={isDeleting}
      />

      {/* Modal de Criação / Edição de Dia ou Sessão */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDay ? `Editar Sessão: ${editingDay.name}` : 'Cadastrar Nova Sessão'}
        description="Defina os dados da sessão, anexe o vídeo oficial com preview e a arte gráfica para o card"
        maxWidth="2xl"
      >
        <form onSubmit={handleSave} className="space-y-6">
          {modalError && <Alert variant="danger">{modalError}</Alert>}

          <Select
            label="Data da programação"
            value={eventDateId}
            onChange={event => {
              const selectedId = event.target.value;
              setEventDateId(selectedId);
              const selected = eventDates.find(date => date.id === selectedId);
              if (selected) setDateLabel(selected.dateLabel);
            }}
            options={[
              { value: '', label: 'Selecione uma data cadastrada' },
              ...eventDates.filter(date => date.active || date.id === eventDateId).map(date => ({
                value: date.id,
                label: `${date.name} — ${date.dateLabel}`,
              })),
            ]}
            helperText="Cadastre novas categorias no menu Datas da Programação. Cada sessão pertence a uma categoria."
            required
          />

          {/* Dados Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              label="Nome da Sessão"
              placeholder="Ex: Abertura, Ergonomia ou Segurança no Trânsito"
              value={name}
              onChange={e => {
                setName(e.target.value);
                if (!editingDay) {
                  setSlug(slugifySessionName(e.target.value));
                }
              }}
              required
            />
            <TextField
              label="Slug (URL Amigável)"
              placeholder="ex: segunda-feira"
              value={slug}
              onChange={e => setSlug(e.target.value)}
              helperText="Se outra sessão já usar esse endereço, o sistema acrescentará o horário automaticamente."
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              label="Rótulo da Data"
              placeholder="Ex: 10 de Novembro de 2026"
              value={dateLabel}
              readOnly
              helperText="Definido automaticamente pela categoria selecionada."
              required
            />
            <TextField
              label="Tema Principal"
              placeholder="Ex: Cultura de Segurança e Cuidado Ativo"
              value={theme}
              onChange={e => setTheme(e.target.value)}
            />
          </div>

          <TextField
            label="Atração / Título da Palestra"
            placeholder="Ex: Palestra Magna: Segurança Começa em Mim"
            value={attraction}
            onChange={e => setAttraction(e.target.value)}
          />

          <TextField
            label="Palestrante(s)"
            placeholder="Nomes separados por vírgula (Ex: Dr. Roberto Guimarães, Profa. Sandra Lima)"
            value={speakersText}
            onChange={e => setSpeakersText(e.target.value)}
            helperText="Aparecerão no card e no cabeçalho da sessão."
          />

          {/* Datas e Horários */}
          <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 sm:p-4">
            <DateTimePicker
              label="Data e horário de abertura (Brasília)"
              value={opensAt}
              onChange={setOpensAt}
              required
            />
            <DateTimePicker
              label="Data e horário de encerramento (Brasília)"
              value={closesAt}
              onChange={setClosesAt}
              required
            />
          </div>

          {/* SEÇÃO 1: VÍDEO DA SESSÃO COM ANEXO E PREVIEW EM MINIATURA */}
          <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-200/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Film className="w-4 h-4 text-[var(--brand-primary)]" />
                  <span>Vídeo da Sessão (Obrigatório para o Colaborador)</span>
                </h4>
                <p className="text-xs text-slate-500">
                  O colaborador assistirá a este vídeo para desbloquear o questionário e validar a presença remota.
                </p>
              </div>

              {/* Selector: URL vs Anexo */}
              <div className="inline-flex rounded-lg bg-slate-200 p-0.5 text-xs font-semibold self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setVideoSourceType('attachment')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    videoSourceType === 'attachment'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Anexar Arquivo de Vídeo
                </button>
                <button
                  type="button"
                  onClick={() => setVideoSourceType('url')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    videoSourceType === 'url'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  URL Externa
                </button>
              </div>
            </div>

            {videoSourceType === 'attachment' ? (
              <div className="space-y-3">
                <input
                  type="file"
                  ref={videoFileInputRef}
                  accept="video/mp4,video/webm,video/ogg,video/quicktime"
                  onChange={handleVideoFileChange}
                  className="hidden"
                />

                {videoAttachmentDataUrl ? (
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-3">
                    <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="truncate font-semibold text-slate-800">
                          {videoAttachmentName || 'Arquivo de vídeo selecionado'}
                        </span>
                        {videoAttachmentSize && (
                          <span className="text-slate-400">
                            ({(videoAttachmentSize / (1024 * 1024)).toFixed(1)} MB)
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => videoFileInputRef.current?.click()}
                          className="text-[11px] font-semibold text-[var(--brand-primary)] hover:underline"
                        >
                          Substituir arquivo
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setVideoAttachmentDataUrl('');
                            setVideoAttachmentName('');
                            setVideoAttachmentSize(undefined);
                          }}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Remover vídeo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* MINIATURA / PREVIEW DO VÍDEO ANEXADO */}
                    <div className="rounded-lg overflow-hidden border border-slate-200 bg-black aspect-video max-h-52 w-full flex items-center justify-center">
                      <video
                        src={videoAttachmentDataUrl}
                        controls
                        playsInline
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => videoFileInputRef.current?.click()}
                    className="border-2 border-dashed border-emerald-300 hover:border-[var(--brand-primary)] bg-white/70 hover:bg-white p-6 rounded-xl text-center cursor-pointer transition-colors"
                  >
                    <Upload className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-800">
                      Clique para anexar arquivo de vídeo (MP4, WebM, MOV)
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      O arquivo será processado e o player em miniatura será gerado imediatamente para conferência.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <TextField
                label="URL do Vídeo (YouTube, Vimeo ou link direto MP4)"
                placeholder="https://commondatastorage.googleapis.com/.../video.mp4"
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                helperText="Cole um link direto para streaming de vídeo."
              />
            )}
          </div>

          {/* SEÇÃO 2: ARTE DO CARD / BANNER DA SESSÃO COM ENCAIXE NO CARD */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-700" />
                  <span>Arte do Card & Sessão (Capa Visual)</span>
                </h4>
                <p className="text-xs text-slate-500">
                  Esta arte será exibida no topo do card da sessão na página inicial e no cabeçalho.
                </p>
              </div>

              {/* Selector: Upload vs URL */}
              <div className="inline-flex rounded-lg bg-slate-200 p-0.5 text-xs font-semibold self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setCoverArtSourceType('upload')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    coverArtSourceType === 'upload'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Anexar Arte
                </button>
                <button
                  type="button"
                  onClick={() => setCoverArtSourceType('url')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    coverArtSourceType === 'url'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  URL da Imagem
                </button>
              </div>
            </div>

            {coverArtSourceType === 'upload' ? (
              <div className="space-y-3">
                <input
                  type="file"
                  ref={coverArtFileInputRef}
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleCoverArtChange}
                  className="hidden"
                />

                {cardCoverImageUrl ? (
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-3">
                    <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                      <span className="truncate font-semibold text-slate-800">
                        {cardCoverImageName || 'Arte carregada com sucesso'}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => coverArtFileInputRef.current?.click()}
                          className="text-[11px] font-semibold text-[var(--brand-primary)] hover:underline"
                        >
                          Substituir arte
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCardCoverImageUrl('');
                            setCardCoverImageName('');
                          }}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Remover arte"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* PREVIEW DO ENCAIXE NO CARD */}
                    <div className="relative aspect-video max-h-44 w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-900">
                      <img
                        src={cardCoverImageUrl}
                        alt="Preview da Arte do Card"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-3">
                        <span className="text-white text-xs font-bold drop-shadow-sm">
                          {name || 'Título da Sessão'} · Preview do Card na Home
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => coverArtFileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-slate-400 bg-white p-5 rounded-xl text-center cursor-pointer transition-colors"
                  >
                    <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                    <p className="text-xs font-bold text-slate-700">
                      Clique para anexar arquivo de imagem (PNG, JPG, WebP)
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Proporção recomendada: 16:9 ou 4:3 para encaixe perfeito no card da Home.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <TextField
                label="URL da Imagem da Arte"
                placeholder="https://exemplo.com/arte-card.jpg"
                value={cardCoverImageUrl}
                onChange={e => setCardCoverImageUrl(e.target.value)}
                helperText="Insira uma URL direta para a arte gráfica."
              />
            )}
          </div>

          {/* Código de Presença */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 mb-1 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-slate-500" />
              <span>Código Oficial de Presença Presencial</span>
            </h4>
            <TextField
                placeholder={editingDay ? 'Deixe em branco para manter o código atual' : 'Defina um código temporário'}
              value={newAttendanceCode}
              onChange={e => setNewAttendanceCode(e.target.value)}
              helperText="O código é armazenado como hash SHA-256 no banco; o texto limpo nunca é transmitido aos colaboradores."
            />
          </div>

          {/* Opções de Ativação */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <Checkbox
              id="countsForFullWeek"
              label="Conta para o sorteio da programação completa (100% de acertos nesta sessão)"
              checked={countsForFullWeek}
              onChange={e => setCountsForFullWeek(e.target.checked)}
            />
            <Checkbox
              id="activeDay"
              label="Sessão ativa e visível na programação"
              checked={active}
              onChange={e => setActive(e.target.checked)}
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="action" loading={isSaving}>
              Salvar Sessão
            </Button>
          </div>
        </form>
      </Modal>
    </AdminShell>
  );
};
