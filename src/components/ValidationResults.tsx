import React, { useState } from 'react';
import { ProcessedFile } from '@/lib/fileProcessing';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DownloadOptions } from '@/components/DownloadOptions';
import { FileComparisonModal } from '@/components/FileComparisonModal';
import { ValidationStats } from '@/components/ValidationStats';
import { IssueFilters } from '@/components/IssueFilters';
import { useIssueFilter } from '@/hooks/useIssueFilter';
import { generateCSVReport, generateMarkdownReport } from '@/utils/exportReport';
import { toast } from 'sonner';
import {
	Download,
	RotateCcw,
	AlertTriangle,
	CheckCircle,
	AlertCircle,
	Info,
	FileText,
	ChevronDown,
	ChevronUp,
	Eye,
	FileSpreadsheet
} from 'lucide-react';

interface ValidationResultsProps {
	processedFiles: ProcessedFile[];
	onDownload: (format: 'original' | 'xml' | 'csv' | 'json') => void;
	onReset: () => void;
}

function FileIssuesPanel({ file, onCompare, expandedIssues, toggleIssue }: { file: ProcessedFile; onCompare: () => void; expandedIssues: Set<string>; toggleIssue: (k: string) => void }) {
	const issueFilter = useIssueFilter(file.result.issues);
	const [showAll, setShowAll] = useState(false);

	// Memoize filtered issues to avoid re-filtering on every render
	const filteredIssues = React.useMemo(() => issueFilter.filteredIssues, [issueFilter.filteredIssues]);
	const displayIssues = showAll ? filteredIssues : filteredIssues.slice(0, 10);

	const issueCounts = {
		all: file.result.issues.length,
		errors: file.result.issues.filter(i => i.severity === 'error').length,
		warnings: file.result.issues.filter(i => i.severity === 'warning').length,
		autoFixed: file.result.issues.filter(i => i.autoFixed).length,
		manualReview: file.result.issues.filter(i => !i.autoFixed && i.severity === 'error').length,
	};

	return (
		<>
			<IssueFilters
				filter={issueFilter.filter}
				onFilterChange={issueFilter.setFilter}
				searchQuery={issueFilter.searchQuery}
				onSearchChange={issueFilter.setSearchQuery}
				sortBy={issueFilter.sortBy}
				onSortChange={issueFilter.setSortBy}
				issueCounts={issueCounts}
			/>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<Card>
					<CardContent className="pt-6">
						<div className="space-y-2">
							<p className="text-sm font-medium text-muted-foreground">File Status</p>
							{file.result.issues.filter(i => i.severity === 'error' && !i.autoFixed).length === 0 ? (
								<Badge className="bg-success text-success-foreground">✓ Ready for Submission</Badge>
							) : (
								<Badge variant="destructive">⚠ Requires Review</Badge>
							)}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-6">
						<div className="space-y-2">
							<p className="text-sm font-medium text-muted-foreground">Total Issues</p>
							<p className="text-2xl font-bold">{file.result.issues.length}</p>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-6">
						<div className="space-y-2">
							<p className="text-sm font-medium text-muted-foreground">Auto-Fixed</p>
							<p className="text-2xl font-bold text-success">{file.result.issues.filter(i => i.autoFixed).length}</p>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-6">
						<div className="space-y-2">
							<p className="text-sm font-medium text-muted-foreground">File Type</p>
							<Badge variant="outline" className="text-sm uppercase">{file.type}</Badge>
						</div>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center justify-between">
						<span>
							{issueFilter.filteredIssues.length} Issue(s)
							{issueFilter.searchQuery && ` matching "${issueFilter.searchQuery}"`}
						</span>
						<Button variant="outline" size="sm" onClick={onCompare}>
							<Eye className="mr-2 h-4 w-4" />
							Compare Files
						</Button>
					</CardTitle>
					<CardDescription>Filtered and sorted validation issues</CardDescription>
				</CardHeader>

				<CardContent className="space-y-3">
					{filteredIssues.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							<CheckCircle className="h-12 w-12 mx-auto mb-3 text-success" />
							<p className="font-medium">No issues match your filters</p>
							<p className="text-sm">Try adjusting your search or filter criteria.</p>
						</div>
					) : (
						displayIssues.map((issue, idx) => {
							const issueKey = `${file.name}-${idx}`;
							const isExpanded = expandedIssues.has(issueKey);

							return (
								<div key={idx} className={`border rounded-lg p-4 transition-all ${
									issue.severity === 'error' ? 'border-destructive/30 bg-destructive/5' : issue.severity === 'warning' ? 'border-warning/30 bg-warning/5' : 'border-muted bg-muted/20'
								}`}>
									<div className="flex items-start justify-between gap-4">
										<div className="flex-1 space-y-2">
											<div className="flex items-start gap-3">
												{issue.severity === 'error' && <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />}
												{issue.severity === 'warning' && <AlertTriangle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />}
												{issue.severity === 'info' && <Info className="h-5 w-5 text-info mt-0.5 flex-shrink-0" />}

												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2 flex-wrap">
														<Badge variant={issue.severity === 'error' ? 'destructive' : issue.severity === 'warning' ? 'secondary' : 'outline'}>{issue.severity}</Badge>
														{issue.category && <Badge variant="outline" className="capitalize">{issue.category}</Badge>}
														<code className="text-sm bg-muted px-2 py-0.5 rounded">{issue.field}</code>
														{issue.autoFixed && <Badge className="bg-success text-success-foreground"><CheckCircle className="h-3 w-3 mr-1" />Auto-Fixed</Badge>}
														{issue.confidence && <Badge variant="outline" className="text-xs">{issue.confidence} confidence</Badge>}
													</div>

													<p className="text-sm mt-2 text-foreground">{issue.message}</p>
												</div>
											</div>

											{(issue.originalValue !== undefined || issue.fixedValue !== undefined) && (
												<button onClick={() => toggleIssue(issueKey)} className="flex items-center gap-1 text-sm text-primary hover:underline">
													{isExpanded ? (<><ChevronUp className="h-4 w-4" />Hide details</>) : (<><ChevronDown className="h-4 w-4" />Show details</>) }
												</button>
											)}

											{isExpanded && (
												<div className="mt-3 p-3 bg-background rounded-md border space-y-2 text-sm">
													{issue.originalValue !== undefined && (<div><span className="font-medium text-muted-foreground">Original: </span><code className="text-destructive break-all">{JSON.stringify(issue.originalValue)}</code></div>)}
													{issue.fixedValue !== undefined && (<div><span className="font-medium text-muted-foreground">Corrected: </span><code className="text-success break-all">{JSON.stringify(issue.fixedValue)}</code></div>)}
												</div>
											)}
										</div>
									</div>
								</div>
							);
												})
					)}
										{filteredIssues.length > 10 && (
											<div className="pt-2 text-center">
												<Button size="sm" variant="ghost" onClick={() => setShowAll(s => !s)}>{showAll ? 'Show less' : `Show all (${filteredIssues.length})`}</Button>
											</div>
										)}
				</CardContent>
			</Card>
		</>
	);
}

export default function ValidationResults({ processedFiles, onDownload, onReset }: ValidationResultsProps) {
	const [comparisonFile, setComparisonFile] = useState<ProcessedFile | null>(null);
	const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
	const [activeTab, setActiveTab] = useState('overview');

	const toggleIssue = (key: string) => {
		setExpandedIssues((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(key)) newSet.delete(key); else newSet.add(key);
			return newSet;
		});
	};

	const handleExportCSV = () => {
		try {
			const blob = generateCSVReport(processedFiles);
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `ZRA_Validation_Report_${new Date().getTime()}.csv`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			toast.success('CSV report exported successfully');
		} catch (error) {
			toast.error('Failed to export CSV report');
		}
	};

	const handleExportMarkdown = () => {
		try {
			const blob = generateMarkdownReport(processedFiles);
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `ZRA_Validation_Report_${new Date().getTime()}.md`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			toast.success('Markdown report exported successfully');
		} catch (error) {
			toast.error('Failed to export markdown report');
		}
	};

	return (
		<div className="space-y-6 animate-fade-in">
			<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
				<div>
					<h2 className="text-2xl font-bold">Validation Results</h2>
					<p className="text-muted-foreground">{processedFiles.length} file(s) processed</p>
				</div>

				<div className="flex flex-wrap gap-2">
					<Button variant="outline" size="sm" onClick={handleExportCSV}><FileSpreadsheet className="mr-2 h-4 w-4" />Export CSV</Button>
					<Button variant="outline" size="sm" onClick={handleExportMarkdown}><Download className="mr-2 h-4 w-4" />Export Report</Button>
					<DownloadOptions onDownload={onDownload} />
					<Button variant="outline" onClick={onReset}><RotateCcw className="mr-2 h-4 w-4" />Validate New Files</Button>
				</div>
			</div>

			<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
				<TabsList className="grid w-full grid-cols-2 lg:grid-cols-3">
					<TabsTrigger value="overview">Overview & Stats</TabsTrigger>
					<TabsTrigger value="issues">Detailed Issues</TabsTrigger>
					<TabsTrigger value="files">File Comparison</TabsTrigger>
				</TabsList>

				<TabsContent value="overview" className="space-y-6 mt-6">
					<ValidationStats processedFiles={processedFiles} />
				</TabsContent>

				<TabsContent value="issues" className="space-y-6 mt-6">
					<Tabs defaultValue={processedFiles[0]?.name} className="w-full">
						<TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto">
							{processedFiles.map((file) => (
								<TabsTrigger key={file.name} value={file.name} className="gap-2">
									<FileText className="h-4 w-4" />{file.name}
									<Badge variant={file.result.issues.some(i => i.severity === 'error' && !i.autoFixed) ? 'destructive' : 'secondary'}>{file.result.issues.length}</Badge>
								</TabsTrigger>
							))}
						</TabsList>

						{processedFiles.map((file) => (
							<TabsContent key={file.name} value={file.name} className="space-y-6 mt-6">
								<FileIssuesPanel file={file} onCompare={() => setComparisonFile(file)} expandedIssues={expandedIssues} toggleIssue={toggleIssue} />
							</TabsContent>
						))}
					</Tabs>
				</TabsContent>

				<TabsContent value="files" className="space-y-6 mt-6">
					<div className="grid gap-4">
						{processedFiles.map((file) => (
							<Card key={file.name}>
								<CardHeader>
									<CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />{file.name}</CardTitle>
									<CardDescription>{file.type.toUpperCase()} • {file.result.issues.length} issue(s) found</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="flex items-center gap-2">
										<Button onClick={() => setComparisonFile(file)}><Eye className="mr-2 h-4 w-4" />View Comparison</Button>
										<Button variant="outline" onClick={() => { try { const content = JSON.stringify(file.result.fixedData, null, 2); const blob = new Blob([content], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = file.name.replace(/\.(xml|csv|json)$/i, '') + '_corrected.json'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); toast.success('Corrected file download started'); } catch (e) { toast.error('Failed to download corrected file'); } }}><Download className="mr-2 h-4 w-4" />Download Corrected (JSON)</Button>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</TabsContent>
			</Tabs>

			{comparisonFile && (
				<FileComparisonModal
					open={!!comparisonFile}
					onOpenChange={(open) => !open && setComparisonFile(null)}
					fileName={comparisonFile.name}
					originalData={comparisonFile.result.originalData}
					fixedData={comparisonFile.result.fixedData}
				/>
			)}
		</div>
	);
}

