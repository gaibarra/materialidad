"use client";

import { useAuthContext, type UserProfile } from "../context/AuthContext";

export type UserVariant = "despacho" | "corporativo" | "universidad";

export function getUserVariant(user: UserProfile | null): UserVariant {
  if (!user) return "corporativo";
  if (user.despacho_tipo === "despacho") return "despacho";
  // Universidad detection can be added when backend supports it
  return "corporativo";
}

/** React hook wrapper — use `getUserVariant()` directly when you already have the user object */
export function useUserVariant(): UserVariant {
  const { user } = useAuthContext();
  return getUserVariant(user);
}
