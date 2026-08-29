import { useMemo } from "react";
import { useSearch, useNavigate, useLocation } from "@tanstack/react-router";

class SearchParamsWrapper {
  private params: URLSearchParams;

  constructor(params: URLSearchParams) {
    this.params = params;
  }

  get(name: string) {
    return this.params.get(name);
  }

  getAll(name: string) {
    return this.params.getAll(name);
  }

  has(name: string) {
    return this.params.has(name);
  }

  entries() {
    return this.params.entries();
  }

  keys() {
    return this.params.keys();
  }

  values() {
    return this.params.values();
  }

  toString() {
    return this.params.toString();
  }

  [Symbol.iterator]() {
    return this.params[Symbol.iterator]();
  }
}

export function useSearchParams(): [SearchParamsWrapper, (next: Record<string, string> | URLSearchParams) => void] {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const location = useLocation();

  const params = useMemo(() => {
    const sp = new URLSearchParams(location.searchStr || location.search || "");
    return new SearchParamsWrapper(sp);
  }, [location.searchStr, location.search]);

  const setSearchParams = (next: Record<string, string> | URLSearchParams) => {
    const nextRecord: Record<string, string> = {};
    if (next instanceof URLSearchParams) {
      next.forEach((value, key) => {
        nextRecord[key] = value;
      });
    } else {
      Object.assign(nextRecord, next);
    }
    navigate({ to: location.pathname, search: nextRecord, replace: true });
  };

  return [params, setSearchParams];
}
