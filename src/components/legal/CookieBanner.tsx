import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const KEY = "intermo:cookie-consent";

export function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = window.localStorage.getItem(KEY);
    if (!v) setShow(true);
  }, []);

  if (!show) return null;

  const persist = (value: "accepted" | "rejected") => {
    try {
      window.localStorage.setItem(KEY, value);
    } catch {
      // ignore
    }
    setShow(false);
  };

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-lg border border-border bg-background/95 p-4 shadow-lg backdrop-blur"
    >
      <p className="text-sm text-foreground">
        Usamos cookies essenciais pra você usar a Intermo com segurança. Você pode aceitar
        cookies opcionais (analytics) pra nos ajudar a melhorar. Veja a{" "}
        <Link to="/privacidade" className="underline">
          política de privacidade
        </Link>
        .
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => persist("rejected")}>
          Recusar opcionais
        </Button>
        <Button size="sm" onClick={() => persist("accepted")}>
          Aceitar todos
        </Button>
      </div>
    </div>
  );
}
