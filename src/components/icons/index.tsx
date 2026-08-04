/**
 * Icon system.
 *
 * The app draws its icons from Tabler: a uniform 2px-stroke, geometric,
 * square-cornered set that reads as instrument labelling rather than as the
 * rounded, weight-switching marks of the previous identity. Icons carry a large
 * share of a product's visual signature, so the set changes with the world.
 *
 * This module is a COMPATIBILITY LAYER, not a re-export list. It keeps the
 * previous call signature alive on purpose:
 *
 *   - the same ~265 component names the app already imports;
 *   - a `weight` prop that is ACCEPTED AND IGNORED. Tabler has one weight, so
 *     the ~2,300 `weight="fill"|"bold"|"regular"` props across the app keep
 *     compiling and simply stop having an effect. Rewriting them all would have
 *     been thousands of edits for no visual gain.
 *   - `size` as a number, mapped to width/height like the old API.
 *
 * That is what let the provider change in one file instead of 297.
 *
 * GENERATED — do not hand-edit the map below. Regenerate if the icon set moves.
 */
"use client";

import * as React from "react";
import type { Icon as TablerIcon } from "@tabler/icons-react";
import {
  IconActivity,
  IconAdjustments,
  IconAdjustmentsHorizontal,
  IconAlertCircle,
  IconAlertTriangle,
  IconAlignLeft,
  IconArchive,
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconArrowUpRight,
  IconArrowsDownUp,
  IconArrowsLeftRight,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconArrowsShuffle,
  IconBan,
  IconBarcode,
  IconBell,
  IconBellOff,
  IconBold,
  IconBolt,
  IconBookmark,
  IconBraces,
  IconBracketsAngle,
  IconBrain,
  IconBrandGoogle,
  IconBrandInstagram,
  IconBrandTelegram,
  IconBrandWhatsapp,
  IconBroadcast,
  IconBrowser,
  IconBrush,
  IconBuildingBank,
  IconBuildingSkyscraper,
  IconBuildingStore,
  IconBulb,
  IconCalculator,
  IconCalendar,
  IconCalendarCheck,
  IconCamera,
  IconCaretUpDown,
  IconCertificate,
  IconChartBar,
  IconChartDonut,
  IconChartLine,
  IconChartPie,
  IconCheck,
  IconChecks,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconChevronsLeft,
  IconCircle,
  IconCircleCheck,
  IconCirclePlus,
  IconCircleX,
  IconClipboardText,
  IconClock,
  IconClockHour4,
  IconClockPlay,
  IconCode,
  IconCommand,
  IconConfetti,
  IconCopy,
  IconCornerUpLeft,
  IconCrown,
  IconCurrencyDollar,
  IconCurrencyReal,
  IconDatabase,
  IconDeviceDesktop,
  IconDeviceFloppy,
  IconDeviceMobile,
  IconDeviceSim,
  IconDots,
  IconDotsVertical,
  IconDownload,
  IconEdit,
  IconExternalLink,
  IconEye,
  IconEyeOff,
  IconFile,
  IconFileText,
  IconFileTypeCsv,
  IconFiles,
  IconFilter,
  IconFlag,
  IconFlame,
  IconGif,
  IconGitBranch,
  IconGitMerge,
  IconGripVertical,
  IconH1,
  IconH2,
  IconH3,
  IconHash,
  IconHeadset,
  IconHeart,
  IconHeartHandshake,
  IconHelpCircle,
  IconHistory,
  IconHourglass,
  IconId,
  IconInfoCircle,
  IconInvoice,
  IconItalic,
  IconKey,
  IconLayoutGrid,
  IconLayoutKanban,
  IconLeaf,
  IconLink,
  IconList,
  IconListNumbers,
  IconLoader2,
  IconLock,
  IconLogin,
  IconLogout,
  IconMail,
  IconMapPin,
  IconMenu2,
  IconMessage,
  IconMessageCircle,
  IconMessageDots,
  IconMessages,
  IconMicrophone,
  IconMicrophoneOff,
  IconMinus,
  IconMoodNeutral,
  IconMoodSad,
  IconMoodSmile,
  IconMoodWink,
  IconMoon,
  IconMovie,
  IconMusic,
  IconPackage,
  IconPalette,
  IconPaperclip,
  IconPencil,
  IconPhone,
  IconPhoneCall,
  IconPhoneIncoming,
  IconPhoneOff,
  IconPhoneOutgoing,
  IconPhoto,
  IconPhotoOff,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerStop,
  IconPlaylist,
  IconPlug,
  IconPlugConnected,
  IconPlus,
  IconPointer,
  IconPower,
  IconPuzzle,
  IconReceipt,
  IconRefresh,
  IconRobot,
  IconRosetteDiscountCheck,
  IconRotate2,
  IconScale,
  IconSchool,
  IconSearch,
  IconSend,
  IconSettings,
  IconShield,
  IconShieldCheck,
  IconShieldExclamation,
  IconShieldPlus,
  IconSitemap,
  IconSparkles,
  IconSpeakerphone,
  IconSquare,
  IconStack2,
  IconStar,
  IconSun,
  IconTable,
  IconTag,
  IconTarget,
  IconTemperature,
  IconTestPipe,
  IconThumbDown,
  IconThumbUp,
  IconTool,
  IconTopologyStar3,
  IconTrash,
  IconTrendingUp,
  IconTypography,
  IconUnlink,
  IconUpload,
  IconUrgent,
  IconUser,
  IconUserCheck,
  IconUserCircle,
  IconUserCog,
  IconUserMinus,
  IconUserPlus,
  IconUsers,
  IconUsersGroup,
  IconVault,
  IconVideo,
  IconVolume,
  IconVolumeOff,
  IconWallet,
  IconWaveSine,
  IconWaveSquare,
  IconWebhook,
  IconWifi,
  IconWifi2,
  IconWifiOff,
  IconWorld,
  IconX,
} from "@tabler/icons-react";

/** The legacy weight vocabulary. Accepted for source compatibility; ignored. */
export type IconWeight =
  | "thin"
  | "light"
  | "regular"
  | "bold"
  | "fill"
  | "duotone";

export interface IconProps
  extends Omit<React.ComponentPropsWithoutRef<"svg">, "ref"> {
  size?: number | string;
  /** No-op. Tabler ships a single stroke weight. */
  weight?: IconWeight;
  mirrored?: boolean;
  color?: string;
}

export type Icon = React.FC<IconProps>;

/**
 * Wrap a Tabler icon in the old call signature.
 *
 * stroke is pinned to 1.75: Tabler's 2 is a touch heavy beside 13px Archivo at
 * the 14-18px sizes this UI actually renders at.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- `weight` is
// destructured precisely so it is swallowed and never reaches the SVG.
function adapt(Cmp: TablerIcon): Icon {
  const Wrapped: Icon = ({ size, weight: _weight, mirrored, color, style, ...rest }) => (
    <Cmp
      size={typeof size === "string" ? Number.parseFloat(size) || 24 : size}
      color={color}
      stroke={1.75}
      style={mirrored ? { ...style, transform: "scaleX(-1)" } : style}
      {...rest}
    />
  );
  Wrapped.displayName = (Cmp as unknown as { displayName?: string }).displayName;
  return Wrapped;
}

export const Archive: Icon = /*#__PURE__*/ adapt(IconArchive);
export const ArrowBendUpLeft: Icon = /*#__PURE__*/ adapt(IconCornerUpLeft);
export const ArrowClockwise: Icon = /*#__PURE__*/ adapt(IconRefresh);
export const ArrowCounterClockwise: Icon = /*#__PURE__*/ adapt(IconRotate2);
export const ArrowDown: Icon = /*#__PURE__*/ adapt(IconArrowDown);
export const ArrowLeft: Icon = /*#__PURE__*/ adapt(IconArrowLeft);
export const ArrowRight: Icon = /*#__PURE__*/ adapt(IconArrowRight);
export const ArrowSquareOut: Icon = /*#__PURE__*/ adapt(IconExternalLink);
export const ArrowUp: Icon = /*#__PURE__*/ adapt(IconArrowUp);
export const ArrowUpRight: Icon = /*#__PURE__*/ adapt(IconArrowUpRight);
export const ArrowsClockwise: Icon = /*#__PURE__*/ adapt(IconRefresh);
export const ArrowsDownUp: Icon = /*#__PURE__*/ adapt(IconArrowsDownUp);
export const ArrowsInSimple: Icon = /*#__PURE__*/ adapt(IconArrowsMinimize);
export const ArrowsLeftRight: Icon = /*#__PURE__*/ adapt(IconArrowsLeftRight);
export const ArrowsOut: Icon = /*#__PURE__*/ adapt(IconArrowsMaximize);
export const ArrowsOutSimple: Icon = /*#__PURE__*/ adapt(IconArrowsMaximize);
export const Bank: Icon = /*#__PURE__*/ adapt(IconBuildingBank);
export const Barcode: Icon = /*#__PURE__*/ adapt(IconBarcode);
export const Bell: Icon = /*#__PURE__*/ adapt(IconBell);
export const BellSlash: Icon = /*#__PURE__*/ adapt(IconBellOff);
export const Bookmark: Icon = /*#__PURE__*/ adapt(IconBookmark);
export const BracketsAngle: Icon = /*#__PURE__*/ adapt(IconBracketsAngle);
export const BracketsCurly: Icon = /*#__PURE__*/ adapt(IconBraces);
export const Brain: Icon = /*#__PURE__*/ adapt(IconBrain);
export const Broadcast: Icon = /*#__PURE__*/ adapt(IconBroadcast);
export const Browser: Icon = /*#__PURE__*/ adapt(IconBrowser);
export const Buildings: Icon = /*#__PURE__*/ adapt(IconBuildingSkyscraper);
export const Calculator: Icon = /*#__PURE__*/ adapt(IconCalculator);
export const Calendar: Icon = /*#__PURE__*/ adapt(IconCalendar);
export const CalendarBlank: Icon = /*#__PURE__*/ adapt(IconCalendar);
export const CalendarCheck: Icon = /*#__PURE__*/ adapt(IconCalendarCheck);
export const Camera: Icon = /*#__PURE__*/ adapt(IconCamera);
export const CaretDown: Icon = /*#__PURE__*/ adapt(IconChevronDown);
export const CaretLeft: Icon = /*#__PURE__*/ adapt(IconChevronLeft);
export const CaretLineLeft: Icon = /*#__PURE__*/ adapt(IconChevronsLeft);
export const CaretRight: Icon = /*#__PURE__*/ adapt(IconChevronRight);
export const CaretUp: Icon = /*#__PURE__*/ adapt(IconChevronUp);
export const CaretUpDown: Icon = /*#__PURE__*/ adapt(IconCaretUpDown);
export const Certificate: Icon = /*#__PURE__*/ adapt(IconCertificate);
export const ChartBar: Icon = /*#__PURE__*/ adapt(IconChartBar);
export const ChartDonut: Icon = /*#__PURE__*/ adapt(IconChartDonut);
export const ChartLine: Icon = /*#__PURE__*/ adapt(IconChartLine);
export const ChartLineUp: Icon = /*#__PURE__*/ adapt(IconTrendingUp);
export const ChartPie: Icon = /*#__PURE__*/ adapt(IconChartPie);
export const ChatCenteredDots: Icon = /*#__PURE__*/ adapt(IconMessageDots);
export const ChatCircle: Icon = /*#__PURE__*/ adapt(IconMessageCircle);
export const ChatCircleDots: Icon = /*#__PURE__*/ adapt(IconMessageCircle);
export const ChatTeardropDots: Icon = /*#__PURE__*/ adapt(IconMessageDots);
export const ChatText: Icon = /*#__PURE__*/ adapt(IconMessage);
export const ChatsCircle: Icon = /*#__PURE__*/ adapt(IconMessages);
export const Check: Icon = /*#__PURE__*/ adapt(IconCheck);
export const CheckCircle: Icon = /*#__PURE__*/ adapt(IconCircleCheck);
export const Checks: Icon = /*#__PURE__*/ adapt(IconChecks);
export const Circle: Icon = /*#__PURE__*/ adapt(IconCircle);
export const CircleNotch: Icon = /*#__PURE__*/ adapt(IconLoader2);
export const ClipboardText: Icon = /*#__PURE__*/ adapt(IconClipboardText);
export const Clock: Icon = /*#__PURE__*/ adapt(IconClock);
export const ClockCountdown: Icon = /*#__PURE__*/ adapt(IconClockPlay);
export const ClockCounterClockwise: Icon = /*#__PURE__*/ adapt(IconHistory);
export const Code: Icon = /*#__PURE__*/ adapt(IconCode);
export const Command: Icon = /*#__PURE__*/ adapt(IconCommand);
export const Confetti: Icon = /*#__PURE__*/ adapt(IconConfetti);
export const Copy: Icon = /*#__PURE__*/ adapt(IconCopy);
export const CopySimple: Icon = /*#__PURE__*/ adapt(IconCopy);
export const Crown: Icon = /*#__PURE__*/ adapt(IconCrown);
export const CrownSimple: Icon = /*#__PURE__*/ adapt(IconCrown);
export const CurrencyDollar: Icon = /*#__PURE__*/ adapt(IconCurrencyDollar);
export const Cursor: Icon = /*#__PURE__*/ adapt(IconPointer);
export const CursorClick: Icon = /*#__PURE__*/ adapt(IconPointer);
export const Database: Icon = /*#__PURE__*/ adapt(IconDatabase);
export const Desktop: Icon = /*#__PURE__*/ adapt(IconDeviceDesktop);
export const DeviceMobile: Icon = /*#__PURE__*/ adapt(IconDeviceMobile);
export const DeviceMobileCamera: Icon = /*#__PURE__*/ adapt(IconDeviceMobile);
export const DotsSixVertical: Icon = /*#__PURE__*/ adapt(IconGripVertical);
export const DotsThree: Icon = /*#__PURE__*/ adapt(IconDots);
export const DotsThreeOutline: Icon = /*#__PURE__*/ adapt(IconDots);
export const DotsThreeVertical: Icon = /*#__PURE__*/ adapt(IconDotsVertical);
export const DownloadSimple: Icon = /*#__PURE__*/ adapt(IconDownload);
export const Envelope: Icon = /*#__PURE__*/ adapt(IconMail);
export const EnvelopeSimple: Icon = /*#__PURE__*/ adapt(IconMail);
export const Equalizer: Icon = /*#__PURE__*/ adapt(IconAdjustmentsHorizontal);
export const Eye: Icon = /*#__PURE__*/ adapt(IconEye);
export const EyeClosedIcon: Icon = /*#__PURE__*/ adapt(IconEyeOff);
export const EyeSlash: Icon = /*#__PURE__*/ adapt(IconEyeOff);
export const Faders: Icon = /*#__PURE__*/ adapt(IconAdjustments);
export const File: Icon = /*#__PURE__*/ adapt(IconFile);
export const FileCsv: Icon = /*#__PURE__*/ adapt(IconFileTypeCsv);
export const FileText: Icon = /*#__PURE__*/ adapt(IconFileText);
export const Files: Icon = /*#__PURE__*/ adapt(IconFiles);
export const FilmSlate: Icon = /*#__PURE__*/ adapt(IconMovie);
export const FilmStrip: Icon = /*#__PURE__*/ adapt(IconMovie);
export const Fire: Icon = /*#__PURE__*/ adapt(IconFlame);
export const FlagCheckered: Icon = /*#__PURE__*/ adapt(IconFlag);
export const FloppyDisk: Icon = /*#__PURE__*/ adapt(IconDeviceFloppy);
export const FlowArrow: Icon = /*#__PURE__*/ adapt(IconTopologyStar3);
export const Funnel: Icon = /*#__PURE__*/ adapt(IconFilter);
export const FunnelSimple: Icon = /*#__PURE__*/ adapt(IconFilter);
export const Gear: Icon = /*#__PURE__*/ adapt(IconSettings);
export const GearSix: Icon = /*#__PURE__*/ adapt(IconSettings);
export const Gif: Icon = /*#__PURE__*/ adapt(IconGif);
export const GitBranch: Icon = /*#__PURE__*/ adapt(IconGitBranch);
export const GitMerge: Icon = /*#__PURE__*/ adapt(IconGitMerge);
export const Globe: Icon = /*#__PURE__*/ adapt(IconWorld);
export const GlobeHemisphereWest: Icon = /*#__PURE__*/ adapt(IconWorld);
export const GlobeSimple: Icon = /*#__PURE__*/ adapt(IconWorld);
export const GoogleLogo: Icon = /*#__PURE__*/ adapt(IconBrandGoogle);
export const GraduationCap: Icon = /*#__PURE__*/ adapt(IconSchool);
export const GridFour: Icon = /*#__PURE__*/ adapt(IconLayoutGrid);
export const Handshake: Icon = /*#__PURE__*/ adapt(IconHeartHandshake);
export const Hash: Icon = /*#__PURE__*/ adapt(IconHash);
export const Headset: Icon = /*#__PURE__*/ adapt(IconHeadset);
export const Heart: Icon = /*#__PURE__*/ adapt(IconHeart);
export const Hourglass: Icon = /*#__PURE__*/ adapt(IconHourglass);
export const HourglassMedium: Icon = /*#__PURE__*/ adapt(IconHourglass);
export const IdentificationBadge: Icon = /*#__PURE__*/ adapt(IconId);
export const IdentificationCard: Icon = /*#__PURE__*/ adapt(IconId);
export const Image: Icon = /*#__PURE__*/ adapt(IconPhoto);
export const ImageBroken: Icon = /*#__PURE__*/ adapt(IconPhotoOff);
export const ImageSquare: Icon = /*#__PURE__*/ adapt(IconPhoto);
export const Info: Icon = /*#__PURE__*/ adapt(IconInfoCircle);
export const InstagramLogo: Icon = /*#__PURE__*/ adapt(IconBrandInstagram);
export const Invoice: Icon = /*#__PURE__*/ adapt(IconInvoice);
export const Kanban: Icon = /*#__PURE__*/ adapt(IconLayoutKanban);
export const Key: Icon = /*#__PURE__*/ adapt(IconKey);
export const Leaf: Icon = /*#__PURE__*/ adapt(IconLeaf);
export const Lightbulb: Icon = /*#__PURE__*/ adapt(IconBulb);
export const Lightning: Icon = /*#__PURE__*/ adapt(IconBolt);
export const Link: Icon = /*#__PURE__*/ adapt(IconLink);
export const LinkBreak: Icon = /*#__PURE__*/ adapt(IconUnlink);
export const LinkSimple: Icon = /*#__PURE__*/ adapt(IconLink);
export const LinkSimpleBreak: Icon = /*#__PURE__*/ adapt(IconUnlink);
export const List: Icon = /*#__PURE__*/ adapt(IconMenu2);
export const ListBullets: Icon = /*#__PURE__*/ adapt(IconList);
export const ListDashes: Icon = /*#__PURE__*/ adapt(IconList);
export const ListNumbers: Icon = /*#__PURE__*/ adapt(IconListNumbers);
export const Lock: Icon = /*#__PURE__*/ adapt(IconLock);
export const LockIcon: Icon = /*#__PURE__*/ adapt(IconLock);
export const LockKey: Icon = /*#__PURE__*/ adapt(IconLock);
export const MagnifyingGlass: Icon = /*#__PURE__*/ adapt(IconSearch);
export const MapPin: Icon = /*#__PURE__*/ adapt(IconMapPin);
export const Megaphone: Icon = /*#__PURE__*/ adapt(IconSpeakerphone);
export const Microphone: Icon = /*#__PURE__*/ adapt(IconMicrophone);
export const MicrophoneSlash: Icon = /*#__PURE__*/ adapt(IconMicrophoneOff);
export const Minus: Icon = /*#__PURE__*/ adapt(IconMinus);
export const Monitor: Icon = /*#__PURE__*/ adapt(IconDeviceDesktop);
export const MonitorPlay: Icon = /*#__PURE__*/ adapt(IconDeviceDesktop);
export const Moon: Icon = /*#__PURE__*/ adapt(IconMoon);
export const MusicNotes: Icon = /*#__PURE__*/ adapt(IconMusic);
export const NotePencil: Icon = /*#__PURE__*/ adapt(IconEdit);
export const Package: Icon = /*#__PURE__*/ adapt(IconPackage);
export const PaintBrush: Icon = /*#__PURE__*/ adapt(IconBrush);
export const Palette: Icon = /*#__PURE__*/ adapt(IconPalette);
export const PaperPlaneRight: Icon = /*#__PURE__*/ adapt(IconSend);
export const PaperPlaneTilt: Icon = /*#__PURE__*/ adapt(IconSend);
export const Paperclip: Icon = /*#__PURE__*/ adapt(IconPaperclip);
export const Pause: Icon = /*#__PURE__*/ adapt(IconPlayerPause);
export const PauseCircle: Icon = /*#__PURE__*/ adapt(IconPlayerPause);
export const Pencil: Icon = /*#__PURE__*/ adapt(IconPencil);
export const PencilSimple: Icon = /*#__PURE__*/ adapt(IconPencil);
export const Person: Icon = /*#__PURE__*/ adapt(IconUser);
export const Phone: Icon = /*#__PURE__*/ adapt(IconPhone);
export const PhoneCall: Icon = /*#__PURE__*/ adapt(IconPhoneCall);
export const PhoneDisconnect: Icon = /*#__PURE__*/ adapt(IconPhoneOff);
export const PhoneIncoming: Icon = /*#__PURE__*/ adapt(IconPhoneIncoming);
export const PhoneOutgoing: Icon = /*#__PURE__*/ adapt(IconPhoneOutgoing);
export const PhoneSlash: Icon = /*#__PURE__*/ adapt(IconPhoneOff);
export const PixLogo: Icon = /*#__PURE__*/ adapt(IconCurrencyReal);
export const Play: Icon = /*#__PURE__*/ adapt(IconPlayerPlay);
export const PlayCircle: Icon = /*#__PURE__*/ adapt(IconPlayerPlay);
export const Plug: Icon = /*#__PURE__*/ adapt(IconPlug);
export const Plugs: Icon = /*#__PURE__*/ adapt(IconPlug);
export const PlugsConnected: Icon = /*#__PURE__*/ adapt(IconPlugConnected);
export const Plus: Icon = /*#__PURE__*/ adapt(IconPlus);
export const PlusCircle: Icon = /*#__PURE__*/ adapt(IconCirclePlus);
export const Power: Icon = /*#__PURE__*/ adapt(IconPower);
export const Prohibit: Icon = /*#__PURE__*/ adapt(IconBan);
export const Pulse: Icon = /*#__PURE__*/ adapt(IconActivity);
export const PuzzlePiece: Icon = /*#__PURE__*/ adapt(IconPuzzle);
export const Question: Icon = /*#__PURE__*/ adapt(IconHelpCircle);
export const Queue: Icon = /*#__PURE__*/ adapt(IconPlaylist);
export const Receipt: Icon = /*#__PURE__*/ adapt(IconReceipt);
export const Robot: Icon = /*#__PURE__*/ adapt(IconRobot);
export const Scales: Icon = /*#__PURE__*/ adapt(IconScale);
export const SealCheck: Icon = /*#__PURE__*/ adapt(IconRosetteDiscountCheck);
export const Shield: Icon = /*#__PURE__*/ adapt(IconShield);
export const ShieldCheck: Icon = /*#__PURE__*/ adapt(IconShieldCheck);
export const ShieldPlus: Icon = /*#__PURE__*/ adapt(IconShieldPlus);
export const ShieldWarning: Icon = /*#__PURE__*/ adapt(IconShieldExclamation);
export const Shuffle: Icon = /*#__PURE__*/ adapt(IconArrowsShuffle);
export const SignIn: Icon = /*#__PURE__*/ adapt(IconLogin);
export const SignOut: Icon = /*#__PURE__*/ adapt(IconLogout);
export const SimCard: Icon = /*#__PURE__*/ adapt(IconDeviceSim);
export const Siren: Icon = /*#__PURE__*/ adapt(IconUrgent);
export const Sliders: Icon = /*#__PURE__*/ adapt(IconAdjustments);
export const SlidersHorizontal: Icon = /*#__PURE__*/ adapt(IconAdjustmentsHorizontal);
export const Smiley: Icon = /*#__PURE__*/ adapt(IconMoodSmile);
export const SmileyMeh: Icon = /*#__PURE__*/ adapt(IconMoodNeutral);
export const SmileySad: Icon = /*#__PURE__*/ adapt(IconMoodSad);
export const SmileyWink: Icon = /*#__PURE__*/ adapt(IconMoodWink);
export const Sparkle: Icon = /*#__PURE__*/ adapt(IconSparkles);
export const SpeakerHigh: Icon = /*#__PURE__*/ adapt(IconVolume);
export const SpeakerSlash: Icon = /*#__PURE__*/ adapt(IconVolumeOff);
export const Spinner: Icon = /*#__PURE__*/ adapt(IconLoader2);
export const SpinnerGap: Icon = /*#__PURE__*/ adapt(IconLoader2);
export const Square: Icon = /*#__PURE__*/ adapt(IconSquare);
export const SquaresFour: Icon = /*#__PURE__*/ adapt(IconLayoutGrid);
export const Stack: Icon = /*#__PURE__*/ adapt(IconStack2);
export const Star: Icon = /*#__PURE__*/ adapt(IconStar);
export const Stop: Icon = /*#__PURE__*/ adapt(IconPlayerStop);
export const StopCircle: Icon = /*#__PURE__*/ adapt(IconPlayerStop);
export const Storefront: Icon = /*#__PURE__*/ adapt(IconBuildingStore);
export const Sun: Icon = /*#__PURE__*/ adapt(IconSun);
export const Table: Icon = /*#__PURE__*/ adapt(IconTable);
export const Tag: Icon = /*#__PURE__*/ adapt(IconTag);
export const TagChevron: Icon = /*#__PURE__*/ adapt(IconTag);
export const TagSimple: Icon = /*#__PURE__*/ adapt(IconTag);
export const Target: Icon = /*#__PURE__*/ adapt(IconTarget);
export const TelegramLogo: Icon = /*#__PURE__*/ adapt(IconBrandTelegram);
export const TestTube: Icon = /*#__PURE__*/ adapt(IconTestPipe);
export const TextAa: Icon = /*#__PURE__*/ adapt(IconTypography);
export const TextAlignLeft: Icon = /*#__PURE__*/ adapt(IconAlignLeft);
export const TextB: Icon = /*#__PURE__*/ adapt(IconBold);
export const TextHOne: Icon = /*#__PURE__*/ adapt(IconH1);
export const TextHThree: Icon = /*#__PURE__*/ adapt(IconH3);
export const TextHTwo: Icon = /*#__PURE__*/ adapt(IconH2);
export const TextItalic: Icon = /*#__PURE__*/ adapt(IconItalic);
export const TextT: Icon = /*#__PURE__*/ adapt(IconTypography);
export const ThermometerSimple: Icon = /*#__PURE__*/ adapt(IconTemperature);
export const ThumbsDown: Icon = /*#__PURE__*/ adapt(IconThumbDown);
export const ThumbsUp: Icon = /*#__PURE__*/ adapt(IconThumbUp);
export const Timer: Icon = /*#__PURE__*/ adapt(IconClockHour4);
export const Trash: Icon = /*#__PURE__*/ adapt(IconTrash);
export const TrashSimple: Icon = /*#__PURE__*/ adapt(IconTrash);
export const TreeStructure: Icon = /*#__PURE__*/ adapt(IconSitemap);
export const TrendUp: Icon = /*#__PURE__*/ adapt(IconTrendingUp);
export const Upload: Icon = /*#__PURE__*/ adapt(IconUpload);
export const UploadSimple: Icon = /*#__PURE__*/ adapt(IconUpload);
export const User: Icon = /*#__PURE__*/ adapt(IconUser);
export const UserCheck: Icon = /*#__PURE__*/ adapt(IconUserCheck);
export const UserCircle: Icon = /*#__PURE__*/ adapt(IconUserCircle);
export const UserCirclePlus: Icon = /*#__PURE__*/ adapt(IconUserPlus);
export const UserGear: Icon = /*#__PURE__*/ adapt(IconUserCog);
export const UserMinus: Icon = /*#__PURE__*/ adapt(IconUserMinus);
export const UserPlus: Icon = /*#__PURE__*/ adapt(IconUserPlus);
export const Users: Icon = /*#__PURE__*/ adapt(IconUsers);
export const UsersFour: Icon = /*#__PURE__*/ adapt(IconUsersGroup);
export const UsersThree: Icon = /*#__PURE__*/ adapt(IconUsers);
export const Vault: Icon = /*#__PURE__*/ adapt(IconVault);
export const Video: Icon = /*#__PURE__*/ adapt(IconVideo);
export const VideoCamera: Icon = /*#__PURE__*/ adapt(IconVideo);
export const Wallet: Icon = /*#__PURE__*/ adapt(IconWallet);
export const Warning: Icon = /*#__PURE__*/ adapt(IconAlertTriangle);
export const WarningCircle: Icon = /*#__PURE__*/ adapt(IconAlertCircle);
export const WaveSquare: Icon = /*#__PURE__*/ adapt(IconWaveSquare);
export const Waveform: Icon = /*#__PURE__*/ adapt(IconWaveSine);
export const WebhooksLogo: Icon = /*#__PURE__*/ adapt(IconWebhook);
export const WhatsappLogo: Icon = /*#__PURE__*/ adapt(IconBrandWhatsapp);
export const WifiHigh: Icon = /*#__PURE__*/ adapt(IconWifi);
export const WifiMedium: Icon = /*#__PURE__*/ adapt(IconWifi2);
export const WifiSlash: Icon = /*#__PURE__*/ adapt(IconWifiOff);
export const Wrench: Icon = /*#__PURE__*/ adapt(IconTool);
export const X: Icon = /*#__PURE__*/ adapt(IconX);
export const XCircle: Icon = /*#__PURE__*/ adapt(IconCircleX);

// Late additions: call sites that use the Icon-suffixed or aliased forms.
export const Download: Icon = /*#__PURE__*/ adapt(IconDownload);
export const DownloadIcon: Icon = /*#__PURE__*/ adapt(IconDownload);
export const SubsetProperOfIcon: Icon = /*#__PURE__*/ adapt(IconArrowsMaximize);
