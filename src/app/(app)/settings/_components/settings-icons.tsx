import * as React from "react";

/*
  One mark per setting, drawn for this list rather than borrowed: the navigator
  used to give every row in a group the same stock icon (three map pins, three
  dashboards), so the icon told you nothing. Each of these is a few strokes on
  a 24 grid at one weight, so the column reads as a set.
*/
const P: Record<string, React.ReactNode> = {
  // a stall: awning, walls, door
  business: <><path d="M4.5 10 6 4.5h12L19.5 10" /><path d="M4 10h16" /><path d="M5.5 10v9.5h13V10" /><path d="M10 19.5V14h4v5.5" /></>,
  // a line that climbs
  valuation: <><path d="m4 17.5 5-5 3.5 3.5 7-8" /><path d="M15 8h4.5v4.5" /></>,
  // the Home bento
  "overview-cards": <><rect x="4" y="4" width="7" height="9.5" rx="2" /><rect x="13" y="4" width="7" height="5.5" rx="2" /><rect x="13" y="12" width="7" height="8" rx="2" /><rect x="4" y="16" width="7" height="4" rx="1.6" /></>,
  // a till receipt
  "cost-of-goods": <><path d="M6.5 3.5h11v17l-2.75-1.8L12 20.5l-2.75-1.8L6.5 20.5z" /><path d="M9.5 8.5h5" /><path d="M9.5 12.5h5" /></>,
  // two panes, one seen through the other
  transparency: <><circle cx="9.5" cy="12" r="5.5" /><circle cx="14.5" cy="12" r="5.5" /></>,
  // a premix pouch with its seal
  "premix-cost": <><path d="M7.5 4h9l-1 3 2.5 12.5h-12L8.5 7z" /><path d="M8.5 7h7" /><path d="M10 14.5c1.2-2.4 3-2.4 4 0" /></>,
  locations: <><path d="M12 20.5s6-5 6-9.7a6 6 0 1 0-12 0c0 4.7 6 9.7 6 9.700z" /><circle cx="12" cy="10.7" r="2" /></>,
  // a market tent
  events: <><path d="M12 4.5 4 19h16z" /><path d="M12 4.500V3" /><path d="M9.5 19 12 13.5 14.5 19" /><path d="M2.5 19h19" /><path d="M12 3h3" /></>,
  "pin-lock": <><rect x="5" y="10.5" width="14" height="9.5" rx="2.8" /><path d="M8.5 10.500V8a3.5 3.5 0 0 1 7 0v2.5" /><circle cx="12" cy="15.2" r="0.9" fill="currentColor" stroke="none" /></>,
  team: <><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19.500a5.5 5.5 0 0 1 11 0" /><circle cx="17" cy="9.5" r="2.3" /><path d="M16.8 14.500a4.3 4.3 0 0 1 3.9 4.3" /></>,
  // a spark: something reading for you
  ai: <><path d="m11 4 1.7 4.800L17.5 10.500l-4.8 1.700L11 17l-1.7-4.800L4.5 10.500l4.8-1.700z" /><path d="M18.5 15.500v4" /><path d="M16.5 17.500h4" /></>,
  square: <><rect x="4" y="4" width="16" height="16" rx="4.5" /><rect x="9" y="9" width="6" height="6" rx="1.5" /></>,
  "email-invoices": <><rect x="3.5" y="5.5" width="17" height="13" rx="3" /><path d="m4.5 8 7.5 5.500L19.5 8" /></>,
  // a day's summary: a sheet with a total line
  "sales-summary-csv": <><path d="M6.5 3.500h7.500l3.5 3.500v13.500h-11z" /><path d="M14 3.500V7h3.5" /><path d="M9.5 12h5" /><path d="M9.5 16h5" /></>,
  // what sold: a list of items
  "item-sales-csv": <><path d="M9.5 6.500h10" /><path d="M9.5 12h10" /><path d="M9.5 17.500h10" /><circle cx="5.2" cy="6.5" r="1" /><circle cx="5.2" cy="12" r="1" /><circle cx="5.2" cy="17.5" r="1" /></>,
  "imported-data": <><rect x="4" y="5.5" width="16" height="14.5" rx="3" /><path d="M4 10.500h16" /><path d="M8.5 3.500v3.5" /><path d="M15.5 3.500v3.5" /><path d="m9.5 15.2 1.8 1.8 3.4-3.6" /></>,
  "items-categories": <><path d="M3.5 11.500V4.500h7l10 10-7 7z" /><circle cx="7.8" cy="8.8" r="1.2" /></>,
  exports: <><path d="M12 4v11" /><path d="m7.5 10.5 4.5 4.5 4.5-4.5" /><path d="M5 19.500h14" /></>,
  "danger-zone": <><path d="M12 4.5 20.5 19.500h-17z" /><path d="M12 10.500v4" /><circle cx="12" cy="17" r="0.7" fill="currentColor" stroke="none" /></>,
};

export function SettingIcon({ name, className }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}
    >
      {P[name] ?? <circle cx="12" cy="12" r="7" />}
    </svg>
  );
}
