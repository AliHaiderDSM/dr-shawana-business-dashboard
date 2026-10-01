import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

export interface ListState {
  page: number;
  pageSize: number;
  search: string;
  sort: string | undefined;
  filters: Record<string, string>;
  searchInput: string;
  setSearchInput: (value: string) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setSort: (sort: string | undefined) => void;
  setFilter: (key: string, value: string | undefined) => void;
  setFilters: (changes: Record<string, string | undefined>) => void;
  resetFilters: () => void;
  query: Record<string, string | number>;
}

const RESERVED = new Set(['page', 'pageSize', 'search', 'sort']);

export function useListState(options: { defaultSort?: string; pageSize?: number; prefix?: string } = {}) {
  const [params, setParams] = useSearchParams();
  const prefix = options.prefix ?? '';
  const key = useCallback((name: string) => `${prefix}${name}`, [prefix]);

  const page = Math.max(1, Number(params.get(key('page')) ?? 1) || 1);
  const pageSize = Number(params.get(key('pageSize')) ?? options.pageSize ?? 20) || 20;
  const search = params.get(key('search')) ?? '';
  const sort = params.get(key('sort')) ?? options.defaultSort;

  const filters = useMemo(() => {
    const result: Record<string, string> = {};
    params.forEach((value, name) => {
      if (!name.startsWith(prefix)) return;
      const bare = name.slice(prefix.length);
      if (!RESERVED.has(bare) && value) result[bare] = value;
    });
    return result;
  }, [params, prefix]);

  const update = useCallback(
    (changes: Record<string, string | undefined>, resetPage = true) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [name, value] of Object.entries(changes)) {
            if (value === undefined || value === '') next.delete(key(name));
            else next.set(key(name), value);
          }
          if (resetPage) next.delete(key('page'));
          return next;
        },
        { replace: true },
      );
    },
    [setParams, key],
  );

  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    if (searchInput === search) return;
    const timer = window.setTimeout(() => update({ search: searchInput.trim() || undefined }), 350);
    return () => window.clearTimeout(timer);
  }, [searchInput, search, update]);

  const query = useMemo(
    () => ({
      page,
      pageSize,
      ...(search ? { search } : {}),
      ...(sort ? { sort } : {}),
      ...filters,
    }),
    [page, pageSize, search, sort, filters],
  );

  return {
    page,
    pageSize,
    search,
    sort,
    filters,
    searchInput,
    setSearchInput,
    setPage: (next: number) => update({ page: next > 1 ? String(next) : undefined }, false),
    setPageSize: (size: number) => update({ pageSize: String(size) }),
    setSort: (next: string | undefined) => update({ sort: next }),
    setFilter: (name: string, value: string | undefined) => update({ [name]: value }),
    setFilters: (changes: Record<string, string | undefined>) => update(changes),
    resetFilters: () => update(Object.fromEntries(Object.keys(filters).map((f) => [f, undefined]))),
    query,
  } satisfies ListState;
}
