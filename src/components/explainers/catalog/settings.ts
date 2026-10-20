import {
  ArrowsClockwise,
  Bell,
  BellSlash,
  Brain,
  ChartPie,
  ChatCircleDots,
  ChatsCircle,
  ChatText,
  CheckCircle,
  Clock,
  ClockCountdown,
  ClockCounterClockwise,
  Crown,
  CursorClick,
  Desktop,
  DownloadSimple,
  EnvelopeSimple,
  FlagCheckered,
  Globe,
  Handshake,
  Headset,
  Hourglass,
  Kanban,
  Lightbulb,
  ListBullets,
  ListNumbers,
  LockKey,
  MapPin,
  Paperclip,
  PaperPlaneRight,
  PhoneCall,
  Plug,
  Power,
  Queue,
  Robot,
  Scales,
  ShieldCheck,
  Shuffle,
  Sliders,
  Sparkle,
  SpeakerHigh,
  Stack,
  User,
  UserCheck,
  UsersThree,
  WhatsappLogo,
  WifiHigh,
} from "@/components/icons";

import type { ExplainerArea } from "./types";

export const settingsExplainers = {
  notificationEmail: {
    icon: EnvelopeSimple,
    scene: {
      kind: "compare",
      off: { label: "off", rows: [{ icon: Bell, label: "bellOnly" }] },
      on: { label: "on", rows: [{ icon: Bell, label: "bell" }, { icon: EnvelopeSimple, label: "email" }] },
    },
    steps: 3,
    footnote: true,
  },
  notificationDigest: {
    icon: Clock,
    scene: {
      kind: "timeline",
      events: [
        { at: 0.15, icon: Bell, label: "notice" },
        { at: 0.45, icon: Bell, label: "another" },
        { at: 0.9, icon: EnvelopeSimple, label: "digest", tone: "accent" },
      ],
      start: "start",
      end: "end",
    },
    steps: 3,
    footnote: true,
  },
  adminsInRoulette: {
    icon: Crown,
    scene: {
      kind: "compare",
      off: { label: "off", rows: [{ icon: UsersThree, label: "staffOnly" }, { label: "adminsOut" }] },
      on: { label: "on", rows: [{ label: "staff" }, { label: "admins" }] },
    },
    steps: 3,
  },
  rouletteRescue: {
    icon: ArrowsClockwise,
    scene: {
      kind: "timeline",
      events: [
        { at: 0.1, icon: UserCheck, label: "assigned" },
        { at: 0.5, icon: Hourglass, label: "unopened", tone: "warning" },
        { at: 0.9, icon: ArrowsClockwise, label: "next", tone: "accent" },
      ],
    },
    steps: 3,
    footnote: true,
  },
  rouletteOnline: {
    icon: WifiHigh,
    scene: {
      kind: "fanout",
      source: { icon: ChatCircleDots, label: "conversation" },
      targets: [
        { icon: UserCheck, label: "ana", note: "online" },
        { icon: UserCheck, label: "bruno", note: "online" },
        { icon: User, label: "carla", note: "offline", tone: "muted" },
      ],
      picked: 0,
    },
    steps: 3,
  },
  rouletteLastSeen: {
    icon: ClockCounterClockwise,
    scene: {
      kind: "fanout",
      source: { icon: ChatCircleDots, label: "conversation" },
      targets: [
        { icon: UserCheck, label: "ana", note: "now" },
        { icon: User, label: "bruno", note: "hoursAgo" },
        { icon: User, label: "carla", note: "daysAgo", tone: "muted" },
      ],
      picked: 0,
    },
    steps: 3,
    footnote: true,
  },
  rouletteRoundRobin: {
    icon: ArrowsClockwise,
    scene: {
      kind: "fanout",
      source: { icon: ChatCircleDots, label: "conversation" },
      targets: [
        { icon: User, label: "ana", note: "last", tone: "muted" },
        { icon: User, label: "bruno", note: "next" },
        { icon: User, label: "carla", note: "after" },
      ],
      picked: 1,
    },
    steps: 3,
  },
  roulettePriority: {
    icon: ListNumbers,
    scene: {
      kind: "fanout",
      source: { icon: ChatCircleDots, label: "conversation" },
      targets: [
        { icon: User, label: "ana", note: "tierOne" },
        { icon: User, label: "bruno", note: "tierOne" },
        { icon: User, label: "carla", note: "tierTwo", tone: "muted" },
      ],
      picked: 0,
    },
    steps: 4,
    footnote: true,
  },
  rouletteWeighted: {
    icon: Scales,
    scene: {
      kind: "fanout",
      source: { icon: ChatCircleDots, label: "conversation" },
      targets: [
        { icon: User, label: "ana", note: "weightThree" },
        { icon: User, label: "bruno", note: "weightTwo" },
        { icon: User, label: "carla", note: "weightOne" },
      ],
      picked: 0,
    },
    steps: 3,
    footnote: true,
  },
  rouletteLeastBusy: {
    icon: Stack,
    scene: {
      kind: "fanout",
      source: { icon: ChatCircleDots, label: "conversation" },
      targets: [
        { icon: User, label: "ana", note: "openFour" },
        { icon: User, label: "bruno", note: "openOne" },
        { icon: User, label: "carla", note: "openThree" },
      ],
      picked: 1,
    },
    steps: 3,
    footnote: true,
  },
  rouletteLongestIdle: {
    icon: Hourglass,
    scene: {
      kind: "fanout",
      source: { icon: ChatCircleDots, label: "conversation" },
      targets: [
        { icon: User, label: "ana", note: "minutesAgo" },
        { icon: User, label: "bruno", note: "hoursAgo" },
        { icon: User, label: "carla", note: "halfHourAgo" },
      ],
      picked: 1,
    },
    steps: 3,
  },
  rouletteRandom: {
    icon: Shuffle,
    scene: {
      kind: "fanout",
      source: { icon: Shuffle, label: "draw" },
      targets: [
        { icon: User, label: "ana" },
        { icon: User, label: "bruno" },
        { icon: User, label: "carla", note: "drawn" },
      ],
      picked: 2,
    },
    steps: 2,
  },
  rouletteClaim: {
    icon: CursorClick,
    scene: {
      kind: "flow",
      nodes: [
        { icon: ChatCircleDots, label: "conversation" },
        { icon: UsersThree, label: "team", tone: "muted" },
        { icon: CursorClick, label: "firstOpens", tone: "accent" },
      ],
    },
    steps: 3,
    footnote: true,
  },
  rouletteCapacity: {
    icon: Sliders,
    scene: {
      kind: "fanout",
      source: { icon: ChatCircleDots, label: "conversation" },
      targets: [
        { icon: User, label: "ana", note: "full", tone: "muted" },
        { icon: User, label: "bruno", note: "room" },
        { icon: User, label: "carla", note: "full", tone: "muted" },
      ],
      picked: 1,
    },
    steps: 3,
    footnote: true,
  },
  autoCloseIdle: {
    icon: Hourglass,
    scene: {
      kind: "timeline",
      events: [
        { at: 0.1, icon: ChatText, label: "ourMessage" },
        { at: 0.5, icon: Hourglass, label: "silence", tone: "muted" },
        { at: 0.9, icon: CheckCircle, label: "closed", tone: "accent" },
      ],
    },
    steps: 3,
    footnote: true,
  },
  autoCloseMaxAge: {
    icon: ClockCountdown,
    scene: {
      kind: "timeline",
      events: [
        { at: 0.1, icon: ChatsCircle, label: "lastMessage" },
        { at: 0.5, icon: Hourglass, label: "noMessages", tone: "muted" },
        { at: 0.9, icon: CheckCircle, label: "closed", tone: "accent" },
      ],
    },
    steps: 3,
    footnote: true,
  },
  outcomeCapture: {
    icon: FlagCheckered,
    scene: {
      kind: "flow",
      nodes: [
        { icon: CheckCircle, label: "finish" },
        { icon: ListBullets, label: "outcome" },
        { icon: ChartPie, label: "report", tone: "accent" },
      ],
    },
    steps: 3,
  },
  outcomeRequired: {
    icon: CheckCircle,
    scene: {
      kind: "compare",
      off: { label: "off", rows: [{ icon: CheckCircle, label: "canSkip" }, { label: "noOutcome" }] },
      on: { label: "on", rows: [{ label: "asks" }, { label: "blocks" }] },
    },
    steps: 3,
  },
  workingHours: {
    icon: Clock,
    scene: {
      kind: "compare",
      off: { label: "off", rows: [{ icon: Clock, label: "rescueAlways" }, { icon: Clock, label: "clockAlways" }] },
      on: { label: "on", rows: [{ label: "rescueOpen" }, { label: "clockOpen" }] },
    },
    steps: 3,
    footnote: true,
  },
  channelAutoReply: {
    icon: Robot,
    scene: {
      kind: "flow",
      nodes: [
        { icon: ChatCircleDots, label: "message" },
        { icon: Robot, label: "automation" },
        { icon: PaperPlaneRight, label: "reply", tone: "accent" },
      ],
    },
    steps: 3,
    footnote: true,
  },
  conversationAnalysis: {
    icon: Sparkle,
    scene: {
      kind: "flow",
      nodes: [
        { icon: ChatsCircle, label: "conversation" },
        { icon: Hourglass, label: "pause", tone: "muted" },
        { icon: Sparkle, label: "analysis" },
        { icon: ChartPie, label: "audience", tone: "accent" },
      ],
    },
    steps: 3,
    footnote: true,
  },
  autoStaging: {
    icon: Kanban,
    scene: {
      kind: "flow",
      nodes: [
        { icon: ChatsCircle, label: "conversation" },
        { icon: Brain, label: "decides" },
        { icon: Kanban, label: "stage", tone: "accent" },
      ],
    },
    steps: 3,
  },
  autoMemory: {
    icon: Brain,
    scene: {
      kind: "flow",
      nodes: [
        { icon: ChatsCircle, label: "conversation" },
        { icon: Lightbulb, label: "facts" },
        { icon: Brain, label: "memory", tone: "accent" },
      ],
    },
    steps: 3,
    footnote: true,
  },
  dealAutomation: {
    icon: Handshake,
    scene: {
      kind: "flow",
      nodes: [
        { icon: ChatsCircle, label: "conversation" },
        { icon: Sparkle, label: "analysis" },
        { icon: Handshake, label: "deal", tone: "accent" },
      ],
    },
    steps: 3,
    footnote: true,
  },
  handleGroups: {
    icon: UsersThree,
    scene: {
      kind: "compare",
      off: { label: "off", rows: [{ icon: ChatsCircle, label: "inInbox" }, { label: "noAutomation" }] },
      on: { label: "on", rows: [{ label: "inInbox" }, { label: "automationRuns" }] },
    },
    steps: 3,
  },
  importHistory: {
    icon: ClockCounterClockwise,
    scene: {
      kind: "timeline",
      events: [
        { at: 0.1, icon: Plug, label: "connects" },
        { at: 0.5, icon: DownloadSimple, label: "imports" },
        { at: 0.9, icon: ChatsCircle, label: "inbox", tone: "accent" },
      ],
    },
    steps: 3,
    footnote: true,
  },
  whatsappCalling: {
    icon: PhoneCall,
    scene: {
      kind: "flow",
      nodes: [
        { icon: User, label: "customer" },
        { icon: WhatsappLogo, label: "whatsapp" },
        { icon: Headset, label: "team", tone: "accent" },
      ],
    },
    steps: 3,
    footnote: true,
  },
  sipTrunkEnabled: {
    icon: Power,
    scene: {
      kind: "compare",
      off: { label: "off", rows: [{ label: "disconnected" }, { label: "noCalls" }] },
      on: { label: "on", rows: [{ label: "connected" }, { label: "inDialer" }] },
    },
    steps: 3,
  },
  sipSkipRegistration: {
    icon: ShieldCheck,
    scene: {
      kind: "compare",
      off: { label: "off", rows: [{ icon: LockKey, label: "credentials" }, { icon: Plug, label: "registers" }] },
      on: { label: "on", rows: [{ label: "allowedIp" }, { label: "noRegister" }] },
    },
    steps: 2,
    footnote: true,
  },
  sipStun: {
    icon: Globe,
    scene: {
      kind: "flow",
      nodes: [
        { icon: Desktop, label: "server" },
        { icon: Globe, label: "stun" },
        { icon: MapPin, label: "publicAddress", tone: "accent" },
      ],
    },
    steps: 3,
  },
  webchatHumanRequest: {
    icon: Headset,
    scene: {
      kind: "flow",
      nodes: [
        { icon: User, label: "visitor" },
        { icon: Queue, label: "queue" },
        { icon: UserCheck, label: "agent", tone: "accent" },
      ],
    },
    steps: 3,
  },
  webchatAttachments: {
    icon: Paperclip,
    scene: {
      kind: "compare",
      off: { label: "off", rows: [{ label: "textOnly" }, { label: "filesRefused" }] },
      on: { label: "on", rows: [{ label: "text" }, { label: "files" }] },
    },
    steps: 2,
  },
  webchatActive: {
    icon: ChatCircleDots,
    scene: {
      kind: "compare",
      off: { label: "off", rows: [{ label: "hidden" }, { icon: ChatsCircle, label: "historyKept" }] },
      on: { label: "on", rows: [{ label: "onSites" }, { label: "newChats" }] },
    },
    steps: 2,
    footnote: true,
  },
  messengerGetStarted: {
    icon: CursorClick,
    scene: {
      kind: "flow",
      nodes: [
        { icon: ChatCircleDots, label: "newChat" },
        { icon: CursorClick, label: "start" },
        { icon: Robot, label: "automation", tone: "accent" },
      ],
    },
    steps: 3,
  },
  messengerComposerHidden: {
    icon: ListBullets,
    scene: {
      kind: "compare",
      off: { label: "off", rows: [{ icon: ChatText, label: "typing" }, { icon: ListBullets, label: "menu" }] },
      on: { label: "on", rows: [{ label: "noTyping" }, { label: "menu" }] },
    },
    steps: 2,
  },
  sendCapRemove: {
    icon: LockKey,
    scene: {
      kind: "compare",
      off: { label: "off", rows: [{ icon: LockKey, label: "newLimit" }, { icon: ListBullets, label: "countKept" }] },
      on: { label: "on", rows: [{ label: "noLimit" }, { label: "countCleared" }] },
    },
    steps: 3,
  },
  alertSound: {
    icon: SpeakerHigh,
    scene: {
      kind: "compare",
      off: { label: "off", rows: [{ icon: Bell, label: "silent" }] },
      on: { label: "on", rows: [{ icon: Bell, label: "alert" }, { icon: SpeakerHigh, label: "sound" }] },
    },
    steps: 3,
  },
  desktopAlerts: {
    icon: Desktop,
    scene: {
      kind: "compare",
      off: { label: "off", rows: [{ icon: Bell, label: "insideOnly" }] },
      on: { label: "on", rows: [{ icon: Bell, label: "inside" }, { icon: Desktop, label: "desktop" }] },
    },
    steps: 3,
    footnote: true,
  },
  teamChatMute: {
    icon: BellSlash,
    scene: {
      kind: "compare",
      off: { label: "off", rows: [{ icon: ChatsCircle, label: "everyMessage" }] },
      on: { label: "on", rows: [{ icon: ChatsCircle, label: "mentionsOnly" }] },
    },
    steps: 3,
  },
} satisfies ExplainerArea;
