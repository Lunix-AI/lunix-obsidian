export const formatError = (e: unknown) => {
	if (e instanceof Error) {
		// Handles standard Error objects
		return `${e.name}: ${e.message}\n${e.stack}`;
	}

	if (typeof e === "object") {
		try {
			// Attempts to JSON-serialize the object if possible
			return `Object: ${JSON.stringify(e)}`;
		} catch (jsonError) {
			// If JSON serialization fails, use a different approach
			return `Object, could not stringify: ${String(e)}`;
		}
	} else {
		// Handles non-object types (e.g., strings, numbers)
		return String(e);
	}
};
