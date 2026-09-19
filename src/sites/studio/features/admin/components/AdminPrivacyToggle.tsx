import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import EyeIcon from "#/components/ui/eye-icon";
import EyeOffIcon from "#/components/ui/eye-off-icon";
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
			renderIcon={(iconRef) =>
				isPrivacyModeEnabled ? (
					<EyeOffIcon
						ref={iconRef}
						size={16}
						aria-hidden
						className="shrink-0 text-current"
					/>
				) : (
					<EyeIcon
						ref={iconRef}
						size={16}
						aria-hidden
						className="shrink-0 text-current"
					/>
				)
			}>
			<button type="button">{isPrivacyModeEnabled ? "Privacy on" : "Privacy off"}</button>
		</AnimatedIconButton>
	);
}
