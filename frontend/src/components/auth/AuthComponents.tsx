/**
 * Shared authentication utilities for MotoYa login pages.
 *
 * - `authFetch`: standard POST to auth endpoints with error parsing.
 * - `PasswordField`: password input with show/hide toggle (dark + light variants).
 * - `ErrorAlert`: styled error message box (dark + light variants).
 */

import { useState, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// ── API helper ──────────────────────────────────────────────────────────────

export async function authFetch<T = Record<string, unknown>>(
  url: string,
  body: URLSearchParams | string,
  contentType: string = 'application/x-www-form-urlencoded',
): Promise<T> {
  const headers: Record<string, string> = {};
  if (contentType) headers['Content-Type'] = contentType;

  const res = await fetch(url, { method: 'POST', headers, body: typeof body === 'string' ? body : body.toString() });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const detail = (data as Record<string, unknown>).detail ?? (data as Record<string, unknown>).message ?? `Error ${res.status}`;
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }

  return data as T;
}

// ── Password field ──────────────────────────────────────────────────────────

interface PasswordFieldProps {
  value: string;
  onChange: (v: string) => void;
  variant?: 'light' | 'dark';
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
}

export function PasswordField({
  value,
  onChange,
  variant = 'light',
  placeholder = '••••••••',
  autoComplete = 'current-password',
  disabled = false,
}: PasswordFieldProps) {
  const [show, setShow] = useState(false);
  const isDark = variant === 'dark';

  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        required
        autoComplete={autoComplete}
        disabled={disabled}
        className={
          isDark
            ? 'w-full h-11 px-4 pr-11 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316] transition-all'
            : 'w-full h-10 px-3 pr-10 rounded-md border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#f97316]/40 focus:border-[#f97316] transition-all'
        }
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        className={
          isDark
            ? 'absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors'
            : 'absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors'
        }
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ── Error alert ─────────────────────────────────────────────────────────────

interface ErrorAlertProps {
  message: string;
  variant?: 'light' | 'dark';
}

export function ErrorAlert({ message, variant = 'light' }: ErrorAlertProps) {
  if (!message) return null;
  const isDark = variant === 'dark';

  return (
    <div
      className={
        isDark
          ? 'bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl'
          : 'bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg'
      }
    >
      {message}
    </div>
  );
}

// ── Form wrapper ────────────────────────────────────────────────────────────

interface AuthFormProps {
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  loadingText: string;
  submitText: string;
  children: ReactNode;
  variant?: 'light' | 'dark';
  disabled?: boolean;
}

export function AuthForm({
  onSubmit,
  loading,
  loadingText,
  submitText,
  children,
  variant = 'light',
  disabled = false,
}: AuthFormProps) {
  const isDark = variant === 'dark';

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {children}
      <button
        type="submit"
        disabled={loading || disabled}
        className={
          isDark
            ? 'w-full h-11 rounded-xl bg-[#f97316] hover:bg-[#ea580c] text-white font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2'
            : 'w-full h-10 rounded-md bg-[#f97316] hover:bg-[#ea580c] text-white font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2'
        }
      >
        {loading ? loadingText : submitText}
      </button>
    </form>
  );
}
