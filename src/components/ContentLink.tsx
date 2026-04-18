import { FileText, Image } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface ContentLinkProps {
  href: string;
  children: React.ReactNode;
  linkType?: 'image' | 'pdf';
  className?: string;
  ariaLabel?: string;
}

/**
 * ContentLink - A styled hyperlink component for linking landing page text
 * to Supabase-hosted images and PDFs.
 *
 * Features:
 * - Opens in new tab with security attributes
 * - Visual indicator icon (image or PDF icon)
 * - Glowing underline effect matching site accent colors
 * - Accessible with aria-label
 */
export function ContentLink({
  href,
  children,
  linkType = 'pdf',
  className,
  ariaLabel,
}: ContentLinkProps) {
  const isImage = linkType === 'image';

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel || `Open ${linkType} in new tab`}
      className={cn(
        // Base styles
        'inline-flex items-center gap-1 font-semibold cursor-pointer',
        'transition-all duration-200 ease-out',
        // Color scheme - purple (#9a02d0) for PDFs, green (#44f80c) for images
        isImage
          ? 'text-[#44f80c] hover:text-[#6bff3c]'
          : 'text-[#9a02d0] hover:text-[#b71de8]',
        // Underline effect - animated on hover
        'border-b border-dashed',
        isImage
          ? 'border-[#44f80c]/40 hover:border-[#44f80c]'
          : 'border-[#9a02d0]/40 hover:border-[#9a02d0]',
        // Glow on hover
        isImage
          ? 'hover:drop-shadow-[0_0_6px_rgba(68,248,12,0.5)]'
          : 'hover:drop-shadow-[0_0_6px_rgba(154,2,208,0.5)]',
        className
      )}
    >
      {children}
      {/* Link type indicator icon */}
      {isImage ? (
        <Image
          className="inline-block opacity-60 group-hover:opacity-100 transition-opacity"
          weight="fill"
          size={14}
        />
      ) : (
        <FileText
          className="inline-block opacity-60 group-hover:opacity-100 transition-opacity"
          weight="fill"
          size={14}
        />
      )}
    </a>
  );
}

export default ContentLink;
