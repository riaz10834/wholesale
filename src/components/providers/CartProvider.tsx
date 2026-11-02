"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartItem } from "@/lib/types";

interface CartCtx {
  items: CartItem[];
  count: number;
  subtotal: number;
  ready: boolean;
  add: (item: CartItem) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
}

const Ctx = createContext<CartCtx>(null as unknown as CartCtx);
const KEY = "wb_cart_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(KEY, JSON.stringify(items));
  }, [items, ready]);

  const add = useCallback((item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((p) => p.variantId === item.variantId);
      if (existing) {
        return prev.map((p) =>
          p.variantId === item.variantId
            ? { ...p, ...item, quantity: Math.min(p.quantity + item.quantity, item.stock) }
            : p
        );
      }
      return [...prev, item];
    });
  }, []);

  const setQty = useCallback((variantId: string, qty: number) => {
    setItems((prev) =>
      prev.map((p) => (p.variantId === variantId ? { ...p, quantity: Math.max(1, Math.min(qty, p.stock || qty)) } : p))
    );
  }, []);

  const remove = useCallback((variantId: string) => setItems((prev) => prev.filter((p) => p.variantId !== variantId)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({
      items,
      ready,
      count: items.reduce((s, i) => s + i.quantity, 0),
      subtotal: items.reduce((s, i) => s + i.quantity * i.price, 0),
      add,
      setQty,
      remove,
      clear,
    }),
    [items, ready, add, setQty, remove, clear]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCart = () => useContext(Ctx);
