
"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full border",
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const generateColor = (name: string) => {
    let hash = 0;
    if (name.length === 0) return `hsl(0, 0%, 80%)`;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash; // Convert to 32bit integer
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 70%, 80%)`;
};

const getTextColor = (bgColor: string) => {
    // This is a simplified check. For the HSL values we're using, a dark text will always be more readable.
    return 'hsl(0, 0%, 10%)'; // Dark text for good contrast on pastel backgrounds
}

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, children, ...props }, ref) => {
    const name = typeof children === 'string' ? children : '';
    const backgroundColor = generateColor(name);
    const textColor = getTextColor(backgroundColor);

    return (
        <AvatarPrimitive.Fallback
            ref={ref}
            className={cn(
            "flex h-full w-full items-center justify-center rounded-full font-semibold",
            className
            )}
            style={{ backgroundColor, color: textColor }}
            {...props}
        >
            {name?.[0]?.toUpperCase()}
        </AvatarPrimitive.Fallback>
    )
})
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
