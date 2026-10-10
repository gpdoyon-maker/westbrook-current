# Event Data Format

Events live in `src/data/events.json` as a JSON array with one object per event. The file is the source of truth for the Events page; do not embed event records in page markup.

Each event has these fields:

| Field | Type | Format and meaning |
| --- | --- | --- |
| `title` | string | Event name. |
| `date` | string | Event date in `YYYY-MM-DD`, using the Westbrook, Maine calendar date. |
| `startTime` | string | Optional start time in 24-hour `HH:mm`, America/New_York local time. Use an empty string if the time is unknown. |
| `endTime` | string | Optional end time in 24-hour `HH:mm`, America/New_York local time. This field may be blank and it is not displayed on the site. |
| `venue` | string | Venue name or an empty string when no venue is listed. |
| `category` | string | Display category, for example `Arts & music`. |
| `admission` | string | `free` or `paid`. |
| `description` | string | Plain-text event description; use an empty string when none is provided. |
| `sourceLink` | string | Absolute URL to the original event listing. |
| `highlight` | boolean | Optional. `true` marks the event as Featured; omit this field otherwise. |
| `status` | string | Optional. `cancelled` marks the event as cancelled: it stays in the list with a Cancelled label, calendar buttons are hidden, and its structured data reports `EventCancelled`. Omit this field for normal events. |

The visitor's `TODAY` marker is calculated in the browser from the visitor's local calendar date and is not stored in this file. Keep times as local Westbrook times; do not store UTC timestamps or preformatted display dates here.

The Google Sheet that feeds this list publishes these `startTime` and `endTime` fields. The site intentionally ignores `endTime` for display, even when a value is present.

## Notices and alerts

Notices and alerts live in `src/data/notices.json` as a JSON array, one object per item. Both always link to an official source.

| Field | Type | Format and meaning |
| --- | --- | --- |
| `type` | string | `General Notice` shows as a quiet, collapsible strip at the top of the Events list. `Cancellation / Delay` and `Emergency` show as alert banners at the top of every page. The short names `general`, `delay`, and `emergency` also work. |
| `headline` | string | Required. For a notice, include the dates in it, for example `Leaf & brush pickup, Oct 30 – Nov 17`. |
| `description` | string | Optional plain text. Line breaks are kept. |
| `officialLink` | string | Required absolute `http(s)` URL of the official source. The site shows its host name, for example `westbrookmaine.gov`. Records without a valid link are never shown. |
| `postedAt` | string | Optional, alerts only: `YYYY-MM-DD HH:mm` (a 12-hour time such as `6:10 AM` also works), Westbrook time. Shown as "Posted 6:10 AM". |
| `showFrom` | string | Optional `YYYY-MM-DD` (`M/D/YYYY` also works). The item stays hidden before the start of this day. Blank means show right away. |
| `expiresDate` | string | Required `YYYY-MM-DD` (`M/D/YYYY` also works). Records without a valid expiry are never shown. |
| `expiresTime` | string | Optional `HH:mm` or `10:00 AM`. Blank means the item stays up through the end of `expiresDate`. |
| `status` | string | Optional. When present, only `Active` records are shown. |

All dates and times are Westbrook (America/New_York) wall-clock values. Whether an item is showing is decided in the visitor's browser, so an expired alert disappears on time even if the page was built earlier; nothing is hard-coded into the page. Multiple alerts stack, with emergencies first and then delays, newest first.

The Events page is rendered in the build-time HTML. Its schema.org `Event` JSON-LD is generated from each record's `title`, `date`, optional `startTime`, `venue`, `description`, optional `sourceLink`, and `admission`. Records without a title or valid date are omitted. Event times use the America/New_York offset for their date; `endTime`, prices, and organizers are not included.
