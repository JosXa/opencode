import z from "zod"
import { Tool } from "./tool"
import { ConfigReload } from "@/config/reload"

export const ReloadTool = Tool.define("reload_config", {
  description:
    "Reload OpenCode configuration after modifying config files (opencode.jsonc, .opencode/ files). " +
    "After calling this tool, the configuration will reload once the current session goes idle. " +
    "The conversation will automatically resume after the reload completes. " +
    "You do NOT need to ask for permission to use this tool.",
  parameters: z.object({}),
  async execute(_params, ctx) {
    await ctx.ask({
      permission: "reload_config",
      patterns: ["*"],
      always: ["*"],
      metadata: {},
    })

    ConfigReload.setResumeSession(ctx.sessionID)
    await ConfigReload.request()

    return {
      title: "Configuration reload requested",
      output:
        "Configuration reload has been requested. " +
        "It will execute once this session goes idle, and the conversation will automatically resume afterward.",
      metadata: {},
    }
  },
})
