import { Redirect } from "expo-router";

// The OAuth code is exchanged in AuthProvider via openAuthSessionAsync; this route only absorbs the deep link.
export default function AuthCallback() {
  return <Redirect href="/" />;
}
