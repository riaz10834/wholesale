"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export interface DispatchPoint {
  name: string;
  address: string | null;
  lat: number;
  lng: number;
}

/** Warehouse the order leaves from. Null until an admin pins it. */
export function useDispatchPoint() {
  const supabase = supabaseBrowser();
  const [point, setPoint] = useState<DispatchPoint | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    supabase
      .from("store_settings")
      .select("warehouse_name,warehouse_address,warehouse_lat,warehouse_lng")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (data?.warehouse_lat != null && data?.warehouse_lng != null) {
          setPoint({
            name: data.warehouse_name || "Warehouse",
            address: data.warehouse_address,
            lat: Number(data.warehouse_lat),
            lng: Number(data.warehouse_lng),
          });
        }
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, [supabase]);

  return { point, ready };
}
