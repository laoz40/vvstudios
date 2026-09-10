import { cn } from "#/lib/utils";

export const sectionHeadingClassName = "text-base font-semibold text-primary";

export const transitionClassName =
	"transform-gpu transition-[transform,border-color,background-color,color] duration-200 ease-in";

const cardHoverClassName = "hover:border-primary/40 hover:bg-primary/10";

const cardSelectedClassName = "border-primary/40 bg-primary/10";

const textIdleClassName = "text-foreground/80";

const textSelectedClassName = "text-foreground";

const footerBaseClassName = "bg-input/30";

const footerHoverClassName = "group-hover:bg-primary/10";

const footerSelectedClassName = "bg-primary/10";

const pillIdleClassName =
	"min-w-16 border-border bg-input/30 text-foreground/85 group-hover:text-primary group-hover:bg-secondary";

const pillSelectedClassName = "min-w-20 border-foreground/15 bg-background/30 text-primary";

export function getCardStateClassName(isSelected: boolean) {
	return cn(cardHoverClassName, isSelected && cardSelectedClassName);
}

export function getTextStateClassName(isSelected: boolean) {
	return isSelected ? textSelectedClassName : textIdleClassName;
}

export function getFooterStateClassName(isSelected: boolean) {
	return cn(footerBaseClassName, isSelected ? footerSelectedClassName : footerHoverClassName);
}

export function getPillStateClassName(isSelected: boolean) {
	return isSelected ? pillSelectedClassName : pillIdleClassName;
}

export function getRevealMotionProps(shouldReduceMotion: boolean) {
	if (shouldReduceMotion) {
		return {
			initial: { height: 0 },
			animate: { height: "auto" },
			exit: { height: 0 },
			transition: { duration: 0 }
		} as const;
	}

	return {
		initial: { height: 0, opacity: 0, y: -8 },
		animate: { height: "auto", opacity: 1, y: 0 },
		exit: { height: 0, opacity: 0, y: -8 },
		transition: { duration: 0.2, ease: "easeOut" }
	} as const;
}
