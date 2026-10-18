# SheetSync

SheetSync is a personal tracker that logs everyday life into your own Google Sheet. You log quickly from your phone, every category becomes a tab in the spreadsheet, and a monthly report summarises what you recorded.

Live app: <https://sherol.github.io/sheetsync/>

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
4. Start logging. Entries also save on the device, so the app works before you connect a sheet.

## The three views

The switcher in the top bar moves between three views:

| View | What it's for |
|---|---|
| **Category Studio** | Edit tabs and fields: names, icons, colours, field types, order |
| **Mobile / iPad App** | Log and edit entries |
| **Monthly Reports** | See a month's summary and save it to the sheet |

The top bar always shows the brown squirrel next to the **SheetSync Rainbow Studio** name. Inside the app view, the header shows the white-outline squirrel, which is also the favicon.

## Categories

SheetSync starts with ten categories. Each one is a tab in the app and a tab in your Google Sheet.

| Category | Sheet tab | Fields |
|---|---|---|
| Media | `Media` | Title, Type (Book / Movie / TV / Game), Date Consumed, Review, Links |
| Medicine & Food | `Medicine_Food` | Date, Time, Type (Med / Snack / Meal / Drink), Food / Drink / Activity, Amount, How do I feel?, Hunger Level 1–10, Burning Level 1–10, Stress 1–10 |
| Memories | `Memories` | Date, Location, Who Was There, What Happened, Results |
| Mood | `Mood` | Date, Mood Score 1–10, Daily Recap |
| Meals & Recipes | `Meals_Recipes` | Name, Type, Ingredients, Directions, Last Cooked, Links |
| Projects | `Projects` | Name, Type, Date, About, Links |
| People | `People` | Name, Last Contact, To-dos, Associated Projects |
| Presentations & Writings | `Presentations_Writings` | Title, About, Where, When, Who Was There, Slides, Links |
| Prototypes & Ideas | `Prototypes_Ideas` | Name, Type, Date, Idea, Related Projects, Links |
| Prayer | `Prayer` | Date, Prayer, Book Studied, Chapters, Study Notes, Answered (Waiting / Answered) |

You can rename, recolour, reorder, add and delete categories and their fields in [Category Studio](#category-studio).

## Logging entries

The app opens on a **home list** of every category, top to bottom. Each row shows how many entries the category has and the date of the latest one.

- **Open a category:** tap its row. The screen shows the entry form, then that category's recent entries. **‹ All** returns to the list.
- **Save:** fill in the form and tap **Save to _category_**. Fields marked `*` are required; if one is empty, a red banner names it.
- **Defaults:** date fields start at today, and time fields start at the current time.
- **More fields:** fields set to "More fields" in the studio sit behind a **N more fields** toggle below the main form.
- **Edit:** tap the pencil on a recent entry to load it into the form, change it, then tap **Update entry**. In Google Sheets, an edit overwrites that entry's existing row instead of adding a new one, so you can keep records such as a person's "Last Contact" or a recipe's "Last Cooked" current.
- **Recent entries:** shows up to 10 entries, newest first, with their choices, coloured ratings and clickable links.

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

## Monthly report

**Monthly Reports** covers the month you pick from the selector. The selector lists every month that has entries, plus the current month. All numbers come from what you logged; an empty month shows "—" rather than an estimate.

- **Totals:** entries logged, average mood, days with a mood entry, and Bible chapters studied that month.
- **Summary:** a few plain sentences, such as the busiest category, the mood range, and food averages.
- **Daily mood:** a bar chart coloured on the same green-to-red scale as the mood buttons.
- **Entries by category:** a bar for each category.
- **Details:** the average of every other rating field, such as Hunger, Burning and Stress, plus counts for choice fields (e.g. Media by type).
- **Bible Study Progress:** all-time, at the bottom of the report.

**Save Report to Sheet** adds a row to the `Monthly_Reports` tab with the month, entry count, average mood, counts by category and the summary.

## Category Studio

The studio is where you change what you track. A sidebar lists the categories; select one to edit it.

### Tab settings

- **Icon:** tap the large icon square to open the icon library. It has about 100 icons in six groups (Media & Hobbies, Food & Drink, Health & Mood, Work & Ideas, People & Places, Faith & Life) and a search box.
- **Tab name:** the name shown in the app. Changing it does **not** change the Google Sheet.
- **Google Sheet tab:** the spreadsheet tab this category writes to.
  - **Match name** fills in a sheet-safe version of the tab name; for example, "Books & Films" becomes `Books_and_Films`.
  - **Rename sheet tab** applies it. If you're signed in and the sheet has a tab with the old name, that tab is renamed in the spreadsheet and keeps all its rows. Otherwise the app switches to the new name and creates that tab on the next save.
  - Names already used by another tab aren't allowed.
- **Colour:** pick one of 12 swatches, or any custom colour.
- **Delete tab:** removes the category and its entries from this device, after you confirm. The tab in Google Sheets is not touched.

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

**Save Layout to Sheet** writes your current setup as JSON to the `App_Config` tab as a backup.

## How data is stored and synced

- **On the device:** entries and settings are saved in the browser's local storage, so they persist between visits on that device and browser.
- **In Google Sheets:** when connected and signed in, every save writes to the category's tab.
  - Each row has **ID**, **Saved At**, then one column per field in the studio's order.
  - The header row refreshes on each save, so new fields get a column.
  - Rows are matched by ID, so editing an entry updates its row.
- **Changing fields later:** reordering or deleting fields changes the header row, but rows already in the sheet keep their original column positions.
- **Older versions of SheetSync:** if you used the earlier Life / Health / Prayer / Habits version, your connected spreadsheet stays linked. Its old tabs are left untouched, and the new category tabs are added beside them.

## Development

Requirements: Node.js 20 or newer.

```bash
npm install --legacy-peer-deps
npm run dev      # dev server on http://localhost:3000
npm run lint     # type check (tsc --noEmit)
npm run build    # production build in dist/
```

### Project layout

| Path | Contents |
|---|---|
| `src/config/categories.ts` | The default categories, the rating colour scale, entry title/date helpers |
| `src/config/bible.ts` | The 66 books with chapter counts, chapter parsing, progress maths |
| `src/services/sheetsService.ts` | Google Sheets and Drive API calls: create, add tabs, upsert rows, rename tabs, reports |
| `src/services/storageService.ts` | Local storage, and migration from older saved settings |
| `src/services/auth.ts` | Google sign-in through Firebase Auth |
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
