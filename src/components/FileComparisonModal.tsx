import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import clsx from 'clsx';
import JsonDiff from './JsonDiff';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
// We'll dynamically import optional libs when needed. Keep types conservative.
// Minimal runtime types for optional libraries
type Html2CanvasRunner = (el: HTMLElement, opts?: Record<string, unknown>) => Promise<HTMLCanvasElement>;
type Html2CanvasModule = Html2CanvasRunner | { default: Html2CanvasRunner };

interface JsPDFInstance {
  getImageProperties(dataUrl: string): { width: number; height: number };
  internal: { pageSize: { getWidth(): number } };
  addImage(dataUrl: string, format: string, x: number, y: number, w: number, h: number): void;
  save(filename: string): void;
}
type JsPDFConstructor = new (orientation?: string, unit?: string, format?: string | number[]) => JsPDFInstance;
type JsPDFModule = { jsPDF?: JsPDFConstructor; default?: JsPDFConstructor } | JsPDFConstructor;

let html2canvas: Html2CanvasModule | null = null;
let jsPDF: JsPDFModule | null = null;

interface FileComparisonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  originalData: unknown;
  fixedData: unknown;
}

export function FileComparisonModal({
  open,
  onOpenChange,
  fileName,
  originalData,
  fixedData,
}: FileComparisonModalProps) {

  // Compute a flat set of keys present in either object (shallow keys only)
  function getChangedKeys(a: unknown, b: unknown): string[] {
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return [];
    const keys = new Set<string>([...Object.keys(a as Record<string, unknown>), ...Object.keys(b as Record<string, unknown>)]);
    const changed: string[] = [];
    keys.forEach(k => {
      try {
        const va = JSON.stringify((a as Record<string, unknown>)[k]);
        const vb = JSON.stringify((b as Record<string, unknown>)[k]);
        if (va !== vb) changed.push(k);
      } catch (e) {
        if ((a as Record<string, unknown>)[k] !== (b as Record<string, unknown>)[k]) changed.push(k);
      }
    });
    return changed.sort();
  }

  const changedKeys = getChangedKeys(originalData, fixedData);
  // Helper to convert JSON to a simple XML string (basic, matches fileProcessing.jsonToXML)
  function jsonToXML(obj: unknown, rootName = 'Invoice'): string {
    function buildXML(data: unknown, nodeName: string): string {
      if (data === null || data === undefined) return `<${nodeName}/>`;
      if (typeof data !== 'object') {
        return `<${nodeName}>${String(data)}</${nodeName}>`;
      }
      if (Array.isArray(data)) {
        return (data as unknown[]).map(item => buildXML(item, nodeName)).join('\n');
      }
      let xml = `<${nodeName}>`;
      for (const key in data as Record<string, unknown>) {
        if (key === '@attributes') continue;
        xml += '\n  ' + buildXML((data as Record<string, unknown>)[key], key);
      }
      xml += `\n</${nodeName}>`;
      return xml;
    }
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + buildXML(obj, rootName);
  }

  function downloadFixedAs(format: 'json' | 'csv' | 'xml') {
    try {
      let content: string;
      let mime = 'application/octet-stream';
      if (format === 'json') {
        content = JSON.stringify(fixedData, null, 2);
        mime = 'application/json';
      } else if (format === 'csv') {
        const arr = Array.isArray(fixedData) ? fixedData : [fixedData];
        content = Papa.unparse(arr);
        mime = 'text/csv';
      } else {
        content = jsonToXML(fixedData);
        mime = 'application/xml';
      }

      const blob = new Blob([content], { type: mime + ';charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const base = fileName.replace(/\.(xml|csv|json)$/i, '');
      a.download = `${base}_corrected.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed', e);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 w-full">
            <div>
              <DialogTitle className="text-lg md:text-xl">File Comparison — {fileName}</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Compare the original file with the ZRA-compliant corrected version. Use the Diff tab for a side-by-side visual comparison.
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => downloadFixedAs('json')}>
                <Download className="mr-2 h-4 w-4" /> JSON
              </Button>
              <Button size="sm" variant="outline" onClick={() => downloadFixedAs('csv')}>
                <Download className="mr-2 h-4 w-4" /> CSV
              </Button>
              <Button size="sm" variant="ghost" onClick={() => downloadFixedAs('xml')}>
                <Download className="mr-2 h-4 w-4" /> XML
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  try {
                    // Dynamically import optional libraries only when user requests PDF export
                    try {
                      const htmlModule = await import('html2canvas');
                      const pdfModule = await import('jspdf');
                      // Assign to typed shapes without using `any` casts
                      html2canvas = (htmlModule as unknown) as Html2CanvasModule;
                      jsPDF = (pdfModule as unknown) as JsPDFModule;
                    } catch (impErr) {
                      // Optional libs not installed — fallback to JSON download
                      return downloadFixedAs('json');
                    }

                    const el = document.querySelector('.jsondiffpatch-root') || document.querySelector('.dialog-content');
                    if (!el) return downloadFixedAs('json');

                    // html2canvas has signature (element, options) => Promise<HTMLCanvasElement>
                    const html2canvasRunner = (html2canvas as Html2CanvasModule) as Html2CanvasRunner;
                    const canvas = await html2canvasRunner(el as HTMLElement, { scale: 2 });
                    const imgData = canvas.toDataURL('image/png');

                    // jsPDF may export constructor directly or under .jsPDF
                    // Narrow jsPDF to either module-with-jsPDF or constructor
                    let PdfCtor: JsPDFConstructor | undefined;
                    if (jsPDF && typeof jsPDF === 'function') {
                      PdfCtor = jsPDF as JsPDFConstructor;
                    } else if (jsPDF && typeof jsPDF === 'object' && 'jsPDF' in jsPDF) {
                      const mod = jsPDF as { [k: string]: unknown };
                      if (typeof mod['jsPDF'] === 'function') {
                        PdfCtor = mod['jsPDF'] as unknown as JsPDFConstructor;
                      }
                    }

                    if (!PdfCtor) return downloadFixedAs('json');

                    const pdf = new PdfCtor('p', 'mm', 'a4');
                    const imgProps = pdf.getImageProperties(imgData as string);
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                    pdf.save(fileName.replace(/\.(xml|csv|json)$/i, '') + '_corrected.pdf');
                  } catch (e) {
                    console.error('PDF export failed', e);
                    downloadFixedAs('json');
                  }
                }}
              >
                <Download className="mr-2 h-4 w-4" /> PDF
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="original" className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="original">Original</TabsTrigger>
            <TabsTrigger value="fixed">Corrected</TabsTrigger>
            <TabsTrigger value="diff">Diff</TabsTrigger>
          </TabsList>

          <TabsContent value="original" className="mt-4">
            <ScrollArea className="h-[520px] w-full rounded-md border p-4 bg-slate-50">
              <pre className="text-sm font-mono leading-relaxed">
                {JSON.stringify(originalData, null, 2)}
              </pre>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="fixed" className="mt-4">
            <ScrollArea className="h-[520px] w-full rounded-md border p-4 bg-slate-50">
              <pre className="text-sm font-mono leading-relaxed">
                {JSON.stringify(fixedData, null, 2)}
              </pre>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="diff" className="mt-4">
            <ScrollArea className="h-[520px] w-full rounded-md border p-4 bg-white">
              <JsonDiff original={originalData} fixed={fixedData} />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
