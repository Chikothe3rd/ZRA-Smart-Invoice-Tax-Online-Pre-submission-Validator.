import { useState } from 'react';
import { Download, FileJson, FileText, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface DownloadOptionsProps {
  onDownload: (format: 'original' | 'xml' | 'csv' | 'json') => void;
}

export function DownloadOptions({ onDownload }: DownloadOptionsProps) {
  // Use the shared DownloadFormat type for clarity
  // (imported via the project's path aliases)
  type DownloadFormat = 'original' | 'xml' | 'csv' | 'json';
  const [selectedFormat, setSelectedFormat] = useState<DownloadFormat>('original');
  const [open, setOpen] = useState(false);

  const handleDownload = () => {
    onDownload(selectedFormat);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2">
          <Download className="w-4 h-4" />
          Download Corrected Files
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Download Format</DialogTitle>
          <DialogDescription>
            Select the file format for your corrected ZRA-compliant files
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <RadioGroup value={selectedFormat} onValueChange={(value: DownloadFormat) => setSelectedFormat(value)}>
            <div className="space-y-3">
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted cursor-pointer">
                <RadioGroupItem value="original" id="original" />
                <Label htmlFor="original" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold">Original Format</div>
                      <div className="text-xs text-muted-foreground">
                        Keep the same format as uploaded files
                      </div>
                    </div>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted cursor-pointer">
                <RadioGroupItem value="xml" id="xml" />
                <Label htmlFor="xml" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold">XML Format</div>
                      <div className="text-xs text-muted-foreground">
                        Structured XML with nested elements
                      </div>
                    </div>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted cursor-pointer">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-success/10 rounded">
                      <FileSpreadsheet className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <div className="font-semibold">CSV Format</div>
                      <div className="text-xs text-muted-foreground">
                        Spreadsheet-compatible comma-separated
                      </div>
                    </div>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted cursor-pointer">
                <RadioGroupItem value="json" id="json" />
                <Label htmlFor="json" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent/10 rounded">
                      <FileJson className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <div className="font-semibold">JSON Format</div>
                      <div className="text-xs text-muted-foreground">
                        JavaScript Object Notation format
                      </div>
                    </div>
                  </div>
                </Label>
              </div>
            </div>
          </RadioGroup>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleDownload} className="flex-1">
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
