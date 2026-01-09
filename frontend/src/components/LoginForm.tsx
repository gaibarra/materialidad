"use client";

import { useState } from "react";

import { useAuthContext } from "../context/AuthContext";
import { alertError, alertSuccess } from "../lib/alerts";

export function LoginForm() {
  const { login } = useAuthContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenant, setTenant] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      await login({ email, password, tenant });
      void alertSuccess("Acceso autorizado", "Redirigiendo al panel principal");
    } catch (err) {
      void alertError("No pudimos iniciar sesión", (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white/90 p-8 shadow-xl"
    >
      <div>
        <label className="block text-sm font-medium text-ink-500">Correo</label>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-ink-500">Contraseña</label>
        <input
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-ink-500">Código de empresa</label>
        <input
          type="text"
          required
          placeholder="p.ej. ACME"
          value={tenant}
          onChange={(event) => setTenant(event.target.value.trim().toLowerCase())}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm uppercase focus:border-jade-500 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-lg bg-jade-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-jade-600 disabled:opacity-70"
      >
        {isLoading ? "Verificando" : "Ingresar"}
      </button>
    </form>
  );
}
