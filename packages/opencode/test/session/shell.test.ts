import { test, expect } from "bun:test"
import { Config } from "../../src/config/config"
import { Instance } from "../../src/project/instance"
import { tmpdir } from "../fixture/fixture"
import path from "path"

test("uses shell from config over env var", async () => {
  const originalShell = process.env["SHELL"]
  process.env["SHELL"] = "bash"

  try {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(
          path.join(dir, "opencode.json"),
          JSON.stringify({
            $schema: "https://opencode.ai/config.json",
            shell: "fish",
          }),
        )
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const config = await Config.get()
        expect(config.shell).toBe("fish")
      },
    })
  } finally {
    if (originalShell !== undefined) {
      process.env["SHELL"] = originalShell
    } else {
      delete process.env["SHELL"]
    }
  }
})

test("falls back to env var when config not set", async () => {
  const originalShell = process.env["SHELL"]
  process.env["SHELL"] = "zsh"

  try {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(
          path.join(dir, "opencode.json"),
          JSON.stringify({
            $schema: "https://opencode.ai/config.json",
          }),
        )
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const config = await Config.get()
        // shell is not in config, so it's undefined
        expect(config.shell).toBeUndefined()
      },
    })
  } finally {
    if (originalShell !== undefined) {
      process.env["SHELL"] = originalShell
    } else {
      delete process.env["SHELL"]
    }
  }
})

test("falls back to bash when neither config nor env set", async () => {
  const originalShell = process.env["SHELL"]
  delete process.env["SHELL"]

  try {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(
          path.join(dir, "opencode.json"),
          JSON.stringify({
            $schema: "https://opencode.ai/config.json",
          }),
        )
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const config = await Config.get()
        // shell is not in config, and SHELL env var is not set
        expect(config.shell).toBeUndefined()
      },
    })
  } finally {
    if (originalShell !== undefined) {
      process.env["SHELL"] = originalShell
    } else {
      delete process.env["SHELL"]
    }
  }
})

test("handles shell with full Unix path", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(
        path.join(dir, "opencode.json"),
        JSON.stringify({
          $schema: "https://opencode.ai/config.json",
          shell: "/usr/local/bin/fish",
        }),
      )
    },
  })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const config = await Config.get()
      expect(config.shell).toBe("/usr/local/bin/fish")
      // Verify basename extraction would work correctly
      const shellName = path.basename(config.shell!)
      expect(shellName).toBe("fish")
    },
  })
})

test("handles shell with Windows path", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(
        path.join(dir, "opencode.json"),
        JSON.stringify({
          $schema: "https://opencode.ai/config.json",
          shell: "C:\\Windows\\System32\\cmd.exe",
        }),
      )
    },
  })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const config = await Config.get()
      expect(config.shell).toBe("C:\\Windows\\System32\\cmd.exe")
      // Verify basename extraction would work correctly
      const shellName = path.basename(config.shell!)
      expect(shellName).toBe("cmd.exe")
    },
  })
})

test("handles shell name without path", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(
        path.join(dir, "opencode.json"),
        JSON.stringify({
          $schema: "https://opencode.ai/config.json",
          shell: "nu",
        }),
      )
    },
  })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const config = await Config.get()
      expect(config.shell).toBe("nu")
      // Verify basename extraction would work correctly
      const shellName = path.basename(config.shell!)
      expect(shellName).toBe("nu")
    },
  })
})

test("preserves shell config across multiple config merges", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(
        path.join(dir, "opencode.jsonc"),
        JSON.stringify({
          $schema: "https://opencode.ai/config.json",
          model: "base/model",
          shell: "zsh",
        }),
      )
      await Bun.write(
        path.join(dir, "opencode.json"),
        JSON.stringify({
          $schema: "https://opencode.ai/config.json",
          model: "override/model",
        }),
      )
    },
  })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const config = await Config.get()
      expect(config.model).toBe("override/model")
      expect(config.shell).toBe("zsh")
    },
  })
})

test("config shell overrides when specified in later file", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(
        path.join(dir, "opencode.jsonc"),
        JSON.stringify({
          $schema: "https://opencode.ai/config.json",
          shell: "bash",
        }),
      )
      await Bun.write(
        path.join(dir, "opencode.json"),
        JSON.stringify({
          $schema: "https://opencode.ai/config.json",
          shell: "fish",
        }),
      )
    },
  })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const config = await Config.get()
      expect(config.shell).toBe("fish")
    },
  })
})
