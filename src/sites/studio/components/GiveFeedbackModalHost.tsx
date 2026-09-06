import { Suspense, lazy } from "react";

import PublicConvexProvider, {
	usePublicConvexAvailable
} from "#/integrations/convex/public-provider";

const GiveFeedbackModal = lazy(() =>
	import("#studio/components/GiveFeedbackModal").then((module) => ({
		default: module.GiveFeedbackModal
	}))
);

function LazyGiveFeedbackModal() {
	return (
		<Suspense fallback={null}>
			<GiveFeedbackModal />
		</Suspense>
	);
}

export function GiveFeedbackModalHost() {
	const hasPublicConvex = usePublicConvexAvailable();

	if (hasPublicConvex) {
		return <LazyGiveFeedbackModal />;
	}

	return (
		<PublicConvexProvider>
			<LazyGiveFeedbackModal />
		</PublicConvexProvider>
	);
}
