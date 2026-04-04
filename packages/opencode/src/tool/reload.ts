import z from "zod"
import { Tool } from "./tool"
import { ConfigReload } from "@/config/reload"

export const ReloadTool = Tool.define("reload_config", {
  description: "Reload OpenCode configuration files and plugins without restarting.",
  parameters: z.object({}),
  async execute(_params, ctx) {
    await ctx.ask({
      permission: "reload_config",
      patterns: ["*"],
      always: ["*"],
      metadata: {},
    })

    await ConfigReload.request({ resumeSessionID: ctx.sessionID })

    return {
      title: "Configuration reload enqueued",
      output: "Reload enqueued. The session will stop now and resume automatically after reload.",
      metadata: {},
      stopSession: true,
    }
  },
})
