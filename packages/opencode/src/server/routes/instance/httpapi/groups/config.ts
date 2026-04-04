import { Config } from "@/config/config"
import { ConfigV1 } from "@opencode-ai/core/v1/config/config"
import { Provider } from "@/provider/provider"
import { HttpApi, HttpApiEndpoint, HttpApiError, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { Authorization } from "../middleware/authorization"
import { InstanceContextMiddleware } from "../middleware/instance-context"
import {
  WorkspaceRoutingMiddleware,
  WorkspaceRoutingQuery,
  WorkspaceRoutingQueryFields,
} from "../middleware/workspace-routing"
import { described } from "./metadata"
import { Schema } from "effect"

const root = "/config"
const BootstrapCompleteQuery = Schema.Struct({
  ...WorkspaceRoutingQueryFields,
  cycle: Schema.optional(Schema.NumberFromString),
})

export const ConfigApi = HttpApi.make("config")
  .add(
    HttpApiGroup.make("config")
      .add(
        HttpApiEndpoint.get("get", root, {
          query: WorkspaceRoutingQuery,
          success: described(ConfigV1.Info, "Get config info"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "config.get",
            summary: "Get configuration",
            description: "Retrieve the current OpenCode configuration settings and preferences.",
          }),
        ),
        HttpApiEndpoint.patch("update", root, {
          query: WorkspaceRoutingQuery,
          payload: ConfigV1.Info,
          success: described(ConfigV1.Info, "Successfully updated config"),
          error: HttpApiError.BadRequest,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "config.update",
            summary: "Update configuration",
            description: "Update OpenCode configuration settings and preferences.",
          }),
        ),
        HttpApiEndpoint.get("providers", `${root}/providers`, {
          query: WorkspaceRoutingQuery,
          success: described(Provider.ConfigProvidersResult, "List of providers"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "config.providers",
            summary: "List config providers",
            description: "Get a list of all configured AI providers and their default models.",
          }),
        ),
        HttpApiEndpoint.post("reload", `${root}/reload`, {
          query: WorkspaceRoutingQuery,
          success: described(
            Schema.Struct({
              success: Schema.Boolean,
              immediate: Schema.Boolean,
            }),
            "Configuration reloaded successfully",
          ),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "config.reload",
            summary: "Reload configuration",
            description:
              "Reload all configuration files (opencode.jsonc, .opencode/) and plugins, and restart all instances without restarting the TUI.",
          }),
        ),
        HttpApiEndpoint.post("bootstrapComplete", `${root}/bootstrap-complete`, {
          query: BootstrapCompleteQuery,
          success: described(Schema.Struct({ success: Schema.Boolean }), "Blocker released"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "config.bootstrapComplete",
            summary: "Signal TUI bootstrap complete",
            description:
              "Called by the TUI after its blocking bootstrap phase finishes. Releases the reload blocker so any pending reload can proceed.",
          }),
        ),
      )
      .annotateMerge(
        OpenApi.annotations({
          title: "config",
          description: "Experimental HttpApi config routes.",
        }),
      )
      .middleware(InstanceContextMiddleware)
      .middleware(WorkspaceRoutingMiddleware)
      .middleware(Authorization),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "opencode experimental HttpApi",
      version: "0.0.1",
      description: "Experimental HttpApi surface for selected instance routes.",
    }),
  )
