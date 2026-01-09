"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { LoginForm } from "../../../components/LoginForm";
import { useAuthContext } from "../../../context/AuthContext";

export default function LoginPage() {
  const { isAuthenticated } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <p className="text-sm uppercase tracking-widest text-jade-600">Ingreso seguro</p>
          <h1 className="mt-2 text-2xl font-semibold text-ink-500">
            Autentica tu acceso fiscal
          </h1>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
