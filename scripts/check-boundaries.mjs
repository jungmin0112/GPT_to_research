// Use the project's TypeScript resolver, including path aliases and re-exports.
import ts from "typescript";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function check(root = process.cwd()) {
  const config = ts.readConfigFile(
    path.join(root, "tsconfig.json"),
    ts.sys.readFile,
  );
  const { options } = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    root,
  );
  const src = path.join(root, "src");
  const files = ts.sys.readDirectory(src, [".ts", ".tsx"]);
  const edges = new Map(),
    modules = new Map(),
    errors = [];
  function add(graph, from, to) {
    if (!graph.has(from)) graph.set(from, new Set());
    graph.get(from).add(to);
  }
  for (const file of files) {
    const from = path.relative(src, file).split(path.sep).join("/");
    const [layer, owner] = from.split("/");
    const ast = ts.createSourceFile(
      file,
      ts.sys.readFile(file),
      ts.ScriptTarget.Latest,
      true,
    );
    function visit(node) {
      let spec;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        spec = node.moduleSpecifier;
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
        spec = node.argument.literal;
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) &&
            node.expression.text === "require"))
      )
        spec = node.arguments[0];
      if (spec) {
        if (!ts.isStringLiteralLike(spec))
          errors.push(from + ": nonliteral import");
        else {
          const resolved = ts.resolveModuleName(
            spec.text,
            file,
            options,
            ts.sys,
          ).resolvedModule?.resolvedFileName;
          if (resolved) {
            const dest = path.relative(src, resolved).split(path.sep).join("/");
            if (!dest.startsWith("../")) {
              add(edges, from, dest);
              const [otherLayer, otherOwner, entry, ...rest] = dest.split("/");
              if (
                otherLayer === "modules" &&
                (layer !== "modules" || owner !== otherOwner)
              ) {
                if (
                  rest.length ||
                  !["index.ts", "index.tsx", "server.ts"].includes(entry)
                )
                  errors.push(from + " → private " + dest);
                if (layer === "modules") add(modules, owner, otherOwner);
              }
              if (
                (layer === "shared" && otherLayer !== "shared") ||
                (layer === "server" &&
                  ["app", "modules"].includes(otherLayer)) ||
                (layer === "modules" && otherLayer === "app")
              )
                errors.push(from + " → forbidden layer " + dest);
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  function cycles(graph) {
    const visited = new Set(),
      active = new Set();
    function walk(n, chain) {
      if (active.has(n)) {
        errors.push("cycle: " + [...chain, n].join(" → "));
        return;
      }
      if (visited.has(n)) return;
      visited.add(n);
      active.add(n);
      for (const to of graph.get(n) ?? []) walk(to, [...chain, n]);
      active.delete(n);
    }
    for (const n of graph.keys()) walk(n, []);
  }
  cycles(edges);
  cycles(modules);
  return errors;
}
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const errors = check();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else console.log("Module boundaries and dependency cycles: OK");
}
