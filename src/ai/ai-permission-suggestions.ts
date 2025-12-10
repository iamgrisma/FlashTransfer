// This is an AI-powered tool that suggests the best permission level for sharing a file.
// It takes the file type and use case as input, and returns a suggestion for the permission level.

'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PermissionSuggestionInputSchema = z.object({
  fileType: z.string().describe('The type of the file being shared (e.g., document, image, spreadsheet).'),
  useCase: z.string().describe('The intended use case for sharing the file (e.g., review, collaboration, distribution).'),
});
export type PermissionSuggestionInput = z.infer<typeof PermissionSuggestionInputSchema>;

const PermissionSuggestionOutputSchema = z.object({
  suggestedPermission: z.enum(['View Only', 'Download', 'Editor']).describe('The AI-suggested permission level for sharing.'),
  reasoning: z.string().describe('The AI explanation for the suggested permission level.'),
});
export type PermissionSuggestionOutput = z.infer<typeof PermissionSuggestionOutputSchema>;

export async function suggestPermission(input: PermissionSuggestionInput): Promise<PermissionSuggestionOutput> {
  return permissionSuggestionFlow(input);
}

const permissionSuggestionPrompt = ai.definePrompt({
  name: 'permissionSuggestionPrompt',
  input: {schema: PermissionSuggestionInputSchema},
  output: {schema: PermissionSuggestionOutputSchema},
  prompt: `You are an AI assistant that suggests the most appropriate permission level for sharing a file, based on the file type and use case.

  File Type: {{{fileType}}}
  Use Case: {{{useCase}}}

  Consider the following permission levels:
  - View Only: The recipient can only view the file.
  - Download: The recipient can download the file.
  - Editor: The recipient can edit the file.

  Based on the file type and use case, suggest the most appropriate permission level and explain your reasoning. Make sure to pick only from the permission levels above.
  Do not include any introductory or concluding statements. Only provide the JSON output.`,
});

const permissionSuggestionFlow = ai.defineFlow(
  {
    name: 'permissionSuggestionFlow',
    inputSchema: PermissionSuggestionInputSchema,
    outputSchema: PermissionSuggestionOutputSchema,
  },
  async input => {
    const {output} = await permissionSuggestionPrompt(input);
    return output!;
  }
);
