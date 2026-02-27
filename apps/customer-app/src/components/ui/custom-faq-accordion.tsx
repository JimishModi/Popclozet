'use client';

import * as React from 'react';
import { HelpCircle, MessageCircle, ChevronDown } from 'lucide-react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { cn } from '@/lib/utils';

const CustomAccordion = AccordionPrimitive.Root;

const CustomAccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn('', className)}
    {...props}
  />
));
CustomAccordionItem.displayName = 'CustomAccordionItem';

const CustomAccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        'group flex flex-1 items-center justify-between gap-4 rounded-2xl p-4 text-left',
        'bg-white dark:bg-[#282828] dark:text-[#FAFAFA] transition-all hover:bg-white/80 hover:shadow-md',
        'dark:hover:bg-[#282828]/80 focus-visible:outline-none focus-visible:ring-2',
        'dark:data-[state=open]:bg-[#282828] data-[state=open]:shadow-md',
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-4">
        <HelpCircle className="h-5 w-5 text-black/60 dark:text-[#FAFAFA]/60" />
        <span className="text-lg font-medium dark:text-[#FAFAFA] text-black tracking-wide">
          {children}
        </span>
      </div>
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-black/5 dark:bg-[#FAFAFA]/10 transition-transform group-hover:scale-105 group-data-[state=open]:rotate-180">
        <ChevronDown className="h-4 w-4 text-black dark:text-[#FAFAFA]" />
      </div>
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
CustomAccordionTrigger.displayName = 'CustomAccordionTrigger';

const CustomAccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className={cn(
      'overflow-hidden dark:text-[#FAFAFA]',
      'data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down pb-2',
      className
    )}
    {...props}
  >
    <div className="mt-4 ml-14">
      <div className="flex items-start gap-4 rounded-2xl bg-white dark:bg-[#282828] p-4 shadow-sm transition-all">
        <span className="flex-1 text-md leading-relaxed text-black/60 dark:text-[#FAFAFA]/60">{children}</span>
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-black/5 dark:bg-[#FAFAFA]/10 transition-transform hover:scale-105">
          <MessageCircle className="h-5 w-5 text-black dark:text-[#FAFAFA]" />
        </div>
      </div>
    </div>
  </AccordionPrimitive.Content>
));
CustomAccordionContent.displayName = 'CustomAccordionContent';

export {
  CustomAccordion,
  CustomAccordionItem,
  CustomAccordionTrigger,
  CustomAccordionContent,
};
