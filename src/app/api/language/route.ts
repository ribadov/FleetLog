import { NextResponse } from "next/server";
import { resolveLocale } from "@/lib/i18n";

export async function POST(req: Request) {
  const { locale } = (await req.json()) as { locale?: string };
  const normalized = resolveLocale(locale);

  const response = NextResponse.json({ ok: true, locale: normalized });
  response.cookies.set("fleetlog-lang", normalized, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
