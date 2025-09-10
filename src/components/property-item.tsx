
"use client";

import { cn } from "@/lib/utils";
import React from 'react';

export const PropertyItem = ({ icon: Icon, label, value, isLink }: { icon: React.ElementType, label: string, value: string | undefined | number, isLink?: boolean }) => (
    <div>
        <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {label}
        </dt>
        {isLink && typeof value === 'string' ? 
            <dd className="mt-1 text-sm text-foreground break-all"><a href={value} target="_blank" rel="noopener noreferrer" className="underline">{value}</a></dd> :
            <dd className="mt-1 text-sm text-foreground break-all">{value || 'N/A'}</dd>
        }
    </div>
);
PropertyItem.displayName = "PropertyItem";
