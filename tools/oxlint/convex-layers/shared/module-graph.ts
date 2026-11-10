import { existsSync } from "node:fs";
import path from "node:path";
import {
	API,
	SymbolFlags,
	type Project,
	type Snapshot,
	type Symbol
} from "typescript/unstable/sync";
import * as ts from "typescript/unstable/ast";
import { isConvexLibFile, isConvexServiceFile } from "./paths.ts";

const REGISTRARS = new Set([
	"query",
	"mutation",
	"action",
	"internalQuery",
	"internalMutation",
	"internalAction",
	"httpAction"
]);
const GENERIC_REGISTRARS = new Set([...REGISTRARS].map((name) => `${name}Generic`));

function isModuleLiteral(
	node: ts.Node
): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
	return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

export type Origin = { file: string; name: string };
export type Dependency = { node: ts.Node; source: string; files: Set<string>; origins: Origin[] };

/** Uses TSGo's native bindings and module resolution without loading external SDK trees. */
export class ModuleGraph {
	private readonly api: API;
	private readonly snapshot: Snapshot;
	private readonly project: Project;
	private readonly resolutions = new Map<string, string | undefined>();
	private readonly sources = new Map<string, ts.SourceFile | undefined>();
	private readonly endpoints = new Map<string, boolean>();
	private readonly root: string;
	readonly files: readonly string[];

	constructor(root: string) {
		this.root = root;
		const config = path.join(root, ".convex-layers.tsconfig.json");
		// Keep project aliases, but bind only local code. The config exists only in memory.
		const configText = JSON.stringify({
			extends: "./tsconfig.json",
			compilerOptions: { noLib: true, types: [], allowJs: true, checkJs: false },
			include: ["convex/**/*"],
			exclude: ["convex/tests/**", "convex/**/tests/**", "convex/**/*.test.*", "convex/**/*.spec.*"]
		});
		this.api = new API({
			cwd: root,
			fs: {
				readFile: (file) =>
					file === config
						? configText
						: file.includes(`${path.sep}node_modules${path.sep}`)
							? null
							: undefined,
				fileExists: (file) =>
					file === config
						? true
						: file.includes(`${path.sep}node_modules${path.sep}`)
							? false
							: undefined,
				directoryExists: (directory) =>
					directory.includes(`${path.sep}node_modules`) ? false : undefined
			}
		});
		try {
			this.snapshot = this.api.updateSnapshot({ openProject: config });
			const project = this.snapshot.getProject(config);
			if (!project) throw new Error("TSGo could not open the Convex lint project");
			this.project = project;
			this.files = project.rootFiles;
		} catch (cause) {
			this.api.close();
			throw cause;
		}
	}

	close() {
		this.snapshot.dispose();
		this.api.close();
	}

	source(file: string) {
		if (!this.sources.has(file)) this.sources.set(file, this.project.program.getSourceFile(file));
		return this.sources.get(file);
	}

	resolve(source: string, importer: string): string | undefined {
		const key = `${importer}\0${source}`;
		if (this.resolutions.has(key)) return this.resolutions.get(key);
		const literal = this.source(importer)?.imports.find(
			(node) => isModuleLiteral(node) && node.text === source
		);
		const resolved =
			literal &&
			this.project.checker
				.getSymbolAtLocation(literal)
				?.declarations.find((declaration) => declaration.kind === ts.SyntaxKind.SourceFile)?.path;
		// Literal require aliases need a path fallback because they are not TypeScript
		// module-resolution sites.
		const fallback = source.startsWith("#convex/")
			? path.join(this.root, "convex", source.slice(8))
			: source.startsWith(".")
				? path.resolve(path.dirname(importer), source)
				: undefined;
		const file =
			resolved ??
			(fallback &&
				[
					fallback,
					...[".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", "/index.ts", "/index.js"].map(
						(extension) => `${fallback}${extension}`
					)
				].find(existsSync)) ??
			fallback;
		this.resolutions.set(key, file);
		return file;
	}

	private declarations(symbol: Symbol): ts.Node[] {
		return symbol.declarations.flatMap((handle) => {
			const node = handle.resolve(this.project);
			return node ? [node] : [];
		});
	}

	private moduleSpecifier(node: ts.Node): ts.Expression | undefined {
		for (
			let parent = node.parent;
			parent.kind !== ts.SyntaxKind.SourceFile;
			parent = parent.parent
		) {
			if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent))
				return parent.moduleSpecifier;
		}
		return undefined;
	}

	private exportedOrigins(file: string, name: string, seen: Set<ts.Node>): Origin[] {
		const source = this.source(file);
		const symbol =
			source &&
			this.project.checker
				.getSymbolAtLocation(source)
				?.getExports()
				.find((symbol) => symbol.name === name);
		return symbol ? this.symbolOrigins(symbol, seen) : [{ file, name }];
	}

	isRegistrar(origin: Origin): boolean {
		const relative = path.relative(this.root, origin.file).replaceAll("\\", "/");
		return (
			((relative === "convex/_generated/server.d.ts" ||
				relative === "convex/_generated/server.js") &&
				REGISTRARS.has(origin.name)) ||
			(origin.file === "convex/server" && GENERIC_REGISTRARS.has(origin.name))
		);
	}

	origins(node: ts.Node, seen = new Set<ts.Node>()): Origin[] {
		if (seen.has(node)) return [];
		seen.add(node);
		if (
			ts.isParenthesizedExpression(node) ||
			ts.isAsExpression(node) ||
			ts.isSatisfiesExpression(node) ||
			ts.isNonNullExpression(node)
		) {
			return this.origins(node.expression, seen);
		}
		if (ts.isAwaitExpression(node)) return this.origins(node.expression, seen);
		if (ts.isConditionalExpression(node))
			return [...this.origins(node.whenTrue, seen), ...this.origins(node.whenFalse, seen)];
		if (ts.isCallExpression(node)) {
			const argument = node.arguments[0];
			if (this.isModuleLoader(node.expression) && argument && isModuleLiteral(argument)) {
				return [
					{
						file: this.resolve(argument.text, node.getSourceFile().fileName) ?? argument.text,
						name: "*"
					}
				];
			}
			if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "bind")
				return this.origins(node.expression.expression, seen);
		}
		if (ts.isVariableDeclaration(node) || ts.isBindingElement(node)) {
			if (node.initializer) return this.origins(node.initializer, seen);
			if (ts.isBindingElement(node) && ts.isVariableDeclaration(node.parent.parent)) {
				const initializer = node.parent.parent.initializer;
				if (initializer) {
					const owner = this.project.checker.getTypeAtLocation(initializer);
					const key = node.propertyName ?? node.name;
					const name = key && (ts.isIdentifier(key) || isModuleLiteral(key)) ? key.text : undefined;
					const symbol =
						owner && name
							? this.project.checker
									.getPropertiesOfType(owner)
									.find((symbol) => symbol.name === name)
							: undefined;
					if (symbol) return this.symbolOrigins(symbol, seen);
				}
			}
		}
		if (ts.isImportSpecifier(node) || ts.isExportSpecifier(node)) {
			if (node.isTypeOnly) return [];
		}
		if (ts.isNamespaceImport(node) || ts.isNamespaceExport(node)) {
			const symbol = this.project.checker.getSymbolAtLocation(node.name);
			return symbol ? this.symbolOrigins(symbol, seen) : [];
		}
		if (ts.isObjectLiteralExpression(node)) {
			return [...node.properties].flatMap((property) => {
				if (ts.isShorthandPropertyAssignment(property)) {
					const symbol = this.project.checker.getShorthandAssignmentValueSymbol(property);
					return symbol ? this.symbolOrigins(symbol, seen) : [];
				}
				if (ts.isPropertyAssignment(property)) return this.origins(property.initializer, seen);
				if (ts.isSpreadAssignment(property)) return this.origins(property.expression, seen);
				return [];
			});
		}
		const symbol = this.project.checker.getSymbolAtLocation(node);
		if (symbol) return this.symbolOrigins(symbol, seen);
		if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
			const key = ts.isPropertyAccessExpression(node)
				? node.name.text
				: node.argumentExpression && isModuleLiteral(node.argumentExpression)
					? node.argumentExpression.text
					: undefined;
			const owners = this.origins(node.expression, seen);
			return owners.flatMap((owner) => {
				if (key === "call" || key === "apply" || key === "bind") return [owner];
				if (!key) return [];
				if (owner.name === "*") return [{ file: owner.file, name: key }];
				return [];
			});
		}
		return [];
	}

	private symbolOrigins(symbol: Symbol, seen: Set<ts.Node>): Origin[] {
		return this.declarations(symbol).flatMap((declaration) => {
			if (seen.has(declaration)) return [];
			const file = path.resolve(declaration.getSourceFile().fileName);
			const origin = { file, name: symbol.name };
			if (this.isRegistrar(origin)) return [origin];
			if (declaration.kind === ts.SyntaxKind.SourceFile) return [{ file, name: "*" }];
			if (
				ts.isImportSpecifier(declaration) ||
				ts.isImportClause(declaration) ||
				ts.isNamespaceImport(declaration) ||
				ts.isExportSpecifier(declaration) ||
				ts.isNamespaceExport(declaration)
			) {
				seen.add(declaration);
				const source = this.moduleSpecifier(declaration);
				if (source && isModuleLiteral(source)) {
					const target = this.resolve(source.text, file) ?? source.text;
					const name =
						ts.isNamespaceImport(declaration) || ts.isNamespaceExport(declaration)
							? "*"
							: ts.isImportClause(declaration)
								? "default"
								: (declaration.propertyName ?? declaration.name).text;
					if (name === "*" || target === "convex/server") return [{ file: target, name }];
					return this.exportedOrigins(target, name, seen);
				}
				if (ts.isExportSpecifier(declaration)) {
					const name = declaration.propertyName ?? declaration.name;
					const local = this.project.checker.resolveName(
						name.text,
						SymbolFlags.Value | SymbolFlags.Alias,
						declaration
					);
					if (local && local.id !== symbol.id) return this.symbolOrigins(local, seen);
				}
			}
			if (ts.isPropertyAssignment(declaration)) return this.origins(declaration.initializer, seen);
			if (ts.isVariableDeclaration(declaration) || ts.isBindingElement(declaration)) {
				const origins = this.origins(declaration, seen);
				if (origins.length) return origins;
			}
			return [origin];
		});
	}

	exports(file: string, seen = new Set<string>()): Origin[] {
		if (seen.has(file)) return [];
		seen.add(file);
		const source = this.source(file);
		if (!source) return [];
		return [...source.statements].flatMap((statement): Origin[] => {
			if (ts.isExportDeclaration(statement)) {
				if (statement.isTypeOnly) return [];
				const clause = statement.exportClause;
				if (clause && ts.isNamedExports(clause))
					return [...clause.elements]
						.filter((element) => !element.isTypeOnly)
						.flatMap((element) => this.origins(element.name));
				if (clause) return this.origins(clause.name);
				const target =
					statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
						? this.resolve(statement.moduleSpecifier.text, file)
						: undefined;
				return target ? this.exports(target, seen) : [];
			}
			if (ts.isExportAssignment(statement)) return this.origins(statement.expression);
			if (
				ts.isVariableStatement(statement) ||
				ts.isFunctionDeclaration(statement) ||
				ts.isClassDeclaration(statement) ||
				ts.isEnumDeclaration(statement)
			) {
				if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword))
					return [];
				if (ts.isVariableStatement(statement))
					return [...statement.declarationList.declarations].flatMap((declaration) =>
						this.origins(declaration.name)
					);
				if (statement.name) return this.origins(statement.name);
			}
			return [];
		});
	}

	isEndpoint(file: string): boolean {
		const cached = this.endpoints.get(file);
		if (cached !== undefined) return cached;
		this.endpoints.set(file, false);
		const source = this.source(file);
		if (!source || source.isDeclarationFile) return false;
		let endpoint = false;
		const visit = (node: ts.Node) => {
			if (
				ts.isCallExpression(node) &&
				this.origins(node.expression).some((origin) => this.isRegistrar(origin))
			)
				endpoint = true;
			if (!endpoint) node.forEachChild(visit);
		};
		visit(source);
		if (!endpoint)
			endpoint = this.exports(file).some(
				(origin) => origin.file !== file && this.isEndpoint(origin.file)
			);
		this.endpoints.set(file, endpoint);
		return endpoint;
	}

	private isModuleLoader(node: ts.Node, seen = new Set<ts.Node>()): boolean {
		if (seen.has(node)) return false;
		seen.add(node);
		if (node.kind === ts.SyntaxKind.ImportKeyword) return true;
		if (
			ts.isParenthesizedExpression(node) ||
			ts.isAsExpression(node) ||
			ts.isNonNullExpression(node)
		)
			return this.isModuleLoader(node.expression, seen);
		if (!ts.isIdentifier(node)) return false;
		const symbol = this.project.checker.getSymbolAtLocation(node);
		const declarations = symbol ? this.declarations(symbol) : [];
		if (
			node.text === "require" &&
			!declarations.some((declaration) => declaration.getSourceFile() === node.getSourceFile())
		)
			return true;
		return declarations.some(
			(declaration) =>
				ts.isVariableDeclaration(declaration) &&
				declaration.initializer &&
				this.isModuleLoader(declaration.initializer, seen)
		);
	}

	dependencies(source: ts.SourceFile, seen = new Set<string>()): Dependency[] {
		if (seen.has(source.fileName)) return [];
		seen.add(source.fileName);
		const dependencies: Dependency[] = [];
		const add = (node: ts.Node, specifier: string, origins: Origin[]) => {
			const file = this.resolve(specifier, source.fileName);
			if (!origins.length && specifier === "convex/server")
				origins = [{ file: specifier, name: "*" }];
			const expanded = origins.flatMap((origin) =>
				origin.name === "*" ? [origin, ...this.exports(origin.file)] : [origin]
			);
			const files = new Set([...(file ? [file] : []), ...expanded.map((origin) => origin.file)]);
			// A neutral helper/barrel must not hide a forbidden dependency. Stop at real layers:
			// handler -> service -> lib is valid, while handler -> neutral helper -> lib is not.
			for (const dependencyFile of [...files]) {
				if (
					isConvexLibFile(dependencyFile) ||
					isConvexServiceFile(dependencyFile) ||
					this.isEndpoint(dependencyFile)
				)
					continue;
				const dependencySource = this.source(dependencyFile);
				if (!dependencySource || dependencySource.isDeclarationFile) continue;
				for (const nested of this.dependencies(dependencySource, new Set(seen))) {
					if (nested.source === "<dynamic>") files.add("<dynamic>");
					for (const nestedFile of nested.files) files.add(nestedFile);
					expanded.push(...nested.origins);
				}
			}
			dependencies.push({ node, source: specifier, files, origins: expanded });
		};
		const visit = (node: ts.Node) => {
			if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
				if (node.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword) return;
				const bindings = node.importClause?.namedBindings;
				const values =
					bindings && ts.isNamedImports(bindings)
						? [...bindings.elements].filter((element) => !element.isTypeOnly)
						: bindings
							? [bindings]
							: [];
				if (
					node.importClause &&
					!node.importClause.name &&
					bindings &&
					ts.isNamedImports(bindings) &&
					bindings.elements.length > 0 &&
					!values.length
				)
					return;
				const origins = [
					...(node.importClause?.name ? this.origins(node.importClause.name) : []),
					...values.flatMap((binding) => this.origins(binding.name))
				];
				add(node, node.moduleSpecifier.text, origins);
			} else if (
				ts.isExportDeclaration(node) &&
				!node.isTypeOnly &&
				node.moduleSpecifier &&
				ts.isStringLiteral(node.moduleSpecifier)
			) {
				const clause = node.exportClause;
				if (
					clause &&
					ts.isNamedExports(clause) &&
					clause.elements.length > 0 &&
					clause.elements.every((element) => element.isTypeOnly)
				)
					return;
				const file = this.resolve(node.moduleSpecifier.text, source.fileName);
				const origins =
					clause && ts.isNamedExports(clause)
						? [...clause.elements]
								.filter((element) => !element.isTypeOnly)
								.flatMap((element) => this.origins(element.name))
						: file
							? this.exports(file)
							: [];
				add(node, node.moduleSpecifier.text, origins);
			} else if (
				ts.isImportEqualsDeclaration(node) &&
				!node.isTypeOnly &&
				ts.isExternalModuleReference(node.moduleReference)
			) {
				const argument = node.moduleReference.expression;
				if (argument && isModuleLiteral(argument)) {
					const file = this.resolve(argument.text, source.fileName);
					add(node, argument.text, file ? this.exports(file) : []);
				} else add(node, "<dynamic>", []);
			} else if (ts.isCallExpression(node) && this.isModuleLoader(node.expression)) {
				const argument = node.arguments[0];
				if (argument && isModuleLiteral(argument)) {
					const file = this.resolve(argument.text, source.fileName);
					add(node, argument.text, file ? this.exports(file) : []);
				} else {
					add(node, "<dynamic>", []);
				}
			}
			node.forEachChild(visit);
		};
		visit(source);
		return dependencies;
	}
}
