import type { ReminderChannel } from "@prisma/client";
import type { ChannelAdapter } from "./types";
import { inAppChannel } from "./inApp";
import { emailChannel } from "./email";
import { whatsappChannel } from "./whatsapp";
import { pushChannel } from "./push";
import { browserPushChannel } from "./browserPush";

export const channelRegistry: Record<ReminderChannel, ChannelAdapter> = {
  IN_APP: inAppChannel,
  EMAIL: emailChannel,
  WHATSAPP: whatsappChannel,
  PUSH: pushChannel,
  BROWSER_PUSH: browserPushChannel,
};

export * from "./types";
