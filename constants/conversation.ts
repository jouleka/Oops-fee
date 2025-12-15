export interface Message {
  id: number;
  type: 'date' | 'sent' | 'received';
  text: string;
}

export const CONVERSATION: Message[] = [
  { id: 0, type: 'date', text: '3 months ago' },
  { id: 1, type: 'sent', text: 'Starting my workout plan tomorrow 💪' },
  { id: 2, type: 'sent', text: 'This time for real' },
  { id: 3, type: 'date', text: '2 months ago' },
  { id: 4, type: 'sent', text: 'Ok starting NEXT Monday' },
  { id: 5, type: 'sent', text: 'Had a rough week' },
  { id: 6, type: 'date', text: '1 month ago' },
  { id: 7, type: 'sent', text: 'New month new me' },
  { id: 8, type: 'sent', text: 'Going to wake up at 6am every day' },
  { id: 9, type: 'date', text: '2 weeks ago' },
  { id: 10, type: 'sent', text: 'Why am I like this' },
  { id: 11, type: 'date', text: 'Yesterday' },
  { id: 12, type: 'sent', text: "Found this app that charges you money if you don't follow through" },
  { id: 13, type: 'sent', text: 'Kinda scared ngl' },
  { id: 14, type: 'date', text: 'Today' },
  { id: 15, type: 'received', text: 'So are you actually going to do it this time?' },
  { id: 16, type: 'received', text: "Or is this just another \"I'll start Monday\" moment" },
];

// Timing config
export const TIMING = {
  DATE_DELAY: 400,
  TYPING_DURATION: 900,
  PAUSE_BETWEEN: 300,
} as const;

export const CTA_HEIGHT = 220;

export const REPLY_TEXT = "No. I'm putting money on it this time.";
