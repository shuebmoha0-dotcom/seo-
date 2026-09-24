import React from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Parses inline formatting: **bold**, *italic*, `code`, and [link](url)
 */
export function renderInlineFormatting(text: string): React.ReactNode {
  // Regex to split by bold, code, and links
  const tokenRegex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Bold: **text**
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={index} className="font-bold text-neutral-900">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Code: `code`
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 rounded-md bg-neutral-100 text-indigo-700 font-mono text-xs border border-neutral-200"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Link: [anchor](url)
    const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
    if (linkMatch) {
      const anchorText = linkMatch[1];
      const href = linkMatch[2];
      const isInternal = href.startsWith("/") || href.includes("seo-hazel-eight.vercel.app") || href.includes("seautopilot.io");

      if (isInternal) {
        return (
          <Link
            key={index}
            href={href}
            className="text-indigo-600 hover:text-indigo-800 font-semibold underline underline-offset-2 transition-colors"
          >
            {anchorText}
          </Link>
        );
      }

      return (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:text-indigo-800 font-semibold underline underline-offset-2 transition-colors inline-flex items-center gap-0.5"
        >
          <span>{anchorText}</span>
          <ExternalLink className="w-3 h-3 inline-block opacity-60" />
        </a>
      );
    }

    return part;
  });
}

/**
 * High-performance, clean Markdown article renderer supporting
 * Headings, Tables, Blockquotes, Lists, Code, and First-Class Images
 */
export function renderMarkdownArticle(content: string): React.ReactNode[] {
  if (!content) return [];

  // Normalize Windows CRLF and trailing spaces
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.trim().split("\n");
  const elements: React.ReactNode[] = [];

  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = (key: string) => {
    if (tableRows.length > 0) {
      const headers = tableRows[0];
      const rows = tableRows.slice(1).filter((r) => !r.every((c) => c.includes("---")));
      elements.push(
        <div key={key} className="overflow-x-auto my-8">
          <table className="w-full border-collapse border border-neutral-200 text-sm rounded-xl overflow-hidden shadow-2xs">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                {headers.map((h, i) => (
                  <th key={i} className="p-3.5 text-left font-bold text-neutral-900">
                    {h.trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="border-b border-neutral-100 hover:bg-neutral-50/50 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="p-3.5 text-neutral-700">
                      {renderInlineFormatting(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
    }
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    let rawLine = lines[i];
    let trimmed = rawLine.trim();

    if (!trimmed) {
      if (inTable) flushTable(`table-${i}`);
      continue;
    }

    // Skip redundant top-level H1 (already rendered prominently in the header)
    if (trimmed.startsWith("# ") && !trimmed.startsWith("## ")) {
      continue;
    }

    // Horizontal Rule
    if (trimmed === "---" || trimmed === "***") {
      if (inTable) flushTable(`table-${i}`);
      elements.push(<hr key={`hr-${i}`} className="my-8 border-neutral-200" />);
      continue;
    }

    // Table Row
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      inTable = true;
      const cols = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      tableRows.push(cols);
      continue;
    } else if (inTable) {
      flushTable(`table-${i}`);
    }

    // ── 1. IMAGE SUPPORT (Markdown ![Alt](url "Caption") & Split lines) ─────────
    // Handle split markdown images where ![Alt] is on one line and (url) is on the next line
    if (/^!\[(.*?)\]$/.test(trimmed) && i + 1 < lines.length && /^\((.*?)\)$/.test(lines[i + 1].trim())) {
      trimmed = `${trimmed}${lines[i + 1].trim()}`;
      i++; // advance line counter
    }

    const mdImageMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (mdImageMatch) {
      const altText = mdImageMatch[1].trim();
      const rawTarget = mdImageMatch[2].trim();

      // Check for optional caption in quotes: (url "Caption text")
      let imageUrl = rawTarget;
      let caption = "";
      const quoteMatch = rawTarget.match(/^(.*?)\s+["'](.*?)["']$/);
      if (quoteMatch) {
        imageUrl = quoteMatch[1].trim();
        caption = quoteMatch[2].trim();
      } else if (altText && !altText.toLowerCase().startsWith("image") && !altText.toLowerCase().startsWith("untitled")) {
        caption = altText;
      }

      elements.push(
        <figure key={`img-${i}`} className="my-8 rounded-2xl overflow-hidden border border-neutral-200/90 bg-neutral-50 shadow-xs">
          <div className="relative w-full overflow-hidden bg-neutral-100 flex items-center justify-center min-h-[220px]">
            <img
              src={imageUrl}
              alt={altText || "Article visual illustration"}
              loading="lazy"
              className="w-full h-auto max-h-[540px] object-cover rounded-t-xl hover:scale-[1.01] transition-transform duration-300"
            />
          </div>
          {caption && (
            <figcaption className="text-center text-xs text-neutral-500 py-3 px-4 font-medium italic border-t border-neutral-200/60 bg-white">
              {caption}
            </figcaption>
          )}
        </figure>
      );
      continue;
    }

    // Handle HTML <img> tag
    if (/<img\s+[^>]*src=["']([^"']+)["'][^>]*\/?>/i.test(trimmed)) {
      const srcMatch = trimmed.match(/src=["']([^"']+)["']/i);
      const altMatch = trimmed.match(/alt=["']([^"']*)["']/i);
      if (srcMatch) {
        const imageUrl = srcMatch[1];
        const altText = altMatch ? altMatch[1] : "Article visual graphic";
        elements.push(
          <figure key={`html-img-${i}`} className="my-8 rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-50 shadow-xs">
            <img
              src={imageUrl}
              alt={altText}
              loading="lazy"
              className="w-full h-auto max-h-[540px] object-cover rounded-xl"
            />
            {altText && (
              <figcaption className="text-center text-xs text-neutral-500 py-2.5 px-4 font-medium italic border-t border-neutral-100 bg-white">
                {altText}
              </figcaption>
            )}
          </figure>
        );
        continue;
      }
    }

    // ── 2. HEADINGS ─────────────────────────────────────────────────────────────
    if (trimmed.startsWith("## ")) {
      elements.push(
        <h2 key={`h2-${i}`} className="text-2xl md:text-3xl font-extrabold text-neutral-900 mt-12 mb-4 tracking-tight">
          {trimmed.replace("## ", "")}
        </h2>
      );
      continue;
    }

    if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={`h3-${i}`} className="text-lg md:text-xl font-bold text-neutral-900 mt-8 mb-3 tracking-tight">
          {trimmed.replace("### ", "")}
        </h3>
      );
      continue;
    }

    if (trimmed.startsWith("#### ")) {
      elements.push(
        <h4 key={`h4-${i}`} className="text-base font-bold text-neutral-900 mt-6 mb-2 tracking-tight">
          {trimmed.replace("#### ", "")}
        </h4>
      );
      continue;
    }

    // ── 3. BLOCKQUOTE ───────────────────────────────────────────────────────────
    if (trimmed.startsWith("> ")) {
      elements.push(
        <blockquote key={`quote-${i}`} className="border-l-4 border-indigo-600 bg-indigo-50/60 pl-4 py-3.5 pr-4 rounded-r-xl my-6 text-sm text-neutral-800 leading-relaxed font-medium">
          {renderInlineFormatting(trimmed.replace("> ", ""))}
        </blockquote>
      );
      continue;
    }

    // ── 4. LISTS ────────────────────────────────────────────────────────────────
    // Unordered List
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const text = trimmed.slice(2);
      elements.push(
        <div key={`ul-${i}`} className="flex items-start gap-2.5 my-2.5 pl-2 text-sm md:text-base text-neutral-700 leading-relaxed">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-2.5 shrink-0" />
          <span>{renderInlineFormatting(text)}</span>
        </div>
      );
      continue;
    }

    // Ordered List
    if (/^\d+\.\s/.test(trimmed)) {
      const numMatch = trimmed.match(/^(\d+)\.\s(.*)$/);
      if (numMatch) {
        elements.push(
          <div key={`ol-${i}`} className="flex items-start gap-3 my-2.5 pl-2 text-sm md:text-base text-neutral-700 leading-relaxed">
            <span className="font-bold text-indigo-600 text-sm shrink-0 min-w-[20px]">{numMatch[1]}.</span>
            <span>{renderInlineFormatting(numMatch[2])}</span>
          </div>
        );
        continue;
      }
    }

    // ── 5. STANDARD PARAGRAPHS ──────────────────────────────────────────────────
    elements.push(
      <p key={`p-${i}`} className="text-base text-neutral-700 leading-relaxed my-4">
        {renderInlineFormatting(trimmed)}
      </p>
    );
  }

  if (inTable) flushTable("table-end");

  return elements;
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  return (
    <div className={`prose prose-neutral max-w-none ${className}`}>
      {renderMarkdownArticle(content)}
    </div>
  );
}
