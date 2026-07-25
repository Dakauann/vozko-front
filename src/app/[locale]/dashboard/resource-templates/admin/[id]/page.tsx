"use client";

import TemplateForm from "../TemplateForm";
import { useParams } from "next/navigation";

export default function EditTemplatePage() {
  const params = useParams();
  const id = params?.id as string;

  return <TemplateForm templateId={id} />;
}
