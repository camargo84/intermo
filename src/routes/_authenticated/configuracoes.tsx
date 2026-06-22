import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FolderSync, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCNPJ, formatPhoneBR } from "@/lib/format";
import {
  getMyProfile,
  updateMyProfile,
  uploadMyLogo,
  getMyLogoSignedUrl,
  reorganizeAutentiqueFolder,
} from "@/lib/profiles.functions";
import { getMySubscription } from "@/lib/subscriptions.functions";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — inTermo" }] }),
  component: ConfiguracoesPage,
});

const schema = z.object({
  ownerName: z.string().min(2, "Informe seu nome."),
  companyFantasyName: z.string().min(2, "Informe o nome fantasia."),
  companyLegalName: z.string().min(2, "Informe a razão social."),
  companyEmail: z.string().email("E-mail inválido."),
  companyPhone: z.string().min(8, "Telefone inválido."),
  defaultMarginPct: z.number().min(0).max(99),
  companyAddress: z.string().optional(),
  companyCity: z.string().optional(),
  companyUf: z.string().optional(),
  companyCep: z.string().optional(),
  representativeName: z.string().optional(),
  representativeCpf: z.string().optional(),
  representativeQualification: z.string().optional(),
  comarca: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

function ConfiguracoesPage() {
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchSub = useServerFn(getMySubscription);
  const updateProfile = useServerFn(updateMyProfile);
  const uploadLogo = useServerFn(uploadMyLogo);
  const fetchLogoUrl = useServerFn(getMyLogoSignedUrl);
  const reorganizeFolder = useServerFn(reorganizeAutentiqueFolder);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reorganizing, setReorganizing] = useState(false);

  const { data: profileData, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });
  const { data: subData } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: () => fetchSub(),
  });
  const { data: logoData, refetch: refetchLogo } = useQuery({
    queryKey: ["my-logo-url"],
    queryFn: () => fetchLogoUrl(),
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
      companyAddress: "",
      companyCity: "",
      companyUf: "",
      companyCep: "",
      representativeName: "",
      representativeCpf: "",
      representativeQualification: "",
      comarca: "",
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
      companyAddress: p.company_address ?? "",
      companyCity: p.company_city ?? "",
      companyUf: p.company_uf ?? "",
      companyCep: p.company_cep ?? "",
      representativeName: p.representative_name ?? "",
      representativeCpf: p.representative_cpf ?? "",
      representativeQualification: p.representative_qualification ?? "",
      comarca: p.comarca ?? "",
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

  async function handleLogoFile(file: File) {
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error("Use PNG ou JPG.");
      return;
    }
    if (file.size > 2_000_000) {
      toast.error("Arquivo acima de 2MB.");
      return;
    }
    setUploading(true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.byteLength; i++) bin += String.fromCharCode(buf[i]);
      const base64 = btoa(bin);
      await uploadLogo({ data: { base64, mime: file.type as "image/png" | "image/jpeg" } });
      await refetchLogo();
      toast.success("Logo atualizado.");
    } catch (err) {
      toast.error("Falha ao enviar logo", { description: err instanceof Error ? err.message : "" });
    } finally {
      setUploading(false);
    }
  }

  async function handleReorganize() {
    setReorganizing(true);
    try {
      await reorganizeFolder({ data: undefined });
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Pasta da Autentique reorganizada.", {
        description: "Os próximos contratos enviados vão para a nova pasta.",
      });
    } catch (err) {
      toast.error("Não foi possível reorganizar", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    } finally {
      setReorganizing(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dados da empresa, representante legal, comarca de foro e logo — usados no contrato.
        </p>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Assinatura</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">R$ 119/mês — uso ilimitado.</p>
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
          <CardTitle className="text-base">Logo da empresa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border bg-muted">
              {logoData?.url ? (
                <img
                  src={logoData.url}
                  alt="Logo da empresa"
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-xs text-muted-foreground">sem logo</span>
              )}
            </div>
            <Label className="cursor-pointer">
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleLogoFile(e.target.files[0])}
              />
              <span className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent">
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Enviar logo (PNG/JPG, até 2MB)
              </span>
            </Label>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Aparece no canto superior direito de cada página do contrato.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integração Autentique</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Seus contratos são organizados em uma pasta exclusiva na sua conta Autentique. Use o
            botão abaixo se você renomeou a empresa ou quer recriar a pasta — os contratos já
            enviados continuam onde estão.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={handleReorganize}
            disabled={reorganizing}
          >
            {reorganizing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FolderSync className="mr-2 h-4 w-4" />
            )}
            Reorganizar no Autentique
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
                {errors.ownerName && (
                  <p className="text-xs text-destructive">{errors.ownerName.message}</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyFantasyName">Nome fantasia</Label>
                  <Input id="companyFantasyName" {...register("companyFantasyName")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyLegalName">Razão social</Label>
                  <Input id="companyLegalName" {...register("companyLegalName")} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input
                  value={
                    profileData?.profile?.company_cnpj
                      ? formatCNPJ(profileData.profile.company_cnpj)
                      : ""
                  }
                  readOnly
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  CNPJ não pode ser alterado depois do cadastro.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyEmail">E-mail da empresa</Label>
                  <Input id="companyEmail" type="email" {...register("companyEmail")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyPhone">Telefone</Label>
                  <Input
                    id="companyPhone"
                    inputMode="tel"
                    {...register("companyPhone", {
                      onChange: (e) =>
                        setValue("companyPhone", formatPhoneBR(e.target.value), {
                          shouldValidate: false,
                        }),
                    })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyAddress">Endereço (rua, número)</Label>
                <Input id="companyAddress" {...register("companyAddress")} />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="companyCity">Cidade</Label>
                  <Input id="companyCity" {...register("companyCity")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyUf">UF</Label>
                  <Input id="companyUf" maxLength={2} {...register("companyUf")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyCep">CEP</Label>
                  <Input id="companyCep" {...register("companyCep")} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="representativeName">Representante legal</Label>
                  <Input id="representativeName" {...register("representativeName")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="representativeCpf">CPF do representante</Label>
                  <Input id="representativeCpf" {...register("representativeCpf")} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="representativeQualification">
                  Qualificação do representante (cargo, nacionalidade…)
                </Label>
                <Input
                  id="representativeQualification"
                  placeholder="Ex.: brasileiro, casado, administrador, RG 1234567 SSP/SP"
                  {...register("representativeQualification")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="comarca">Comarca de foro</Label>
                <Input id="comarca" placeholder="Ex.: São Paulo/SP" {...register("comarca")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultMarginPct">Margem padrão (%)</Label>
                <Input
                  id="defaultMarginPct"
                  type="number"
                  min={0}
                  max={99}
                  step="1"
                  {...register("defaultMarginPct", { valueAsNumber: true })}
                />
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
