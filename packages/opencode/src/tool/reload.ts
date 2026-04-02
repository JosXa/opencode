import z from "zod"
import { Tool } from "./tool"
import { ConfigReload } from "@/config/reload"

export const ReloadTool = Tool.define("reload_config", {
  description:
    "Reload OpenCode configuration after modifying config files (opencode.jsonc, .opencode/ files). " +
    "If all sessions are idle, reloads immediately. Otherwise the reload is deferred until the current " +
    "conversation turn completes. You do NOT need to ask for permission to use this tool.",
  parameters: z.object({}),
  async execute(_params, ctx) {
    await ctx.ask({
      permission: "reload_config",
      patterns: ["*"],
      always: ["*"],
      metadata: {},
    })

    const result = await ConfigReload.request()
    if (result.immediate) {
      return {
        title: "Configuration reloaded",
        output: "Configuration has been reloaded successfully.",
        metadata: {},
      }
    }
    return {
      title: "Reload queued",
      output: "Configuration reload has been queued and will execute after this conversation turn completes.",
      metadata: {},
    }
  },
})
