import { cn } from "#/lib/utils";

export const sectionHeadingClassName =
	"text-sm! font-semibold tracking-widest text-primary uppercase";

export const transitionClassName =
	"transform-gpu transition-[transform,border-color,background-color,color] duration-200 ease-in";

export const cardHoverClassName = "hover:border-primary hover:bg-primary/10";
export const cardSelectedClassName = "border-primary bg-primary/10";

export const textIdleClassName = "text-foreground/80";
export const textSelectedClassName = "text-foreground";

export const footerBaseClassName = "md:bg-input/30 md:backdrop-blur-none";
export const footerHoverClassName = "bg-background/25 group-hover:bg-primary/15";
export const footerSelectedClassName = "bg-primary/12 md:bg-primary/15";

export const pillIdleClassName =
	"border-foreground/15 bg-background/30 text-foreground/85 group-hover:text-primary";
export const pillSelectedClassName = "border-primary bg-primary text-primary-foreground";

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
