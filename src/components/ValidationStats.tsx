import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProcessedFile, ValidationStats as Stats } from '@/types';
import { AlertCircle, CheckCircle, AlertTriangle, Info, TrendingUp } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ValidationStatsProps {
  processedFiles: ProcessedFile[];
}

export function ValidationStats({ processedFiles }: ValidationStatsProps) {
  const stats: Stats = processedFiles.reduce(
    (acc, file) => {
      file.result.issues.forEach((issue) => {
        acc.totalIssues++;
        if (issue.severity === 'error') acc.criticalErrors++;
        if (issue.severity === 'warning') acc.warnings++;
        if (issue.severity === 'info') acc.infoMessages++;
        if (issue.autoFixed) acc.autoFixed++;
        if (issue.severity === 'error' && !issue.autoFixed) acc.manualReviewNeeded++;
        
        const category = issue.category || 'other';
        acc.byCategory[category] = (acc.byCategory[category] || 0) + 1;
      });
      return acc;
    },
    {
      totalIssues: 0,
      criticalErrors: 0,
      warnings: 0,
      infoMessages: 0,
      autoFixed: 0,
      manualReviewNeeded: 0,
      byCategory: {},
    } as Stats
  );

  const complianceRate = stats.totalIssues > 0 
    ? Math.round((stats.autoFixed / stats.totalIssues) * 100) 
    : 100;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Issues</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalIssues}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Found across {processedFiles.length} file(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auto-Fixed</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.autoFixed}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {complianceRate}% compliance rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Errors</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.criticalErrors}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.manualReviewNeeded} need manual review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warnings</CardTitle>
            <Info className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.warnings}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Non-blocking issues
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            ZRA Compliance Score
          </CardTitle>
          <CardDescription>
            Percentage of issues automatically corrected for ZRA submission
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Compliance Rate</span>
              <span className="font-bold text-lg">{complianceRate}%</span>
            </div>
            <Progress value={complianceRate} className="h-3" />
          </div>

          {stats.manualReviewNeeded > 0 && (
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
              <p className="text-sm">
                <strong>{stats.manualReviewNeeded} issue(s)</strong> require manual attention before submission
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      {Object.keys(stats.byCategory).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Issues by Category</CardTitle>
            <CardDescription>Distribution of validation issues</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.byCategory)
                .sort(([, a], [, b]) => b - a)
                .map(([category, count]) => (
                  <div key={category} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize">{category.replace(/_/g, ' ')}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                    <Progress 
                      value={(count / stats.totalIssues) * 100} 
                      className="h-2"
                    />
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
