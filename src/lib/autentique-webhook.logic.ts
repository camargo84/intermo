// Lógica pura (sem I/O) de interpretação dos webhooks da Autentique.
//
// Extraída da rota /api/public/autentique-webhook/$ para ser testável sem
// banco nem rede. A rota importa estas funções e cuida só do I/O (validar
// secret, ler/gravar no Supabase, baixar PDF).

export interface AutentiquePayload {
  event?: { type?: string } | string;
  type?: string;
  document?: {
    id?: string;
    name?: string;
    signatures?: Array<RawSignature>;
  };
  signature?: RawSignature;
  partner?: { document_id?: string };
  document_id?: string;
}

export interface RawSignature {
  public_id?: string;
  name?: string;
  email?: string;
  signed_at?: string | null;
  rejected_at?: string | null;
  viewed_at?: string | null;
  link?: { short_link?: string } | string | null;
  action?: { name?: string } | string;
}

export interface SignerRecord {
  public_id?: string | null;
  name?: string | null;
  email?: string | null;
  link?: string | null;
  signed_at?: string | null;
  rejected_at?: string | null;
}

export interface ContractPatch {
  status?: string;
  signed_at?: string | null;
  last_error?: string | null;
  autentique_signers?: SignerRecord[];
}

export function extractEventType(body: AutentiquePayload): string {
  if (typeof body.event === "string") return body.event;
  if (body.event && typeof body.event === "object" && body.event.type) return body.event.type;
  if (typeof body.type === "string") return body.type;
  return "";
}

export function normalizeSigner(raw: RawSignature): SignerRecord {
  const link = typeof raw.link === "string" ? raw.link : (raw.link?.short_link ?? null);
  return {
    public_id: raw.public_id ?? null,
    name: raw.name ?? null,
    email: raw.email ?? null,
    link,
    signed_at: raw.signed_at ?? null,
    rejected_at: raw.rejected_at ?? null,
  };
}

export function mergeSigners(
  current: SignerRecord[],
  body: AutentiquePayload,
): SignerRecord[] | null {
  // Snapshot completo do documento, se vier
  if (body.document?.signatures?.length) {
    const incoming = body.document.signatures.map(normalizeSigner);
    // Se já temos signers conhecidos, preservar campos não vindos no snapshot
    if (!current.length) return incoming;
    return incoming.map((inc) => {
      const prev = current.find(
        (s) =>
          (inc.public_id && s.public_id === inc.public_id) || (inc.email && s.email === inc.email),
      );
      // Preserva campos de estado já conhecidos quando o snapshot não os traz.
      // normalizeSigner converte ausência em null, então um snapshot parcial não
      // pode apagar uma assinatura/rejeição já registrada (o status "signed"
      // depende de signed_at — perdê-lo reverteria um contrato já assinado).
      if (!prev) return inc;
      return {
        ...prev,
        ...inc,
        signed_at: inc.signed_at ?? prev.signed_at,
        rejected_at: inc.rejected_at ?? prev.rejected_at,
        link: inc.link ?? prev.link,
      };
    });
  }
  // Patch de um único signatário
  if (body.signature) {
    const incoming = normalizeSigner(body.signature);
    const key = incoming.public_id ?? incoming.email;
    if (!key) return null;
    const next = current.length ? [...current] : [];
    const idx = next.findIndex(
      (s) =>
        (incoming.public_id && s.public_id === incoming.public_id) ||
        (incoming.email && s.email === incoming.email),
    );
    if (idx >= 0) {
      const prev = next[idx];
      next[idx] = {
        ...prev,
        ...incoming,
        signed_at: incoming.signed_at ?? prev.signed_at,
        rejected_at: incoming.rejected_at ?? prev.rejected_at,
        link: incoming.link ?? prev.link,
      };
    } else {
      next.push(incoming);
    }
    return next;
  }
  return null;
}

export function buildPatch({
  eventType,
  body,
  currentSigners,
}: {
  eventType: string;
  body: AutentiquePayload;
  currentSigners: SignerRecord[];
}): ContractPatch {
  const patch: ContractPatch = {};
  const merged = mergeSigners(currentSigners, body);
  const effective = merged ?? currentSigners;
  if (merged) patch.autentique_signers = merged;

  const ev = eventType.toLowerCase();

  if (ev.includes("rejected")) {
    patch.status = "rejected";
  } else if (ev.includes("expired")) {
    patch.status = "expired";
  } else if (ev.includes("deleted")) {
    patch.status = "error";
    patch.last_error = "Documento removido na Autentique";
  } else if (ev.includes("signed")) {
    // Só marca contrato como assinado quando TODOS os signatários assinaram
    const everyone = effective.length > 0 && effective.every((s) => !!s.signed_at);
    if (everyone) {
      patch.status = "signed";
      // Maior signed_at = último a assinar
      const last = effective
        .map((s) => s.signed_at)
        .filter((x): x is string => !!x)
        .sort()
        .pop();
      patch.signed_at = last ?? new Date().toISOString();
      patch.last_error = null;
    }
  }

  return patch;
}
