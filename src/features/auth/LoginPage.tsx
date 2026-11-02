import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { settingsRepository } from '../../services/repositories';
import { AppSettings } from '../../types';
import { TextField } from '../../components/ui/TextField';
import { PasswordField } from '../../components/ui/PasswordField';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { ShieldCheck, User, Sparkles, KeyRound } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [employeeNumber, setEmployeeNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    settingsRepository.getSettings().then(setSettings).catch(console.error);
  }, []);

  // If already logged in, redirect
  useEffect(() => {
    if (user) {
      if (user.mustChangePassword) {
        navigate('/primeiro-acesso', { replace: true });
      } else if (!user.regulationAcceptedVersion) {
        navigate('/regulamento', { replace: true });
      } else {
        const from = (location.state as any)?.from?.pathname || '/';
        navigate(from, { replace: true });
      }
    }
  }, [user, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeNumber.trim() || !password) {
      setErrorMessage('Por favor, informe a matrícula e a senha.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await login(employeeNumber, password);
      if (!res.success) {
        setErrorMessage(res.message || 'Matrícula ou senha inválida.');
      }
    } catch (err) {
      setErrorMessage('Erro de conexão ao autenticar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (emp: string, pass: string) => {
    setEmployeeNumber(emp);
    setPassword(pass);
    setErrorMessage('');
  };

  const brandName = settings?.brandName || settings?.eventName || 'Portal SIPAT Honda';
  const brandSubtitle = settings?.brandSubtitle || 'Semana Interna de Prevenção de Acidentes do Trabalho';
  const loginTitle = settings?.loginTitle || 'Acesse sua conta';
  const loginSubtitle = settings?.loginSubtitle || 'Utilize sua matrícula funcional para ingressar no evento.';
  const loginBadge = settings?.loginBadgeText || 'Honda Automóveis do Brasil';
  const helpText = settings?.initialPasswordHelpText || 'Use a senha temporária fornecida pela administração.';

  return (
    <div
      className="min-h-screen flex flex-col justify-center items-center p-4 transition-colors"
      style={{
        background: `linear-gradient(135deg, var(--brand-primary-deep, #014730) 0%, var(--brand-primary, #028056) 50%, var(--brand-primary-dark, #015237) 100%)`,
      }}
    >
      {/* Brand Icon / Logo & Heading */}
      <div className="flex flex-col items-center mb-6 text-center">
        {settings?.primaryLogoUrl ? (
          <div className="mb-4 max-w-[200px] max-h-16 flex items-center justify-center p-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20">
            <img
              src={settings.primaryLogoUrl}
              alt={brandName}
              className="max-h-12 max-w-full object-contain"
            />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg mb-3">
            <ShieldCheck className="w-9 h-9 text-[var(--brand-action,#66bd39)]" />
          </div>
        )}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-display tracking-tight">
          {brandName}
        </h1>
        <p className="text-xs sm:text-sm text-emerald-100/90 mt-1 max-w-md">
          {brandSubtitle} • {settings?.eventYear || 2026}
        </p>
        <p className="text-sm font-semibold text-white mt-2">Ola, mundo</p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-[450px] bg-white rounded-2xl shadow-2xl p-6 sm:p-8 border border-white/20">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold text-slate-800 font-display">{loginTitle}</h2>
            <span className="text-[10px] font-bold text-[var(--brand-primary,#028056)] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {loginBadge}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">{loginSubtitle}</p>
        </div>

        {errorMessage && (
          <div className="mb-5">
            <Alert variant="danger">{errorMessage}</Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <TextField
            label="Matrícula Funcional"
            placeholder="Ex.: 101010 ou admin"
            required
            autoComplete="username"
            value={employeeNumber}
            onChange={e => setEmployeeNumber(e.target.value)}
            icon={<User className="w-4 h-4" />}
          />

          <PasswordField
            label="Senha de Acesso"
            placeholder="Digite sua senha"
            required
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          <p className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100 leading-relaxed">
            <strong className="text-slate-700">Dica de primeiro acesso:</strong> {helpText}
          </p>

          <Button
            type="submit"
            variant="action"
            size="lg"
            loading={loading}
            className="w-full mt-2 font-bold text-sm tracking-wide"
          >
            ENTRAR NO PORTAL
          </Button>
        </form>

        {/* Contas demonstrativas existem somente no servidor de desenvolvimento. */}
        {import.meta.env.DEV && import.meta.env.VITE_DEMO_ADMIN_PASSWORD && import.meta.env.VITE_DEMO_COLLABORATOR_PASSWORD && <div className="mt-8 pt-5 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Acesso Rápido para Avaliação</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => handleQuickFill('admin', import.meta.env.VITE_DEMO_ADMIN_PASSWORD)}
              className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 text-[var(--brand-primary-deep,#014730)] hover:bg-emerald-100 border border-emerald-200 transition-colors text-left cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 shrink-0 text-[var(--brand-primary,#028056)]" />
              <div>
                <strong className="block font-bold">Admin Geral</strong>
                <span className="text-[10px] text-slate-500">Conta configurada no ambiente local</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('101010', import.meta.env.VITE_DEMO_COLLABORATOR_PASSWORD)}
              className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors text-left cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              <div>
                <strong className="block font-bold">1º Acesso</strong>
                <span className="text-[10px] text-slate-500">Conta configurada no ambiente local</span>
              </div>
            </button>
          </div>
        </div>}
      </div>
    </div>
  );
};
