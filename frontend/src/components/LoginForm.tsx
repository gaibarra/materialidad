"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useAuthContext } from "../context/AuthContext";
import { alertError, alertSuccess } from "../lib/alerts";

export function LoginForm() {
  const { login } = useAuthContext();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenant, setTenant] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      // Solo enviar tenant si se especificó uno
      const loginData: { email: string; password: string; tenant?: string } = {
        email,
        password,
      };

      if (tenant.trim()) {
        loginData.tenant = tenant.trim().toLowerCase();
      }

      await login(loginData);
      await alertSuccess("Acceso autorizado", "Redirigiendo al panel principal");
      router.push("/dashboard");
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
        <label className="block text-sm font-medium text-ink-500">
          Código de empresa <span className="text-gray-400">(opcional)</span>
        </label>
        <input
          type="text"
          placeholder="Déjalo vacío si eres superusuario"
          value={tenant}
          onChange={(event) => setTenant(event.target.value.trim().toLowerCase())}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm uppercase focus:border-jade-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-gray-500">
          El tenant se determinará automáticamente de tu cuenta si no lo especificas
        </p>
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
