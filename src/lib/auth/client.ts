import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "./index";

// サーバー側の additionalFields（肩書き title）を、クライアントの型にも反映する
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});
