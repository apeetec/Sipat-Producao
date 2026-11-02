import React, { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute, AdminRoute, FirstAccessRoute } from '../../features/auth/guards';

const LoginPage = lazy(() => import('../../features/auth/LoginPage').then(module => ({ default: module.LoginPage })));
const FirstAccessPage = lazy(() => import('../../features/auth/FirstAccessPage').then(module => ({ default: module.FirstAccessPage })));
const RegulationPage = lazy(() => import('../../features/regulations/RegulationPage').then(module => ({ default: module.RegulationPage })));
const HomePage = lazy(() => import('../../features/home/HomePage').then(module => ({ default: module.HomePage })));
const EventDayPage = lazy(() => import('../../features/events/EventDayPage').then(module => ({ default: module.EventDayPage })));
const WinnersPage = lazy(() => import('../../features/winners/WinnersPage').then(module => ({ default: module.WinnersPage })));
const AdminDashboardPage = lazy(() => import('../../features/admin/dashboard/AdminDashboardPage').then(module => ({ default: module.AdminDashboardPage })));
const AdminEventsPage = lazy(() => import('../../features/admin/event-management/AdminEventsPage').then(module => ({ default: module.AdminEventsPage })));
const AdminEventDatesPage = lazy(() => import('../../features/admin/event-date-management/AdminEventDatesPage').then(module => ({ default: module.AdminEventDatesPage })));
const AdminQuestionsPage = lazy(() => import('../../features/admin/question-management/AdminQuestionsPage').then(module => ({ default: module.AdminQuestionsPage })));
const AdminUnitsPage = lazy(() => import('../../features/admin/unit-management/AdminUnitsPage').then(module => ({ default: module.AdminUnitsPage })));
const AdminUsersPage = lazy(() => import('../../features/admin/user-management/AdminUsersPage').then(module => ({ default: module.AdminUsersPage })));
const AdminUserImportPage = lazy(() => import('../../features/admin/user-import/AdminUserImportPage').then(module => ({ default: module.AdminUserImportPage })));
const AdminBulkDeletePage = lazy(() => import('../../features/admin/bulk-delete/AdminBulkDeletePage').then(module => ({ default: module.AdminBulkDeletePage })));
const AdminResultsPage = lazy(() => import('../../features/admin/results/AdminResultsPage').then(module => ({ default: module.AdminResultsPage })));
const AdminDrawsPage = lazy(() => import('../../features/admin/draws/AdminDrawsPage').then(module => ({ default: module.AdminDrawsPage })));
const AdminAuditPage = lazy(() => import('../../features/admin/audit/AdminAuditPage').then(module => ({ default: module.AdminAuditPage })));
const AdminSettingsPage = lazy(() => import('../../features/admin/settings/AdminSettingsPage').then(module => ({ default: module.AdminSettingsPage })));
const AdminCustomizationPage = lazy(() => import('../../features/admin/customization/AdminCustomizationPage').then(module => ({ default: module.AdminCustomizationPage })));
const CsvValidatorPage = lazy(() => import('../../features/tools/CsvValidatorPage').then(module => ({ default: module.CsvValidatorPage })));

export const router = createBrowserRouter([
  // Public login
  {
    path: '/login',
    element: <LoginPage />,
  },
  // First access password change
  {
    path: '/primeiro-acesso',
    element: (
      <FirstAccessRoute>
        <FirstAccessPage />
      </FirstAccessRoute>
    ),
  },
  // Regulation acceptance
  {
    path: '/regulamento',
    element: <RegulationPage />,
  },
  // Collaborator Home
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <HomePage />
      </ProtectedRoute>
    ),
  },
  // Central Session Screen
  {
    path: '/dias/:slug',
    element: (
      <ProtectedRoute>
        <EventDayPage />
      </ProtectedRoute>
    ),
  },
  // Winners Gallery (both routes point to the same canonical component)
  {
    path: '/ganhadores',
    element: (
      <ProtectedRoute>
        <WinnersPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/sorteios',
    element: (
      <ProtectedRoute>
        <WinnersPage />
      </ProtectedRoute>
    ),
  },

  // Admin Shell and Pages
  {
    path: '/admin',
    element: (
      <AdminRoute>
        <AdminDashboardPage />
      </AdminRoute>
    ),
  },
  {
    path: '/admin/datas',
    element: (
      <AdminRoute>
        <AdminEventDatesPage />
      </AdminRoute>
    ),
  },
  {
    path: '/admin/dias',
    element: (
      <AdminRoute>
        <AdminEventsPage />
      </AdminRoute>
    ),
  },
  {
    path: '/admin/perguntas',
    element: (
      <AdminRoute>
        <AdminQuestionsPage />
      </AdminRoute>
    ),
  },
  {
    path: '/admin/unidades',
    element: (
      <AdminRoute>
        <AdminUnitsPage />
      </AdminRoute>
    ),
  },
  {
    path: '/admin/usuarios',
    element: (
      <AdminRoute>
        <AdminUsersPage />
      </AdminRoute>
    ),
  },
  {
    path: '/admin/usuarios/importar',
    element: (
      <AdminRoute>
        <AdminUserImportPage />
      </AdminRoute>
    ),
  },
  {
    path: '/admin/usuarios/excluir-em-massa',
    element: (
      <AdminRoute>
        <AdminBulkDeletePage />
      </AdminRoute>
    ),
  },
  {
    path: '/admin/resultados',
    element: (
      <AdminRoute>
        <AdminResultsPage />
      </AdminRoute>
    ),
  },
  {
    path: '/admin/sorteios',
    element: (
      <AdminRoute>
        <AdminDrawsPage />
      </AdminRoute>
    ),
  },
  {
    path: '/admin/auditoria',
    element: (
      <AdminRoute>
        <AdminAuditPage />
      </AdminRoute>
    ),
  },
  {
    path: '/admin/configuracoes',
    element: (
      <AdminRoute>
        <AdminSettingsPage />
      </AdminRoute>
    ),
  },
  {
    path: '/admin/personalizacao',
    element: (
      <AdminRoute>
        <AdminCustomizationPage />
      </AdminRoute>
    ),
  },
  {
    path: '/ferramentas/validar-csv',
    element: (
      <AdminRoute>
        <CsvValidatorPage />
      </AdminRoute>
    ),
  },

  // Fallback
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
