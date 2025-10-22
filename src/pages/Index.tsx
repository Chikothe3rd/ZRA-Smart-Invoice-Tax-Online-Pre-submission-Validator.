import { useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
import ValidationResults from '@/components/ValidationResults';
import { ValidationHistory } from '@/components/ValidationHistory';
import { processFile, generateDownloadZip, ProcessedFile } from '@/lib/fileProcessing';
import { useValidationHistory } from '@/hooks/useValidationHistory';
import { getValidationStats } from '@/lib/validation';
import { toast } from 'sonner';
import { FileCheck, Shield } from 'lucide-react';

const Index = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const { history, addToHistory, clearHistory, removeItem } = useValidationHistory();

  const handleFilesSelected = async (files: File[]) => {
    setIsProcessing(true);
    
    try {
      const results = await Promise.all(
        files.map(file => processFile(file))
      );
      
      setProcessedFiles(results);
      
      const totalIssues = results.reduce((sum, r) => sum + r.result.issues.length, 0);
      const autoFixed = results.reduce(
        (sum, r) => sum + r.result.issues.filter(i => i.autoFixed).length,
        0
      );

      // Add to history
      results.forEach((result) => {
        const stats = getValidationStats(result.result);
        addToHistory({
          fileName: result.name,
          fileType: result.type,
          stats,
          issues: result.result.issues,
        });
      });
      
      toast.success('Validation Complete', {
        description: `Found ${totalIssues} issues, ${autoFixed} automatically fixed`,
      });
    } catch (error) {
      toast.error('Processing Error', {
        description: error instanceof Error ? error.message : 'Failed to process files',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async (format: 'original' | 'xml' | 'csv' | 'json' = 'original') => {
    try {
      const zipBlob = await generateDownloadZip(processedFiles, format);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ZRA_Validated_Files_${format.toUpperCase()}_${new Date().getTime()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Download Started', {
        description: `Corrected files in ${format.toUpperCase()} format are being downloaded`,
      });
    } catch (error) {
      toast.error('Download Error', {
        description: 'Failed to generate download package',
      });
    }
  };

  const handleReset = () => {
    setProcessedFiles([]);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="relative overflow-hidden bg-gradient-hero text-primary-foreground">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiLz48L2c+PC9zdmc+')] opacity-20" />
        
        <div className="relative container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 text-sm">
              <Shield className="w-4 h-4" />
              Client-side validation · Privacy first
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              ZRA Tax Validation Tool
            </h1>
            
            <p className="text-lg md:text-xl text-primary-foreground/90 max-w-2xl mx-auto">
              Smart invoice & tax return validator for Zambia Revenue Authority submissions. 
              Automatically detect and fix common errors before submission.
            </p>
            
            <div className="flex flex-wrap items-center justify-center gap-6 pt-4">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5" />
                <span className="text-sm">XML, CSV, JSON</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                <span className="text-sm">100% Client-Side</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {processedFiles.length === 0 ? (
          <>
            <FileUpload 
              onFilesSelected={handleFilesSelected} 
              isProcessing={isProcessing}
            />
            
            {/* Accepted File Formats */}
            <div className="mt-12 max-w-3xl mx-auto">
              <div className="bg-card border rounded-lg p-8 shadow-card">
                <h3 className="text-xl font-semibold mb-6 text-center">Accepted File Formats</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* XML Format */}
                  <div className="text-center space-y-3 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg mb-1">XML Files</h4>
                      <p className="text-sm text-muted-foreground">.xml extension</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Structured invoice data with nested elements
                      </p>
                    </div>
                  </div>

                  {/* CSV Format */}
                  <div className="text-center space-y-3 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="mx-auto w-12 h-12 bg-success/10 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg mb-1">CSV Files</h4>
                      <p className="text-sm text-muted-foreground">.csv extension</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Spreadsheet data with comma-separated values
                      </p>
                    </div>
                  </div>

                  {/* JSON Format */}
                  <div className="text-center space-y-3 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="mx-auto w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg mb-1">JSON Files</h4>
                      <p className="text-sm text-muted-foreground">.json extension</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        JavaScript Object Notation with key-value pairs
                      </p>
                    </div>
                  </div>
                </div>

            <div className="mt-8 pt-6 border-t border-border">
                  <h4 className="font-semibold mb-3 text-center">What We Validate</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-start gap-2">
                      <Shield className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                      <span>10-digit TPIN format validation</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Shield className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                      <span>Date format standardization (YYYY-MM-DD)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Shield className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                      <span>VAT rate verification (16% standard)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Shield className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                      <span>Invoice total calculations accuracy</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Shield className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                      <span>Mandatory field completeness</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Shield className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                      <span>ZRA Smart Invoice compliance</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Shield className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                      <span>Duplicate invoice detection</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Shield className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                      <span>Currency & negative value checks</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Validation History */}
            {history.length > 0 && (
              <div className="mt-12">
                <ValidationHistory
                  history={history}
                  onClear={clearHistory}
                  onRemove={removeItem}
                />
              </div>
            )}
          </>
        ) : (
          <ValidationResults 
            processedFiles={processedFiles}
            onDownload={handleDownload}
            onReset={handleReset}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-sm text-muted-foreground">
            <p>
              <strong>Privacy Notice:</strong> All validation occurs in your browser. 
              No files are uploaded to any server.
            </p>
            <p className="mt-2">
              Zambia Revenue Authority Tax Validation Tool © 2025
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
