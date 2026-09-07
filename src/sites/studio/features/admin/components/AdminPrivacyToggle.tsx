import { Eye, EyeOff } from "lucide-react";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import { useAdminPrivacyMode } from "#studio/features/admin/components/AdminPrivacyMode";

export function AdminPrivacyToggle() {
	const { isPrivacyModeEnabled, setPrivacyModeEnabled } = useAdminPrivacyMode();

	return (
		<AnimatedIconButton
			type="button"
			variant="ghost"
			size="sm"
			iconPosition="before"
			aria-pressed={isPrivacyModeEnabled}
			onClick={() => setPrivacyModeEnabled(!isPrivacyModeEnabled)}
			renderIcon={() =>
				isPrivacyModeEnabled ? (
					<EyeOff
						aria-hidden
						className="size-4"
					/>
				) : (
					<Eye
						aria-hidden
						className="size-4"
					/>
				)
			}>
			<button type="button">{isPrivacyModeEnabled ? "Privacy on" : "Privacy off"}</button>
		</AnimatedIconButton>
	);
}
