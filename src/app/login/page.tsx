"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { HardHat, Loader2 } from "lucide-react";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const supabase = createBrowserSupabase();
    try {
      if (mode === "reset") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login`,
        });
        if (resetError) throw resetError;
        setMessage("Если аккаунт существует, мы отправили письмо для сброса пароля.");
        return;
      }

      if (mode === "register") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName.trim() || undefined, role: "manager" },
          },
        });
        if (signUpError) throw signUpError;

        // If email confirmation is off, session exists → go in
        if (data.session) {
          router.replace(next.startsWith("/") ? next : "/dashboard");
          router.refresh();
          return;
        }
        setMessage("Аккаунт создан. Если нужно подтверждение почты — проверьте письмо, затем войдите.");
        setMode("login");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      router.replace(next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось выполнить действие");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md rounded-[18px] border border-line bg-white p-6 md:p-8 shadow-[0_8px_24px_rgba(23,63,52,0.06)]">
        <div className="flex items-center gap-2 mb-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-cream text-orange">
            <HardHat className="w-5 h-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-ink">
              {mode === "login" && "Вход"}
              {mode === "register" && "Регистрация"}
              {mode === "reset" && "Сброс пароля"}
            </h1>
            <p className="text-caption text-muted">СтройУчёт · защищённый доступ</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          {mode === "register" && (
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5" htmlFor="fullName">
                Имя
              </label>
              <input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full h-[44px] rounded-[12px] border border-line px-3 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-orange/30"
                placeholder="Иван Петров"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-[44px] rounded-[12px] border border-line px-3 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-orange/30"
              placeholder="you@company.ru"
              autoComplete="email"
            />
          </div>
          {mode !== "reset" && (
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5" htmlFor="password">
                Пароль
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-[44px] rounded-[12px] border border-line px-3 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-orange/30"
                placeholder="минимум 6 символов"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-green">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-[44px] rounded-[10px] bg-orange text-white font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "login" && "Войти"}
            {mode === "register" && "Создать аккаунт"}
            {mode === "reset" && "Отправить ссылку"}
          </button>
        </form>

        <div className="mt-4 space-y-2 text-sm text-muted">
          {mode !== "login" && (
            <button type="button" className="text-orange hover:underline" onClick={() => setMode("login")}>
              Уже есть аккаунт? Войти
            </button>
          )}
          {mode === "login" && (
            <>
              <button type="button" className="block text-orange hover:underline" onClick={() => setMode("register")}>
                Создать аккаунт
              </button>
              <button type="button" className="block text-orange hover:underline" onClick={() => setMode("reset")}>
                Забыли пароль?
              </button>
            </>
          )}
          <Link href="/" className="block hover:text-ink">
            ← На главную
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex items-center justify-center text-muted">Загрузка…</div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
