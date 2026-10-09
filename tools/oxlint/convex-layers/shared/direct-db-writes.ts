import type { ESTree } from "@oxlint/plugins";

export type DirectDbWriteMethod = "delete" | "insert" | "patch" | "replace";

export type DirectDbWrite = {
	method: DirectDbWriteMethod;
	table: string | undefined;
	fields: Set<string>;
};

function literalString(node: ESTree.Node | undefined): string | undefined {
	if (node?.type === "Literal" && typeof node.value === "string") return node.value;
	if (node?.type === "TemplateLiteral" && node.expressions.length === 0) {
		return node.quasis[0]?.value.cooked ?? undefined;
	}
	return undefined;
}

function memberProperty(node: ESTree.MemberExpression): string | undefined {
	return node.computed
		? literalString(node.property)
		: node.property.type === "Identifier" ? node.property.name : undefined;
}

function isCtxDb(node: ESTree.Node): boolean {
	return (
		node.type === "MemberExpression" &&
		node.object.type === "Identifier" &&
		node.object.name === "ctx" &&
		memberProperty(node) === "db"
	);
}

function objectPropertyName(node: ESTree.ObjectProperty): string | undefined {
	if (!node.computed && node.key.type === "Identifier") return node.key.name;
	return literalString(node.key);
}

/** Returns field keys visible in an inline object and its inline object spreads. */
function visibleObjectPropertyNames(node: ESTree.Node | undefined): Set<string> {
	const fields = new Set<string>();
	if (node?.type !== "ObjectExpression") return fields;

	for (const property of node.properties) {
		if (property.type === "SpreadElement") {
			for (const field of visibleObjectPropertyNames(property.argument)) fields.add(field);
		} else if (property.type === "Property") {
			const name = objectPropertyName(property);
			if (name !== undefined) fields.add(name);
		}
	}

	return fields;
}

function writeFieldsArgument(node: ESTree.CallExpression, method: DirectDbWriteMethod) {
	if (method === "insert") return node.arguments[1];
	if (method === "patch" || method === "replace") return node.arguments[2];
	return undefined;
}

/** Reads direct ctx.db writes with literal table/method names and visible object fields. */
export function getDirectDbWrite(node: ESTree.Node): DirectDbWrite | undefined {
	if (node.type !== "CallExpression" || node.callee.type !== "MemberExpression") return;
	if (!isCtxDb(node.callee.object)) return;

	const method = memberProperty(node.callee);
	if (method !== "insert" && method !== "patch" && method !== "replace" && method !== "delete") {
		return;
	}

	return {
		method,
		table: literalString(node.arguments[0]),
		fields: visibleObjectPropertyNames(writeFieldsArgument(node, method))
	};
}

export function normalizedConvexFilename(filename: string): string {
	const normalized = filename.replaceAll("\\", "/");
	const convexIndex = normalized.lastIndexOf("/convex/");
	return convexIndex === -1 ? normalized : normalized.slice(convexIndex + 1);
}

export function isConvexTestFile(filename: string): boolean {
	return /(?:\/tests\/|\.test\.[cm]?tsx?$)/u.test(filename.replaceAll("\\", "/"));
}
