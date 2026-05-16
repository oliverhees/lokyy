import { execFileSync, type ExecFileSyncOptions } from 'node:child_process'

export type HermesCliResult = { ok: boolean; stdout: string; stderr: string }

export function runHermes(args: string[], opts: ExecFileSyncOptions = {}): HermesCliResult {
  try {
    const stdout = execFileSync('hermes', args, {
      encoding: 'utf8',
      timeout: 15_000,
      ...opts,
    }) as string
    return { ok: true, stdout, stderr: '' }
  } catch (err: unknown) {
    const e = err as { stdout?: string | Buffer; stderr?: string | Buffer; message?: string }
    return {
      ok: false,
      stdout: typeof e.stdout === 'string' ? e.stdout : e.stdout?.toString() ?? '',
      stderr:
        typeof e.stderr === 'string' ? e.stderr : e.stderr?.toString() ?? e.message ?? 'unknown error',
    }
  }
}

export function stripBoxDrawing(s: string): string {
  return s.replace(/[━─┃┏┓┗┛┳┻╋┣┫│╔╗╚╝║]/g, ' ').replace(/\x1b\[[0-9;]*m/g, '')
}
