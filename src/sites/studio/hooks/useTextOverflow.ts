import { useCallback, useState } from "react";

export function useTextOverflow() {
	const [isTruncated, setIsTruncated] = useState(false);

	const previewRef = useCallback((preview: HTMLElement | null) => {
		if (!preview) return undefined;

		const measureOverflow = () => {
			setIsTruncated(
				preview.scrollHeight > preview.clientHeight || preview.scrollWidth > preview.clientWidth
			);
		};

		measureOverflow();
		const resizeObserver = new ResizeObserver(measureOverflow);
		resizeObserver.observe(preview);
		const textObserver = new MutationObserver(measureOverflow);
		textObserver.observe(preview, { characterData: true, childList: true, subtree: true });

		return () => {
			resizeObserver.disconnect();
			textObserver.disconnect();
		};
	}, []);

	return { previewRef, isTruncated };
}
