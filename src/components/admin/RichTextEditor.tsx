import React, { useEffect, useRef, useState } from 'react';
import { Bold, Italic, Underline, Heading2, Heading3, Pilcrow, List, ListOrdered, Quote, Link2, Image as ImageIcon, Minus, Undo2, Redo2, Code2, Eraser } from 'lucide-react';
import { sanitizeHtml } from '../../utils/html';

/**
 * Lightweight rich-text editor for blog posts (no extra dependencies).
 * Content is sanitised on paste, on source edits and again when the post is saved/rendered.
 */
export const RichTextEditor: React.FC<{ value: string; onChange: (html: string) => void; minHeight?: number }> = ({ value, onChange, minHeight = 360 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState(false);
  const lastEmitted = useRef<string>('');

  // Load external value (e.g. when opening another post) without fighting the caret while typing
  useEffect(() => {
    if (!ref.current || source) return;
    if (value !== lastEmitted.current) {
      ref.current.innerHTML = sanitizeHtml(value || '');
      lastEmitted.current = value;
    }
  }, [value, source]);

  const emit = () => {
    if (!ref.current) return;
    const html = ref.current.innerHTML;
    lastEmitted.current = html;
    onChange(html);
  };

  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
  };

  const addLink = () => {
    const url = window.prompt('Link address (https://… or a site path like /courses)');
    if (!url) return;
    if (!/^(https?:\/\/|\/(?!\/)|mailto:)/i.test(url.trim())) return window.alert('Use an https:// link, a path starting with /, or mailto:');
    exec('createLink', url.trim());
  };

  const addImage = () => {
    const url = window.prompt('Image address (https://…)');
    if (!url) return;
    if (!/^https:\/\/\S+$/i.test(url.trim())) return window.alert('Images must use an https:// address.');
    exec('insertImage', url.trim());
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    e.preventDefault();
    if (html) document.execCommand('insertHTML', false, sanitizeHtml(html));
    else document.execCommand('insertText', false, text);
    emit();
  };

  const Btn: React.FC<{ title: string; onClick: () => void; children: React.ReactNode }> = ({ title, onClick, children }) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()} // keep the text selection
      onClick={onClick}
      disabled={source}
      className="w-9 h-9 rounded-lg hover:bg-[#E8EFFB] text-[#334155] flex items-center justify-center disabled:opacity-30"
    >
      {children}
    </button>
  );

  return (
    <div className="border border-[#E2E8F0] rounded-2xl overflow-hidden bg-white">
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-[#EEF2F7] bg-[#F7F9FC]" role="toolbar" aria-label="Formatting">
        <Btn title="Paragraph" onClick={() => exec('formatBlock', 'P')}><Pilcrow className="w-4 h-4" /></Btn>
        <Btn title="Heading" onClick={() => exec('formatBlock', 'H2')}><Heading2 className="w-4 h-4" /></Btn>
        <Btn title="Sub-heading" onClick={() => exec('formatBlock', 'H3')}><Heading3 className="w-4 h-4" /></Btn>
        <span className="w-px h-6 bg-[#E2E8F0] mx-1" />
        <Btn title="Bold" onClick={() => exec('bold')}><Bold className="w-4 h-4" /></Btn>
        <Btn title="Italic" onClick={() => exec('italic')}><Italic className="w-4 h-4" /></Btn>
        <Btn title="Underline" onClick={() => exec('underline')}><Underline className="w-4 h-4" /></Btn>
        <span className="w-px h-6 bg-[#E2E8F0] mx-1" />
        <Btn title="Bulleted list" onClick={() => exec('insertUnorderedList')}><List className="w-4 h-4" /></Btn>
        <Btn title="Numbered list" onClick={() => exec('insertOrderedList')}><ListOrdered className="w-4 h-4" /></Btn>
        <Btn title="Quote" onClick={() => exec('formatBlock', 'BLOCKQUOTE')}><Quote className="w-4 h-4" /></Btn>
        <Btn title="Divider" onClick={() => exec('insertHorizontalRule')}><Minus className="w-4 h-4" /></Btn>
        <span className="w-px h-6 bg-[#E2E8F0] mx-1" />
        <Btn title="Link" onClick={addLink}><Link2 className="w-4 h-4" /></Btn>
        <Btn title="Image" onClick={addImage}><ImageIcon className="w-4 h-4" /></Btn>
        <Btn title="Clear formatting" onClick={() => exec('removeFormat')}><Eraser className="w-4 h-4" /></Btn>
        <span className="w-px h-6 bg-[#E2E8F0] mx-1" />
        <Btn title="Undo" onClick={() => exec('undo')}><Undo2 className="w-4 h-4" /></Btn>
        <Btn title="Redo" onClick={() => exec('redo')}><Redo2 className="w-4 h-4" /></Btn>
        <button
          type="button"
          onClick={() => {
            if (source) {
              // leaving source mode: clean whatever was typed
              const clean = sanitizeHtml(value);
              lastEmitted.current = '';
              onChange(clean);
            }
            setSource(!source);
          }}
          className={`ml-auto h-9 px-3 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 ${source ? 'bg-[#111827] text-white' : 'hover:bg-[#E8EFFB] text-[#334155]'}`}
        >
          <Code2 className="w-4 h-4" /> HTML
        </button>
      </div>
      {source ? (
        <textarea
          className="w-full p-4 font-mono text-[13px] text-[#111827] focus:outline-none"
          style={{ minHeight }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="HTML source"
        />
      ) : (
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          onPaste={onPaste}
          className="ed-article p-5 focus:outline-none"
          style={{ minHeight }}
          role="textbox"
          aria-multiline="true"
          aria-label="Post content"
        />
      )}
    </div>
  );
};
