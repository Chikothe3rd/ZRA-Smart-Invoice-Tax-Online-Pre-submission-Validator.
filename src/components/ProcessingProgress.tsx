import { Progress } from "@/components/ui/progress";
import { CheckCircle2, FileText, Loader2 } from "lucide-react";

interface ProcessingProgressProps {
  currentFile: string;
  currentIndex: number;
  totalFiles: number;
  progress: number;
}

export function ProcessingProgress({ 
  currentFile, 
  currentIndex, 
  totalFiles, 
  progress 
}: ProcessingProgressProps) {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card border border-border rounded-lg p-8 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-center justify-center mb-6">
          <div className="relative">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <FileText className="h-6 w-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
        </div>
        
        <h3 className="text-lg font-semibold text-center mb-2">
          Processing Files
        </h3>
        
        <p className="text-sm text-muted-foreground text-center mb-6">
          Validating and fixing ZRA compliance issues...
        </p>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">File {currentIndex + 1} of {totalFiles}</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          
          <Progress value={progress} className="h-2" />
          
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            <span className="text-muted-foreground truncate">{currentFile}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
