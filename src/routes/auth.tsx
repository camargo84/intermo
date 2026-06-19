import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "./login";

// Alias canônico exigido pela integração Supabase (redireciona protegidos para /auth).
export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — inTermo" }] }),
  component: LoginPage,
});
