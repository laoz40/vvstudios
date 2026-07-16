import type { ReactNode } from "react";
import { Image } from "@unpic/react";
import logoAnimatedYellow from "#studio/assets/logo-animated-yellow.svg";

type StudioErrorPageProps = { actions: ReactNode; description: string; title: string };

export function StudioErrorPage({ actions, description, title }: StudioErrorPageProps) {
	return (
		<main className="px-6 text-center md:px-10">
			<div className="mx-auto flex max-w-3xl flex-col items-center gap-8">
				<Image
					src={logoAnimatedYellow}
					alt="VV Studios"
					width={200}
					height={200}
					layout="fixed"
					loading="eager"
					className="size-[50vh] shrink-0"
				/>

				<div className="space-y-4">
					<h1 className="text-4xl font-semibold tracking-tight md:text-6xl">{title}</h1>
					<p className="mx-auto max-w-xl text-base text-muted-foreground">{description}</p>
				</div>

				<div className="flex flex-col gap-3 sm:flex-row">{actions}</div>
			</div>
		</main>
	);
}
