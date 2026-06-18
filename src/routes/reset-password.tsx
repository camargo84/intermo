import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Recuperar senha — Intermo" }] }),
  component: ResetPasswordPage,
});

const requestSchema = z.object({ email: z.string().email("E-mail inválido.") });
const updateSchema = z
  .object({
    password: z
      .string()
      .min(8, "Mínimo de 8 caracteres.")
      .regex(/[A-Z]/, "Inclua ao menos uma letra maiúscula.")
      .regex(/[0-9]/, "Inclua ao menos um número."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "As senhas não coincidem.", path: ["confirm"] });

type RequestData = z.infer<typeof requestSchema>;
type UpdateData = z.infer<typeof updateSchema>;

function ResetPasswordPage() {
  const [mode, setMode] = useState<"request" | "update">("request");
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hash.get("type") === "recovery") setMode("update");
  }, []);

  return mode === "update" ? <UpdateForm onDone={() => navigate({ to: "/login" })} /> : <RequestForm />;
}

function RequestForm() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RequestData>({ resolver: zodResolver(requestSchema) });

  async function onSubmit(values: RequestData) {
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Não consegui enviar o e-mail", { description: error.message });
      return;
    }
    setSent(true);
  }

  return (
    <AuthLayout
      title="Esqueceu sua senha?"
      subtitle="Sem problema. Vamos enviar um link para você criar uma nova."
      footer={
        <>
          Lembrou agora?{" "}
          <Link to="/login" className="font-medium text-accent hover:underline">Voltar para o login</Link>
        </>
      }
    >
      {sent ? (
        <div className="space-y-3 text-center">
          <p className="text-sm">
            Pronto! Se houver uma conta com esse e-mail, você vai receber um link para redefinir a senha em alguns instantes.
          </p>
          <p className="text-xs text-muted-foreground">Confira sua caixa de spam se não encontrar.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" autoComplete="email" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Enviar link de recuperação
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

function UpdateForm({ onDone }: { onDone: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateData>({ resolver: zodResolver(updateSchema) });

  async function onSubmit(values: UpdateData) {
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: values.password });
    setSubmitting(false);
    if (error) {
      toast.error("Não consegui atualizar a senha", { description: error.message });
      return;
    }
    toast.success("Senha atualizada!", { description: "Use a nova senha para entrar." });
    onDone();
  }

  return (
    <AuthLayout title="Crie uma nova senha" subtitle="Escolha algo forte e fácil de lembrar.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="password">Nova senha</Label>
          <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirme a nova senha</Label>
          <Input id="confirm" type="password" autoComplete="new-password" {...register("confirm")} />
          {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Salvar nova senha
        </Button>
      </form>
    </AuthLayout>
  );
}
