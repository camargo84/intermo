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
import { Checkbox } from "@/components/ui/checkbox";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { formatCNPJ, formatPhoneBR, isValidCNPJ } from "@/lib/format";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Criar conta — inTermo" },
      {
        name: "description",
        content:
          "Crie sua conta na inTermo: contratos com validade jurídica em minutos. R$ 119/mês nos 6 primeiros meses (depois R$ 149/mês). 7 dias de garantia.",
      },
      { property: "og:title", content: "Criar conta — inTermo" },
      {
        property: "og:description",
        content:
          "Contratos com validade jurídica em minutos. R$ 119/mês nos 6 primeiros meses, depois R$ 149/mês. Garantia de 7 dias.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/signup" }],
  }),
  component: SignupPage,
});

const schema = z.object({
  fantasyName: z.string().min(2, "Informe o nome fantasia."),
  companyName: z.string().min(2, "Informe a razão social."),
  cnpj: z.string().refine((v) => isValidCNPJ(v), "CNPJ inválido."),
  companyEmail: z.string().email("E-mail da empresa inválido."),
  companyPhone: z.string().min(14, "Informe um telefone com DDD."),
  ownerName: z.string().min(2, "Informe seu nome completo."),
  ownerEmail: z.string().email("E-mail inválido."),
  password: z
    .string()
    .min(8, "Mínimo de 8 caracteres.")
    .regex(/[A-Z]/, "Inclua ao menos uma letra maiúscula.")
    .regex(/[0-9]/, "Inclua ao menos um número."),
  acceptTerms: z.literal(true, { message: "Você precisa aceitar os termos." }),
});
type FormData = z.infer<typeof schema>;

function SignupPage() {
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
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { acceptTerms: false as unknown as true },
  });

  const acceptTerms = watch("acceptTerms");

  async function onSubmit(values: FormData) {
    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: values.ownerEmail,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/login?confirmed=1`,
        data: {
          owner_name: values.ownerName,
          company_fantasy_name: values.fantasyName,
          company_legal_name: values.companyName,
          company_cnpj: values.cnpj.replace(/\D/g, ""),
          company_email: values.companyEmail,
          company_phone: values.companyPhone.replace(/\D/g, ""),
        },
      },
    });
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível criar a conta", { description: error.message });
      return;
    }
    // Sem sessão = precisa confirmar e-mail
    if (!data.session) {
      toast.success("Conta criada!", {
        description: "Enviamos um e-mail de confirmação. Abra-o para ativar seu acesso.",
      });
      navigate({ to: "/login" });
      return;
    }
    toast.success("Conta criada!", { description: "Bem-vindo à inTermo." });
    await router.invalidate();
    navigate({ to: "/assinatura" });
  }

  return (
    <AuthLayout
      title="Criar sua conta inTermo"
      subtitle="7 dias de garantia. Não gostou? Devolvemos 100%."
      footer={
        <>
          Já tem conta?{" "}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Entrar
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
        className="space-y-6"
        noValidate
      >
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-foreground">Sua empresa</legend>

          <div className="space-y-2">
            <Label htmlFor="fantasyName">Nome fantasia</Label>
            <Input id="fantasyName" {...register("fantasyName")} />
            {errors.fantasyName && (
              <p className="text-xs text-destructive">{errors.fantasyName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyName">Razão social</Label>
            <Input id="companyName" {...register("companyName")} />
            {errors.companyName && (
              <p className="text-xs text-destructive">{errors.companyName.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                inputMode="numeric"
                placeholder="00.000.000/0000-00"
                {...register("cnpj", {
                  onChange: (e) =>
                    setValue("cnpj", formatCNPJ(e.target.value), { shouldValidate: false }),
                })}
              />
              {errors.cnpj && <p className="text-xs text-destructive">{errors.cnpj.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyPhone">Telefone</Label>
              <Input
                id="companyPhone"
                inputMode="tel"
                placeholder="(11) 99999-9999"
                {...register("companyPhone", {
                  onChange: (e) =>
                    setValue("companyPhone", formatPhoneBR(e.target.value), {
                      shouldValidate: false,
                    }),
                })}
              />
              {errors.companyPhone && (
                <p className="text-xs text-destructive">{errors.companyPhone.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyEmail">E-mail da empresa</Label>
            <Input id="companyEmail" type="email" {...register("companyEmail")} />
            {errors.companyEmail && (
              <p className="text-xs text-destructive">{errors.companyEmail.message}</p>
            )}
          </div>
        </fieldset>

        <fieldset className="space-y-4 border-t border-border pt-6">
          <legend className="text-sm font-semibold text-foreground">Sua conta de acesso</legend>

          <div className="space-y-2">
            <Label htmlFor="ownerName">Seu nome</Label>
            <Input id="ownerName" {...register("ownerName")} />
            {errors.ownerName && (
              <p className="text-xs text-destructive">{errors.ownerName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ownerEmail">Seu e-mail</Label>
            <Input id="ownerEmail" type="email" autoComplete="email" {...register("ownerEmail")} />
            {errors.ownerEmail && (
              <p className="text-xs text-destructive">{errors.ownerEmail.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Crie uma senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register("password")}
            />
            <p className="text-xs text-muted-foreground">
              Mínimo 8 caracteres, com letra maiúscula e número.
            </p>
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>
        </fieldset>

        <div className="flex items-start gap-3">
          <Checkbox
            id="acceptTerms"
            checked={!!acceptTerms}
            onCheckedChange={(v) =>
              setValue("acceptTerms", (v === true) as true, { shouldValidate: true })
            }
          />
          <Label htmlFor="acceptTerms" className="text-xs leading-relaxed text-muted-foreground">
            Li e aceito os{" "}
            <Link to="/termos" className="text-accent hover:underline">
              termos de uso
            </Link>{" "}
            e a{" "}
            <Link to="/privacidade" className="text-accent hover:underline">
              política de privacidade
            </Link>
            .
          </Label>
        </div>
        {errors.acceptTerms && (
          <p className="-mt-3 text-xs text-destructive">{errors.acceptTerms.message}</p>
        )}

        <Button
          type="submit"
          className="w-full bg-brand hover:opacity-90"
          disabled={submitting || !isHydrated}
        >
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Criar minha conta
        </Button>
      </form>
    </AuthLayout>
  );
}
