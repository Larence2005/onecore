
"use client";

import { cn } from "@/lib/utils";
import React from 'react';

export const PropertyItem = ({ icon: Icon, label, value, isLink, children }: { icon: React.ElementType, label: string, value?: string | undefined | number, isLink?: boolean, children?: React.ReactNode }) => (
    <div>
        <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {label}
        </dt>
        <dd className="mt-1 text-sm text-foreground break-all">
            {children ? (
                children
            ) : isLink && typeof value === 'string' ? 
                <a href={value} target="_blank" rel="noopener noreferrer" className="underline">{value}</a> :
                (value || 'N/A')
            }
        </dd>
    </div>
);
PropertyItem.displayName = "PropertyItem";
