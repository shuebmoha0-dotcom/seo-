"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import Script from "next/script";
import { getPaddleClientToken, getPaddleEnvironment } from "@/lib/billing/paddle";

interface PaddleContextType {
  isLoaded: boolean;
  openCheckout: (params: {
    priceId: string;
    customerEmail?: string;
    customData?: Record<string, any>;
    successUrl?: string;
  }) => void;
}

const PaddleContext = createContext<PaddleContextType>({
  isLoaded: false,
  openCheckout: () => {},
});

export function PaddleProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);

  const initPaddle = () => {
    if (typeof window !== "undefined" && (window as any).Paddle) {
      const clientToken = getPaddleClientToken();
      const environment = getPaddleEnvironment();

      try {
        if (environment === "sandbox") {
          (window as any).Paddle.Environment.set("sandbox");
        }
        if (clientToken) {
          (window as any).Paddle.Initialize({
            token: clientToken,
            eventCallback: function (data: any) {
              if (data.name === "checkout.completed") {
                console.log("[Paddle] Checkout completed:", data);
                if (typeof window !== "undefined") {
                  window.location.href = "/dashboard?payment=success";
                }
              }
            },
          });
        }
        setIsLoaded(true);
      } catch (err) {
        console.warn("[Paddle] Initialization notice:", err);
      }
    }
  };

  const openCheckout = (params: {
    priceId: string;
    customerEmail?: string;
    customData?: Record<string, any>;
    successUrl?: string;
  }) => {
    if (typeof window === "undefined" || !(window as any).Paddle) {
      alert("Payment system is loading, please try again in a moment.");
      return;
    }

    const clientToken = getPaddleClientToken();
    if (!clientToken || clientToken.includes("sample")) {
      // Friendly fallback if Paddle keys have not yet been provided in .env
      const confirmed = window.confirm(
        "Paddle billing keys are currently in setup mode. Would you like to proceed with the 14-day free trial on the platform now?"
      );
      if (confirmed) {
        window.location.href = "/login";
      }
      return;
    }

    try {
      (window as any).Paddle.Checkout.open({
        items: [{ priceId: params.priceId, quantity: 1 }],
        customer: params.customerEmail ? { email: params.customerEmail } : undefined,
        customData: params.customData || {},
        settings: {
          displayMode: "overlay",
          theme: "light",
          locale: "en",
          successUrl: params.successUrl || `${window.location.origin}/dashboard?payment=success`,
        },
      });
    } catch (err: any) {
      console.error("[Paddle] Checkout opening error:", err);
      window.location.href = "/login";
    }
  };

  return (
    <PaddleContext.Provider value={{ isLoaded, openCheckout }}>
      <Script
        src="https://cdn.paddle.com/paddle/v2/paddle.js"
        strategy="afterInteractive"
        onLoad={initPaddle}
      />
      {children}
    </PaddleContext.Provider>
  );
}

export function usePaddle() {
  return useContext(PaddleContext);
}
