import { cn } from "#/lib/utils";

export const sectionHeadingClassName = "text-base font-semibold text-primary";

export const transitionClassName =
	"transform-gpu transition-[transform,border-color,background-color,color] duration-200 ease-in";

const cardHoverClassName = "hover:border-primary hover:bg-primary/10";
const cardSelectedClassName = "border-primary bg-primary/10";

const textIdleClassName = "text-foreground/80";
const textSelectedClassName = "text-foreground";

const footerBaseClassName = "md:bg-input/30 md:backdrop-blur-none";
const footerHoverClassName = "bg-background/25 group-hover:bg-primary/15";
const footerSelectedClassName = "bg-primary/12 md:bg-primary/15";

const pillIdleClassName =
	"min-w-16 border-foreground/15 bg-background/30 text-foreground/85 group-hover:text-primary";
const pillSelectedClassName = "min-w-20 border-primary/50 bg-background/30 text-primary";

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
