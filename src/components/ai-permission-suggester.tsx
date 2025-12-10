"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Download, Edit, Eye, Loader2, Sparkles } from 'lucide-react';
import { getPermissionSuggestion } from '@/app/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import type { Permission } from '@/lib/types';
import { Separator } from './ui/separator';

const formSchema = z.object({
  recipient: z.string().min(1, "Recipient is required.").email("Please enter a valid email."),
});

interface AIPermissionSuggesterProps {
    fileName: string;
}

export default function AIPermissionSuggester({ fileName }: AIPermissionSuggesterProps) {
  const [suggestion, setSuggestion] = useState<{ permission: Permission; reason: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState<Permission | "">("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      recipient: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setSuggestion(null);
    const result = await getPermissionSuggestion(fileName, values.recipient);
    if (result) {
        setSuggestion(result);
        setSelectedPermission(result.permission);
    }
    setIsLoading(false);
  }

  const permissionIcons: Record<Permission, React.ReactNode> = {
    "View Only": <Eye className="h-4 w-4 text-muted-foreground" />,
    "Download": <Download className="h-4 w-4 text-muted-foreground" />,
    "Editor": <Edit className="h-4 w-4 text-muted-foreground" />,
  };
  
  const permissions: Permission[] = ["View Only", "Download", "Editor"];

  return (
    <div className="space-y-4 rounded-lg border p-4 bg-secondary/30">
        <h3 className="font-medium text-foreground">Manage Access</h3>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
                control={form.control}
                name="recipient"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Recipient's Email</FormLabel>
                    <div className="flex space-x-2">
                        <FormControl>
                            <Input placeholder="e.g., colleague@example.com" {...field} />
                        </FormControl>
                        <Button type="submit" disabled={isLoading} variant="outline" className="shrink-0">
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Sparkles className="h-4 w-4 text-primary" />
                            )}
                            <span className="ml-2 hidden sm:inline">Suggest</span>
                        </Button>
                    </div>
                    <FormMessage />
                </FormItem>
                )}
            />
            </form>
        </Form>

        {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating suggestion...</span>
            </div>
        )}

        {suggestion && (
            <Alert className="bg-primary/5 border-primary/20 animate-in fade-in-0">
                <Sparkles className="h-4 w-4 text-primary" />
                <AlertTitle className="text-primary font-semibold">AI Suggestion</AlertTitle>
                <AlertDescription>
                    {suggestion.reason}
                </AlertDescription>
            </Alert>
        )}
        
        <RadioGroup 
            value={selectedPermission}
            onValueChange={(value: Permission) => setSelectedPermission(value)}
            className="space-y-1 pt-2"
        >
            <Label>Access Level</Label>
            {permissions.map((p) => (
                <Label 
                    key={p} 
                    htmlFor={p} 
                    className="flex items-center space-x-3 p-3 rounded-md border has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-colors cursor-pointer"
                >
                    <RadioGroupItem value={p} id={p} />
                    <div className="flex items-center gap-2 text-sm">
                        {permissionIcons[p]}
                        <span className="font-medium">{p}</span>
                    </div>
                </Label>
            ))}
        </RadioGroup>
    </div>
  );
}
