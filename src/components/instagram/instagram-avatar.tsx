"use client";

import { ChannelAvatarImage } from "@/components/channels/channel-avatar-image";
import { instagramAvatarUrl } from "@/app/actions/instagram";

interface Props {
  accountId: string;
  username: string;
  className?: string;
  textClassName?: string;
}

export function InstagramAvatar({ accountId, username, className, textClassName }: Props) {
  return (
    <ChannelAvatarImage
      url={instagramAvatarUrl(accountId)}
      authenticated
      name={username}
      seed={username.trim() || accountId}
      className={className}
      textClassName={textClassName}
    />
  );
}
