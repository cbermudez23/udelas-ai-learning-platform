"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Brain, Loader2 } from "lucide-react";

const DEMO_ACCOUNTS = [
  { label: "Estudiante demo", email: "carlos@udelas.ac.pa", password: "demo1234" },
  { label: "Docente demo", email: "profesora@udelas.ac.pa", password: "demo1234" }
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false
    });
    setLoading(false);
    if (res?.error) {
      setError("Correo o contraseña incorrectos.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  function useDemo(acc: (typeof DEMO_ACCOUNTS)[number]) {
    setEmail(acc.email);
    setPassword(acc.password);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-tertiary)] px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center text-white font-semibold">
            U
          </div>
          <div>
            <div className="text-base font-semibold text-brand">
              UDELAS <span className="text-accent">AI</span> Learning Platform
            </div>
            <div className="text-xs text-[var(--text-tertiary)]">
              Universidad Especializada de las Américas · MVP
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              Correo institucional
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@udelas.ac.pa"
              className="mt-1 w-full text-sm px-3 py-2 rounded-lg border border-[var(--border-secondary)] outline-none focus:border-[var(--clr-brand2)]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full text-sm px-3 py-2 rounded-lg border border-[var(--border-secondary)] outline-none focus:border-[var(--clr-brand2)]"
            />
          </div>

          {error && <div className="text-xs text-red-600">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[var(--clr-brand2)] hover:bg-brand transition-colors text-white text-sm font-medium py-2 rounded-lg disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Ingresar
          </button>
        </form>

        <div className="mt-4 card">
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] mb-2">
            <Brain className="w-3.5 h-3.5 text-[var(--clr-brand2)]" />
            Cuentas de demostración
          </div>
          <div className="space-y-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => useDemo(acc)}
                className="w-full text-left text-xs px-3 py-2 rounded-lg border border-[var(--border-tertiary)] hover:border-[var(--clr-brand2)] transition-colors"
              >
                <div className="font-medium">{acc.label}</div>
                <div className="text-[var(--text-tertiary)]">{acc.email}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
