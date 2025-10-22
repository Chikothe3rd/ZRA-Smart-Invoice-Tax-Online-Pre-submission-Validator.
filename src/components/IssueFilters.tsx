import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, SlidersHorizontal } from 'lucide-react';
import { IssueFilter } from '@/types';

interface IssueFiltersProps {
  filter: IssueFilter;
  onFilterChange: (filter: IssueFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: 'severity' | 'field' | 'category';
  onSortChange: (sort: 'severity' | 'field' | 'category') => void;
  issueCounts: {
    all: number;
    errors: number;
    warnings: number;
    autoFixed: number;
    manualReview: number;
  };
}

export function IssueFilters({
  filter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  issueCounts,
}: IssueFiltersProps) {
  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={(v) => onFilterChange(v as IssueFilter)}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="all">
            All ({issueCounts.all})
          </TabsTrigger>
          <TabsTrigger value="errors">
            Errors ({issueCounts.errors})
          </TabsTrigger>
          <TabsTrigger value="warnings">
            Warnings ({issueCounts.warnings})
          </TabsTrigger>
          <TabsTrigger value="auto-fixed">
            Fixed ({issueCounts.autoFixed})
          </TabsTrigger>
          <TabsTrigger value="manual-review">
            Review ({issueCounts.manualReview})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search and Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search issues by field, message, or category..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

  <Select value={sortBy} onValueChange={(v: string) => onSortChange(v as 'severity' | 'field' | 'category')}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="severity">Sort by Severity</SelectItem>
            <SelectItem value="field">Sort by Field</SelectItem>
            <SelectItem value="category">Sort by Category</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
