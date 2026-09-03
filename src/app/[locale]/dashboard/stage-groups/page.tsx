import { redirect } from "@/i18n/routing";
import { getLocale } from "next-intl/server";

/**
 * Stage groups were retired; funnels replaced them.
 *
 * A group was always a one-to-one shadow of a conversation funnel — the pipelines
 * row it stamped, enforced unique per group — but only the group could be created
 * from the UI, and only by way of a campaign. Funnels are now created directly,
 * with the operator drawing their own columns.
 *
 * This route stays as a redirect rather than a 404: it was in the sidebar for a
 * long time and people have it bookmarked. It points at /dashboard/funnels, the
 * surface that does what they came here to do — sending them to the inbox
 * instead, as it did at first, answered a configuration question with a queue.
 *
 * The stage_groups tables and the /stage-groups API are untouched — existing
 * groups keep working, each already backed by a funnel (see the
 * stg_materialize_stage_group_pipelines repair), and integrations may still
 * create campaigns with stageGroupId.
 */
export default async function StageGroupsPage() {
  const locale = await getLocale();
  redirect({ href: "/dashboard/funnels", locale });
}
