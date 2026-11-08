"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface PayRedirectContentProps {
  propSearchParams?: { [key: string]: string | string[] | undefined };
}

function PayRedirectContent({ propSearchParams }: PayRedirectContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const getParam = (key: string): string => {
    const val = searchParams.get(key);
    if (val) return val;
    const propVal = propSearchParams?.[key];
    if (typeof propVal === "string") return propVal;
    if (Array.isArray(propVal) && propVal.length > 0) return propVal[0];
    return "";
  };

  const orderId = getParam("order") || getParam("order_id");

  useEffect(() => {
    if (orderId) {
      const params = new URLSearchParams(searchParams.toString());
      if (!params.has("order_id")) {
        params.set("order_id", orderId);
      }
      params.delete("order");
      router.replace(`/orders/payment?${params.toString()}`);
    } else {
      router.replace("/");
    }
  }, [orderId, searchParams, router]);

  return null;
}

interface PayRedirectPageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

export default function PayRedirectPage({ searchParams }: PayRedirectPageProps) {
  const orderId =
    typeof searchParams?.order_id === "string"
      ? searchParams.order_id
      : typeof searchParams?.order === "string"
      ? searchParams.order
      : "";

  return (
    <Suspense key={orderId} fallback={null}>
      <PayRedirectContent propSearchParams={searchParams} />
    </Suspense>
  );
}
