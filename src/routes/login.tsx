import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/auth/AuthLayout";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — inTermo" },
      {
        name: "description",
        content: "Entre na sua conta inTermo pra gerenciar contratos e clientes.",
      },
      { property: "og:title", content: "Entrar — inTermo" },
      {
        property: "og:description",
        content:
          "Acesse o painel da inTermo para gerenciar contratos, clientes e assinaturas digitais com validade jurídica.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,follow" },
    ],
    links: [{ rel: "canonical", href: "/login" }],
  }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe sua senha."),
});
type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormData) {
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword(values);
    setSubmitting(false);
    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
        toast.error("E-mail ainda não confirmado", {
          description: "Abra o link que enviamos por e-mail para ativar sua conta.",
        });
        return;
      }
      toast.error("Não conseguimos entrar", {
        description: "Verifique e-mail e senha e tente novamente.",
      });
      return;
    }
    toast.success("Bem-vindo de volta!");
    await router.invalidate();
    navigate({ to: "/chat" });
  }

  return (
    <AuthLayout
      title="Bem-vindo de volta."
      subtitle="Continue de onde parou — sua próxima conversa começa em um clique."
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      <form
        method="post"
        action="#"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit(onSubmit)(e);
        }}
        className="space-y-5"
        noValidate
      >
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <Link
              to="/reset-password"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Esqueci minha senha
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={submitting || !isHydrated}>
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Entrar
        </Button>
      </form>
    </AuthLayout>
  );
}
