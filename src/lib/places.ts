import { prisma } from "@/lib/prisma";

type PlaceDelegate = {
  findMany: (args: { where?: { workspaceId: string }; select: { name: true }; orderBy: { name: "asc" } }) => Promise<Array<{ name: string }>>;
  upsert: (args: {
    where: { workspaceId_name: { workspaceId: string; name: string } };
    update: Record<string, never>;
    create: { workspaceId: string; name: string };
  }) => Promise<unknown>;
};

function getPlaceDelegate(): PlaceDelegate | null {
  const candidate = (prisma as unknown as { place?: PlaceDelegate }).place;
  return candidate ?? null;
}

export async function listPlaceNames(workspaceId: string): Promise<string[]> {
  const placeDelegate = getPlaceDelegate();
  if (placeDelegate) {
    const places = await placeDelegate.findMany({
      where: { workspaceId },
      select: { name: true },
      orderBy: { name: "asc" },
    });
    return places.map((place) => place.name);
  }

  const transports = await prisma.transport.findMany({
    where: { workspaceId },
    select: { fromPlace: true, toPlace: true },
  });

  const unique = new Set<string>();
  for (const transport of transports) {
    if (transport.fromPlace) unique.add(transport.fromPlace);
    if (transport.toPlace) unique.add(transport.toPlace);
  }

  return Array.from(unique).sort((a, b) => a.localeCompare(b));
}

export async function storePlaceIfPossible(workspaceId: string, name: string): Promise<void> {
  const trimmedName = name.trim();
  if (!trimmedName) return;

  const placeDelegate = getPlaceDelegate();
  if (!placeDelegate) return;

  await placeDelegate.upsert({
    where: {
      workspaceId_name: {
        workspaceId,
        name: trimmedName,
      },
    },
    update: {},
    create: {
      workspaceId,
      name: trimmedName,
    },
  });
}