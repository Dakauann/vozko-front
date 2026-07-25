"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ElevatedCommandOption } from "@/components/elevated-design/elevated-command-select";

const DEFAULT_PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

type FetchResult<T> = {
    items: T[];
    totalPages: number;
};

type UsePaginatedSelectOptions<T> = {
    fetchFn: (page: number, search: string) => Promise<FetchResult<T>>;
    mapOption: (item: T) => ElevatedCommandOption;
    enabled?: boolean;
    pageSize?: number;
};

export function usePaginatedSelect<T>({
    fetchFn,
    mapOption,
    enabled = true,
    pageSize = DEFAULT_PAGE_SIZE,
}: UsePaginatedSelectOptions<T>) {
    const [items, setItems] = useState<T[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const fetchRef = useRef(0);

    const fetchFnRef = useRef(fetchFn);
    fetchFnRef.current = fetchFn;

    const mapOptionRef = useRef(mapOption);
    mapOptionRef.current = mapOption;

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [search]);

    const load = useCallback(
        async (pageNum: number, query: string, append: boolean) => {
            const fetchId = ++fetchRef.current;
            setIsLoading(true);
            try {
                const result = await fetchFnRef.current(pageNum, query);
                if (fetchId !== fetchRef.current) return; 
                setItems((prev) => (append ? [...prev, ...result.items] : result.items));
                setTotalPages(result.totalPages);
            } finally {
                if (fetchId === fetchRef.current) {
                    setIsLoading(false);
                }
            }
        },
        [],
    );

    useEffect(() => {
        if (!isOpen || !enabled) return;
        setPage(1);
        load(1, debouncedSearch, false);
    }, [isOpen, debouncedSearch, enabled, load]);

    const onOpenChange = useCallback((open: boolean) => {
        setIsOpen(open);
        if (!open) {
            setItems([]);
            setPage(1);
            setTotalPages(1);
            setSearch("");
            setDebouncedSearch("");
        }
    }, []);

    const onSearch = useCallback((query: string) => {
        setSearch(query);
    }, []);

    const onScrollEnd = useCallback(() => {
        if (isLoading || page >= totalPages) return;
        const nextPage = page + 1;
        setPage(nextPage);
        load(nextPage, debouncedSearch, true);
    }, [isLoading, page, totalPages, debouncedSearch, load]);

    const options = useMemo(() => items.map(mapOptionRef.current), [items]);

    return {
        options,
        isLoading,
        onSearch,
        onScrollEnd,
        onOpenChange,
        items,
        search,
    };
}
