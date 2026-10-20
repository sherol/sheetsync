# SheetSync

SheetSync is a personal tracker that logs everyday life into your own Google Sheet. You log quickly from your phone, every category becomes a tab in the spreadsheet, and a monthly report summarises what you recorded.

Live app: <https://sherol.github.io/sheetsync/>

<p>
  <img src="docs/screenshots/home.png" alt="Home screen listing every category" width="240">
  <img src="docs/screenshots/food.png" alt="Medicine and Food form with green-to-red rating scales" width="240">
  <img src="docs/screenshots/prayer.png" alt="Bible study progress map" width="240">
</p>

The screenshots use example data.

## Contents

- [Getting started](#getting-started)
- [The three views](#the-three-views)
- [Categories](#categories)
- [Logging entries](#logging-entries)
- [Field types](#field-types)
- [Bible study tracker](#bible-study-tracker)
- [Monthly report](#monthly-report)
- [Category Studio](#category-studio)
- [How data is stored and synced](#how-data-is-stored-and-synced)
- [Development](#development)
- [License](#license)

## Getting started

1. Open the app. On a phone or tablet it opens in **Mobile / iPad App** view; on a wide screen it opens in **Category Studio**.
2. Select **Connect Google** and sign in. SheetSync asks for permission to edit spreadsheets it creates or opens.
3. Select the spreadsheet status under the SheetSync name in the top bar to open the spreadsheet dialog, then do one of these:
   - **Create** a new spreadsheet. SheetSync adds one tab per category plus `Monthly_Reports` and `App_Config`.
   - **Pick** an existing spreadsheet from your Drive, or **paste** its URL or ID. SheetSync adds any missing tabs and leaves existing tabs alone.
4. Start logging. Entries also save on the device, so the app works before you connect a sheet; anything logged offline is sent once you connect.

## The three views

The switcher in the top bar moves between three views:

| View | What it's for |
|---|---|
| **Category Studio** | Edit tabs and fields: names, icons, colours, field types, order |
| **Mobile / iPad App** | Log and edit entries |
| **Monthly Reports** | See a month's summary and save it to the sheet |

The top bar always shows the brown squirrel next to the **SheetSync Rainbow Studio** name. Inside the app view, the header shows the white-outline squirrel, which is also the favicon.

## Categories

SheetSync starts with ten categories. Each one is a tab in the app and a tab in your Google Sheet. Tabs have a short name (shown on tabs and in lists) and a full title (shown under the name on the home screen and as the form heading); both are editable in Category Studio.

| Tab · full title | Sheet tab | Fields |
|---|---|---|
| **Media** · Media & Books | `Media` | Title, Type (Book / Movie / TV / Game), Date Consumed, Review, Links |
| **Medicine** · Medicine & Food | `Medicine_Food` | Date, Time, Type (Med / Snack / Meal / Drink), Food / Drink / Activity, Amount, How do I feel?, Hunger Level 1–10, Burning Level 1–10, Stress 1–10 |
| **Memories** · Memories & Milestones | `Memories` | Date, Location, Who Was There, What Happened, Results |
| **Mood** · Mood & Feelings | `Mood` | Date, Mood Score 1–10, Daily Recap |
| **Meals** · Meals & Recipes | `Meals_Recipes` | Name, Type, Ingredients, Directions, Last Cooked, Links |
| **Projects** · Projects & Initiatives | `Projects` | Name, Type, Date, About, Links |
| **People** · People & Friends | `People` | Name, Last Contact, To-dos, Associated Projects |
| **Presentations** · Presentations & Writings | `Presentations_Writings` | Title, About, Where, When, Who Was There, Slides, Links |
| **Prototypes** · Prototypes & Ideas | `Prototypes_Ideas` | Name, Type, Date, Idea, Related Projects, Links |
| **Prayer** · Prayer & Theology | `Prayer` | Date, Prayer, Book Studied, Chapters, Study Notes, Answered (Waiting / Answered) |

You can rename, recolour, reorder, add and delete categories and their fields in [Category Studio](#category-studio).

## Logging entries

The app opens on a **home list** of every category, top to bottom. Each row shows how many entries the category has and the date of the latest one.

- **Open a category:** tap its row. The screen shows the entry form, then that category's recent entries. **‹ All** returns to the list.
- **Save:** fill in the form and tap **Save to _category_**. Fields marked `*` are required; if one is empty, a red banner names it.
- **Defaults:** date fields start at today, and time fields start at the current time.
- **More fields:** fields set to "More fields" in the studio sit behind a **N more fields** toggle below the main form.
- **Edit:** tap the pencil on a recent entry to load it into the form, change it, then tap **Update entry**. In Google Sheets, an edit overwrites that entry's existing row instead of adding a new one, so you can keep records such as a person's "Last Contact" or a recipe's "Last Cooked" current.
- **Recent entries:** shows up to 10 entries, newest first, with their choices, coloured ratings and clickable links.

<p>
  <img src="docs/screenshots/mood.png" alt="Mood form with the 1 to 10 scale" width="240">
  <img src="docs/screenshots/people.png" alt="People form picking a project" width="240">
</p>

## Field types

| Type | What you see | Stored in the sheet as |
|---|---|---|
| Single-line text | A text box | Text |
| Long notes | A larger text box | Text |
| Number | A number box, with an optional unit | Number |
| Rating scale | A row of numbered buttons coloured **green (lowest) → yellow → orange → red (highest)**; tap the selected one again to clear it | Number |
| Choice | Buttons for each option, or a dropdown for long lists | Text |
| Date | A date picker | `YYYY-MM-DD` |
| Time | A time picker | `HH:MM` |
| Links | One link per line; shown as clickable links in recent entries | Text |
| Link to another category | Tap-to-pick buttons of entries in another category (e.g. People → Projects), plus a text box for anything else | Comma-separated names |

## Bible study tracker

The Prayer category includes a Bible study tracker.

- **Recording study:** each Prayer entry can record a **Book Studied** (any of the 66 books) and **Chapters**, written as `1-3, 5`, `12` or `all`. A blank Chapters field marks the book as started without counting any chapters.
- **Progress map:** shows chapters studied out of 1,189, books started out of 66, and books finished. It lays out every book under Old and New Testament, shaded by how much of it you've covered.
- **Book details:** tap a book to see each chapter marked done or not, and how many sessions you've logged on it.

The tracker appears on the Prayer screen and at the bottom of the monthly report.

<img src="docs/screenshots/prayer.png" alt="Bible study progress with Psalms selected" width="300">

## Monthly report

**Monthly Reports** covers the month you pick from the selector. The selector lists every month that has entries, plus the current month. All numbers come from what you logged; an empty month shows "—" rather than an estimate.

- **Totals:** entries logged, average mood, days with a mood entry, and Bible chapters studied that month.
- **Summary:** a few plain sentences, such as the busiest category, the mood range, and food averages.
- **Daily mood:** a bar chart coloured on the same green-to-red scale as the mood buttons.
- **Entries by category:** a bar for each category.
- **Details:** the average of every other rating field, such as Hunger, Burning and Stress, plus counts for choice fields (e.g. Media by type).
- **Bible Study Progress:** all-time, at the bottom of the report.

![Monthly report](docs/screenshots/report.png)

**Save Report to Sheet** adds a row to the `Monthly_Reports` tab with the month, entry count, average mood, counts by category and the summary.

## Category Studio

The studio is where you change what you track. A sidebar lists the categories; select one to edit it.

![Category Studio editing the People tab](docs/screenshots/studio.png)

### Tab settings

- **Icon:** tap the large icon square to open the icon library. It has about 100 icons in six groups (Media & Hobbies, Food & Drink, Health & Mood, Work & Ideas, People & Places, Faith & Life) and a search box.
- **Tab name:** the short name shown on tabs and in lists. Changing it does **not** change the Google Sheet.
- **Full title:** the longer title shown under the tab name on the home screen and as the form heading.
- **Google Sheet tab:** the spreadsheet tab this category writes to.
  - **Match name** fills in a sheet-safe version of the tab name; for example, "Books & Films" becomes `Books_and_Films`.
  - **Rename sheet tab** applies it. If you're signed in and the sheet has a tab with the old name, that tab is renamed in the spreadsheet and keeps all its rows. Otherwise the app switches to the new name and creates that tab on the next save.
  - Names already used by another tab aren't allowed.
- **Colour:** pick one of 12 swatches, or any custom colour.
- **Delete tab:** removes the category and its entries from this device, after you confirm. The tab in Google Sheets is not touched.

![Icon library](docs/screenshots/icon-picker.png)

**+ New tab** in the sidebar creates a category with Name, Date and Notes fields, ready to rename and extend.

### Fields

- **Add Field** has a name, a type (see [Field types](#field-types)), a "Show on main form" switch and a Required switch. Some types have extra settings:
  - Choice: its options.
  - Number: a unit.
  - Rating scale: lowest and highest values.
  - Link to another category: which category to pick from.
- **↑ / ↓** reorder fields, which is also their column order in the sheet.
- **Main form / More fields** chooses whether a field shows immediately or behind the "more fields" toggle.
- **Delete** (bin icon) removes a field after you confirm.

### Settings

**Home Screen Order** sets the order of the categories on the app's home list.

Your setup is backed up to the `App_Config` tab automatically a couple of seconds after each change, while you're connected. **Save Layout to Sheet** backs it up right away.

## How data is stored and synced

SheetSync keeps a copy on the device and syncs it with your Google Sheet both ways.

- **On the device:** entries and settings are saved in the browser's local storage, so the app works offline and before you connect.
- **Sending:** every save is sent to the category's tab when you're connected. Anything saved while offline or signed out is kept as **unsent**. The badge next to the sheet name shows how many entries haven't been sent yet. They're sent automatically when you connect, when the network comes back, or when you tap the badge.
- **Loading:** when you connect, and when you come back to the app after a minute or more, SheetSync reads every tab and merges it into the device:
  - Entries that are only in the sheet are added, so a new phone, a cleared browser, or rows added by another app (such as mdlife) show up.
  - If an entry was changed in both places, the version with the newer **Saved At** wins.
  - Your category setup is restored from the `App_Config` backup on a device that hasn't changed its own setup. Otherwise the newer setup wins.
  - Nothing on the device is deleted by loading. An entry missing from the sheet is sent again.
- **In the sheet:** each row has **ID**, **Saved At**, then one column per field in the studio's order.
  - Rows are matched by ID, so editing an entry updates its row.
  - Text is stored exactly as typed. For example, chapters like `1-3` stay text instead of turning into a date.
- **Staying connected:** Google sign-in lasts about an hour and survives reloading the page, until you close the tab. When it runs out, the header shows **Reconnect**. Your entries are kept and sent once you reconnect.
- **Switching spreadsheets:** connecting a different spreadsheet sends every entry on the device to it.
- **Changing fields later:** reordering or deleting fields changes the header row, but rows already in the sheet keep their original column positions.
- **Older versions of SheetSync:** if you used the earlier Life / Health / Prayer / Habits version, your connected spreadsheet stays linked. Its old tabs are left untouched, and the new category tabs are added beside them.

## Development

Requirements: Node.js 20 or newer.

```bash
npm install --legacy-peer-deps
npm run dev      # dev server on http://localhost:3000
npm run lint     # type check (tsc --noEmit)
npm test         # unit tests (vitest)
npm run build    # production build in dist/
```

### Project layout

| Path | Contents |
|---|---|
| `src/config/categories.ts` | The default categories, the rating colour scale, entry title/date helpers |
| `src/config/bible.ts` | The 66 books with chapter counts, chapter parsing, progress maths |
| `src/services/sheetsService.ts` | Google Sheets and Drive API calls: create, add tabs, read tabs, write rows, rename tabs, reports |
| `src/services/syncEngine.ts`, `syncLogic.ts` | Two-way sync: reading tabs, merging by ID and Saved At, sending unsent entries and the layout backup |
| `src/hooks/useSheetSync.ts` | When sync runs: on connect, after saves and layout edits, on return to the app, when back online |
| `src/services/storageService.ts` | Local storage, and migration from older saved settings |
| `src/services/auth.ts` | Google sign-in through Firebase Auth; the token is kept for the tab until it expires |
| `src/components/MobileView.tsx` | Home list, entry form, recent entries |
| `src/components/DesktopStudio.tsx`, `CategorySettings.tsx` | Category Studio |
| `src/components/FieldInput.tsx` | One input component for every field type |
| `src/components/MonthlyReportView.tsx` | Monthly report |
| `src/components/BibleProgress.tsx` | Bible study progress map |
| `public/favicon.svg` | The white-outline squirrel; the build embeds it in `index.html` |

### Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds the app and publishes `dist/` to GitHub Pages.

In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**. If it's set to "Deploy from a branch", GitHub also publishes the unbuilt source files. They can overwrite the built app, which shows up as a blank page or a missing favicon.

## License

Apache License 2.0. See [LICENSE](LICENSE).
