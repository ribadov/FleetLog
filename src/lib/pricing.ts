export const WAITING_FREE_MINUTES = 30
export const WAITING_SURCHARGE_STEP_MINUTES = 30
export const WAITING_SURCHARGE_STEP_EUR = 15
export const IMO_SURCHARGE_EUR = 25

type TimeValue = string | null | undefined

function parseClock(value: TimeValue): number | null {
  if (!value) return null
  const normalized = value.trim()
  const match = normalized.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null

  return hours * 60 + minutes
}

export function calculateWaitingMinutes(waitingFrom: TimeValue, waitingTo: TimeValue): number {
  const start = parseClock(waitingFrom)
  const end = parseClock(waitingTo)

  if (start === null || end === null) return 0

  let diff = end - start
  if (diff < 0) {
    diff += 24 * 60
  }

  return diff
}

export function calculateWaitingSurcharge(waitingMinutes: number): number {
  if (waitingMinutes <= WAITING_FREE_MINUTES) return 0

  const chargeableMinutes = waitingMinutes - WAITING_FREE_MINUTES
  const steps = Math.ceil(chargeableMinutes / WAITING_SURCHARGE_STEP_MINUTES)
  return steps * WAITING_SURCHARGE_STEP_EUR
}

export function calculateLegTotal(basePrice: number, waitingFrom: TimeValue, waitingTo: TimeValue) {
  const waitingMinutes = calculateWaitingMinutes(waitingFrom, waitingTo)
  const waitingSurcharge = calculateWaitingSurcharge(waitingMinutes)
  const totalPrice = basePrice + waitingSurcharge

  return {
    waitingMinutes,
    waitingSurcharge,
    totalPrice,
  }
}

export function calculateImoSurcharge(isIMO: boolean): number {
  return isIMO ? IMO_SURCHARGE_EUR : 0
}
