import {
  LocalUserRepository,
  LocalEventDateRepository,
  LocalUnitRepository,
  LocalEventRepository,
  LocalQuestionRepository,
  LocalParticipationRepository,
  LocalDrawRepository,
  LocalAuditRepository,
  LocalSettingsRepository,
} from './local-adapter';
import {
  HttpUserRepository, HttpUnitRepository, HttpEventDateRepository, HttpEventRepository, HttpQuestionRepository,
  HttpParticipationRepository, HttpDrawRepository, HttpAuditRepository, HttpSettingsRepository,
} from './http-adapter';
import { isNodeBackendEnabled } from '../api/node-backend-client';

// Singletons
export const userRepository = isNodeBackendEnabled ? new HttpUserRepository() : new LocalUserRepository();
export const unitRepository = isNodeBackendEnabled ? new HttpUnitRepository() : new LocalUnitRepository();
export const eventDateRepository = isNodeBackendEnabled ? new HttpEventDateRepository() : new LocalEventDateRepository();
export const eventRepository = isNodeBackendEnabled ? new HttpEventRepository() : new LocalEventRepository();
export const questionRepository = isNodeBackendEnabled ? new HttpQuestionRepository() : new LocalQuestionRepository();
export const participationRepository = isNodeBackendEnabled ? new HttpParticipationRepository() : new LocalParticipationRepository();
export const drawRepository = isNodeBackendEnabled ? new HttpDrawRepository() : new LocalDrawRepository();
export const auditRepository = isNodeBackendEnabled ? new HttpAuditRepository() : new LocalAuditRepository();
export const settingsRepository = isNodeBackendEnabled ? new HttpSettingsRepository() : new LocalSettingsRepository();

export * from './interfaces';
