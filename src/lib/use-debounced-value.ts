import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs: number) {
	const [debouncedValue, setDebouncedValue] = useState(value);

	// Delay propagating fast-changing values (e.g. search input) to downstream queries.
	useEffect(() => {
		const timeoutId = setTimeout(() => {
			setDebouncedValue(value);
		}, delayMs);

		return () => {
			clearTimeout(timeoutId);
		};
	}, [delayMs, value]);

	return debouncedValue;
}
