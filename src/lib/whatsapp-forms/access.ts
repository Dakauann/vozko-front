import type { ResourceAction, ResourceType } from "@/lib/workspace/types";

export type Can = (resource: ResourceType, action: ResourceAction) => boolean;

export interface FormAccess {
  view: boolean;
  create: boolean;
  edit: boolean;
  publish: boolean;
  archive: boolean;
  send: boolean;
  responses: boolean;
  sensitive: boolean;
  exportResponses: boolean;
  deleteResponses: boolean;
}

export function formAccess(can: Can): FormAccess {
  const view = can("whatsapp_forms", "read");
  const responses = can("whatsapp_form_responses", "read");
  return {
    view,
    create: can("whatsapp_forms", "create"),
    edit: view && can("whatsapp_forms", "update"),
    publish: view && can("whatsapp_forms", "configure"),
    archive: view && can("whatsapp_forms", "delete"),
    send: can("whatsapp_forms", "send"),
    responses,
    sensitive: responses && can("whatsapp_form_responses", "read_sensitive"),
    exportResponses: responses && can("whatsapp_form_responses", "export"),
    deleteResponses: responses && can("whatsapp_form_responses", "delete"),
  };
}
