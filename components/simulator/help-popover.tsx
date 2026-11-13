'use client';

import { createContext, useContext, useState, type Dispatch, type SetStateAction } from 'react';
import { CircleHelp } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';

const HelpPopoverContext = createContext<{
  openId: string | null;
  setOpenId: Dispatch<SetStateAction<string | null>>;
} | null>(null);

export function HelpPopoverProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <HelpPopoverContext.Provider value={{ openId, setOpenId }}>
      {children}
    </HelpPopoverContext.Provider>
  );
}

export function HelpPopover({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  const context = useContext(HelpPopoverContext);
  if (!context) {
    throw new Error('HelpPopover must be used within HelpPopoverProvider');
  }

  const open = context.openId === id;

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        context.setOpenId((current) =>
          nextOpen ? id : current === id ? null : current,
        );
      }}
    >
      <PopoverTrigger
        type="button"
        aria-label={`Help: ${title}`}
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-[var(--accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-strong)]"
      >
        <CircleHelp className="size-3.5" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="w-56 gap-1.5 rounded-md p-2.5 text-xs leading-relaxed">
        <PopoverHeader>
          <PopoverTitle className="text-xs">{title}</PopoverTitle>
          <PopoverDescription className="text-xs leading-relaxed">
            {description}
          </PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  );
}
