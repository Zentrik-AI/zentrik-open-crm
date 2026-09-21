# Review a team's tasks

Tasks starts with all owners. Choose **Filter by owner** for one person's queue;
the count states how many tasks remain in view. This is a view, not an access
restriction or a reassignment. The task owner can differ from the account owner.

When creating a task, enter its owner explicitly, or leave Owner blank to use
the selected account's owner. Choosing another account does not change an
explicit owner. An account without an owner falls back to Unassigned.

Calendar export includes only open tasks in the selected owner view. Its button
shows the export count. Completed tasks are excluded. The download is a local
`.ics` file; it does not send invitations or write to a calendar service.

The Done section initially shows the eight most recent completed tasks. Its
count makes that limit explicit, and Show all reveals the rest. No task is
deleted or marked done by filtering or exporting.

Browser storage is local to that browser. Folder mode coordinates app and agent
writes through the local workspace API. Neither mode provides hosted multi-user
accounts or permission-based owner isolation.
