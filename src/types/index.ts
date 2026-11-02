export type UserRole = 'admin' | 'collaborator';

export interface AppUser {
  id: string;
  employeeNumber: string; // matrícula única
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  description?: string;
  role: UserRole;
  unitId?: string;
  unitSlug?: string;
  unitNameBackup?: string;
  company?: string;
  adminComment?: string;
  mustChangePassword: boolean;
  regulationAcceptedVersion?: string;
  regulationAcceptedAt?: string; // ISO string / timestamp
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Unit {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface EventSpeaker {
  name: string;
  imageUrl?: string;
  role?: string;
}

export interface EventDate {
  id: string;
  name: string;
  eventDate: string; // YYYY-MM-DD
  dateLabel: string;
  description?: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface EventDay {
  id: string;
  eventDateId?: string; // obrigatório na API nova; opcional somente para dados locais legados
  eventDate?: EventDate;
  name: string;
  slug: string;
  dateLabel: string;
  parentId?: string; // sessões filhas
  attraction?: string;
  theme?: string;
  timezone: 'America/Sao_Paulo';
  opensAt: string; // ISO string
  closesAt: string; // ISO string
  videoUrl?: string;
  videoStoragePath?: string;
  videoEmbedUrl?: string;
  videoType?: 'url' | 'attachment';
  videoAttachmentName?: string;
  videoAttachmentDataUrl?: string;
  cardCoverImageUrl?: string;
  cardCoverImageName?: string;
  unitVideoOverrides?: Record<string, string>;
  attendanceCodeHash?: string; // SHA-256 hash
  attendanceCodeLength: number;
  bannerImageUrl?: string;
  speakers: EventSpeaker[];
  active: boolean;
  countsForFullWeek: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type QuestionType = 'single_choice' | 'free_text' | 'rating';

export interface Alternative {
  id: string;
  text: string;
  isCorrect?: boolean; // apenas admin/backend
  ratingValue?: number;
}

export interface Question {
  id: string;
  eventDayId: string;
  title: string;
  type: QuestionType;
  required: boolean;
  scored: boolean;
  alternatives: Alternative[];
  suggestionPrompt?: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ParticipationStatus = 'not_started' | 'in_progress' | 'submitted';
export type AttendanceModality = 'in_person' | 'remote';

export interface ParticipationAnswer {
  alternativeId?: string;
  text?: string;
  rating?: number;
}

export interface Participation {
  id: string; // userId_dayId
  userId: string;
  eventDayId: string;
  firstAccessAt?: string;
  lastAccessAt?: string;
  modality?: AttendanceModality;
  attendanceValidatedAt?: string;
  videoProgressPercent: number;
  videoCompletedAt?: string;
  status: ParticipationStatus;
  answers: Record<string, ParticipationAnswer>;
  suggestions: Record<string, string>;
  submittedAt?: string;
  correctCount?: number;
  scoredQuestionCount?: number;
  percentage?: number;
  perfectScore: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DrawWinner {
  userId: string;
  employeeNumber: string;
  name: string;
  email: string;
  unitName: string;
  company?: string;
  position: number;
}

export type DrawScope = 
  | { type: 'day'; eventDayId: string }
  | { type: 'full_week' };

export type DrawStatus = 'published' | 'voided';

export interface Draw {
  id: string;
  prizeName: string;
  prizeImageUrl?: string;
  prizeImageStoragePath?: string;
  groupName: string;
  scope: DrawScope;
  unitIds: string[] | ['all'];
  requestedWinnerCount: number;
  actualWinnerCount: number;
  excludePreviousWinners: boolean;
  eligibleCount: number;
  eligibleUserIdsSnapshot: string[];
  winners: DrawWinner[];
  status: DrawStatus;
  voidReason?: string;
  createdBy: string;
  createdAt: string;
  voidedBy?: string;
  voidedAt?: string;
}

export interface Regulation {
  version: string;
  title: string;
  contentHtml: string;
  pdfUrl?: string;
  published: boolean;
  effectiveFrom: string;
  createdAt: string;
}

export interface AccessLog {
  id: string;
  userId: string;
  employeeNumber: string;
  timestamp: string;
  result: 'success' | 'failure';
  failureReason?: string;
  ipHash?: string;
  userAgentSummary?: string;
}

export interface AuditLog {
  id: string;
  actorUserId: string;
  actorName: string;
  action: string;
  entity: string;
  entityId: string;
  beforeData?: Record<string, any>;
  afterData?: Record<string, any>;
  timestamp: string;
  ipHash?: string;
}

export interface AppSettings {
  eventName: string;
  eventYear: number;
  primaryLogoUrl?: string;
  desktopBannerUrl?: string;
  mobileBannerUrl?: string;
  customLinks: Array<{ label: string; url: string; openInNewTab?: boolean }>;
  videoCompletionThresholdPercent: number; // 99%
  showCorrectAnswersAfterSubmit: boolean;
  maskEmployeeNumberInWinners: boolean;
  initialPasswordHelpText: string;
  activeRegulationVersion: string;
  privacyPolicyUrl?: string;
  
  // Customization & White-Label for other campaigns
  brandName?: string;
  brandSubtitle?: string;
  primaryColor?: string;
  primaryDarkColor?: string;
  actionColor?: string;
  backgroundColor?: string;
  loginTitle?: string;
  loginSubtitle?: string;
  loginBadgeText?: string;
  homeHeadline?: string;
  homeDescription?: string;
  regulationTitle?: string;
  supportContact?: string;
}
