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

  return <LoginForm />;
}
