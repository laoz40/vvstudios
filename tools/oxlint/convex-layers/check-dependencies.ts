import path from "node:path";
import * as ts from "typescript/unstable/ast";
import { ModuleGraph } from "./shared/module-graph.ts";
import { isConvexHandlerFile, isConvexLibFile, isConvexServiceFile } from "./shared/paths.ts";

const BOUNDARY_LIBS = new Set([
	"convex/shared/lib/result.ts",
	"convex/shared/lib/logger.ts",
	"convex/shared/lib/driveValidators.ts"
]);

const MESSAGES = {
	libService: "Lib must not depend on services, including through re-exports.",
	endpointDependency:
		"Lib and services must not import endpoint modules. Use generated API references for Convex calls.",
	registrarDependency: "Convex endpoint registration belongs in handlers, not lib or services.",
	dynamicDependency:
		"Use a literal module specifier so layer dependencies can be checked statically.",
	handlerLibImport:
		"Handlers must not depend on domain lib directly, including through re-exports. Compose a service step instead.",
	libReexport:
		"Services must not re-export lib bindings, including aliases and namespaces. Expose an operation that owns meaningful work."
};

/** Check the whole project with one native compiler process, outside Oxlint's workers. */
export function checkConvexLayers(root: string): string[] {
	const graph = new ModuleGraph(root);
	const violations: string[] = [];
	try {
		for (const file of graph.files) {
			if (/(?:[/\\](?:_generated|tests?)[/\\]|\.(?:test|spec)\.)/u.test(file)) continue;
			const source = graph.source(file);
			if (!source || source.isDeclarationFile) continue;
			const relative = path.relative(root, file).replaceAll("\\", "/");
			const lib = isConvexLibFile(file);
			const service = isConvexServiceFile(file);
			const handler =
				!lib &&
				!service &&
				relative !== "convex/devSeed.ts" &&
				(isConvexHandlerFile(file) || graph.isEndpoint(file));
			const report = (node: ts.Node, rule: keyof typeof MESSAGES) => {
				const before = source.text.slice(0, ts.skipTrivia(source.text, node.pos)).split("\n");
				const line = before.length;
				const column = (before.at(-1)?.length ?? 0) + 1;
				violations.push(`${relative}:${line}:${column}: convex-layers/${rule}: ${MESSAGES[rule]}`);
			};
			for (const dependency of graph.dependencies(source)) {
				const files = [...dependency.files];
				if (dependency.source === "<dynamic>" || dependency.files.has("<dynamic>"))
					report(dependency.node, "dynamicDependency");
				else if (lib && files.some(isConvexServiceFile)) report(dependency.node, "libService");
				else if (
					(lib || service) &&
					dependency.origins.some(
						(origin) =>
							graph.isRegistrar(origin) || (origin.file === "convex/server" && origin.name === "*")
					)
				)
					report(dependency.node, "registrarDependency");
				else if (
					(lib || service) &&
					files.some(
						(target) =>
							!target.includes(`${path.sep}_generated${path.sep}`) && graph.isEndpoint(target)
					)
				)
					report(dependency.node, "endpointDependency");
				if (
					handler &&
					files.some(
						(target) =>
							isConvexLibFile(target) &&
							!BOUNDARY_LIBS.has(path.relative(root, target).replaceAll("\\", "/"))
					)
				)
					report(dependency.node, "handlerLibImport");
				if (service && ts.isExportDeclaration(dependency.node) && files.some(isConvexLibFile))
					report(dependency.node, "libReexport");
			}
			if (!service) continue;
			for (const statement of source.statements) {
				if (ts.isExportDeclaration(statement)) {
					if (
						statement.isTypeOnly ||
						statement.moduleSpecifier ||
						!statement.exportClause ||
						!ts.isNamedExports(statement.exportClause)
					)
						continue;
					for (const element of statement.exportClause.elements) {
						if (
							!element.isTypeOnly &&
							graph.origins(element.name).some((origin) => isConvexLibFile(origin.file))
						)
							report(element, "libReexport");
					}
				} else if (ts.isExportAssignment(statement)) {
					if (graph.origins(statement.expression).some((origin) => isConvexLibFile(origin.file)))
						report(statement, "libReexport");
				} else if (
					ts.isVariableStatement(statement) &&
					statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
				) {
					for (const declaration of statement.declarationList.declarations) {
						if (graph.origins(declaration).some((origin) => isConvexLibFile(origin.file)))
							report(declaration, "libReexport");
					}
				}
			}
		}
		return violations.sort();
	} finally {
		graph.close();
	}
}
