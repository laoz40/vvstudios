import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { createPortal } from "react-dom";
import { Image } from "@unpic/react";
import { ArrowRight, Menu, X } from "lucide-react";
import logoYellow from "#studio/assets/vv-logo-yellow.svg";
import { studioSite } from "#/config/sites";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";

const BRAND_LABEL = "VV STUDIOS";
const HOME_ARIA_LABEL = "VV Studios home";
const PRIMARY_NAV_ARIA_LABEL = "Primary navigation";

const MOBILE_NAV_ARIA_LABEL = "Navigation Menu";
const OPEN_NAV_ARIA_LABEL = "Open navigation menu";
const CLOSE_NAV_ARIA_LABEL = "Close navigation menu";
const OPEN_MENU_SR_TEXT = "Open menu";
const CLOSE_MENU_SR_TEXT = "Close menu";
type InertElement = HTMLElement & { inert: boolean };

const BOOK_LINK = { href: studioSite.routes.book, label: "Book session" } as const;
const BACK_HOME_LINK = { href: studioSite.routes.home, label: "Back to home" } as const;

const CONTACT_FAQ_HASH = "contact-faq-title";

type NavLinkItem = {
	href: string;
	hash?: string;
	label: string;
};

const DESKTOP_LINKS: readonly NavLinkItem[] = [
	{ href: studioSite.routes.gallery, label: "Gallery" },
	{ href: studioSite.routes.pricing, label: "Pricing" },
	{ href: studioSite.routes.contact, hash: CONTACT_FAQ_HASH, label: "FAQ" },
	{ href: studioSite.routes.contact, label: "Contact" },
] as const;
const MOBILE_LINKS: readonly NavLinkItem[] = [
	{ href: studioSite.routes.home, label: "Home" },
	{ href: studioSite.routes.gallery, label: "Gallery" },
	{ href: studioSite.routes.pricing, label: "Pricing" },
	{ href: studioSite.routes.contact, hash: CONTACT_FAQ_HASH, label: "FAQ" },
	{ href: studioSite.routes.contact, label: "Contact" },
] as const;

function BrandLink({ className, logoClassName }: { className?: string; logoClassName?: string }) {
	return (
		<Link
			to={studioSite.routes.home}
			aria-label={HOME_ARIA_LABEL}
			className={cn(
				"inline-flex h-full items-center gap-2 rounded-md no-underline outline-none transition-opacity hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-ring/50",
				className,
			)}>
			<Image
				src={logoYellow}
				alt=""
				aria-hidden
				width={36}
				height={36}
				layout="fixed"
				loading="eager"
				className={cn("size-9 shrink-0", logoClassName)}
			/>
			<span className="font-brand text-xl font-medium tracking-wide">{BRAND_LABEL}</span>
		</Link>
	);
}

function DesktopNavLink({
	href,
	hash,
	label,
	pathname,
}: {
	href: string;
	hash?: string;
	label: string;
	pathname: string;
}) {
	return (
		<li className="group relative">
			<Button
				asChild
				variant="link"
				size="sm"
				className="text-foreground decoration-current hover:text-foreground">
				<Link
					to={href}
					hash={hash}
					aria-current={pathname === href && !hash ? "page" : undefined}>
					{label}
				</Link>
			</Button>
		</li>
	);
}

function NavCta({
	href,
	label,
	variant = "primary",
}: {
	href: string;
	label: string;
	variant?: "primary" | "secondary";
}) {
	return (
		<Button
			asChild
			size="lg"
			variant={variant === "primary" ? "default" : "secondary"}
			className={cn(
				"site-nav-cta",
				href === BOOK_LINK.href && "gap-1.5 shadow-lg shadow-primary/45",
			)}>
			<Link to={href}>
				{label}
				{href === BOOK_LINK.href ? (
					<ArrowRight
						className="stroke-2"
						aria-hidden
					/>
				) : null}
			</Link>
		</Button>
	);
}

function DesktopNavbar({ pathname }: { pathname: string }) {
	const isBookPage = pathname === studioSite.routes.book;
	const shouldPlayIntro = pathname === studioSite.routes.home;

	return (
		<div className="site-navbar fixed top-4 left-1/2 z-40 hidden w-full max-w-7xl -translate-x-1/2 px-4 md:block">
			<div className={cn(shouldPlayIntro && "site-nav-intro")}>
				<nav
					aria-label={PRIMARY_NAV_ARIA_LABEL}
					className="rounded-md border border-border/70 bg-background/30 px-4 py-3 shadow-lg backdrop-blur-xs">
					<div className="flex items-stretch justify-between gap-4">
						<div className="flex h-full items-stretch justify-self-start">
							<BrandLink />
						</div>

						<div className="flex items-center justify-end gap-5">
							<ul className="flex items-center gap-3">
								{DESKTOP_LINKS.map((link) => (
									<DesktopNavLink
										key={`${link.href}-${link.label}`}
										href={link.href}
										hash={link.hash}
										label={link.label}
										pathname={pathname}
									/>
								))}
							</ul>

							{isBookPage ? (
								<NavCta
									href={BACK_HOME_LINK.href}
									label={BACK_HOME_LINK.label}
									variant="secondary"
								/>
							) : (
								<NavCta
									href={BOOK_LINK.href}
									label={BOOK_LINK.label}
								/>
							)}
						</div>
					</div>
				</nav>
			</div>
		</div>
	);
}

function MobileNavbar({ pathname }: { pathname: string }) {
	const [isOpen, setIsOpen] = useState(false);
	const [portalElement, setPortalElement] = useState<HTMLDivElement | null>(null);
	const isBookPage = pathname === studioSite.routes.book;
	const shouldPlayIntro = pathname === studioSite.routes.home;

	useEffect(() => {
		setIsOpen(false);
	}, [pathname]);

	useEffect(() => {
		if (!isOpen) {
			setPortalElement(null);
			return;
		}

		const element = document.createElement("div");
		element.dataset.mobileNavRoot = "true";
		document.body.append(element);
		setPortalElement(element);

		return () => {
			element.remove();
		};
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen || !portalElement) {
			return;
		}

		const previousOverflow = document.body.style.overflow;
		const siblings = Array.from(document.body.children).filter(
			(element) => element !== portalElement,
		);
		const previousSiblingState = siblings.map((element) => ({
			element: element as InertElement,
			inert: (element as InertElement).inert,
			ariaHidden: element.getAttribute("aria-hidden"),
		}));

		document.body.style.overflow = "hidden";
		for (const { element } of previousSiblingState) {
			element.inert = true;
			element.setAttribute("aria-hidden", "true");
		}

		return () => {
			document.body.style.overflow = previousOverflow;
			for (const { element, inert, ariaHidden } of previousSiblingState) {
				element.inert = inert;
				if (ariaHidden === null) {
					element.removeAttribute("aria-hidden");
				} else {
					element.setAttribute("aria-hidden", ariaHidden);
				}
			}
		};
	}, [isOpen, portalElement]);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const handleKeydown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setIsOpen(false);
			}
		};

		window.addEventListener("keydown", handleKeydown);

		return () => {
			window.removeEventListener("keydown", handleKeydown);
		};
	}, [isOpen]);

	return (
		<>
			<div className="site-navbar fixed inset-x-0 top-2 z-40 px-4 md:hidden">
				<div className={cn(shouldPlayIntro && "site-nav-intro")}>
					<nav
						aria-label={MOBILE_NAV_ARIA_LABEL}
						className="mx-auto flex h-12 w-full max-w-7xl flex-row items-center justify-between rounded-md border border-border/70 bg-background/30 px-3 shadow-lg backdrop-blur-xs">
						<div className="flex h-full items-center">
							<BrandLink
								className="font-bold"
								logoClassName="size-7"
							/>
						</div>

						<Button
							aria-label={isOpen ? CLOSE_NAV_ARIA_LABEL : OPEN_NAV_ARIA_LABEL}
							aria-expanded={isOpen}
							aria-controls="mobile-nav-panel"
							size="icon-lg"
							variant="ghost"
							onClick={() => {
								setIsOpen((current) => !current);
							}}>
							<span className="sr-only">{isOpen ? CLOSE_MENU_SR_TEXT : OPEN_MENU_SR_TEXT}</span>
							<Menu className={cn("size-5", isOpen && "hidden")} />
							<X className={cn("size-5", !isOpen && "hidden")} />
						</Button>
					</nav>
				</div>
			</div>

			{isOpen && portalElement
				? createPortal(
						<>
							<button
								type="button"
								className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
								onClick={() => {
									setIsOpen(false);
								}}
								aria-label={CLOSE_NAV_ARIA_LABEL}
							/>

							<div
								id="mobile-nav-panel"
								className="fixed top-0 right-0 z-50 flex h-screen w-72 max-w-[90vw] flex-col overscroll-contain border-l border-border bg-background p-5 shadow-xl md:hidden">
								<div className="mb-5 flex items-center justify-between border-b pb-4">
									<p className="font-brand text-lg font-semibold tracking-wide text-muted-foreground">
										{BRAND_LABEL}
									</p>

									<Button
										aria-label={CLOSE_NAV_ARIA_LABEL}
										size="icon-lg"
										variant="ghost"
										onClick={() => {
											setIsOpen(false);
										}}>
										<X className="size-5" />
									</Button>
								</div>

								<ul className="flex flex-col gap-1">
									{MOBILE_LINKS.map((link) => (
										<li key={`${link.href}-${link.label}`}>
											<Button
												asChild
												variant="link"
												className={cn(
													"h-11 w-full justify-start px-3 text-base",
													pathname === link.href && !link.hash
														? "text-accent-foreground"
														: "text-foreground hover:text-foreground",
												)}>
												<Link
													to={link.href}
													hash={link.hash}
													aria-current={pathname === link.href && !link.hash ? "page" : undefined}
													onClick={() => {
														setIsOpen(false);
													}}>
													{link.label}
												</Link>
											</Button>
										</li>
									))}

									<li className="mt-3 border-t pt-4">
										{isBookPage ? (
											<NavCta
												href={BACK_HOME_LINK.href}
												label={BACK_HOME_LINK.label}
												variant="secondary"
											/>
										) : (
											<NavCta
												href={BOOK_LINK.href}
												label={BOOK_LINK.label}
											/>
										)}
									</li>
								</ul>
							</div>
						</>,
						portalElement,
					)
				: null}
		</>
	);
}

export function SiteNavbar() {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	return (
		<>
			<DesktopNavbar pathname={pathname} />
			<MobileNavbar pathname={pathname} />
		</>
	);
}
