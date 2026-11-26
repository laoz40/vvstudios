import { forwardRef, useImperativeHandle } from "react";
import { motion, useAnimate } from "motion/react";
import type { AnimatedIconHandle, AnimatedIconProps } from "./types";

const BrandGoogleDriveIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
	({ size = 24, color = "currentColor", strokeWidth = 2, className = "", ...props }, ref) => {
		const [scope, animate] = useAnimate();

		const start = () => {
			void animate(
				".google-drive-mark",
				{ rotate: [0, -10, 10, -5, 0], scale: [1, 1.05, 1] },
				{ duration: 0.6, ease: "easeInOut" }
			);
		};

		const stop = () => {
			void animate(
				".google-drive-mark",
				{ rotate: 0, scale: 1 },
				{ duration: 0.3, ease: "easeInOut" }
			);
		};

		useImperativeHandle(ref, () => ({
			startAnimation: start,
			stopAnimation: stop
		}));

		return (
			<motion.svg
				ref={scope}
				xmlns="http://www.w3.org/2000/svg"
				width={size}
				height={size}
				viewBox="0 0 24 24"
				fill="none"
				stroke={color}
				strokeWidth={strokeWidth}
				strokeLinecap="round"
				strokeLinejoin="round"
				className={`cursor-pointer ${className}`}
				onHoverStart={start}
				onHoverEnd={stop}
				{...props}>
				<motion.g
					className="google-drive-mark"
					style={{ transformOrigin: "50% 50%" }}>
					<path d="M11.713 3.5L14.426 3.5A1 1 0 0 1 15.289 3.996L22 15.5L19.291 20.014A1 1 0 0 1 18.434 20.5L5 20.5L2.304 16.007A1 1 0 0 1 2.298 14.989L9 3.5Z" />
					<path d="M9 3.5L16 15.5" />
					<path d="M11.958 8.571L5 20.5" />
					<path d="M7.917 15.5H22" />
				</motion.g>
			</motion.svg>
		);
	}
);

BrandGoogleDriveIcon.displayName = "BrandGoogleDriveIcon";

export default BrandGoogleDriveIcon;
