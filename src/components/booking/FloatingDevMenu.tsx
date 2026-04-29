import { X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "#/components/ui/button";

interface FloatingDevMenuProps {
	buttonLabel: string;
	children: (closeMenu: () => void) => ReactNode;
	title: string;
}

export function FloatingDevMenu({ buttonLabel, children, title }: FloatingDevMenuProps): ReactNode {
	const [isOpen, setIsOpen] = useState(false);

	const closeMenu = () => {
		setIsOpen(false);
	};

	return (
		<div className="fixed bottom-6 left-4 z-50 flex flex-col items-start gap-2 sm:left-6">
			{isOpen ? (
				<div className="w-56 rounded-xl border border-border bg-card p-2 shadow-lg">
					<div className="flex items-center justify-between gap-2 px-2 py-1.5">
						<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
							{title}
						</p>
						<Button
							type="button"
							size="icon-sm"
							variant="ghost"
							aria-label="Close dev menu"
							onClick={closeMenu}>
							<X />
						</Button>
					</div>
					<div className="flex flex-col gap-1">{children(closeMenu)}</div>
				</div>
			) : null}

			<Button
				type="button"
				size="sm"
				variant="outline"
				onClick={() => setIsOpen((current) => !current)}>
				{buttonLabel}
			</Button>
		</div>
	);
}
