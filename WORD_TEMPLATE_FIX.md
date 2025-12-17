# How to Fix the Word Template for Board Member Reports

The error "Duplicate open/close tag" occurs when Word adds extra XML formatting around the placeholders. This happens when you apply formatting (bold, color, etc.) to the placeholders.

## Solution: Insert Placeholders as Plain Text

### Method 1: Use Notepad (Recommended)
1. Open Notepad or any plain text editor
2. Type your placeholders exactly as shown below
3. Copy from Notepad
4. Paste into Word using **Ctrl+Shift+V** (Paste Special → Unformatted Text)

### Method 2: Remove All Formatting
1. Select all the placeholder text in Word
2. Press **Ctrl+Spacebar** to clear formatting
3. Make sure NO bold, color, or any other formatting is applied

## Required Template Format

Your Word document should contain EXACTLY this (as plain text, no formatting):

```
Date: {{date}}

[Your table with headers]

{{#member-table-loop}}
{{member-id}}    {{member-name}}    {{balance}}
{{/member-table-loop}}
```

## Important Notes:
- Use hyphens (-) not underscores (_): `member-id`, `member-name`, `member-table-loop`
- NO formatting on any placeholder
- NO bold, italic, color, or highlighting on the `{{` `}}` or text inside
- The placeholders should look exactly like plain text
- Keep them in a table for nice formatting, but don't format the placeholders themselves

## Testing:
1. Save the template as `report-template.docx` in the `public` folder
2. Try generating a report
3. If you still get errors, check that you haven't applied ANY formatting to the placeholders

## Why This Happens:
When you apply formatting in Word (bold, color, etc.), Word splits the XML into multiple tags:
- `{{date` might become `<w:r><w:t>{{</w:t></w:r><w:r><w:t>date</w:t></w:r>`
- Docxtemplater can't parse this split format
- Plain text keeps it as one tag: `<w:r><w:t>{{date}}</w:t></w:r>`
