"use client"

// Єдине джерело сесії/ролі — AuthProvider (src/context/auth.tsx). Цей модуль
// лишається як сумісний re-export, щоб не плодити другу підписку на auth.
export { useAuth } from "@/context/auth"
export type { AuthContextType } from "@/context/auth"
