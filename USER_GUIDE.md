# MeetScribe User Guide

## Getting Started

### Step 1: Install MeetScribe

1. Download the MeetScribe installer for your platform:
   - **Windows**: `MeetScribe-Setup-0.1.0.exe`
   - **macOS**: `MeetScribe-0.1.0.dmg`

2. Run the installer and follow the on-screen instructions.

3. Launch MeetScribe from your Applications folder (macOS) or Start Menu (Windows).

### Step 2: Activate Your License

When you first open MeetScribe, you'll see the **Activation Screen**.

1. You should have received an access token from your organization administrator.
2. Paste the token into the **"Enter your access token"** field.
3. Click **"Activate"**.
4. If the token is valid, you'll be taken to the Meetings screen.
5. If the token is invalid, you'll see an error message. Contact your administrator for a new token.

> **Note:** Your token is validated against the backend server. Make sure you have internet access during activation. A revoked or expired token will disable future sessions.

### Step 3: Connect Google Calendar

1. From the Meetings screen, click **"Connect Google Calendar"**.
2. A browser window will open asking you to sign in to your Google account.
3. Grant MeetScribe permission to **read your calendar** (read-only access is all that's needed).
4. After granting access, return to the MeetScribe app.
5. Your upcoming meetings (next 7–14 days) will appear in the meeting list.

> **What permissions does MeetScribe request?**
> - `https://www.googleapis.com/auth/calendar.readonly` — Read-only access to view your calendar events. MeetScribe never modifies, creates, or deletes calendar events.

### Step 4: Choose Your Transcript Folder

1. Go to **Settings** (gear icon in the top right).
2. Click **"Browse"** next to "Transcript Save Folder".
3. Select the folder where you want transcripts to be saved.
4. This is where all `.txt` and `.json` transcript files will be written.

> **Tip:** Choose a folder that's easy to find, like `Documents/MeetScribe Transcripts` or `Desktop/Transcripts`.

### Step 5: Enable Transcription for a Meeting

1. On the **Meetings** screen, you'll see a list of your upcoming Google Calendar events that contain meeting links.
2. Each meeting shows:
   - **Title** — The name of the meeting
   - **Time** — Start and end time
   - **Platform** — Detected from the meeting link (Google Meet, Zoom, etc.)
   - **Status** — `scheduled`, `waiting`, `joining`, `recording`, `completed`, `failed`, or `skipped`
3. Toggle the **"Enable transcription"** switch for any meeting you want transcribed.
4. You can also use **"Enable all today"** or **"Disable all today"** for quick bulk actions.

### Step 6: Automatic Meeting Join

When an enabled meeting's start time arrives:

1. MeetScribe automatically detects the meeting is starting.
2. The app joins the meeting (currently Google Meet is supported in v1).
3. The status changes from `scheduled` → `joining` → `recording`.
4. Audio is captured and transcription begins.
5. Speaker labels are assigned using a confidence-based system.

> **Important:** MeetScribe is a silent observer. It does not speak, post chat messages, or alter the meeting in any way.

### Step 7: Meeting Ends — Transcript Saved

When the meeting ends (all participants leave, or the meeting is explicitly ended):

1. MeetScribe detects the meeting has ended.
2. The transcript is finalized and saved to your chosen folder.
3. Two files are created:
   - `2024-06-15_0900_team_standup.txt` — Human-readable plain text
   - `2024-06-15_0900_team_standup.json` — Structured JSON with full metadata
4. The meeting status changes to `completed`.

If transcription fails mid-session, a **partial transcript** is saved with a `_partial` suffix so you never lose what was captured.

---

## Understanding the Meeting List

Each meeting in the list shows the following information:

| Field | Description |
|-------|-------------|
| **Title** | The calendar event title |
| **Start Time** | When the meeting begins |
| **End Time** | When the meeting is scheduled to end |
| **Platform** | Auto-detected from the meeting link (Google Meet, Zoom, etc.) |
| **Transcription** | Toggle to enable/disable transcription for this meeting |
| **Status** | Current state of the meeting run |

### Meeting Statuses

| Status | Meaning |
|--------|---------|
| `scheduled` | Meeting is in the future, transcription is enabled |
| `waiting` | Meeting start time is approaching (within 5-minute grace period) |
| `joining` | MeetScribe is attempting to join the meeting |
| `recording` | Meeting is active, audio is being captured and transcribed |
| `completed` | Meeting ended, transcript saved successfully |
| `failed` | Something went wrong (join failure, transcription error, etc.) |
| `skipped` | Meeting was not enabled for transcription |

---

## Understanding Transcript Files

### Plain Text Format (`.txt`)

```
Meeting: Team Standup
Date: 2024-06-15T09:00:00Z
Platform: google_meet
Participants: alice@example.com, bob@example.com
Status: completed

--- Transcript ---

[09:00:00 - 09:00:15] Alice Johnson: Good morning everyone, let's get started.
[09:00:15 - 09:00:30] Speaker 2 [probable]: Sounds good, I have a quick update.
[09:00:30 - 09:01:00] Alice Johnson: Great, go ahead.
[09:01:00 - 09:01:45] Speaker 3 [unknown]: I also wanted to mention the deadline.
```

### JSON Format (`.json`)

```json
{
  "meetingId": "run-abc123",
  "eventId": "evt-xyz789@google.com",
  "title": "Team Standup",
  "startTime": "2024-06-15T09:00:00Z",
  "endTime": "2024-06-15T09:15:00Z",
  "calendarSource": "google",
  "platform": "google_meet",
  "participantsDetected": ["alice@example.com", "bob@example.com"],
  "transcriptSegments": [
    {
      "startedAtMs": 0,
      "endedAtMs": 15000,
      "speakerLabel": "Alice Johnson",
      "speakerConfidence": "known",
      "text": "Good morning everyone, let's get started."
    },
    {
      "startedAtMs": 15000,
      "endedAtMs": 30000,
      "speakerLabel": "Speaker 2",
      "speakerConfidence": "probable",
      "text": "Sounds good, I have a quick update."
    }
  ],
  "outputPath": "/Users/you/Documents/Transcripts/2024-06-15_0900_team_standup.json",
  "sessionStatus": "completed"
}
```

### Speaker Confidence Levels

| Label | Confidence | Meaning |
|-------|-----------|---------|
| `known` | High | Speaker identity confirmed via meeting attendee list and stable voice evidence |
| `probable` | Medium | Same voice has been consistently labeled within this session |
| `unknown` | Low | No identity information available; generic label assigned |

> **Important:** MeetScribe never labels a person by name unless it has high confidence. When uncertain, it uses generic labels like "Speaker 1", "Speaker 2", etc.

---

## Settings

Access settings by clicking the **gear icon** in the top right of the Meetings screen.

| Setting | Default | Description |
|---------|---------|-------------|
| **Transcript Save Folder** | *(none — must be set)* | The local folder where transcript files are saved |
| **Auto-start on Login** | Off | Automatically start MeetScribe when you log in to your computer |
| **Default Enablement** | Off | Whether new meetings are automatically enabled for transcription |
| **Show Speaker Confidence** | On | Display confidence level next to speaker labels in transcripts |
| **Timezone** | Auto-detected | Timezone for displaying meeting times |
| **Debug Logging** | Off | Enable verbose logging for troubleshooting |

---

## Troubleshooting

### "Invalid token" error during activation

- Make sure you copied the entire token (it's a long string of characters).
- Check that the token hasn't expired. Contact your administrator for a new one.
- Ensure you have internet access — the token is validated against the backend server.

### No meetings appear in the list

- Make sure you've connected your Google Calendar.
- Check that your upcoming meetings have a meeting link (Google Meet, Zoom, etc.). MeetScribe only shows meetings with detectable meeting links.
- Try clicking the refresh button to re-fetch your calendar.

### Meeting status shows "failed"

- Check the debug logs (enable **Debug Logging** in Settings).
- Common causes: the meeting URL was invalid, the meeting platform is not yet supported, or the meeting was cancelled.
- A partial transcript may still be saved in your transcript folder with a `_partial` suffix.

### Transcripts not appearing in the folder

- Verify the transcript folder path in Settings is correct.
- Check that MeetScribe has write permissions to the folder.
- Look for `.tmp_` files — these indicate an interrupted write. MeetScribe should clean these up on next run.

### Google Calendar connection lost

- Go to Settings and reconnect your Google account.
- This can happen if the OAuth token expires or is revoked.
- MeetScribe only requests read-only calendar access.

---

## Privacy & Security

### What MeetScribe stores locally

- Your access token (encrypted in OS-native secure storage)
- Calendar connection state
- Meeting preferences (which meetings are enabled)
- Meeting run history
- Transcript files in your chosen folder
- App settings

### What MeetScribe sends to the backend

- Token validation requests (token hash only, not the raw token)
- OAuth callback codes (to exchange for calendar access)
- Health/telemetry data (minimal, no transcript content)

### What MeetScribe does NOT send to the backend

- ❌ Transcript content
- ❌ Audio recordings
- ❌ Speaker identity data
- ❌ Meeting content beyond what's needed for calendar sync

### Transcript privacy

- All transcripts are saved **locally** to your chosen folder.
- No transcript content is uploaded to any server.
- You control where transcripts are stored.
- You can delete transcript files at any time by simply deleting them from the folder.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + ,` | Open Settings |
| `Ctrl/Cmd + R` | Refresh calendar |
| `Ctrl/Cmd + Q` | Quit MeetScribe |

---

## FAQ

**Q: Does MeetScribe work with Zoom or Microsoft Teams?**
A: Not in v1. The architecture supports adding Zoom and Teams through the provider interface, but only Google Meet is currently implemented.

**Q: Can MeetScribe transcribe meetings in other languages?**
A: Language support depends on the transcription provider. The default configuration supports English. Additional language support can be configured through the transcription provider settings.

**Q: What happens if my computer goes to sleep during a meeting?**
A: MeetScribe will attempt to resume the session when the computer wakes up. If the meeting has ended, a partial transcript will be saved with whatever was captured.

**Q: Can I use MeetScribe without an internet connection?**
A: You need internet for calendar sync and token validation. However, once a meeting is scheduled, the local database preserves the schedule. Transcription itself can work offline depending on the transcription provider.

**Q: How do I get a new access token?**
A: Contact your organization administrator. Tokens are issued through the backend service and cannot be self-generated.

**Q: Can I change the transcript folder after meetings have been recorded?**
A: Yes. Changing the folder only affects new transcripts. Previously saved transcripts remain in the old folder.

**Q: What if I accidentally close MeetScribe during a meeting?**
A: Reopen MeetScribe. It will resume scheduling from the local database. If a meeting was in progress, a partial transcript will have been saved.

---

## Uninstalling MeetScribe

1. Close the MeetScribe application.
2. **Windows**: Uninstall via Add/Remove Programs. **macOS**: Drag MeetScribe from Applications to Trash.
3. (Optional) Delete your transcript folder if you no longer need the files.
4. (Optional) Delete the MeetScribe data directory:
   - **Windows**: `%APPDATA%\meetscribe\meetscribe.db`
   - **macOS**: `~/Library/Application Support/meetscribe/meetscribe.db`

> **Note:** Uninstalling does not revoke your Google Calendar access. To revoke access, go to [Google Account Permissions](https://myaccount.google.com/permissions) and remove MeetScribe.

---

## Support

For issues, feature requests, or questions, contact your organization's MeetScribe administrator.