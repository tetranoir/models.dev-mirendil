import { expect, test } from "bun:test"
import { ModelFamilyValues } from "@models.dev/core"
import { generate, loadCatalog, snapshotPayload } from "../script/generate.ts"

test("snapshot exports providers, models, generatedAt, and a default catalog", async () => {
  const snapshot = await import("../src/snapshot.js")
  expect(Object.keys(snapshot.providers).length).toBeGreaterThan(100)
  expect(Object.keys(snapshot.models).length).toBeGreaterThan(100)
  expect(snapshot.default.providers).toBe(snapshot.providers)
  expect(snapshot.default.models).toBe(snapshot.models)
  expect(Number.isNaN(Date.parse(snapshot.generatedAt))).toBe(false)

  const anthropic = snapshot.providers["anthropic"]
  expect(anthropic?.env.length).toBeGreaterThan(0)
  const model = Object.values(anthropic!.models)[0]
  expect(typeof model?.name).toBe("string")
  expect(typeof model?.limit.context).toBe("number")
})


test("snapshot preserves canonical base_model relationships", async () => {
  const snapshot = await import("../src/snapshot.js")
  const mapped = Object.values(snapshot.providers)
    .flatMap((provider: any) => Object.values(provider.models))
    .filter((model: any) => model.base_model !== undefined) as Array<{ base_model: string }>

  expect(mapped.length).toBeGreaterThan(0)
  for (const model of mapped) {
    expect(snapshot.models[model.base_model]).toBeDefined()
  }
})

test("generation reproduces model families and the publish snapshot payload", () => {
  const types = Bun.file(new URL("../src/generated.ts", import.meta.url))
  const snapshot = Bun.file(new URL("../src/snapshot.js", import.meta.url))
  return Promise.all([types.text(), snapshot.text()]).then(([beforeTypes, beforeSnapshot]) =>
    generate()
      .then(() => Promise.all([types.text(), snapshot.text(), loadCatalog()]))
      .then(([afterTypes, afterSnapshot, catalog]) => {
        expect(afterTypes).toBe(beforeTypes)
        expect([...afterTypes.matchAll(/^  \| "([^"]+)"$/gm)].map((match) => match[1])).toEqual(
          [...new Set(ModelFamilyValues)].sort(),
        )
        const payload = `const data = /* @__PURE__ */ JSON.parse(${JSON.stringify(snapshotPayload(catalog))})`
        expect(beforeSnapshot.split("\n")[1]).toBe(payload)
        expect(afterSnapshot.split("\n")[1]).toBe(payload)
      }),
  )
})

test("Mirendil router preserves verified canonical mappings and reasoning controls", () => {
  const bindings = [
    ["claude-opus-5-vertex", "anthropic/claude-opus-5", ["low", "medium", "high", "xhigh", "max"]],
    ["claude-opus-4-8-vertex", "anthropic/claude-opus-4-8", ["low", "medium", "high", "xhigh", "max"]],
    ["anthropic/claude-fable-5-1", "anthropic/claude-fable-5-1", ["low", "medium", "high", "xhigh", "max"]],
    ["z-ai/glm-5.3", "zhipuai/glm-5.3", ["low", "high", "max"]],
    ["z-ai/glm-5.3-flash", "zhipuai/glm-5.3-flash", ["low", "high", "max"]],
    ["gpt-6-astra", "openai/gpt-6-astra", ["low", "medium", "high", "xhigh", "max"]],
    ["gpt-6-astra-openrouter", "openai/gpt-6-astra", ["low", "medium", "high", "xhigh", "max"]],
    ["codex-5.5", "openai/gpt-5.5", ["none", "low", "medium", "high", "xhigh"]],
    ["muse-spark-1.1", "meta/muse-spark-1.1", ["minimal", "low", "medium", "high", "xhigh"]],
  ] as const
  return import("../src/snapshot.js").then((snapshot) => {
    const router = snapshot.providers["mirendil-router"]!
    for (const [id, base_model, values] of bindings) {
      expect(router.models[id]).toMatchObject({ base_model, reasoning_options: [{ type: "effort", values }] })
      expect(snapshot.models[base_model]).toBeDefined()
    }
    expect(router.models["gpt-6-astra"]?.provider?.shape).toBe("responses")
    expect(router.models["codex-5.5"]?.provider?.shape).toBe("responses")
    expect(router.models["gpt-6-astra-openrouter"]?.provider?.shape).toBeUndefined()
    for (const id of ["fern-jade-s525", "fern-lemur-sota", "cheetah-v10"]) {
      expect(router.models[id]).toBeUndefined()
    }
  })
})

test("Mirendil Grok priority mode is opt-in and preserves reasoning controls", () =>
  import("../src/snapshot.js").then((snapshot) => {
    const router = snapshot.providers["mirendil-router"]!
    for (const [id, values] of [
      ["grok-4.5", ["low", "medium", "high"]],
      ["grok-4.6", ["low", "medium", "high", "xhigh"]],
    ] as const) {
      const model = router.models[id]!
      expect(model.base_model).toBe(`xai/${id}`)
      expect(model.reasoning_options).toEqual([{ type: "effort", values: [...values] }])
      expect(model.experimental?.modes?.["fast"]?.provider).toEqual({
        body: { service_tier: "priority" },
        headers: {},
      })
      expect(model.provider?.body?.["service_tier"]).toBeUndefined()
    }
  }),
)
