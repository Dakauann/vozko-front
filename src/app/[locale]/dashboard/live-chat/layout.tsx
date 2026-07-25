"use client";

import FeaturePageLayout from "@/components/FeaturePageLayout";
import TourGuide from "@/components/TourGuide";
import { liveChatTourSteps, liveChatTourPalette, liveChatTourSeed } from "@/data/tour-live-chat";

export default function LiveChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FeaturePageLayout featureKey="liveChat">
      <TourGuide
        steps={liveChatTourSteps}
        storageKey="tour_dismissed_live_chat"
        i18nNamespace="tourLiveChat"
        introPalette={liveChatTourPalette}
        introSeed={liveChatTourSeed}
      />
      {children}
    </FeaturePageLayout>
  );
}
