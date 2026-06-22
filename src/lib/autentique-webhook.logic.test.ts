import { describe, it, expect } from "vitest";
import {
  extractEventType,
  normalizeSigner,
  mergeSigners,
  buildPatch,
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
