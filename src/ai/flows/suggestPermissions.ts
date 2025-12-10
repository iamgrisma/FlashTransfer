'use server';

import { ai } from '../genkit';
import * as z from 'zod';

const permissionSuggestionSchema = z.object({
  permission: z.enum(["View Only", "Download", "Editor"]).describe("The suggested permission level."),
  reason: z.string().describe("A brief, user-friendly justification for the suggested permission level."),
});

export const suggestPermissionsFlow = ai.defineFlow(
  {
    name: 'suggestPermissionsFlow',
    inputSchema: z.object({ fileName: z.string(), recipient: z.string() }),
    outputSchema: permissionSuggestionSchema,
  },
  async (input) => {

    const prompt = `You are an intelligent assistant for a file-sharing application called FileZen. Your task is to suggest the most appropriate permission level for sharing a file. The available permission levels are: "View Only", "Download", and "Editor".

Consider the context provided:
- File Name: "${input.fileName}"
- Recipient: "${input.recipient}"

Analyze the file name and recipient to infer the relationship and purpose of sharing.
For example:
- A design file ('design-mockup-v3.fig') shared with 'client@example.com' might suggest 'View Only'.
- A spreadsheet ('quarterly-report.xlsx') shared with 'finance-team@company.com' might suggest 'Editor'.
- A photo album ('vacation-photos.zip') shared with 'family@email.com' might suggest 'Download'.
- A legal document ('contract.pdf') shared with 'legal@partner.com' might warrant 'View Only' or 'Download' but rarely 'Editor'.

Provide a concise, one-sentence reason for your suggestion. The reason should be friendly and helpful to the user.

Respond with only the JSON object containing the suggested permission and the reason.`;

    const llmResponse = await ai.generate({
        prompt: prompt,
        output: {
          format: 'json',
          schema: permissionSuggestionSchema,
        },
        config: {
          temperature: 0.3,
        }
    });

    const result = llmResponse.output;
    if (!result) {
        throw new Error("AI failed to generate a suggestion.");
    }
    return result;
  },
);
