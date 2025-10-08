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
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = hash % 360;
    return `hsl(${h}, 50%, 85%)`;
};

const getTextColor = (bgColor: string) => {
    // A simple heuristic to determine if the background is light or dark
    // This could be improved, but for HSL with high lightness, dark text is better.
    const hslValues = bgColor.match(/\d+/g);
    if (hslValues) {
        const lightness = parseInt(hslValues[2], 10);
        return lightness > 60 ? 'hsl(0, 0%, 10%)' : 'hsl(0, 0%, 98%)';
    }
    return 'hsl(0, 0%, 10%)'; // default to dark text
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
