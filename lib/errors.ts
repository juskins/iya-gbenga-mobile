const RPC_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Please sign in to continue.",
  INVALID_QUANTITY: "That quantity isn't valid.",
  VARIANT_UNAVAILABLE: "Sorry, that item is no longer available.",
  OUT_OF_STOCK: "Sorry, that item is out of stock.",
};

/** Maps a Supabase RPC error message (which starts with a code) to a friendly message. */
export function friendlyRpcError(message: string | undefined): string {
  const code = message?.trim().split(/[\s:]/)[0] ?? "";
  return RPC_MESSAGES[code] ?? "Something went wrong. Please try again.";
}
