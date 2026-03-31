import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Enterprise, EnterpriseFilters } from '../types/enterprise';

const DEFAULT_PAGE_SIZE = 50;

export type SortField = keyof Enterprise;
export type SortDirection = 'asc' | 'desc';

export function useEnterprises() {
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<EnterpriseFilters>({
    probabilityLevel: '',
    detectionStatus: '',
    industryCategory: '',
    majorCategory: '',
    subCategory: '',
    searchText: '',
    hasCoolingTower: '',
  });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [sortField, setSortField] = useState<SortField>('composite_score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const fetchEnterprises = useCallback(async (
    currentFilters: EnterpriseFilters,
    pageNum: number,
    size: number,
    field: SortField,
    direction: SortDirection,
  ) => {
    setLoading(true);

    let query = supabase
      .from('enterprises')
      .select('*', { count: 'exact' });

    if (currentFilters.probabilityLevel) {
      query = query.eq('probability_level', currentFilters.probabilityLevel);
    }
    if (currentFilters.detectionStatus) {
      query = query.eq('detection_status', currentFilters.detectionStatus);
    }
    if (currentFilters.industryCategory) {
      query = query.ilike('industry_category', `%${currentFilters.industryCategory}%`);
    }
    if (currentFilters.majorCategory) {
      query = query.eq('major_category', currentFilters.majorCategory);
    }
    if (currentFilters.subCategory) {
      query = query.eq('sub_category', currentFilters.subCategory);
    }
    if (currentFilters.searchText) {
      query = query.or(
        `enterprise_name.ilike.%${currentFilters.searchText}%,address.ilike.%${currentFilters.searchText}%,account_number.ilike.%${currentFilters.searchText}%`
      );
    }
    if (currentFilters.hasCoolingTower === 'yes') {
      query = query.eq('has_cooling_tower', true);
    } else if (currentFilters.hasCoolingTower === 'no') {
      query = query.eq('has_cooling_tower', false);
    }

    query = query
      .order(field, { ascending: direction === 'asc' })
      .range(pageNum * size, (pageNum + 1) * size - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Fetch enterprises error:', error);
      setLoading(false);
      return;
    }

    setEnterprises(data || []);
    setTotalCount(count || 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    setPage(0);
    fetchEnterprises(filters, 0, pageSize, sortField, sortDirection);
  }, [filters, sortField, sortDirection, pageSize, fetchEnterprises]);

  const goToPage = useCallback((p: number) => {
    const clamped = Math.max(0, Math.min(p, totalPages - 1));
    setPage(clamped);
    fetchEnterprises(filters, clamped, pageSize, sortField, sortDirection);
  }, [filters, pageSize, sortField, sortDirection, totalPages, fetchEnterprises]);

  const refresh = useCallback(() => {
    fetchEnterprises(filters, page, pageSize, sortField, sortDirection);
  }, [filters, page, pageSize, sortField, sortDirection, fetchEnterprises]);

  const setSort = useCallback((field: SortField, direction: SortDirection) => {
    setSortField(field);
    setSortDirection(direction);
  }, []);

  const changePageSize = useCallback((size: number) => {
    setPageSize(size);
    setPage(0);
  }, []);

  const updateEnterprise = useCallback(async (id: string, updates: Partial<Enterprise>) => {
    const { error } = await supabase
      .from('enterprises')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Update enterprise error:', error);
      return false;
    }

    setEnterprises((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
    );
    return true;
  }, []);

  return {
    enterprises,
    loading,
    filters,
    setFilters,
    totalCount,
    page,
    pageSize,
    totalPages,
    goToPage,
    changePageSize,
    refresh,
    updateEnterprise,
    sortField,
    sortDirection,
    setSort,
  };
}
