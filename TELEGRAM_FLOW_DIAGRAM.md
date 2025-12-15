# 🔄 Telegram Bot Flow Diagrams

Visual representation of the Telegram bot interaction flows.

## 📅 Event Creation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     User sends: /create                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Bot: "What would you like to create?"                      │
│  [📅 Create Event] [👤 Create Member]                       │
└──────────────────────┬──────────────────────────────────────┘
                       │ User clicks "Create Event"
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Bot: "Please enter the event title:"                       │
└──────────────────────┬──────────────────────────────────────┘
                       │ User types: "Community BBQ"
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Bot: "Enter event description (or skip):"                  │
└──────────────────────┬──────────────────────────────────────┘
                       │ User types description or "skip"
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Bot: "Enter event address (or skip):"                      │
└──────────────────────┬──────────────────────────────────────┘
                       │ User types address or "skip"
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Bot: "Select event type:"                                  │
│  [🎉 Event] [📚 Meeting] [🎊 Celebration]                   │
│  [📖 Educational] [🙏 Religious]                            │
└──────────────────────┬──────────────────────────────────────┘
                       │ User clicks a type
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Bot: "Enter the event date (YYYY-MM-DD):"                  │
└──────────────────────┬──────────────────────────────────────┘
                       │ User types: "2024-12-25"
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Bot: "Enter start time (HH:MM):"                           │
└──────────────────────┬──────────────────────────────────────┘
                       │ User types: "14:00"
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Bot: "Enter end time (HH:MM):"                             │
└──────────────────────┬──────────────────────────────────────┘
                       │ User types: "18:00"
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Bot: "Enter estimated cost in dollars:"                    │
└──────────────────────┬──────────────────────────────────────┘
                       │ User types: "200"
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Bot: Shows summary                                         │
│  "Ready to create this event?"                              │
│  [✅ Create Event] [❌ Cancel]                              │
└──────────────────────┬──────────────────────────────────────┘
                       │ User clicks "Create Event"
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Bot: "Select organizing group (optional):"                 │
│  [Group A] [Group B] [Group C] [❌ No Group]               │
└──────────────────────┬──────────────────────────────────────┘
                       │ User selects a group
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Bot: "⏳ Creating event..."                                │
│  "✅ Event Created Successfully!"                           │
└─────────────────────────────────────────────────────────────┘
```

## 👤 Member Creation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     User sends: /create                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Bot: "What would you like to create?"                      │
│  [📅 Create Event] [👤 Create Member]                       │
└──────────────────────┬──────────────────────────────────────┘
                       │ User clicks "Create Member"
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Bot: "Please enter the member's full name:"                │
└──────────────────────┬──────────────────────────────────────┘
                       │ User types: "John Smith"
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Bot: "Enter phone number (e.g., 0412345678):"              │
└──────────────────────┬──────────────────────────────────────┘
                       │ User types: "0412345678"
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Bot: "Enter email address (or skip):"                      │
└──────────────────────┬──────────────────────────────────────┘
                       │ User types email or "skip"
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Bot: "Enter home address (or skip):"                       │
└──────────────────────┬──────────────────────────────────────┘
                       │ User types address or "skip"
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Bot: "Enter a password (minimum 8 characters):"            │
└──────────────────────┬──────────────────────────────────────┘
                       │ User types password
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Bot: "Select member role:"                                 │
│  [👤 Community Member] [👔 Manager]                         │
│  [📋 Public Officer] [💰 Finance Officer]                   │
│  [📦 Logistics Officer]                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │ User selects a role
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Bot: "Select member group:"                                │
│  [Group A] [Group B] [Group C] [❌ No Group]               │
└──────────────────────┬──────────────────────────────────────┘
                       │ User selects a group
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Bot: "How many household members? (Enter a number)"        │
└──────────────────────┬──────────────────────────────────────┘
                       │ User types: "3"
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Bot: "⏳ Creating member..."                               │
│  "✅ Member Created Successfully!"                          │
└─────────────────────────────────────────────────────────────┘
```

## 📄 Bank Statement Upload Flow

```
┌─────────────────────────────────────────────────────────────┐
│              User sends PDF document                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Bot: "📄 Processing..."                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  • Download PDF from Telegram                               │
│  • Parse transactions                                       │
│  • Upload to Cloudflare R2 (if configured)                  │
│  • Create bank statement record                             │
│  • Insert transactions into database                        │
│  • Match transactions to members                            │
│  • Auto-detect membership payments                          │
│  • Update account balance                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Bot: "✅ Bank statement processed successfully!"           │
│  "📊 Summary:"                                              │
│  "• Total transactions found: 25"                           │
│  "• Successfully imported: 23"                              │
│  "💰 New balance: $12,345.67"                              │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 State Management

```
┌─────────────────────────────────────────────────────────────┐
│                    User States Map                           │
│  (In-Memory: Map<chatId, CreationState>)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
    ┌──────────────────┴──────────────────┐
    │                                      │
    ▼                                      ▼
┌─────────────────┐              ┌─────────────────┐
│  Event State    │              │  Member State   │
├─────────────────┤              ├─────────────────┤
│ type: 'event'   │              │ type: 'member'  │
│ step: 'title'   │              │ step: 'name'    │
│ data: {}        │              │ data: {}        │
│ timestamp       │              │ timestamp       │
└─────────────────┘              └─────────────────┘
```

### State Lifecycle

```
/create → State Created → User Input → State Updated → Complete → State Deleted
                ↑                                                       ↓
                └───────────────── /cancel ─────────────────────────────┘
```

## 🎯 Callback Query Routing

```
Callback Data Format:
├── create_event          → Start event creation
├── create_member         → Start member creation
├── event_type_{type}     → Select event type
├── role_{role}           → Select member role
├── group_{name}          → Select member group
├── org_group_{name}      → Select organizing group
├── confirm_yes           → Confirm creation
└── confirm_no            → Cancel creation
```

## 🔐 Validation Points

```
Event Creation:
├── Date: Must match YYYY-MM-DD (e.g., 2024-12-25)
├── Start Time: Must match HH:MM (e.g., 14:30)
├── End Time: Must match HH:MM (e.g., 16:30)
└── Cost: Must be valid number ≥ 0

Member Creation:
├── Phone: Must be 10-digit Australian mobile
├── Email: Must be valid email format (or skip)
└── Password: Must be ≥ 8 characters
```

## 📊 Success Flow Summary

```
User Action → Bot Response → Validation → Database → Confirmation
     ↓              ↓             ↓           ↓            ↓
  /create    Show buttons   Check format   Insert    Show success
   Input      Ask next      Retry error    Record     + details
   Click      Update state  Continue       Update     Clear state
```

## 🚫 Error Handling Flow

```
Invalid Input
    ↓
Validation Fails
    ↓
Bot: "❌ Error message with format example"
    ↓
State: Stays on same step
    ↓
User: Can retry or /cancel
```

## 💡 Key Features

1. **Stateful Conversations**: Bot remembers where you are in the process
2. **Button Navigation**: Quick selections for predefined options
3. **Text Input**: Free-form entry for custom data
4. **Validation**: Real-time format checking
5. **Error Recovery**: Clear messages and retry capability
6. **Cancel Anytime**: `/cancel` command exits any flow
7. **Confirmation**: Review before final submission
8. **Database Integration**: Direct creation in PostgreSQL
9. **Group Loading**: Dynamic button generation from database
10. **Security**: Password hashing, input sanitization

## 🎨 User Experience Highlights

✅ **Intuitive**: Guided step-by-step process
✅ **Flexible**: Skip optional fields easily
✅ **Safe**: Validation prevents bad data
✅ **Fast**: Buttons for quick selection
✅ **Clear**: Helpful error messages
✅ **Responsive**: Immediate feedback
✅ **Complete**: Full feature coverage
✅ **Reversible**: Cancel at any step

