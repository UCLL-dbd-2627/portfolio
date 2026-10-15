# Database Development Portfolio — Student Guide

Practice. Make mistakes. Learn.

This is your semester-long portfolio project. You'll get a working dashboard
with empty widgets, and every week you write a bit more SQL to bring another
one to life. By the end of the semester the whole dashboard works — and
every query in it is yours.

**The rule: you only ever edit files inside `sql/`**. 
Everything else — the dashboard, the backend, the database setup — is provided and already works. As long as you only work in the `sql/` directory, you won't break anything.

---

## 1. What you need installed

| Tool | Why | Check if you have it |
|---|---|---|
| [Git](https://git-scm.com/downloads) | to get the code and submit your work | `git --version` |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | runs the database + dashboard locally | open the app, look for "Engine running" |
| A code editor (e.g. [VS Code](https://code.visualstudio.com/)) | for editing `.sql` files | -- |
| A GitHub account | your portfolio lives in a repo | -- |

**Windows users**: Docker Desktop needs WSL2. If it's not already set up,
Docker Desktop will usually prompt you to install it the first time you run
it. Follow that prompt, it handles most of the setup itself. If Docker
Desktop refuses to start with a message about virtualization, that's a
BIOS/Windows-features issue, not something wrong with this project. Search
"enable virtualization Windows Docker" or ask for help, it's a known,
fixable thing.

---

## 2. Getting the code

1. Your instructor will send you a **GitHub Classroom invite link**. Open
   it and accept the assignment — this creates your own **private** copy of
   the repo, named something like `databasement-portfolio-yourusername`.
   You keep this one repo the whole semester.
2. Clone it to your computer:
   ```
   git clone https://github.com/your-org/databasement-portfolio-yourusername.git
   cd databasement-portfolio-yourusername
   ```
3. Add the **starter repo as a second remote**, called `upstream`. Your instructor may push fixes over the semester -- a typo in a widget's instructions, a bug in the grading harness, that kind of thing, not new content -- and this is how you pull those in without disturbing your own work:
   ```
   git remote add upstream <the starter repo URL your instructor gives you>
   ```

## 3. First-time setup

1. Make sure **Docker Desktop is open and running** (not just installed —
   check for the running indicator).
2. Copy `.env.example` to a new file named `.env`. If port 58080 (or 58432, or 58000) is already used by something else on your machine: change whichever port number conflicts. No other files need to change.
3. In a terminal, from inside the repo folder:
   ```
   docker compose up -d
   ```
   (Mac/Linux users can also just run `make up`.) The first run takes a
   minute or two — it's downloading and building everything. You'll only
   wait like this once.
3. Open **http://localhost:58080** in your browser. You should see the Database Development Portfiolio Dashboard, with most widgets showing "🔧 not wired up yet."
   That's correct; that's your starting point.

**If port 58080 (or 58432, or 58000) is already used by something else on
your machine**: change whichever port number conflicts in your `.env` file. No other files need to change.

**Stuck?** `docker compose logs backend` (or `db`, or `frontend`) shows you
what that piece is actually doing. Copy and paste the output when asking for help,
it's much more useful than "it's not working."

---

## 4. How a widget works

Every widget card on the dashboard corresponds to exactly one file under
`sql/weekNN/`. Open that file — it has:
- a comment explaining what the widget needs (expected columns, expected
  order, sometimes a hint)
- a placeholder query with `TODO`s marking what to fill in

Write your query, replacing the placeholder. Save the file, refresh the
dashboard in your browser. If it runs without error and returns something,
the widget unlocks and shows your data.

**Important**: "unlocked" means your query *ran*, not that it's *correct*.
A query can run fine and still return the wrong answer — it happens more
than you'd think, and two of this semester's widgets are specifically
designed to catch exactly that (see the note in their `.sql` file comments
when you get there). The only way to know for sure is to actually run the
check (see below) — treat "unlocked" as "worth checking," not "done."

**A few widgets each week also involve clicking a button** (placing a demo
order, processing a refund, switching roles) instead of just displaying
data. Those have a matching `.js` file right next to the `.sql` file --
that file is already complete, nothing there for you to write. It's just
the small bit of code connecting the button to your SQL. Don't edit it;
it's there so you can see how the pieces connect, not as an exercise.

**Check your own work before pushing**, the same way the autograder will —
either click **"Run full check"** right on the dashboard, or from a
terminal:
```
make test
```
Run the terminal version from the repo folder, in a terminal — same place
you ran `docker compose up`. It doesn't need anything beyond Docker (which
you already have running): it builds a small throwaway container, runs
every check against your current `sql/` files, and prints a pass/fail line
per widget. Same checks, same comparison logic, as what the lecturers will run to check your project. If it passes here, it'll pass there. The in-browser button
runs the exact same logic, just with a results list instead of terminal
output.

No `make` on your system (common on Windows)? Run the same thing directly:
```
docker compose --profile tools run --rm grading sh -c "cd backend && npm install --silent && cd ../grading && npm install --silent && node run_tests.js"
```

The first time you run it, it'll take a little longer (installing its own
dependencies inside the container). After that it's fast.

**One thing worth knowing**: `make test` resets the database to its seed
state as part of running the checks — so if you'd clicked "place demo
order" or "process refund" on the live dashboard before running it, that
demo data will be back to its original state afterward. Nothing about your
actual `sql/` files is touched, only the database content. Just re-click
whatever you were exploring if you want to see it again.

---

## 5. Working through it week by week

Work through the folders in order — later weeks sometimes reuse ideas from
earlier ones (e.g. week 9's trigger gets reused by two different widgets).
Roughly:

| Week | Folder | What you're practicing |
|---|---|---|
| 1 | `sql/week01/` | basic joins, aggregation |
| 2 | `sql/week02/` | HAVING, and *actually looking at your data* before you trust a query |
| 3 | `sql/week03/` | transactions, savepoints |
| 4 | `sql/week04/` | subqueries, CTEs, anti-joins |
| 5 | `sql/week05/` | window functions, pagination |
| 6 | `sql/week06/` | views |
| 8 | `sql/week08/` | row-level security |
| 9 | `sql/week09/` | stored procedures, triggers |
| 10 | `sql/week10/` | DDL (ALTER TABLE, schema changes) |

A couple of widgets (you'll know them when you hit them) are built around
real messiness in the data rather than a clean textbook spec — a query that
looks right and runs without error but is quietly wrong. Take the hint in
the comment seriously: run a plain `SELECT` to actually look at the data
before you write the real query. This is a habit worth having regardless of
this course.

A couple of other things worth knowing before you start:

- **When a widget needs a "top N" or a specific number of rows**, use
  `FETCH FIRST n ROWS ONLY` (or `OFFSET ... FETCH NEXT ... ROWS ONLY` for
  the pagination widget in week 5), not `LIMIT`. Same result either way —
  `FETCH` is just the syntax this course uses consistently, and it's
  standard SQL rather than a Postgres-specific shortcut.
- **`customers` and `sellers` have a `customer_name`/`seller_name` column**
  alongside their rather anonymous IDs — join those in when a
  widget's spec asks for a name, so the dashboard shows something readable
  instead of just opaque strings.

---

## 6. Committing and pushing — do this after every attempt, not once at the end

Your instructor can see your commit history, not just your final answer —
and it's genuinely useful to you too, since `git log` becomes your own
record of what you figured out and when.

**At a minimum, commit whenever a widget starts working**, not just at some deadline:
```
git add sql/week01/top_products.sql
git commit -m "week01: top products by revenue"
git push
```

A few habits worth having:
- **Small, frequent commits beat one giant commit at the end.** One commit
  per widget (or even per meaningful attempt) is a much better record of
  your actual work than a single "finished everything" commit the night
  it's due.
- **Push regularly**, not just once. Pushing keeps your work stored in GitHub so you never risk losing it in a crash. But it also allows the lecturers to keep an eye on student progress. Not pushing looks a lot like not working.
- **Commit messages should say what you did**, in a few words — future you,
  re-reading this in week 9, will thank present you.
- It's fine to commit something that doesn't pass yet. A commit isn't a
  claim of correctness, it's a checkpoint.

---

## 7. If you get properly stuck

- **Every widget says "relation does not exist" (or the dashboard shows
  nothing)?** The database did not finish loading on first start. Run
  `docker compose down -v` and then `docker compose up -d`. The `-v` is
  essential: it deletes the half-built database so setup runs again. If it
  happens again, run `docker compose logs db` and send the first 30 lines.
- `make reset` (or `docker compose down -v && docker compose up -d`) wipes
  your local database back to its starting seed data — your `sql/` files
  are never touched by this, only the database gets reset. Useful if you've
  wedged something with a bad trigger or a half-finished transaction.
- Read the error message. Postgres errors are usually specific and
  actionable, not cryptic.
- Ask — but bring the actual error message, not just "it's not working."
