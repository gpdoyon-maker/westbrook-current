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

The visitor's `TODAY` marker is calculated in the browser from the visitor's local calendar date and is not stored in this file. Keep times as local Westbrook times; do not store UTC timestamps or preformatted display dates here.

The Google Sheet that feeds this list publishes these `startTime` and `endTime` fields. The site intentionally ignores `endTime` for display, even when a value is present.
