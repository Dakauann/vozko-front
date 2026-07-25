import type React from "react";

export type MonthlyYearlyTabVariant = "monthly" | "yearly";

export interface MonthlyYearlyTabProps {
    variant?: MonthlyYearlyTabVariant;
    onMonthlyClick: React.MouseEventHandler<HTMLButtonElement>;
    onYearlyClick: React.MouseEventHandler<HTMLButtonElement>;
    discount?: string;
    className?: string;
}

export interface PricingPlan {
    planName: string;
    monthlyPrice: string;
    yearlyPrice: string;
    planDescription: string;
    showPopularTag: boolean;
    buttonVariant: "primary" | "secondary";
    features: string[];
}

export type PricingVariant = MonthlyYearlyTabVariant | "mobile-v1" | "mobile-v2";

export interface PricingProps {
    variant?: PricingVariant;
    className?: string;
}