"use client";

import * as React from "react";
import { Check, Copy, Terminal } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useConfig } from "@/hooks/use-config";
import { cn } from "@/lib/utils";

interface CodeBlockCommandProps {
  item: string;
  className?: string;
}

export function CodeBlockCommand({ item, className }: CodeBlockCommandProps) {
  const [config, setConfig] = useConfig();
  const { isCopied, copyToClipboard } = useCopyToClipboard();

  const commands = React.useMemo(() => {
    return {
      pnpm: `pnpm add ${item}`,
      npm: `npm install ${item}`,
      yarn: `yarn add ${item}`,
      bun: `bun add ${item}`,
    };
  }, [item]);

  const copyCommand = React.useCallback(() => {
    const command = commands[config.packageManager as keyof typeof commands];
    if (command) copyToClipboard(command);
  }, [config.packageManager, commands, copyToClipboard]);

  return (
    <div className={cn("relative overflow-hidden rounded-md border bg-muted/30", className)}>
      <Tabs
        value={config.packageManager}
        onValueChange={(value) => setConfig({ ...config, packageManager: value as "pnpm" | "npm" | "yarn" | "bun" })}
        className="gap-0"
      >
        <div className="relative flex items-center gap-2 border-b px-4 py-2.5 bg-background/50">
          <Terminal className="size-3.5 text-muted-foreground" strokeWidth={2} />
          <TabsList className="h-auto bg-transparent p-0" translate="no">
            {["pnpm", "npm", "yarn", "bun"].map((pm) => (
              <TabsTrigger
                key={pm}
                value={pm}
                className="h-auto rounded-sm px-2 py-1 text-xs font-mono data-[state=active]:bg-background data-[state=active]:border data-[state=active]:border-border"
              >
                {pm}
              </TabsTrigger>
            ))}
          </TabsList>
          <Button
            size="icon"
            variant="ghost"
            className="absolute right-2 size-7 opacity-70 hover:bg-transparent cursor-pointer"
            onClick={copyCommand}
          >
            <span className="sr-only">Copy</span>
            {isCopied
              ? <Check className="size-3.5 text-emerald-600" strokeWidth={2} />
              : <Copy className="size-3.5" strokeWidth={2} />}
          </Button>
        </div>
        <div className="bg-background">
          {Object.entries(commands).map(([key, command]) => (
            <TabsContent key={key} value={key} className="m-0">
              <pre className="px-4 py-3 overflow-x-auto dark:bg-[#0F0F0F] not-prose">
                <code className="font-mono text-sm text-[#032F62] dark:text-[#9ECBFF]">{command}</code>
              </pre>
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}