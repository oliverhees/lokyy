/**
 * Lokyy Dashboards — typed client for /api/lokyy/dashboards.
 */

export type DashboardListItem = {
  id: string
  title: string
  template: string
  schedule: string
  createdAt: string
  originalIntent?: string
  lastRunDate: string | null
  runCount: number
}

export type DashboardDetail = {
  id: string
  title: string
  template: string
  schedule: string
  createdAt: string
  originalIntent?: string
  capabilityTokenId: string
  runs: string[]
}

export type DashboardData = {
  payload: unknown
  runAt: string | null
  date: string | null
}

const BASE = '/api/lokyy/dashboards'

export async function listDashboards(): Promise<DashboardListItem[]> {
  const r = await fetch(BASE, { credentials: 'same-origin' })
  if (!r.ok) throw new Error(`listDashboards: HTTP ${r.status}`)
  const data = (await r.json()) as { dashboards: DashboardListItem[] }
  return data.dashboards
}

export async function getDashboard(id: string): Promise<DashboardDetail> {
  const r = await fetch(`${BASE}/${encodeURIComponent(id)}`, { credentials: 'same-origin' })
  if (!r.ok) throw new Error(`getDashboard: HTTP ${r.status}`)
  const data = (await r.json()) as { dashboard: DashboardDetail }
  return data.dashboard
}

export async function getDashboardData(id: string, date?: string): Promise<DashboardData> {
  const url = date
    ? `${BASE}/${encodeURIComponent(id)}/data?date=${encodeURIComponent(date)}`
    : `${BASE}/${encodeURIComponent(id)}/data`
  const r = await fetch(url, { credentials: 'same-origin' })
  if (!r.ok) throw new Error(`getDashboardData: HTTP ${r.status}`)
  return (await r.json()) as DashboardData
}

export async function runDashboardNow(id: string): Promise<{ ok: true; runDate: string; itemCount: number }> {
  const r = await fetch(`${BASE}/${encodeURIComponent(id)}/run`, {
    method: 'POST',
    credentials: 'same-origin',
  })
  if (!r.ok) {
    const txt = await r.text().catch(() => '')
    throw new Error(`runDashboardNow: HTTP ${r.status} ${txt}`)
  }
  return (await r.json()) as { ok: true; runDate: string; itemCount: number }
}

export async function createDashboardFromIntent(intent: string): Promise<{ dashboardId: string; template: string }> {
  const r = await fetch(`${BASE}/from-intent`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intent }),
  })
  if (!r.ok) {
    const txt = await r.text().catch(() => '')
    throw new Error(`createDashboard: HTTP ${r.status} ${txt}`)
  }
  return (await r.json()) as { dashboardId: string; template: string }
}

/** URL the FE iframe loads — same-origin, served by lokyy-os-be. */
export function dashboardViewUrl(id: string): string {
  return `${BASE}/${encodeURIComponent(id)}/view`
}
