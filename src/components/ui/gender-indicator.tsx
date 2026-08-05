"use client";

import { User, Users } from "@/components/icons";

import React from "react";
import { cn } from "@/lib/utils";

interface GenderIndicatorProps {
  gender?: string;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  showText?: boolean;
  className?: string;
}

const GenderIndicator: React.FC<GenderIndicatorProps> = ({
  gender,
  size = "md",
  showIcon = true,
  showText = true,
  className,
}) => {
  const normalizedGender = gender?.toLowerCase().trim();

  const getGenderInfo = () => {
    switch (normalizedGender) {
      case "male":
      case "m":
      case "masculino":
      case "homme":
      case "hombre":
      case "mann":
      case "uomo":
      case "homem":
        return {
          type: "male",
          label: "Masculino",
          bgColor: "bg-primary/15/30",
          textColor: "text-primary-ink dark:text-info",
          borderColor: "border-info/20 dark:border-info",
          icon: <User className="h-3 w-3" weight="fill" />,
        };

      case "female":
      case "f":
      case "feminino":
      case "femme":
      case "mujer":
      case "frau":
      case "donna":
      case "mulher":
        return {
          type: "female",
          label: "Feminino",
          bgColor: "bg-chart-4/15 dark:bg-chart-4/30",
          textColor: "text-chart-4 dark:text-chart-4",
          borderColor: "border-chart-4/20 dark:border-chart-4",
          icon: <Users className="h-3 w-3" weight="fill" />,
        };

      default:
        return {
          type: "unknown",
          label: "Indefinido",
          bgColor: "bg-muted",
          textColor: "text-muted-foreground",
          borderColor: "border-border",
          icon: <User className="h-3 w-3" weight="fill" />,
        };
    }
  };

  const genderInfo = getGenderInfo();

  const sizeConfig = {
    sm: {
      padding: "px-2 py-1",
      text: "text-xs",
      spacing: "space-x-1",
    },
    md: {
      padding: "px-2.5 py-1.5",
      text: "text-xs",
      spacing: "space-x-1.5",
    },
    lg: {
      padding: "px-3 py-2",
      text: "text-sm",
      spacing: "space-x-2",
    },
  };

  const config = sizeConfig[size];

  if (!gender || genderInfo.type === "unknown") {
    return null;
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border transition-colors",
        config.padding,
        config.text,
        config.spacing,
        genderInfo.bgColor,
        genderInfo.textColor,
        genderInfo.borderColor,
        className
      )}
      title={`Gênero: ${genderInfo.label}`}
    >
      {showIcon && <span className="flex-shrink-0">{genderInfo.icon}</span>}
      {showText && <span className="font-medium">{genderInfo.label}</span>}
    </div>
  );
};

export default GenderIndicator;
