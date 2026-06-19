import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCNPJ, formatPhoneBR } from "@/lib/format";
import { getMyProfile, updateMyProfile } from "@/lib/profiles.functions";
import { getMySubscription } from "@/lib/subscriptions.functions";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Intermo" }] }),
  component: ConfiguracoesPage,
});

const schema = z.object({
  ownerName: z.string().min(2, "Informe seu nome."),
  companyFantasyName: z.string().min(2, "Informe o nome fantasia."),
  companyLegalName: z.string().min(2, "Informe a razão social."),
  companyEmail: z.string().email("E-mail inválido."),
  companyPhone: z.string().min(8, "Telefone inválido."),
  defaultMarginPct: z.coerce.number().min(0).max(99),
});
type FormData = z.infer<typeof schema>;

function ConfiguracoesPage() {
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchSub = useServerFn(getMySubscription);
  const updateProfile = useServerFn(updateMyProfile);
  const [saving, setSaving] = useState(false);

  const { data: profileData, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });
  const { data: subData } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: () => fetchSub(),
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
      defaultMarginPct: 30,
    },
  });

  useEffect(() => {
    const p = profileData?.profile;
    if (!p) return;
    reset({
      ownerName: p.owner_name ?? "",
      companyFantasyName: p.company_fantasy_name ?? "",
      companyLegalName: p.company_legal_name ?? "",
      companyEmail: p.company_email ?? "",
      companyPhone: p.company_phone ? formatPhoneBR(p.company_phone) : "",
      defaultMarginPct: Number(p.default_margin_pct ?? 30),
    });
  }, [profileData, reset]);

  async function onSubmit(values: FormData) {
    setSaving(true);
    try {
      await updateProfile({ data: values });
      toast.success("Dados salvos.");
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    } catch (err) {
      toast.error("Não foi possível salvar", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dados da empresa, margem padrão pra cálculos financeiros e situação da assinatura.
        </p>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Assinatura</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">R$ 119/mês via AbacatePay.</p>
          </div>
          <Badge variant={subData?.subscription?.status === "active" ? "default" : "outline"}>
            {subData?.subscription?.status ?? "sem assinatura"}
          </Badge>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/assinatura">Gerenciar assinatura</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da empresa</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="ownerName">Seu nome</Label>
                <Input id="ownerName" {...register("ownerName")} />
                {errors.ownerName && <p className="text-xs text-destructive">{errors.ownerName.message}</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyFantasyName">Nome fantasia</Label>
                  <Input id="companyFantasyName" {...register("companyFantasyName")} />
                  {errors.companyFantasyName && <p className="text-xs text-destructive">{errors.companyFantasyName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyLegalName">Razão social</Label>
                  <Input id="companyLegalName" {...register("companyLegalName")} />
                  {errors.companyLegalName && <p className="text-xs text-destructive">{errors.companyLegalName.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input value={profileData?.profile?.company_cnpj ? formatCNPJ(profileData.profile.company_cnpj) : ""} readOnly disabled />
                <p className="text-xs text-muted-foreground">CNPJ não pode ser alterado depois do cadastro.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyEmail">E-mail da empresa</Label>
                  <Input id="companyEmail" type="email" {...register("companyEmail")} />
                  {errors.companyEmail && <p className="text-xs text-destructive">{errors.companyEmail.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyPhone">Telefone</Label>
                  <Input
                    id="companyPhone"
                    inputMode="tel"
                    {...register("companyPhone", {
                      onChange: (e) => setValue("companyPhone", formatPhoneBR(e.target.value), { shouldValidate: false }),
                    })}
                  />
                  {errors.companyPhone && <p className="text-xs text-destructive">{errors.companyPhone.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultMarginPct">Margem padrão (%)</Label>
                <Input
                  id="defaultMarginPct"
                  type="number"
                  min={0}
                  max={99}
                  step="1"
                  {...register("defaultMarginPct")}
                />
                <p className="text-xs text-muted-foreground">
                  Usada nos cards de Financeiro pra estimar lucro sobre a receita.
                </p>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar alterações
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
