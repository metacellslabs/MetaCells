# Metacells

Metacells is a spreadsheet-style workspace with formulas, AI prompts, reports, file cells, and channel integrations.

## Channel Sends

Channel sends run once when you commit a cell containing a send command.

### Telegram

Use either form:

- `/tg hello from Metacells`
- `/tg:send:hello from Metacells`

If the message references workbook attachment cells, Telegram sends the real files. Any remaining text is sent as the caption or follow-up message.

Examples:

```text
/tg hello
/tg @policy uploaded
/tg:send:@logo done
```

### Email (IMAP + SMTP)

Email sends require a structured payload so the sender has `to`, and usually `subj` and `body`.

Use:

```text
/sf:send:{"to":"user@example.com","subj":"Hi","body":"hello"}
```

You can provide `to` as a string or an array.

Examples:

```text
/sf:send:{"to":"user@example.com","subj":"Status","body":"hello"}
/sf:send:{"to":["a@example.com","b@example.com"],"subj":"Report","body":"see attached @policy"}
```

## File Cells

File cells store uploaded files in the workbook. They:

- show the filename in the sheet
- expose extracted text content to AI prompts
- can be sent through supported channels as real attachments

Examples:

```text
'Summarise @policy
/tg @policy uploaded
File:@policy:[Upload policy PDF]
```
