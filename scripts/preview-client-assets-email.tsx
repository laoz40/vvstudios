import { ClientAssetsEmail } from "#studio/features/client-assets-email/ClientAssetsEmail";

const previewProps = { assetsUrl: "#", name: "Alex", signoffName: "Joseph" };

export default function ClientAssetsEmailPreview() {
	return <ClientAssetsEmail {...previewProps} />;
}

ClientAssetsEmailPreview.PreviewProps = previewProps;
