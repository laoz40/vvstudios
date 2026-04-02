export type SchemaContext = "https://schema.org";

export type PostalAddress = {
	"@type": "PostalAddress";
	streetAddress: string;
	addressLocality: string;
	addressRegion: string;
	postalCode: string;
	addressCountry: string;
};

export type OrganizationReference = {
	"@type": "Organization";
	name: string;
	"@id"?: string;
};

export type WebSiteSchema = {
	"@context": SchemaContext;
	"@type": "WebSite";
	"@id"?: string;
	name: string;
	url: string;
};

export type OrganizationSchema = {
	"@context": SchemaContext;
	"@type": "Organization";
	"@id"?: string;
	name: string;
	alternateName?: string;
	url: string;
	image: string;
	telephone: string;
	email: string;
};

export type LocalBusinessSchema = {
	"@context": SchemaContext;
	"@type": "LocalBusiness";
	"@id"?: string;
	name: string;
	alternateName?: string;
	url: string;
	image: string;
	telephone: string;
	email: string;
	address: PostalAddress;
	areaServed: string[];
	parentOrganization: OrganizationReference;
};

export type BreadcrumbListItem = {
	name: string;
	path: string;
};

export type ListItem = {
	"@type": "ListItem";
	position: number;
	name: string;
	item: string;
};

export type BreadcrumbListSchema = {
	"@context": SchemaContext;
	"@type": "BreadcrumbList";
	itemListElement: ListItem[];
};

export type FaqSchemaItem = {
	question: string;
	answer: string;
};

export type Question = {
	"@type": "Question";
	name: string;
	acceptedAnswer: {
		"@type": "Answer";
		text: string;
	};
};

export type FaqPageSchema = {
	"@context": SchemaContext;
	"@type": "FAQPage";
	mainEntity: Question[];
};

export type JsonLdNode =
	| WebSiteSchema
	| OrganizationSchema
	| LocalBusinessSchema
	| BreadcrumbListSchema
	| FaqPageSchema;

export type BusinessSchemaConfig = {
	name: string;
	url: string;
	image: string;
	telephone: string;
	email: string;
	address: PostalAddress;
	areaServed: string[];
	parentOrganization: OrganizationReference;
};

const schemaContext: SchemaContext = "https://schema.org";

export const buildWebSiteSchema = (name: string, url: string): WebSiteSchema => ({
	"@context": schemaContext,
	"@type": "WebSite",
	"@id": `${url}#website`,
	name,
	url,
});

export const buildOrganizationSchema = (
	config: Pick<
		BusinessSchemaConfig,
		"name" | "url" | "image" | "telephone" | "email"
	>,
): OrganizationSchema => ({
	"@context": schemaContext,
	"@type": "Organization",
	"@id": `${config.url}#organization`,
	name: config.name,
	alternateName: "Vertigo Visuals",
	url: config.url,
	image: config.image,
	telephone: config.telephone,
	email: config.email,
});

export const buildLocalBusinessSchema = (
	config: BusinessSchemaConfig,
): LocalBusinessSchema => ({
	"@context": schemaContext,
	"@type": "LocalBusiness",
	"@id": `${config.url}#localbusiness`,
	name: config.name,
	alternateName: "Vertigo Visuals",
	url: config.url,
	image: config.image,
	telephone: config.telephone,
	email: config.email,
	address: config.address,
	areaServed: config.areaServed,
	parentOrganization: config.parentOrganization,
});

export const buildBreadcrumbSchema = (
	items: BreadcrumbListItem[],
	siteUrl: URL,
): BreadcrumbListSchema => ({
	"@context": schemaContext,
	"@type": "BreadcrumbList",
	itemListElement: items.map((item, index) => ({
		"@type": "ListItem",
		position: index + 1,
		name: item.name,
		item: new URL(item.path, siteUrl).toString(),
	})),
});

export const buildFaqSchema = (items: FaqSchemaItem[]): FaqPageSchema => ({
	"@context": schemaContext,
	"@type": "FAQPage",
	mainEntity: items.map((item) => ({
		"@type": "Question",
		name: item.question,
		acceptedAnswer: {
			"@type": "Answer",
			text: item.answer,
		},
	})),
});

export const serializeJsonLd = (schema: JsonLdNode): string =>
	JSON.stringify(schema)
		.replace(/</g, "\\u003c")
		.replace(/>/g, "\\u003e")
		.replace(/&/g, "\\u0026")
		.replace(/\u2028/g, "\\u2028")
		.replace(/\u2029/g, "\\u2029");
