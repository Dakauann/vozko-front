export const CARRIER_CHANNELS = ["rcs", "sms"] as const;
export type CarrierChannel = (typeof CARRIER_CHANNELS)[number];

export interface CarrierWhatsAppFallback {
  actor_id: string;
  business_phone_id: string;
  template_id: string;
  body_params?: string[];
  header_params?: string[];
}

export interface CarrierFallbackSpec {
  whatsapp?: CarrierWhatsAppFallback;
  sms_route_id?: string;
  sms_text?: string;
}

export interface CarrierPrice<Kind extends string = string> {
  charge_kind: Kind;
  unit_micros: number;
  quantity: number;
  total_micros: number;
}

export interface CarrierChannelAutomation {
  agent_id: string | null;
  workflow_id: string | null;
  enable_agent_responses: boolean;
  enable_workflow: boolean;
  enable_analysis: boolean;
  enable_auto_staging: boolean;
  enable_auto_memory: boolean;
  disclosure: string;
}

export interface CarrierInboxSettings {
  department_id: string | null;
  pipeline_id: string | null;
  automation: CarrierChannelAutomation;
}
