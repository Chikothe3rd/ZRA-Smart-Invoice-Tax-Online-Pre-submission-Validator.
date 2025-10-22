import { useState, useMemo } from 'react';
import { ValidationIssue, IssueFilter } from '@/types';

export function useIssueFilter(issues: ValidationIssue[]) {
  const [filter, setFilter] = useState<IssueFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'severity' | 'field' | 'category'>('severity');

  const filteredIssues = useMemo(() => {
    let filtered = [...issues];

    // Apply filter
    switch (filter) {
      case 'errors':
        filtered = filtered.filter((issue) => issue.severity === 'error');
        break;
      case 'warnings':
        filtered = filtered.filter((issue) => issue.severity === 'warning');
        break;
      case 'auto-fixed':
        filtered = filtered.filter((issue) => issue.autoFixed);
        break;
      case 'manual-review':
        filtered = filtered.filter((issue) => !issue.autoFixed && issue.severity === 'error');
        break;
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (issue) =>
          issue.field.toLowerCase().includes(query) ||
          issue.message.toLowerCase().includes(query) ||
          issue.category?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      if (sortBy === 'severity') {
        const severityOrder = { error: 3, warning: 2, info: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      } else if (sortBy === 'field') {
        return a.field.localeCompare(b.field);
      } else if (sortBy === 'category') {
        return (a.category || '').localeCompare(b.category || '');
      }
      return 0;
    });

    return filtered;
  }, [issues, filter, searchQuery, sortBy]);

  return {
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    filteredIssues,
  };
}
