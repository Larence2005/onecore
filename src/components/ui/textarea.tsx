
import * as React from 'react';

import {cn} from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({className, ...props}, ref) => {
    return (
      <textarea
        className={cn(
          'flex w-full rounded-none border-0 border-b border-input bg-transparent px-1 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export {Textarea};
