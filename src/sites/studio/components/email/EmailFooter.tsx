import { Link, Section, Text } from "@react-email/components";
import { CONTACT_EMAIL } from "#/config/contact";

export function EmailFooter() {
	return (
		<Section style={footerSection}>
			<Text style={footerText}>This is an automated email, please do not reply.</Text>
			<Text style={footerText}>
				You can contact us through{" "}
				<Link
					href={`mailto:${CONTACT_EMAIL}`}
					style={footerLink}>
					{CONTACT_EMAIL}
				</Link>
				.
			</Text>
		</Section>
	);
}

const footerSection = {
	borderTop: "1px solid #454545",
	marginTop: "24px",
	paddingTop: "16px",
	textAlign: "center" as const
};

const footerText = { color: "#b8b8b8", fontSize: "12px", lineHeight: "18px", margin: "0 0 8px" };

const footerLink = { color: "#f5c400", textDecoration: "underline" };
