import { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  isProcessing: boolean;
}

export function FileUpload({ onFilesSelected, isProcessing }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter(
      file => file.name.match(/\.(xml|csv|json)$/i)
    );
    
    if (files.length > 0) {
      setSelectedFiles(files);
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(files);
    }
  }, []);

  const handleValidate = () => {
    if (selectedFiles.length > 0) {
      onFilesSelected(selectedFiles);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-12 text-center transition-all duration-200',
          isDragging
            ? 'border-primary bg-primary/5 scale-105'
            : 'border-border hover:border-primary/50',
          isProcessing && 'opacity-50 pointer-events-none'
        )}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept=".xml,.csv,.json"
          multiple
          onChange={handleFileInput}
          disabled={isProcessing}
        />
        
        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Upload className="w-8 h-8 text-primary" />
          </div>
          
          <div>
            <h3 className="text-xl font-semibold mb-2">Upload Invoice Files</h3>
            <p className="text-muted-foreground">
              Drag and drop your files here, or click to browse
            </p>
          </div>

          <Button asChild variant="outline" size="lg" disabled={isProcessing}>
            <label htmlFor="file-upload" className="cursor-pointer">
              Select Files
            </label>
          </Button>

          <p className="text-sm text-muted-foreground">
            Supported formats: XML, CSV, JSON
          </p>
        </div>
      </div>

      {selectedFiles.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="bg-card rounded-lg border p-4 shadow-card">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Selected Files ({selectedFiles.length})
            </h4>
            <ul className="space-y-2">
              {selectedFiles.map((file, index) => (
                <li key={index} className="text-sm flex items-center gap-2 text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {file.name}
                  <span className="text-xs">({(file.size / 1024).toFixed(1)} KB)</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-accent-foreground">Privacy Notice</p>
              <p className="text-muted-foreground mt-1">
                All validation is performed client-side in your browser. No data is sent to external servers.
              </p>
            </div>
          </div>

          <Button 
            onClick={handleValidate} 
            disabled={isProcessing}
            size="lg"
            className="w-full"
          >
            {isProcessing ? 'Processing...' : 'Validate & Fix'}
          </Button>
        </div>
      )}
    </div>
  );
}
