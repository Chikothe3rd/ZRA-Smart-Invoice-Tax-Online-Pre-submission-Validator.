import React, { useEffect, useRef, useState } from 'react';

export default function JsonDiff({ original, fixed }: { original: unknown; fixed: unknown }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hasLibrary, setHasLibrary] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    async function ensureLib() {
      try {
        const mod = await import('jsondiffpatch');
        if (!mounted) return;
        const modTyped = mod as unknown;
        type JsonDiffPatchLib = {
          diff: (a: unknown, b: unknown) => unknown;
          formatters: { html: { format: (delta: unknown, obj: unknown) => string } };
        };
        const jsondiffpatch = ((modTyped as { default?: unknown }).default ?? modTyped) as unknown as JsonDiffPatchLib;
        setHasLibrary(true);
        if (!containerRef.current) return;
        const delta = jsondiffpatch.diff(original || {}, fixed || {});
        const html = jsondiffpatch.formatters.html.format(delta, original || {});
        containerRef.current.innerHTML = html;
      } catch (e) {
        if (!mounted) return;
        setHasLibrary(false);
      }
    }

    ensureLib();
    return () => { mounted = false; };
  }, [original, fixed]);

  if (hasLibrary === false) {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-medium mb-2">Original</h4>
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(original, null, 2)}</pre>
        </div>
        <div>
          <h4 className="text-sm font-medium mb-2">Corrected</h4>
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(fixed, null, 2)}</pre>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="jsondiffpatch-root" />;
}
