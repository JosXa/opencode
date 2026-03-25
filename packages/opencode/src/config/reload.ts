import { Config } from "./config"
import { GlobalBus } from "../bus/global"
import { AppRuntime } from "../effect/app-runtime"
import { disposeAllInstancesAndEmitGlobalDisposed } from "../server/global-lifecycle"

export namespace ConfigReload {
  const log = {
    debug: (message: string, metadata?: unknown) => console.debug("config.reload", message, metadata),
    info: (message: string, metadata?: unknown) => console.info("config.reload", message, metadata),
    error: (message: string, metadata?: unknown) => console.error("config.reload", message, metadata),
  }

  export const Event = {
    Pending: { type: "config.reload.pending" },
    Executing: { type: "config.reload.executing" },
    Done: { type: "config.reload.done" },
  } as const

  let pending = false
  let resumeSessionID: string | undefined
  let reloadInFlight = false
  let doneResumeSessionID: string | undefined
  const active = new Set<string>()
  const blockers = new Set<string>()
  /** Rejects stale bootstrap-complete POSTs from a previous reload cycle. */
  let bootstrapCycle = 0

  function isBlocked() {
    return active.size > 0 || blockers.size > 0
  }

  export function isPending() {
    return pending
  }

  export function start(sessionID: string) {
    active.add(sessionID)
    log.debug("start", { sessionID })
  }

  export function finish(sessionID: string) {
    active.delete(sessionID)
    log.debug("finish", { sessionID })
    finishReloadIfReady("last session finished")
  }

  export function startBlocker(blockerID: string) {
    blockers.add(blockerID)
    if (blockerID === "tui-bootstrap") bootstrapCycle++
    log.debug("startBlocker", { blockerID, bootstrapCycle })
  }

  export function getBootstrapCycle() {
    return bootstrapCycle
  }

  export function finishBlocker(blockerID: string) {
    blockers.delete(blockerID)
    log.debug("finishBlocker", { blockerID })
    finishReloadIfReady("bootstrap complete")

    if (!pending || isBlocked()) return
    queueMicrotask(() => {
      void check().catch((error) => {
        log.error("deferred blocker check failed", { error, blockerID })
      })
    })
  }

  /**
   * Request a config reload. If all sessions are idle, reloads immediately.
   * Otherwise queues the reload to fire when the last session goes idle.
   */
  export async function request(options?: { resumeSessionID?: string }): Promise<{ immediate: boolean }> {
    if (options?.resumeSessionID) resumeSessionID = options.resumeSessionID
    if (!isBlocked()) {
      log.info("reload executing immediately")
      await execute()
      return { immediate: true }
    }
    pending = true
    log.info("reload queued", { resumeSessionID })
    emit(Event.Pending.type, { pending: true })
    return { immediate: false }
  }

  /** Called from idle/blocker transitions to run a deferred reload once safe. */
  export async function check() {
    if (!pending) return
    if (isBlocked()) {
      log.debug("check: still blocked", {
        active: [...active],
        blockers: [...blockers],
      })
      return
    }
    log.info("executing deferred reload")
    await execute()
  }

  async function execute() {
    pending = false
    emit(Event.Pending.type, { pending: false })
    emit(Event.Executing.type, { executing: true })
    const sid = resumeSessionID
    resumeSessionID = undefined

    // The old instance is about to be destroyed. New sessions/blockers will
    // register against the next instance cycle and release the Done event.
    active.clear()
    blockers.clear()
    reloadInFlight = true
    doneResumeSessionID = sid
    log.info("reloading configuration", { resumeSessionID: sid })

    // The caller may be interrupted during instance disposal, so do not depend
    // on awaiting this chain. bootstrap-complete emits Done after the new TUI
    // has enough state to hide the reload modal and optionally resume.
    AppRuntime.runPromise(Config.Service.use((cfg) => cfg.invalidate()))
      .then(() => AppRuntime.runPromise(disposeAllInstancesAndEmitGlobalDisposed({ swallowErrors: true })))
      .catch((error) => {
        reloadInFlight = false
        doneResumeSessionID = undefined
        emit(Event.Executing.type, { executing: false })
        log.error("reload failed", { error })
      })
  }

  function finishReloadIfReady(reason: string) {
    if (!reloadInFlight || isBlocked()) return
    reloadInFlight = false
    const sid = doneResumeSessionID
    doneResumeSessionID = undefined
    log.info("reload done", { reason, resumeSessionID: sid })
    emit(Event.Executing.type, { executing: false })
    emit(Event.Done.type, { resumeSessionID: sid })
  }

  function emit(type: (typeof Event)[keyof typeof Event]["type"], properties: Record<string, unknown>) {
    GlobalBus.emit("event", {
      payload: { type, properties },
    })
  }
}
