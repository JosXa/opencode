import { Config } from "./config"
import { Log } from "../util/log"
import { GlobalBus } from "../bus/global"
import { AppRuntime } from "../effect/app-runtime"

const log = Log.create({ service: "config.reload" })

export namespace ConfigReload {
  export const Event = {
    Pending: { type: "config.reload.pending" },
    Executing: { type: "config.reload.executing" },
    Done: { type: "config.reload.done" },
  } as const

  let pending = false
  const active = new Set<string>()

  export function isPending() {
    return pending
  }

  export function start(sessionID: string) {
    active.add(sessionID)
  }

  export function finish(sessionID: string) {
    active.delete(sessionID)
  }

  /**
   * Request a config reload. If all sessions are idle, reloads immediately.
   * Otherwise queues the reload to fire when the last session goes idle.
   * Returns true if reload was executed immediately, false if queued.
   */
  export async function request(): Promise<{ immediate: boolean }> {
    if (active.size === 0) {
      await execute()
      return { immediate: true }
    }
    log.info("sessions busy, deferring reload")
    pending = true
    emit(Event.Pending.type, { pending: true })
    return { immediate: false }
  }

  /**
   * Called from Runner.onIdle - checks if a deferred reload is pending
   * and all sessions are now idle. If so, fires the reload.
   */
  export async function check() {
    if (!pending) return
    if (active.size > 0) return
    log.info("all sessions idle, executing deferred reload")
    await execute()
  }

  async function execute() {
    pending = false
    emit(Event.Pending.type, { pending: false })
    emit(Event.Executing.type, { executing: true })
    log.info("reloading configuration")
    // Config.invalidate destroys config caches in the current runtime. The
    // instance Bus is replaced separately by the reload flow, so Done goes via
    // GlobalBus where existing SSE subscriptions can still observe it.
    // Emit Done through GlobalBus so existing SSE subscriptions can observe it
    // even if config invalidation rebuilds instance-scoped services.
    await AppRuntime.runPromise(Config.Service.use((cfg) => cfg.invalidate()))
    emit(Event.Done.type, {})
  }

  function emit(type: (typeof Event)[keyof typeof Event]["type"], properties: Record<string, unknown>) {
    GlobalBus.emit("event", {
      payload: { type, properties },
    })
  }
}
