// Lógica pura (sem I/O) de interpretação dos webhooks da Autentique.
//
// Extraída da rota /api/public/autentique-webhook/$ para ser testável sem
// banco nem rede. A rota importa estas funções e cuida só do I/O (validar
// secret, ler/gravar no Supabase, baixar PDF).

import { createHash } from "node:crypto";

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
        // Campos de identidade/estado não podem ser apagados por um evento
        // parcial que não os traz (normalizeSigner converte ausência em null).
        public_id: inc.public_id ?? prev.public_id,
        name: inc.name ?? prev.name,
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
        // Preserva identidade/estado quando o evento parcial não os traz.
        public_id: incoming.public_id ?? prev.public_id,
        name: incoming.name ?? prev.name,
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
  currentStatus,
}: {
  eventType: string;
  body: AutentiquePayload;
  currentSigners: SignerRecord[];
  /** Status atual do contrato no banco. "signed" é terminal e imutável. */
  currentStatus?: string | null;
}): ContractPatch {
  const patch: ContractPatch = {};
  const merged = mergeSigners(currentSigners, body);
  const effective = merged ?? currentSigners;
  if (merged) patch.autentique_signers = merged;

  // Um contrato já assinado por todas as partes é definitivo: nenhum evento
  // tardio/reentregue (deleted, expired, rejected) pode revertê-lo. Webhooks
  // chegam fora de ordem, então tratamos "signed" como terminal e só
  // permitimos atualização NÃO destrutiva dos signatários.
  if (currentStatus === "signed") {
    return patch;
  }

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

/**
 * Decide se devemos baixar e arquivar o PDF assinado.
 *
 * Verdadeiro quando o contrato está (ou acabou de ficar) assinado E ainda não
 * temos o PDF arquivado. Considerar o status já persistido — e não só a
 * transição desta requisição — garante que um reenvio do evento "signed"
 * recupere o PDF caso o primeiro download tenha falhado. Idempotente por
 * construção: assim que signed_pdf_path existe, retorna falso.
 */
export function shouldFetchSignedPdf(args: {
  patchStatus?: string;
  currentStatus?: string | null;
  signedPdfPath?: string | null;
}): boolean {
  const isSigned = args.patchStatus === "signed" || args.currentStatus === "signed";
  return isSigned && !args.signedPdfPath;
}

/**
 * Fingerprint determinístico que identifica um evento da Autentique.
 *
 * A Autentique reentrega webhooks (retries, entregas fora de ordem). Sem
 * deduplicação, cada reentrega polui contract_events com uma linha duplicada,
 * corrompendo a trilha de auditoria — inaceitável num sistema com valor
 * jurídico. Este fingerprint é a chave de idempotência: a rota grava o evento
 * com onConflict(ignoreDuplicates), então a 2ª entrega do MESMO evento é
 * silenciosamente ignorada.
 *
 * A identidade é baseada no CONTEÚDO do evento, não no payload bruto (que pode
 * ser re-serializado entre entregas): documento + tipo + signatário +
 * timestamp do estado. Dois eventos reais distintos (ex.: dois signatários
 * assinando) produzem fingerprints distintos e ambos são gravados; a mesma
 * entrega repetida produz o mesmo fingerprint e é descartada.
 *
 * Retorna null quando não há identidade estável (sem documentId): nesse caso a
 * rota não tenta deduplicar (mas também já ignora eventos sem documento).
 */
export function computeEventFingerprint(args: {
  documentId: string | null;
  eventType: string;
  body: AutentiquePayload;
}): string | null {
  if (!args.documentId) return null;
  const sig = args.body.signature;
  const signerId = sig?.public_id ?? sig?.email ?? "";
  // Timestamp do estado que o evento carrega — distingue "assinou" de "visualizou"
  // do mesmo signatário, e fixa o instante para reentregas idênticas.
  const stateTs = sig?.signed_at ?? sig?.rejected_at ?? sig?.viewed_at ?? "";
  const parts = [args.documentId, args.eventType.toLowerCase(), signerId, stateTs];
  const canonical = parts.join("|");
  return createHash("sha256").update(canonical).digest("hex");
}
