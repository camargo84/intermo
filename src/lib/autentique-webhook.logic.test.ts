import { describe, it, expect } from "vitest";
import {
  extractEventType,
  normalizeSigner,
  mergeSigners,
  buildPatch,
  shouldFetchSignedPdf,
  computeEventFingerprint,
  type AutentiquePayload,
  type SignerRecord,
} from "./autentique-webhook.logic";

describe("extractEventType", () => {
  it("lê event como string", () => {
    expect(extractEventType({ event: "document.signed" })).toBe("document.signed");
  });
  it("lê event.type quando event é objeto", () => {
    expect(extractEventType({ event: { type: "signature.rejected" } })).toBe("signature.rejected");
  });
  it("cai para o campo type", () => {
    expect(extractEventType({ type: "document.expired" })).toBe("document.expired");
  });
  it("retorna string vazia quando não há tipo", () => {
    expect(extractEventType({})).toBe("");
  });
});

describe("normalizeSigner", () => {
  it("extrai short_link quando link é objeto", () => {
    const s = normalizeSigner({ email: "a@b.com", link: { short_link: "https://x/y" } });
    expect(s.link).toBe("https://x/y");
  });
  it("aceita link como string", () => {
    expect(normalizeSigner({ link: "https://z" }).link).toBe("https://z");
  });
  it("normaliza ausências para null", () => {
    const s = normalizeSigner({});
    expect(s).toEqual({
      public_id: null,
      name: null,
      email: null,
      link: null,
      signed_at: null,
      rejected_at: null,
    });
  });
});

describe("mergeSigners", () => {
  it("usa snapshot completo do documento quando não há signers prévios", () => {
    const body: AutentiquePayload = {
      document: { signatures: [{ email: "a@b.com" }, { email: "c@d.com" }] },
    };
    const merged = mergeSigners([], body);
    expect(merged).toHaveLength(2);
    expect(merged?.map((s) => s.email)).toEqual(["a@b.com", "c@d.com"]);
  });

  it("preserva signed_at prévio ao aplicar snapshot que não traz o campo", () => {
    const current: SignerRecord[] = [{ email: "a@b.com", signed_at: "2026-01-01T00:00:00Z" }];
    const body: AutentiquePayload = { document: { signatures: [{ email: "a@b.com" }] } };
    const merged = mergeSigners(current, body);
    expect(merged?.[0].signed_at).toBe("2026-01-01T00:00:00Z");
  });

  it("aplica patch de um único signatário por email", () => {
    const current: SignerRecord[] = [
      { email: "a@b.com", signed_at: null },
      { email: "c@d.com", signed_at: null },
    ];
    const body: AutentiquePayload = {
      signature: { email: "c@d.com", signed_at: "2026-02-02T00:00:00Z" },
    };
    const merged = mergeSigners(current, body);
    expect(merged?.find((s) => s.email === "c@d.com")?.signed_at).toBe("2026-02-02T00:00:00Z");
    expect(merged?.find((s) => s.email === "a@b.com")?.signed_at).toBeNull();
  });

  it("retorna null quando não há nem snapshot nem signature", () => {
    expect(mergeSigners([], { type: "x" })).toBeNull();
  });

  it("patch parcial posterior não apaga signed_at já registrado", () => {
    const current: SignerRecord[] = [{ email: "a@b.com", signed_at: "2026-01-01T00:00:00Z" }];
    // evento sem signed_at (ex.: "viewed" chegando depois do "signed")
    const body: AutentiquePayload = { signature: { email: "a@b.com", viewed_at: "2026-01-05" } };
    const merged = mergeSigners(current, body);
    expect(merged?.[0].signed_at).toBe("2026-01-01T00:00:00Z");
  });

  it("patch por email NÃO apaga public_id/name já conhecidos", () => {
    const current: SignerRecord[] = [
      { public_id: "p1", name: "Fulano", email: "a@b.com", signed_at: null },
    ];
    // evento de assinatura chega só com email (sem public_id nem name)
    const body: AutentiquePayload = {
      signature: { email: "a@b.com", signed_at: "2026-01-01T00:00:00Z" },
    };
    const merged = mergeSigners(current, body);
    expect(merged?.[0].public_id).toBe("p1");
    expect(merged?.[0].name).toBe("Fulano");
    expect(merged?.[0].signed_at).toBe("2026-01-01T00:00:00Z");
  });

  it("snapshot parcial NÃO apaga public_id/name já conhecidos", () => {
    const current: SignerRecord[] = [
      { public_id: "p1", name: "Fulano", email: "a@b.com", signed_at: "2026-01-01T00:00:00Z" },
    ];
    const body: AutentiquePayload = { document: { signatures: [{ email: "a@b.com" }] } };
    const merged = mergeSigners(current, body);
    expect(merged?.[0].public_id).toBe("p1");
    expect(merged?.[0].name).toBe("Fulano");
    expect(merged?.[0].signed_at).toBe("2026-01-01T00:00:00Z");
  });
});

describe("buildPatch — regra crítica: só assina com TODOS assinados", () => {
  it("NÃO marca signed quando só parte dos signatários assinou", () => {
    const current: SignerRecord[] = [
      { email: "a@b.com", signed_at: "2026-01-01T00:00:00Z" },
      { email: "c@d.com", signed_at: null },
    ];
    const patch = buildPatch({ eventType: "document.signed", body: {}, currentSigners: current });
    expect(patch.status).toBeUndefined();
    expect(patch.signed_at).toBeUndefined();
  });

  it("marca signed quando todos assinaram, com o último signed_at", () => {
    const current: SignerRecord[] = [
      { email: "a@b.com", signed_at: "2026-01-01T00:00:00Z" },
      { email: "c@d.com", signed_at: "2026-03-03T00:00:00Z" },
    ];
    const patch = buildPatch({ eventType: "document.signed", body: {}, currentSigners: current });
    expect(patch.status).toBe("signed");
    expect(patch.signed_at).toBe("2026-03-03T00:00:00Z");
    expect(patch.last_error).toBeNull();
  });

  it("NÃO marca signed com lista de signatários vazia", () => {
    const patch = buildPatch({ eventType: "document.signed", body: {}, currentSigners: [] });
    expect(patch.status).toBeUndefined();
  });

  it("incorpora o signatário do snapshot e marca signed quando o snapshot completa todos", () => {
    const current: SignerRecord[] = [{ email: "a@b.com", signed_at: "2026-01-01T00:00:00Z" }];
    const body: AutentiquePayload = {
      document: {
        signatures: [
          { email: "a@b.com", signed_at: "2026-01-01T00:00:00Z" },
          { email: "c@d.com", signed_at: "2026-02-02T00:00:00Z" },
        ],
      },
    };
    const patch = buildPatch({ eventType: "document.signed", body, currentSigners: current });
    expect(patch.status).toBe("signed");
    expect(patch.autentique_signers).toHaveLength(2);
  });
});

describe("buildPatch — outros estados terminais", () => {
  it("rejected", () => {
    expect(
      buildPatch({ eventType: "signature.rejected", body: {}, currentSigners: [] }).status,
    ).toBe("rejected");
  });
  it("expired", () => {
    expect(buildPatch({ eventType: "document.expired", body: {}, currentSigners: [] }).status).toBe(
      "expired",
    );
  });
  it("deleted vira error com last_error", () => {
    const patch = buildPatch({ eventType: "document.deleted", body: {}, currentSigners: [] });
    expect(patch.status).toBe("error");
    expect(patch.last_error).toBe("Documento removido na Autentique");
  });
});

describe("buildPatch — 'signed' é terminal e imutável (webhooks fora de ordem)", () => {
  const signed: SignerRecord[] = [
    { email: "a@b.com", signed_at: "2026-01-01T00:00:00Z" },
    { email: "c@d.com", signed_at: "2026-02-02T00:00:00Z" },
  ];

  it("deleted tardio NÃO reverte um contrato já assinado", () => {
    const patch = buildPatch({
      eventType: "document.deleted",
      body: {},
      currentSigners: signed,
      currentStatus: "signed",
    });
    expect(patch.status).toBeUndefined();
    expect(patch.last_error).toBeUndefined();
  });

  it("expired tardio NÃO reverte um contrato já assinado", () => {
    const patch = buildPatch({
      eventType: "document.expired",
      body: {},
      currentSigners: signed,
      currentStatus: "signed",
    });
    expect(patch.status).toBeUndefined();
  });

  it("rejected tardio NÃO reverte um contrato já assinado", () => {
    const patch = buildPatch({
      eventType: "signature.rejected",
      body: {},
      currentSigners: signed,
      currentStatus: "signed",
    });
    expect(patch.status).toBeUndefined();
  });

  it("ainda mescla signers de forma não destrutiva mesmo quando terminal", () => {
    const body: AutentiquePayload = {
      signature: { email: "a@b.com", link: { short_link: "https://novo/link" } },
    };
    const patch = buildPatch({
      eventType: "document.viewed",
      body,
      currentSigners: signed,
      currentStatus: "signed",
    });
    expect(patch.status).toBeUndefined();
    expect(patch.autentique_signers?.find((s) => s.email === "a@b.com")?.link).toBe(
      "https://novo/link",
    );
    // não apaga a assinatura prévia
    expect(patch.autentique_signers?.find((s) => s.email === "a@b.com")?.signed_at).toBe(
      "2026-01-01T00:00:00Z",
    );
  });

  it("status não-terminal (sent) ainda transiciona normalmente", () => {
    const patch = buildPatch({
      eventType: "signature.rejected",
      body: {},
      currentSigners: signed,
      currentStatus: "sent",
    });
    expect(patch.status).toBe("rejected");
  });
});

describe("shouldFetchSignedPdf — recuperação idempotente do PDF assinado", () => {
  it("baixa na transição para signed quando ainda não há PDF", () => {
    expect(
      shouldFetchSignedPdf({ patchStatus: "signed", currentStatus: "sent", signedPdfPath: null }),
    ).toBe(true);
  });

  it("REGRESSÃO: reenvio do 'signed' recupera PDF após falha (patch vazio, já signed, sem PDF)", () => {
    // patchStatus undefined porque 'signed' é terminal e buildPatch não re-emite status;
    // sem este caminho, um download que falhou na 1ª entrega nunca seria refeito.
    expect(
      shouldFetchSignedPdf({
        patchStatus: undefined,
        currentStatus: "signed",
        signedPdfPath: null,
      }),
    ).toBe(true);
  });

  it("NÃO baixa de novo quando o PDF já está arquivado (idempotência)", () => {
    expect(
      shouldFetchSignedPdf({
        patchStatus: "signed",
        currentStatus: "signed",
        signedPdfPath: "user/abc-signed.pdf",
      }),
    ).toBe(false);
  });

  it("NÃO baixa quando o contrato não está assinado", () => {
    expect(
      shouldFetchSignedPdf({ patchStatus: undefined, currentStatus: "sent", signedPdfPath: null }),
    ).toBe(false);
  });
});

describe("computeEventFingerprint — chave de idempotência do webhook", () => {
  it("reentrega idêntica do mesmo evento gera o MESMO fingerprint", () => {
    const body: AutentiquePayload = {
      type: "signature.accepted",
      signature: { public_id: "p1", email: "a@b.com", signed_at: "2026-01-01T00:00:00Z" },
    };
    const fp1 = computeEventFingerprint({
      documentId: "doc1",
      eventType: "signature.accepted",
      body,
    });
    const fp2 = computeEventFingerprint({
      documentId: "doc1",
      eventType: "signature.accepted",
      body,
    });
    expect(fp1).toBe(fp2);
    expect(fp1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("dois signatários distintos assinando geram fingerprints DIFERENTES", () => {
    const a: AutentiquePayload = {
      signature: { public_id: "p1", email: "a@b.com", signed_at: "2026-01-01T00:00:00Z" },
    };
    const b: AutentiquePayload = {
      signature: { public_id: "p2", email: "b@b.com", signed_at: "2026-01-01T00:00:00Z" },
    };
    const fpA = computeEventFingerprint({ documentId: "doc1", eventType: "signed", body: a });
    const fpB = computeEventFingerprint({ documentId: "doc1", eventType: "signed", body: b });
    expect(fpA).not.toBe(fpB);
  });

  it("mesmo signatário: 'viewed' e 'signed' geram fingerprints DIFERENTES", () => {
    const viewed: AutentiquePayload = {
      signature: { public_id: "p1", viewed_at: "2026-01-01T00:00:00Z" },
    };
    const signed: AutentiquePayload = {
      signature: { public_id: "p1", signed_at: "2026-01-02T00:00:00Z" },
    };
    const fpV = computeEventFingerprint({ documentId: "doc1", eventType: "viewed", body: viewed });
    const fpS = computeEventFingerprint({ documentId: "doc1", eventType: "signed", body: signed });
    expect(fpV).not.toBe(fpS);
  });

  it("mesmo evento em documentos distintos gera fingerprints DIFERENTES", () => {
    const body: AutentiquePayload = {
      signature: { public_id: "p1", signed_at: "2026-01-01T00:00:00Z" },
    };
    const fp1 = computeEventFingerprint({ documentId: "doc1", eventType: "signed", body });
    const fp2 = computeEventFingerprint({ documentId: "doc2", eventType: "signed", body });
    expect(fp1).not.toBe(fp2);
  });

  it("sem documentId retorna null (sem identidade estável, rota não deduplica)", () => {
    const body: AutentiquePayload = { signature: { email: "a@b.com" } };
    expect(computeEventFingerprint({ documentId: null, eventType: "signed", body })).toBeNull();
  });

  it("tipo de evento case-insensitive: 'SIGNED' e 'signed' colidem (mesmo evento)", () => {
    const body: AutentiquePayload = {
      signature: { public_id: "p1", signed_at: "2026-01-01T00:00:00Z" },
    };
    const up = computeEventFingerprint({ documentId: "doc1", eventType: "SIGNED", body });
    const lo = computeEventFingerprint({ documentId: "doc1", eventType: "signed", body });
    expect(up).toBe(lo);
  });
});
