export interface StageGroupItem {
    id: string;
    stageGroupId: string;
    name: string;
    description: string;
    color: string;
    position: number;
}

export interface StageGroup {
    id: string;
    workspaceId: string;
    name: string;
    items: StageGroupItem[];
}

export interface CreateStageGroupInput {
    name: string;
    items: Omit<StageGroupItem, 'id' | 'stageGroupId'>[];
}

export interface UpdateStageGroupInput {
    name?: string;
    items?: Omit<StageGroupItem, 'id' | 'stageGroupId'>[];
}
