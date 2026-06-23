import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCNPJ, formatPhoneBR } from "@/lib/format";
import { getMyProfile, updateMyProfile } from "@/lib/profiles.functions";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Complete seu cadastro — inTermo" }] }),
  component: OnboardingPage,
});

const onlyDigits = (s: string | undefined) => (s ?? "").replace(/\D/g, "");

const schema = z.object({
  ownerName: z.string().min(2, "Informe seu nome."),
  companyFantasyName: z.string().min(2, "Informe o nome fantasia."),
  companyLegalName: z.string().min(2, "Informe a razão social."),
  companyEmail: z.string().email("E-mail inválido."),
  companyPhone: z.string().refine((v) => onlyDigits(v).length >= 10, "Telefone inválido."),
  companyCnpj: z
    .string()
    .refine((v) => onlyDigits(v).length === 14, "CNPJ deve ter 14 dígitos."),
  companyAddress: z.string().min(3, "Informe o endereço."),
  companyCity: z.string().min(2, "Informe a cidade."),
  companyUf: z.string().length(2, "UF deve ter 2 letras."),
  companyCep: z
    .string()
    .refine((v) => onlyDigits(v).length === 8, "CEP deve ter 8 dígitos."),
  representativeName: z.string().min(2, "Informe o representante legal."),
  representativeCpf: z
    .string()
    .refine((v) => onlyDigits(v).length === 11, "CPF deve ter 11 dígitos."),
  representativeQualification: z.string().optional(),
  comarca: z.string().min(2, "Informe a comarca de foro."),
});
type FormData = z.infer<typeof schema>;

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const updateProfile = useServerFn(updateMyProfile);
  const [saving, setSaving] = useState(false);

  const { data: profileData, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      ownerName: "",
      companyFantasyName: "",
      companyLegalName: "",
      companyEmail: "",
      companyPhone: "",
      companyCnpj: "",
      companyAddress: "",
      companyCity: "",
      companyUf: "",
      companyCep: "",
      representativeName: "",
      representativeCpf: "",
      representativeQualification: "Sócio administrador",
      comarca: "",
    },
  });

  // Pré-preenche com dados do Google (full_name / email) e do profile (se já existe parcialmente).
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const meta = (u.user?.user_metadata ?? {}) as Record<string, string | undefined>;
      const p = profileData?.profile;
      reset({
        ownerName: p?.owner_name ?? meta.full_name ?? meta.name ?? "",
        companyFantasyName: p?.company_fantasy_name ?? "",
        companyLegalName: p?.company_legal_name ?? "",
        companyEmail: p?.company_email ?? u.user?.email ?? "",
        companyPhone: p?.company_phone ? formatPhoneBR(p.company_phone) : "",
        companyCnpj: p?.company_cnpj ? formatCNPJ(p.company_cnpj) : "",
        companyAddress: p?.company_address ?? "",
        companyCity: p?.company_city ?? "",
        companyUf: p?.company_uf ?? "",
        companyCep: p?.company_cep ?? "",
        representativeName: p?.representative_name ?? meta.full_name ?? meta.name ?? "",
        representativeCpf: p?.representative_cpf ?? "",
        representativeQualification: p?.representative_qualification ?? "Sócio administrador",
        comarca: p?.comarca ?? "",
      });
    })();
  }, [profileData, reset]);

  const cnpjLocked = Boolean(profileData?.profile?.company_cnpj);

  async function onSubmit(values: FormData) {
    setSaving(true);
    try {
      await updateProfile({
        data: {
          ...values,
          companyCnpj: onlyDigits(values.companyCnpj),
          companyPhone: onlyDigits(values.companyPhone),
          companyCep: onlyDigits(values.companyCep),
          representativeCpf: onlyDigits(values.representativeCpf),
          companyUf: values.companyUf.toUpperCase(),
          defaultMarginPct: 30,
        },
      });
      toast.success("Cadastro completo!", { description: "Tudo pronto para gerar contratos." });
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      navigate({ to: "/chat" });
    } catch (err) {
      toast.error("Não foi possível salvar", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Complete seu cadastro</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Esses dados aparecem em todos os contratos que você gerar. Você só preenche uma vez.
        </p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Empresa</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Seu nome" error={errors.ownerName?.message}>
              <Input {...register("ownerName")} />
            </Field>
            <Field label="Nome fantasia" error={errors.companyFantasyName?.message}>
              <Input {...register("companyFantasyName")} />
            </Field>
            <Field label="Razão social" error={errors.companyLegalName?.message}>
              <Input {...register("companyLegalName")} />
            </Field>
            <Field label="CNPJ" error={errors.companyCnpj?.message}>
              <Input
                {...register("companyCnpj")}
                disabled={cnpjLocked}
                onChange={(e) => setValue("companyCnpj", formatCNPJ(e.target.value))}
                placeholder="00.000.000/0000-00"
              />
            </Field>
            <Field label="E-mail comercial" error={errors.companyEmail?.message}>
              <Input type="email" {...register("companyEmail")} />
            </Field>
            <Field label="Telefone" error={errors.companyPhone?.message}>
              <Input
                {...register("companyPhone")}
                onChange={(e) => setValue("companyPhone", formatPhoneBR(e.target.value))}
                placeholder="(11) 99999-9999"
              />
            </Field>
            <Field label="Endereço" error={errors.companyAddress?.message} className="sm:col-span-2">
              <Input {...register("companyAddress")} placeholder="Rua, número, complemento" />
            </Field>
            <Field label="Cidade" error={errors.companyCity?.message}>
              <Input {...register("companyCity")} />
            </Field>
            <Field label="UF" error={errors.companyUf?.message}>
              <Input {...register("companyUf")} maxLength={2} placeholder="SP" />
            </Field>
            <Field label="CEP" error={errors.companyCep?.message}>
              <Input {...register("companyCep")} placeholder="00000-000" />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Representante legal & foro</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome do representante" error={errors.representativeName?.message}>
              <Input {...register("representativeName")} />
            </Field>
            <Field label="CPF do representante" error={errors.representativeCpf?.message}>
              <Input {...register("representativeCpf")} placeholder="000.000.000-00" />
            </Field>
            <Field
              label="Qualificação"
              error={errors.representativeQualification?.message}
              className="sm:col-span-2"
            >
              <Input
                {...register("representativeQualification")}
                placeholder="Sócio administrador"
              />
            </Field>
            <Field label="Comarca de foro" error={errors.comarca?.message} className="sm:col-span-2">
              <Input {...register("comarca")} placeholder="São Paulo/SP" />
            </Field>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar e continuar
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-sm">{label}</Label>
      {children}
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
