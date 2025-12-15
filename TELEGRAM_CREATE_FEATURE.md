# 🤖 Telegram Bot - Create Events & Members

The Telegram bot now supports interactive creation of events and members through a conversational interface with buttons!

## 🎯 Features

### ➕ `/create` Command
Start the creation process with an interactive menu to choose between:
- **📅 Create Event** - Create community events with all details
- **👤 Create Member** - Add new members to the system

### 📅 Event Creation Flow

1. **Title** - Enter the event title
2. **Description** - Add description (or skip)
3. **Address** - Event location (or skip)
4. **Type** - Select from button options:
   - 🎉 Event
   - 📚 Meeting
   - 🎊 Celebration
   - 📖 Educational
   - 🙏 Religious
5. **Date** - Enter date in YYYY-MM-DD format
6. **Start Time** - Enter in HH:MM format (24-hour)
7. **End Time** - Enter in HH:MM format (24-hour)
8. **Cost** - Enter estimated cost in dollars
9. **Confirmation** - Review and confirm
10. **Organizing Group** - Select which group will organize (optional)

### 👤 Member Creation Flow

1. **Name** - Enter full name
2. **Phone** - Enter 10-digit Australian mobile number
3. **Email** - Enter email address (or skip)
4. **Address** - Enter home address (or skip)
5. **Password** - Set login password (min 8 characters)
6. **Role** - Select from button options:
   - 👤 Community Member
   - 👔 Manager
   - 📋 Public Officer
   - 💰 Finance Officer
   - 📦 Logistics Officer
7. **Group** - Select member group (or none)
8. **Household Members** - Enter number of household members
9. **Auto-created** - Member is created and confirmed

## 🎮 Commands

| Command | Description |
|---------|-------------|
| `/start` | Show welcome message and available commands |
| `/create` | Start the creation menu (event or member) |
| `/cancel` | Cancel current creation process |

## 📱 Usage Examples

### Creating an Event

```
User: /create
Bot: ➕ What would you like to create?
     [📅 Create Event] [👤 Create Member]

User: [Clicks "Create Event"]
Bot: 📅 Creating Event
     Please enter the event title:

User: Community BBQ
Bot: 📝 Enter event description (or type "skip" to skip):

User: Annual summer BBQ gathering
Bot: 📍 Enter event address (or type "skip" to skip):

User: Community Hall, 123 Main St
Bot: 🎯 Select event type:
     [🎉 Event] [📚 Meeting] [🎊 Celebration] [📖 Educational] [🙏 Religious]

User: [Clicks "Event"]
Bot: 📆 Enter the event date (YYYY-MM-DD):

User: 2024-12-25
Bot: 🕐 Enter start time (HH:MM in 24-hour format):

User: 14:00
Bot: 🕐 Enter end time (HH:MM in 24-hour format):

User: 18:00
Bot: 💰 Enter estimated cost in dollars (or type "0" for free):

User: 200
Bot: 📅 Event Summary
     Title: Community BBQ
     Type: Event
     Date: 2024-12-25
     Time: 14:00 - 18:00
     Location: Community Hall, 123 Main St
     Description: Annual summer BBQ gathering
     Estimated Cost: $200
     
     Ready to create this event?
     [✅ Create Event] [❌ Cancel]

User: [Clicks "Create Event"]
Bot: 👥 Select organizing group (optional):
     [Group A] [Group B] [Group C] [❌ No Group]

User: [Clicks "Group A"]
Bot: ⏳ Creating event...
     ✅ Event Created Successfully!
     Title: Community BBQ
     Date: 2024-12-25
     ID: abc-123-def
```

### Creating a Member

```
User: /create
Bot: ➕ What would you like to create?
     [📅 Create Event] [👤 Create Member]

User: [Clicks "Create Member"]
Bot: 👤 Creating Member
     Please enter the member's full name:

User: John Smith
Bot: 📱 Enter phone number (e.g., 0412345678):

User: 0412345678
Bot: 📧 Enter email address (or type "skip" to skip):

User: john.smith@example.com
Bot: 🏠 Enter home address (or type "skip" to skip):

User: 456 Oak Avenue, Sydney
Bot: 🔒 Enter a password (minimum 8 characters):

User: SecurePass123
Bot: 👔 Select member role:
     [👤 Community Member] [👔 Manager] [📋 Public Officer]
     [💰 Finance Officer] [📦 Logistics Officer]

User: [Clicks "Community Member"]
Bot: 👥 Select member group:
     [Group A] [Group B] [Group C] [❌ No Group]

User: [Clicks "Group A"]
Bot: 👥 How many household members? (Enter a number)

User: 3
Bot: ⏳ Creating member...
     ✅ Member Created Successfully!
     Name: John Smith
     Phone: 0412345678
     Role: Community Member
     ID: xyz-789-abc
```

## 🔧 Technical Details

### State Management
- Uses in-memory `Map<chatId, CreationState>` to track user progress
- Each state includes: type (event/member), current step, data collected, timestamp
- Automatically cleaned up on completion or cancellation

### Validation
- **Date Format**: YYYY-MM-DD (e.g., 2024-12-25)
- **Time Format**: HH:MM in 24-hour format (e.g., 14:30)
- **Phone Number**: 10-digit Australian mobile (e.g., 0412345678)
- **Email**: Standard email format validation
- **Password**: Minimum 8 characters
- **Cost**: Must be a valid number ≥ 0

### Error Handling
- Invalid input formats show helpful error messages
- Duplicate phone/email errors are caught and reported
- Database errors are logged and user-friendly messages shown
- `/cancel` command available at any step

### Security
- Passwords are hashed with bcrypt before storage
- No sensitive data logged to console
- State timeout can be implemented (currently in-memory)

## 🚀 Setup

The feature is already integrated into the existing Telegram bot. No additional setup required beyond the standard Telegram bot configuration.

Just ensure:
1. `TELEGRAM_BOT_TOKEN` is set in environment variables
2. Webhook is configured (see `TELEGRAM_BOT_SETUP.md`)
3. Database tables exist for `events`, `users`, and `member_groups`

## 💡 Tips

- Use `/cancel` at any time to abort the creation process
- Most fields support "skip" for optional information
- Button selections are faster than typing for predefined options
- Date/time validation ensures data consistency
- Groups must exist in database before they appear in selection

## 🐛 Troubleshooting

### "Error loading groups"
- Check that `member_groups` table exists in database
- Verify database connection is working
- Bot will continue without group selection if table doesn't exist

### "This phone number is already registered"
- Phone numbers must be unique in the system
- Check existing members before creating

### "Invalid date format"
- Use YYYY-MM-DD format exactly (e.g., 2024-12-25)
- Ensure month and day have leading zeros (12, not 12)

### State not persisting
- In-memory state is cleared on server restart
- Users need to start over if bot restarts mid-creation
- Consider Redis/database for production persistence

## 🎨 Customization

### Adding New Event Types
Edit the `showEventTypeSelection` function to add more types:

```typescript
const keyboard = {
  inline_keyboard: [
    [{ text: '🆕 New Type', callback_data: 'event_type_NewType' }],
    // ... existing types
  ],
}
```

### Adding New Member Roles
Edit the `showRoleSelection` function:

```typescript
const keyboard = {
  inline_keyboard: [
    [{ text: '🆕 New Role', callback_data: 'role_New_Role' }],
    // ... existing roles
  ],
}
```

### Custom Validation
Add custom validation in `handleEventInput` or `handleMemberInput` functions for specific fields.

## 📊 Future Enhancements

Potential improvements:
- 📸 Image upload support for events/members
- 📅 Calendar picker for dates
- 🔄 Edit existing records
- 📋 View created records
- 🔍 Search functionality
- 👥 Bulk member import
- 📧 Email notifications on creation
- ⏰ Reminder setup during event creation
- 📱 SMS verification for phone numbers

