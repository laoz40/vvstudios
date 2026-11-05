import { useEffect, useRef, useState } from "react";

export function useTextOverflow<T extends HTMLElement>(text: string | undefined) {
	const previewRef = useRef<T>(null);
	const [isTruncated, setIsTruncated] = useState(false);

	useEffect(() => {
		const preview = previewRef.current;

		if (!preview) return undefined;

		const measureOverflow = () => {
			setIsTruncated(
				preview.scrollHeight > preview.clientHeight || preview.scrollWidth > preview.clientWidth
			);
		};

		measureOverflow();
		const observer = new ResizeObserver(measureOverflow);
		observer.observe(preview);

		return () => observer.disconnect();
	}, [text]);

	return { previewRef, isTruncated };
}
