"use server";

import { suggestPermissionsFlow } from "@/ai/flows/suggestPermissions";
import type { Permission } from "@/lib/types";


export async function getPermissionSuggestion(
  fileName: string,
  recipient: string
): Promise<{ permission: Permission; reason:string } | null> {
  try {
    const result = await suggestPermissionsFlow({ fileName, recipient });
    // Basic validation of the AI output
    if (result && result.permission && result.reason) {
        if (["View Only", "Download", "Editor"].includes(result.permission)) {
            return result as { permission: Permission; reason: string };
        }
    }
    console.warn("AI output validation failed.", result);
    return null;
  } catch (error) {
    console.error("Error invoking AI flow:", error);
    // In a real app, you'd want more robust error handling and logging.
    return null;
  }
}
