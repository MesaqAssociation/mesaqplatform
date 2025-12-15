# 🧪 Telegram Bot Testing Guide

Complete guide for testing the Telegram bot's create functionality.

## 🚀 Quick Test Checklist

### Before Testing
- [ ] Bot is set up (see `TELEGRAM_BOT_SETUP.md`)
- [ ] Webhook is configured
- [ ] Environment variables are set
- [ ] Database is accessible
- [ ] `member_groups` table exists (optional but recommended)

### Test Commands
- [ ] `/start` shows welcome message
- [ ] `/create` shows creation options
- [ ] `/cancel` cancels operation

### Test Event Creation
- [ ] Full event with all fields
- [ ] Event with skipped optional fields
- [ ] Event with invalid date format
- [ ] Event with invalid time format
- [ ] Event with organizing group
- [ ] Event without organizing group
- [ ] Cancel mid-creation with `/cancel`

### Test Member Creation
- [ ] Full member with all fields
- [ ] Member with skipped email
- [ ] Member with skipped address
- [ ] Member with invalid phone
- [ ] Member with invalid email
- [ ] Member with short password
- [ ] Member with duplicate phone (should fail)
- [ ] Member with group assignment
- [ ] Member without group
- [ ] Cancel mid-creation with `/cancel`

### Test PDF Upload
- [ ] Valid bank statement PDF
- [ ] Non-PDF file (should be ignored)

---

## 📋 Detailed Test Scenarios

### Test 1: Complete Event Creation

**Steps:**
1. Send `/create`
2. Click "📅 Create Event"
3. Enter title: `Test Community Event`
4. Enter description: `This is a test event`
5. Enter address: `123 Test Street`
6. Click event type: `🎉 Event`
7. Enter date: `2025-01-15`
8. Enter start time: `14:00`
9. Enter end time: `16:00`
10. Enter cost: `50`
11. Click "✅ Create Event"
12. Select organizing group (or No Group)

**Expected Result:**
```
✅ Event Created Successfully!

Title: Test Community Event
Date: 2025-01-15
ID: [uuid]
```

---

### Test 2: Event with Skipped Fields

**Steps:**
1. Send `/create`
2. Click "📅 Create Event"
3. Enter title: `Quick Event`
4. Type: `skip` (for description)
5. Type: `skip` (for address)
6. Click event type: `📚 Meeting`
7. Enter date: `2025-02-20`
8. Enter start time: `10:00`
9. Enter end time: `11:30`
10. Enter cost: `0`
11. Click "✅ Create Event"
12. Click "❌ No Group"

**Expected Result:**
```
✅ Event Created Successfully!

Title: Quick Event
Date: 2025-02-20
ID: [uuid]
```

---

### Test 3: Invalid Date Format

**Steps:**
1. Send `/create`
2. Click "📅 Create Event"
3. Enter title: `Test Event`
4. Type: `skip`
5. Type: `skip`
6. Click event type: `🎉 Event`
7. Enter date: `15-01-2025` (wrong format)

**Expected Result:**
```
❌ Invalid date format. Please use YYYY-MM-DD (e.g., 2024-12-25):
```

**Then:**
8. Enter date: `2025-01-15` (correct format)
9. Should continue to time input

---

### Test 4: Invalid Time Format

**Steps:**
1. Complete event creation up to start time
2. Enter start time: `2:30pm` (wrong format)

**Expected Result:**
```
❌ Invalid time format. Please use HH:MM (e.g., 14:30):
```

**Then:**
3. Enter start time: `14:30` (correct format)
4. Should continue to end time

---

### Test 5: Cancel Event Creation

**Steps:**
1. Send `/create`
2. Click "📅 Create Event"
3. Enter title: `Test`
4. Enter description: `Test`
5. Send `/cancel`

**Expected Result:**
```
❌ Operation cancelled.
```

Bot should forget all entered data. Starting `/create` again should start fresh.

---

### Test 6: Complete Member Creation

**Steps:**
1. Send `/create`
2. Click "👤 Create Member"
3. Enter name: `Test User`
4. Enter phone: `0412345678`
5. Enter email: `test@example.com`
6. Enter address: `456 Test Ave`
7. Enter password: `TestPass123`
8. Click role: `👤 Community Member`
9. Select group (or No Group)
10. Enter household: `2`

**Expected Result:**
```
⏳ Creating member...
✅ Member Created Successfully!

Name: Test User
Phone: 0412345678
Role: Community Member
ID: [uuid]
```

---

### Test 7: Member with Skipped Fields

**Steps:**
1. Send `/create`
2. Click "👤 Create Member"
3. Enter name: `Quick Member`
4. Enter phone: `0498765432`
5. Type: `skip` (for email)
6. Type: `skip` (for address)
7. Enter password: `Password123`
8. Click role: `👤 Community Member`
9. Click "❌ No Group"
10. Enter household: `1`

**Expected Result:**
```
✅ Member Created Successfully!

Name: Quick Member
Phone: 0498765432
Role: Community Member
ID: [uuid]
```

---

### Test 8: Invalid Phone Number

**Steps:**
1. Send `/create`
2. Click "👤 Create Member"
3. Enter name: `Test`
4. Enter phone: `123` (too short)

**Expected Result:**
```
❌ Invalid phone number. Please enter a 10-digit Australian mobile (e.g., 0412345678):
```

**Then:**
5. Enter phone: `0412345678` (correct format)
6. Should continue to email

---

### Test 9: Invalid Email Format

**Steps:**
1. Complete member creation up to email
2. Enter email: `notanemail` (invalid)

**Expected Result:**
```
❌ Invalid email format. Please enter a valid email or type "skip":
```

**Then:**
3. Enter email: `valid@example.com` (correct)
4. Should continue to address

---

### Test 10: Short Password

**Steps:**
1. Complete member creation up to password
2. Enter password: `short` (too short)

**Expected Result:**
```
❌ Password must be at least 8 characters. Please try again:
```

**Then:**
3. Enter password: `LongerPassword123` (valid)
4. Should continue to role selection

---

### Test 11: Duplicate Phone Number

**Steps:**
1. Create a member with phone `0411111111`
2. Try to create another member with same phone

**Expected Result:**
```
❌ This phone number is already registered
```

---

### Test 12: Cancel Member Creation

**Steps:**
1. Send `/create`
2. Click "👤 Create Member"
3. Enter name: `Test`
4. Enter phone: `0412345678`
5. Send `/cancel`

**Expected Result:**
```
❌ Operation cancelled.
```

---

### Test 13: Multiple Events in Sequence

**Steps:**
1. Create event 1 (complete)
2. Send `/create` again
3. Create event 2 (complete)
4. Both should succeed independently

**Expected Result:**
Both events created successfully, no interference between them.

---

### Test 14: Multiple Members in Sequence

**Steps:**
1. Create member 1 (complete)
2. Send `/create` again
3. Create member 2 with different phone (complete)
4. Both should succeed independently

**Expected Result:**
Both members created successfully, no interference between them.

---

### Test 15: PDF Upload Still Works

**Steps:**
1. Send a valid PDF bank statement
2. Wait for processing

**Expected Result:**
```
📄 Processing...
✅ Bank statement processed successfully!
[transaction summary]
```

PDF upload should work independently of `/create` functionality.

---

## 🐛 Common Issues & Solutions

### Issue: Groups not showing in selection
**Cause:** `member_groups` table doesn't exist or is empty
**Solution:**
1. Run migration to create table:
   ```sql
   CREATE TABLE IF NOT EXISTS member_groups (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       name VARCHAR(100) NOT NULL UNIQUE,
       description TEXT,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```
2. Add some test groups:
   ```sql
   INSERT INTO member_groups (name) VALUES 
   ('Group A'), ('Group B'), ('Group C');
   ```

### Issue: Bot doesn't respond to /create
**Cause:** Webhook not configured or code not deployed
**Solution:**
1. Check webhook status: `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"`
2. Redeploy if needed
3. Re-run webhook setup: `npx tsx scripts/setup-telegram-bot.ts`

### Issue: "Error creating event/member"
**Cause:** Database connection or schema issue
**Solution:**
1. Check server logs for detailed error
2. Verify database URL in environment variables
3. Check that tables exist and have correct schema

### Issue: State persists after cancel
**Cause:** In-memory state might have an issue
**Solution:** Restart the server (state is cleared on restart)

### Issue: Validation not working
**Cause:** Regex patterns might not match input
**Solution:**
- Date: Use exactly YYYY-MM-DD (e.g., `2025-01-15`)
- Time: Use exactly HH:MM (e.g., `14:30`)
- Phone: Use 10 digits starting with 0 (e.g., `0412345678`)

---

## 📊 Test Results Template

Use this template to track your testing:

```markdown
# Test Results - [Date]

## Environment
- [ ] Production
- [ ] Development/Staging

## Event Creation Tests
- [ ] Test 1: Complete Event ✅/❌
- [ ] Test 2: Skipped Fields ✅/❌
- [ ] Test 3: Invalid Date ✅/❌
- [ ] Test 4: Invalid Time ✅/❌
- [ ] Test 5: Cancel Event ✅/❌

## Member Creation Tests
- [ ] Test 6: Complete Member ✅/❌
- [ ] Test 7: Skipped Fields ✅/❌
- [ ] Test 8: Invalid Phone ✅/❌
- [ ] Test 9: Invalid Email ✅/❌
- [ ] Test 10: Short Password ✅/❌
- [ ] Test 11: Duplicate Phone ✅/❌
- [ ] Test 12: Cancel Member ✅/❌

## Integration Tests
- [ ] Test 13: Multiple Events ✅/❌
- [ ] Test 14: Multiple Members ✅/❌
- [ ] Test 15: PDF Upload ✅/❌

## Notes
[Any issues or observations]
```

---

## 🔍 Monitoring & Debugging

### Check Server Logs
**Vercel:**
1. Go to Dashboard → Your Project → Logs
2. Look for "Telegram webhook received"
3. Check for any error messages

**Local Development:**
Check console output for:
- `Telegram webhook received: {...}`
- Error messages with stack traces

### Inspect State
Add logging in development:
```typescript
console.log('Current user states:', Array.from(userStates.entries()))
```

### Database Verification
After creating records, verify in database:

**Events:**
```sql
SELECT * FROM events 
WHERE title LIKE '%Test%' 
ORDER BY created_at DESC;
```

**Members:**
```sql
SELECT id, name, phone, role, group_name 
FROM users 
WHERE name LIKE '%Test%' 
ORDER BY date_joined DESC;
```

---

## 🎯 Success Criteria

✅ All commands work as expected
✅ Validation catches invalid input
✅ Error messages are clear and helpful
✅ Can cancel at any step
✅ Multiple creations work independently
✅ Database records are created correctly
✅ Groups load dynamically (if table exists)
✅ PDF upload still functions
✅ No interference between different features
✅ State is properly managed and cleaned up

---

## 📞 Need Help?

If tests fail:
1. Check server logs for detailed errors
2. Verify database connection and schema
3. Test webhook with `/start` command
4. Review `TELEGRAM_CREATE_FEATURE.md` for feature details
5. Check `TELEGRAM_FLOW_DIAGRAM.md` for expected flow

