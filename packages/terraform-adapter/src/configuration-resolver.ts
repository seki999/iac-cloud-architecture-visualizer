import type { InfraNode, TerraformModuleConfig } from "@iacviz/schemas";
import { splitAddressSegments } from "@iacviz/core";
const unindexed = (value: string) => value.replace(/\[(?:"(?:[^"\\]|\\.)*"|\d+)\]/g, "");
interface Context {
  module: TerraformModuleConfig;
  inputs?: Record<string, unknown>;
}
/** Resolve only unique resource identity through module input/output expression references. */
export function configurationResolver(
  root: TerraformModuleConfig,
  nodes: InfraNode[],
  warn: (message: string) => void,
  ambiguous: (nodes: InfraNode[]) => void = () => {},
) {
  const contexts = new Map<string, Context>();
  function index(module: TerraformModuleConfig, path: string, inputs?: Record<string, unknown>) {
    contexts.set(path, { module, inputs });
    for (const [name, call] of Object.entries(module.module_calls ?? {}))
      if (call.module)
        index(call.module, path ? `${path}.module.${name}` : `module.${name}`, call.expressions);
  }
  index(root, "");
  function refs(value: unknown): string[] {
    if (!value || typeof value !== "object") return [];
    const array = (value as Record<string, unknown>).references;
    return Array.isArray(array) ? array.filter((r): r is string => typeof r === "string") : [];
  }
  return function resolve(
    ref: string,
    modulePath: string,
    allowModuleDependency = false,
    seen = new Set<string>(),
  ): InfraNode[] {
    const key = modulePath + "|" + ref;
    if (seen.has(key) || seen.size > 64) return [];
    seen.add(key);
    const parts = splitAddressSegments(ref);
    if (parts[0] === "var") {
      const context = contexts.get(unindexed(modulePath));
      const input = context?.inputs?.[parts[1] ?? ""];
      const parent = splitAddressSegments(modulePath).slice(0, -2).join(".");
      const candidates = refs(input).flatMap((r) => resolve(r, parent, false, new Set(seen)));
      const unique = [...new Map(candidates.map((n) => [n.id, n])).values()];
      if (unique.length > 1) {
        ambiguous(unique);
        warn("Module input refers to multiple resources; binding remains unresolved.");
        return [];
      }
      return unique;
    }
    if (["local", "each", "count", "path", "terraform"].includes(parts[0] ?? "")) return [];
    let offset = 0;
    while (parts[offset] === "module" && parts[offset + 1]) offset += 2;
    if (offset) {
      const child = [modulePath, parts.slice(0, offset).join(".")].filter(Boolean).join(".");
      if (offset === parts.length && allowModuleDependency) {
        return nodes.filter(
          (n) =>
            !n.change?.deposed &&
            (n.moduleAddress === child ||
              n.moduleAddress?.startsWith(child + ".") ||
              n.moduleAddress?.startsWith(child + "[")),
        );
      }
      const output = parts[offset]?.replace(/\[.*$/, "");
      const context = contexts.get(unindexed(child));
      const expression = output ? context?.module.outputs?.[output]?.expression : undefined;
      if (expression) {
        const candidates = refs(expression).flatMap((r) => resolve(r, child, false, new Set(seen)));
        const unique = [...new Map(candidates.map((n) => [n.id, n])).values()];
        if (unique.length === 1) return unique;
        if (unique.length > 1) {
          ambiguous(unique);
          warn("Module output has multiple possible resources; binding remains unresolved.");
        }
        return [];
      }
    }
    const scoped = [modulePath, ref].filter(Boolean).join(".");
    const exact = nodes.filter(
      (n) => !n.change?.deposed && (scoped === n.address || scoped.startsWith(n.address + ".")),
    );
    if (exact.length === 1) return exact;
    const possible = nodes.filter((n) => {
      if (n.change?.deposed) return false;
      const base = unindexed(n.address);
      return scoped === base || scoped.startsWith(base + ".");
    });
    if (possible.length > 1) {
      ambiguous(possible);
      warn("Ambiguous configuration resource reference; instance binding remains unresolved.");
    }
    return possible.length === 1 ? possible : [];
  };
}
