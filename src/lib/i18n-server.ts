import { cookies } from "next/headers";
import { DEFAULT_LOCALE, type Locale, resolveLocale } from "@/lib/i18n";

export async function getLocaleFromRequest(): Promise<Locale> {
  const store = await cookies();
  const raw = store.get("fleetlog-lang")?.value;
  return resolveLocale(raw ?? DEFAULT_LOCALE);
}
