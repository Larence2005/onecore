
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export const TableIcon = React.forwardRef<
  SVGSVGElement,
  React.SVGProps<SVGSVGElement>
>(({ className, ...props }, ref) => (
    <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("lucide lucide-table", className)}
        {...props}
    >
        <path d="M12 3v18"/>
        <path d="M3 7.5h18"/>
        <path d="M3 12h18"/>
        <path d="M3 16.5h18"/>
        <path d="M21 3H3v18h18V3z"/>
    </svg>
));
TableIcon.displayName = "TableIcon";
