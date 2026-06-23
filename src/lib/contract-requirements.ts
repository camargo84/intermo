// Fonte única da verdade: campos obrigatórios para gerar contrato.

export type ProfileForContract = {
  company_legal_name?: string | null;
  company_fantasy_name?: string | null;
  company_cnpj?: string | null;
  company_address?: string | null;
  company_city?: string | null;
  company_uf?: string | null;
  company_cep?: string | null;
  representative_name?: string | null;
  representative_qualification?: string | null;
  comarca?: string | null;
};

export type ClientForContract = {
  name?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  email?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
};

export function profileMissingFields(p: ProfileForContract | null | undefined): string[] {
  const m: string[] = [];
  if (!p) return ["perfil não encontrado"];
  if (!p.company_legal_name) m.push("razão social");
  if (!p.company_cnpj) m.push("CNPJ");
  if (!p.company_address) m.push("endereço");
  if (!p.company_city || !p.company_uf) m.push("cidade/UF");
  if (!p.representative_name) m.push("representante legal");
  if (!p.comarca) m.push("comarca de foro");
  return m;
}

export function clientMissingFields(c: ClientForContract | null | undefined): string[] {
  const m: string[] = [];
  if (!c) return ["cliente não encontrado"];
  if (!c.name) m.push("nome");
  if (!c.cpf && !c.cnpj) m.push("CPF ou CNPJ");
  if (!c.endereco) m.push("endereço");
  if (!c.cidade || !c.uf) m.push("cidade/UF");
  return m;
}
