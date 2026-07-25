
export interface SystemConfig {

    baseSystemPrompt?: string;




    maxConcurrentCalls?: number;


    workTimeEnabled?: boolean;


    workTimeStart?: string;


    workTimeEnd?: string;
}


export type UpdateSystemConfigPayload = Partial<SystemConfig>;


export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
    baseSystemPrompt: "",
    maxConcurrentCalls: 30,
    workTimeEnabled: false,
    workTimeStart: "08:00",
    workTimeEnd: "20:00",
};
