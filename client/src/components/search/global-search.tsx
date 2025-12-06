import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { SearchResults } from "@/lib/types";

export function GlobalSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [, setLocation] = useLocation();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: searchResults, isLoading } = useQuery<SearchResults>({
    queryKey: [`/api/search?q=${searchQuery}`],
    enabled: searchQuery.length > 2,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setShowResults(false);
        inputRef.current?.blur();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleNavigate = (type: string, id: string, orderNumber?: string) => {
    switch (type) {
      case 'customer':
        setLocation(`/customers/${id}`);
        break;
      case 'order':
        setLocation(`/orders?orderId=${id}`);
        break;
      case 'thread':
        setLocation('/inbox');
        break;
      case 'repair':
        setLocation('/repairs');
        break;
    }
    setShowResults(false);
    setSearchQuery("");
  };

  return (
    <div className="relative" ref={searchRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search customers, orders, threads..."
          className="h-9 w-64 pl-10 pr-12"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setShowResults(true)}
          data-testid="global-search-input"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          ⌘K
        </div>
      </div>

      {showResults && searchQuery.length > 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50" data-testid="search-results">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Searching...</div>
          ) : searchResults ? (
            <div className="max-h-80 overflow-y-auto">
              {searchResults.customers.length > 0 && (
                <div className="p-2">
                  <h4 className="text-xs font-medium text-muted-foreground mb-1">Customers</h4>
                  {searchResults.customers.map((customer) => (
                    <div
                      key={customer.id}
                      className="p-2 hover:bg-accent rounded cursor-pointer"
                      onClick={() => handleNavigate('customer', customer.id)}
                      data-testid={`search-result-customer-${customer.id}`}
                    >
                      <div className="font-medium">{customer.firstName} {customer.lastName}</div>
                      <div className="text-sm text-muted-foreground">{customer.email}</div>
                    </div>
                  ))}
                </div>
              )}

              {searchResults.orders.length > 0 && (
                <div className="p-2">
                  <h4 className="text-xs font-medium text-muted-foreground mb-1">Orders</h4>
                  {searchResults.orders.map((order) => (
                    <div
                      key={order.id}
                      className="p-2 hover:bg-accent rounded cursor-pointer"
                      onClick={() => handleNavigate('order', order.id, order.orderNumber)}
                      data-testid={`search-result-order-${order.id}`}
                    >
                      <div className="font-medium">Order {order.orderNumber}</div>
                      <div className="text-sm text-muted-foreground">{order.customerEmail}</div>
                    </div>
                  ))}
                </div>
              )}

              {searchResults.emailThreads.length > 0 && (
                <div className="p-2">
                  <h4 className="text-xs font-medium text-muted-foreground mb-1">Email Threads</h4>
                  {searchResults.emailThreads.map((thread) => (
                    <div
                      key={thread.id}
                      className="p-2 hover:bg-accent rounded cursor-pointer"
                      onClick={() => handleNavigate('thread', thread.id)}
                      data-testid={`search-result-thread-${thread.id}`}
                    >
                      <div className="font-medium">{thread.subject}</div>
                      <div className="text-sm text-muted-foreground">{thread.customerEmail}</div>
                    </div>
                  ))}
                </div>
              )}

              {searchResults.repairs.length > 0 && (
                <div className="p-2">
                  <h4 className="text-xs font-medium text-muted-foreground mb-1">Repairs</h4>
                  {searchResults.repairs.map((repair) => (
                    <div
                      key={repair.id}
                      className="p-2 hover:bg-accent rounded cursor-pointer"
                      onClick={() => handleNavigate('repair', repair.id)}
                      data-testid={`search-result-repair-${repair.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">{repair.title}</div>
                          <div className="text-xs text-muted-foreground">
                            Status: {repair.status} • Priority: {repair.priority}
                          </div>
                        </div>
                        {repair.estimatedCost && (
                          <div className="text-xs font-medium">
                            €{((repair.estimatedCost || 0) / 100).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {searchResults.customers.length === 0 &&
                searchResults.orders.length === 0 &&
                searchResults.emailThreads.length === 0 &&
                searchResults.repairs.length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground">No results found</div>
                )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
