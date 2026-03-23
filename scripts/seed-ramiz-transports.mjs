import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const workspaceRoot = process.cwd();
const envPath = path.join(workspaceRoot, ".env");
const envLocalPath = path.join(workspaceRoot, ".env.local");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
}

function parseDate(dateStr) {
  const [day, month, year] = dateStr.split(".").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function formatContainerNumber(index) {
  // Simple but unique-enough container numbers for testing
  return `CTNR${(index + 1).toString().padStart(6, "0")}`;
}

function formatJobNumber(index) {
  return `JOB-${(index + 1).toString().padStart(4, "0")}`;
}

function calculateWaitingMinutes(waitingFrom, waitingTo) {
  if (!waitingFrom || !waitingTo) return 0;
  const [fromH, fromM] = waitingFrom.split(":").map(Number);
  const [toH, toM] = waitingTo.split(":").map(Number);
  if (
    !Number.isFinite(fromH) || !Number.isFinite(fromM) ||
    !Number.isFinite(toH) || !Number.isFinite(toM)
  ) {
    return 0;
  }
  let start = fromH * 60 + fromM;
  let end = toH * 60 + toM;
  let diff = end - start;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function calculateWaitingSurcharge(waitingMinutes) {
  const WAITING_FREE_MINUTES = 30;
  const WAITING_SURCHARGE_STEP_MINUTES = 30;
  const WAITING_SURCHARGE_STEP_EUR = 15;
  if (waitingMinutes <= WAITING_FREE_MINUTES) return 0;
  const chargeableMinutes = waitingMinutes - WAITING_FREE_MINUTES;
  const steps = Math.ceil(chargeableMinutes / WAITING_SURCHARGE_STEP_MINUTES);
  return steps * WAITING_SURCHARGE_STEP_EUR;
}

function calculateLegTotals(basePrice, waitingFrom, waitingTo) {
  const waitingMinutes = calculateWaitingMinutes(waitingFrom, waitingTo);
  const waitingSurcharge = calculateWaitingSurcharge(waitingMinutes);
  const totalPrice = basePrice + waitingSurcharge;
  return { waitingMinutes, waitingSurcharge, totalPrice };
}

function calculateImoSurcharge(isIMO) {
  const IMO_SURCHARGE_EUR = 25;
  return isIMO ? IMO_SURCHARGE_EUR : 0;
}

async function main() {
  const START_DATE = parseDate("16.03.2026");
  const END_DATE = parseDate("20.04.2026");
  const DAYS_RANGE = Math.round((END_DATE - START_DATE) / (24 * 60 * 60 * 1000)) + 1;

  const manager = await prisma.user.findFirst({
    where: {
      role: "MANAGER",
      OR: [
        { name: "Ramiz Ibadov" },
        { companyName: { contains: "Ramiz Ibadov" } },
      ],
    },
  });

  if (!manager) {
    console.error("Kein MANAGER 'Ramiz Ibadov' gefunden.");
    process.exit(1);
  }

  const contractor = await prisma.user.findFirst({
    where: {
      role: "CONTRACTOR",
      OR: [
        { name: "Firma1" },
        { companyName: "Firma1" },
      ],
    },
  });

  if (!contractor) {
    console.error("Kein CONTRACTOR 'Firma1' gefunden.");
    process.exit(1);
  }

  const workspace = await prisma.workspace.findFirst({
    where: { managerId: manager.id },
  });

  if (!workspace) {
    console.error("Kein Workspace für den Auftraggeber 'Firma1' gefunden.");
    process.exit(1);
  }

  const driver = await prisma.user.findFirst({
    where: {
      role: "DRIVER",
      workspaceId: workspace.id,
    },
  });

  if (!driver) {
    console.error("Kein Fahrer (DRIVER) gefunden, bitte zunächst einen Fahrer anlegen.");
    process.exit(1);
  }

  console.log("Verwende Auftragnehmer (MANAGER):", manager.name, manager.id);
  console.log("Verwende Auftraggeber (CONTRACTOR):", contractor.name, contractor.id);
  console.log("Verwende Fahrer:", driver.name, driver.id);
  console.log("Workspace:", workspace.name, workspace.id);

  const origins = ["Hamburg CTB", "Hamburg CTA", "Bremerhaven", "Wilhelmshaven"];
  const destinations = ["Hamburg EG", "Magdeburg", "Berlin", "Hannover", "Leipzig"];

  for (let index = 0; index < 40; index += 1) {
    const dayOffset = index % DAYS_RANGE;
    const date = addDays(START_DATE, dayOffset);

    const legsCount = (index % 3) + 1; // 1 bis 3 Sub-Touren

    const legsData = [];
    let transportBasePrice = 0;
    let transportWaitingMinutes = 0;
    let transportWaitingSurcharge = 0;

    for (let sequence = 1; sequence <= legsCount; sequence += 1) {
      const fromPlace = origins[(index + sequence) % origins.length];
      const toPlace = destinations[(index + sequence) % destinations.length];

      const basePrice = 150 + 25 * sequence + 10 * (index % 4); // etwas Variation

      // Jede zweite Tour hat Wartezeit
      const hasWaiting = (index + sequence) % 2 === 0;
      const waitingFrom = hasWaiting ? "10:00" : null;
      const waitingTo = hasWaiting ? "12:00" : null;

      const { waitingMinutes, waitingSurcharge, totalPrice } = calculateLegTotals(
        basePrice,
        waitingFrom,
        waitingTo,
      );

      const isIMO = (index + sequence) % 5 === 0; // gelegentlich ADR/IMO

      transportBasePrice += basePrice;
      transportWaitingMinutes += waitingMinutes;
      transportWaitingSurcharge += waitingSurcharge;

      legsData.push({
        sequence,
        fromPlace,
        toPlace,
        waitingFrom,
        waitingTo,
        isIMO,
        basePrice,
        waitingMinutes,
        waitingSurcharge,
        totalPrice,
      });
    }

    const anyLegIsIMO = legsData.some((leg) => leg.isIMO);
    const imoSurcharge = calculateImoSurcharge(anyLegIsIMO);
    const price = legsData.reduce((sum, leg) => sum + leg.totalPrice, 0) + imoSurcharge;

    const orderNumber = formatContainerNumber(index);
    const jobNumber = formatJobNumber(index);

    const notes = anyLegIsIMO
      ? "Teilweise ADR / IMO-Fracht"
      : "Standard-Containertransport";

    const created = await prisma.transport.create({
      data: {
        date,
        orderNumber,
        jobNumber,
        fromPlace: legsData[0].fromPlace,
        toPlace: legsData[legsData.length - 1].toPlace,
        containerSize: "SIZE_40",
        isIMO: anyLegIsIMO,
        waitingFrom: legsData[0].waitingFrom,
        waitingTo: legsData[legsData.length - 1].waitingTo,
        basePrice: transportBasePrice,
        waitingMinutes: transportWaitingMinutes,
        waitingSurcharge: transportWaitingSurcharge,
        imoSurcharge: imoSurcharge,
        price,
        notes,
        workspaceId: workspace.id,
        driverId: driver.id,
        contractorId: contractor.id,
        sellerId: manager.id,
        legs: {
          create: legsData,
        },
      },
    });

    console.log(`Transport ${index + 1}/40 angelegt:`, created.id, orderNumber, jobNumber);
  }

  console.log("Fertig: 40 Transports für Ramiz Ibadov / Firma1 erzeugt.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
