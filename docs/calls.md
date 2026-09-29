# Calls into CRM evidence

Calls downloads selected Granola transcripts or imports text files, asks Jev to
classify verbatim passages, and lets you save chosen passages to an account as
one source note and individual claims. It never sends follow-up messages.

## Download and start

Use the workshop bundle or a release that includes **Calls**. The public main
branch must contain this feature before a workshop points attendees there.
From the source checkout, with Node 22.18 or newer:

```sh
npm ci
npm run crm -- init ~/my-crm --demo
cd ~/my-crm
./crm ui
```

On Windows, choose a workspace path such as `C:\Users\you\my-crm`, and use
`crm.cmd ui`. Your CRM data is in that separate workspace folder.
The first source run builds the interface. Keep the terminal open while using it.
The UI serves on the loopback interface; it is not exposed to your local network.

The packaged workshop archive contains the built app. Install the supplied
`zentrik-open-crm-*.tgz` into an empty tools directory with `npm install <archive>`.
Then run `npx open-crm init <workspace-folder> --demo` and
`npx open-crm --workspace <workspace-folder> ui`. The archive runs without the
source checkout or build tools; Node is still required.

## Connect privately

Open **Calls → Connections**. Choose TypeSafe / Jev, paste your API key into
the password field, and choose **Check and connect**. Repeat for Granola if you
want API import. The input clears immediately. The local server checks the key
with the selected provider and retains it in memory only for that process.
Closing a browser tab does not stop the server. Use Disconnect or stop the
terminal process to clear its key. Disconnect stops new work; an already sent
request may still finish at the provider.

The server can also read `TYPESAFE_API_KEY` and `GRANOLA_API_KEY` from its launch
environment. Use your secret manager's environment injection. Never put values
in a command argument, screenshot, repository, agent prompt or exported CRM.
Environment-supplied keys are loaded again when a new server starts. This feature
does not read another application's credential store or copy its login tokens.

Get a TypeSafe key at [the console](https://console.typesafe.ai).
Granola keys are created under Settings → Connectors → API keys. API access
requires a suitable plan and permitted scopes; see
[Granola's current instructions](https://docs.granola.ai/introduction).
Use the narrowest scope that reaches the calls you intend to import.

## What leaves the computer

| Action | Network destination | Data |
|---|---|---|
| Connect Jev | api.typesafe.ai | Jev key; model-list request |
| Browse/import Granola | public-api.granola.ai | Granola key and selected note identifiers |
| Process with Jev | api.typesafe.ai | Selected transcript passages and classification questions |
| Review/save | Local workspace only | Selected quotes, source references and claims |

Local storage does not make Jev processing local inference. Read the providers'
current data policies before choosing which conversations to process.
The interface requires a separate confirmation before sending transcript content.
Provider error bodies and keys are not copied into logs or records.

## Run one call

1. Browse Granola and select a call. Import downloads it; it does not invoke Jev.
   You can also select `.txt` or `.md` transcript files.
2. Select the imported call. Confirm that its content may be sent to TypeSafe.
3. Process with Jev. Open the call's review panel when processing completes.
4. Read the quoted passages and their proposed categories. Expand the complete
   transcript to inspect surrounding context. Confidence is the model's score,
   not a verified probability that the claim is true.
5. Select individual quotes and choose the account yourself. Save the reviewed
   quotes. Conditions remain visible, and previous claims are not overwritten.
6. Open that account or its Notes to find the saved evidence. The source file is
   retained under `sources/`; the note cites its source identifier.

Categories: need, risk, goal, objection, commitment, fact, or ignore. Certainty:
explicit statement, conditional statement, or unclear. “Explicit” means a speaker
stated it directly; it is not independent verification. The module does not
invent a summary, infer a deadline, identify anonymous speakers, or set revenue.
Long turns are divided into bounded verbatim passages with nearby context.

## Try a batch

Choose **Try 50 sample calls** to import short fictional calls locally. These
files ship with the package and contain no customer data. Connecting Jev and
processing them uses the real API; there is no simulated production mode.

Select up to 50 calls and start processing. Four calls run concurrently; long
calls require several requests. Each call records the returned model, elapsed
time, status and findings. One failed call does not discard completed calls.
Failed calls can be selected and retried. A server restart marks interrupted
calls as failed rather than reporting completion.

The batch timer measures processing only. Granola import has its own elapsed
time and rate limit. Neither timer measures a person's review. Sample calls are
short and are not a representative benchmark. Do not claim a speedup from test
providers, cached classifications or samples without naming the workload.

## Files, limits and recovery

Call processing records and batch receipts are under `.open-crm/calls/` in the
workspace, separate from CRM exports. Original sources are under `sources/`.
Back up the whole folder to retain both. Workspace-only JSON exports do not
include transcripts or processing history. The generated Markdown account views
include accepted claims and note content, so they can contain private data.

The current limit is 200 imported calls per workspace, 200,000 characters per
call, and 50 selected calls per run. Oversized input is rejected, not truncated.
Duplicate transcript content is imported once. Saving the same call again does
not duplicate its note or claims. A corrected transcript creates a new version;
review it deliberately to avoid retaining conflicting claims without context.

Calls appear only in folder mode. The browser-only hosted demo has no local
server for keys or providers. Share-safe mode suppresses the Calls content.
For a stage demonstration, use synthetic calls in a dedicated workspace.

## Agent access

```sh
./crm calls list --json
./crm calls import ./call.txt --json
./crm calls show call_ID --json
./crm calls process call_ID --send-to-typesafe --json
./crm calls save call_ID --account ACCOUNT_ID --spans s0,s2 --approved-by 'Reviewer' --json
```

CLI processing uses the launch environment's key, not a key held by another UI
process. Run one processing batch per workspace. Agents must obtain the person's
instruction before transferring transcripts or recording an approval.
MCP offers `crm_list_calls` and `crm_show_call`; normal CRM write tools retain
the existing proposal gate. Saving reviewed calls applies existing core operations
under the workspace lock. No new parallel CRM data store is introduced.

## API contract references

- [Jev HTTP API](https://docs.typesafe.ai/api): typed Choice questions and answers.
- [Jev model information](https://docs.typesafe.ai/models): pinned `jev-1.13.0`;
  results record the returned model name.
- [Granola API](https://docs.granola.ai/introduction): list, pagination, transcript
  reads, access scopes and rate limits. Requests are paced and retry transient errors.
