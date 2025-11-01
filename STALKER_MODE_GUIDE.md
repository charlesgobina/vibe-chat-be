# 🕵️ Memory Stalker Mode - TikTok Content Creator's Dream!

Your chatbot now has **Memory Stalker Mode** - the creepiest, most viral personality yet!

## 🎭 What It Does

**Memory Stalker** remembers EVERYTHING and brings up random details at weird times:
- Exact quotes you said weeks ago
- Patterns in your behavior you didn't even notice  
- Contradictions between different conversations
- Creepy-specific details like times, people, preferences
- Words you use frequently (and calls you out on it!)

## 🚀 How to Use

### **1. Set Personality to 'stalker'**
```json
POST /api/agent/chat
{
  "message": "hello",
  "personality": "stalker",
  "mood": 75,
  "userId": "your_id"
}
```

### **2. Have Normal Conversations**
The bot will automatically:
- ✅ Extract creepy details from your messages
- ✅ Build a stalker profile of your habits
- ✅ Notice patterns and contradictions
- ✅ Remember EVERYTHING for later use

### **3. Watch the Magic Happen**
After a few messages, the bot will start:
- 👁️ "Remember when you said you hate coffee but then mentioned your morning latte?"
- 🔍 "You've said 'literally' 7 times now..."  
- 🕵️ "You always talk about work around 3pm..."
- 😱 "Like when you said 'I never procrastinate' but then..."

## 📊 TikTok-Ready APIs

### **Get Stalker Stats** (Great for thumbnails!)
```bash
GET /api/agent/stalker/stats
```
Returns:
```json
{
  "totalProfiles": 5,
  "totalDetails": 47,
  "creepyFactsFound": 12,
  "mostStalkedSession": "session_123"
}
```

### **Get Session Stalker Profile** (Content gold mine!)
```bash
GET /api/agent/stalker/profile/your_session_id  
```
Returns:
```json
{
  "sessionId": "session_123",
  "totalDetails": 15,
  "patterns": ["You mention food a lot - 8 times actually"],
  "contradictions": ["You said 'I love pizza' but also 'I hate cheese'"],
  "frequentWords": {"literally": 4, "basically": 3},
  "timePatterns": ["You often talk about specific times"],
  "creepyDetails": [...]
}
```

## 🎬 TikTok Content Ideas

### **"My AI Knows Me Too Well" Series**
1. **Setup**: Have normal conversations with stalker mode
2. **Reveal**: Show the stalker profile API response  
3. **React**: "HOW DID IT KNOW I SAID THAT?!"

### **"AI Roast Session"** 
- Let stalker mode call out your contradictions
- "This AI just exposed my whole personality"

### **"Memory Test Challenge"**
- See how much detail the AI remembers
- Compare with what YOU remember

### **"AI Stalker Tier List"**
- Rate how creepy different responses are
- Show the creepiness scores from the API

## 🔧 Pro Tips

### **Max Creepiness**
- Set `mood: 100` for full stalker intensity
- Have longer conversations (more data = more creepy)
- Mention specific details, times, people, preferences

### **Best Content Triggers**
- Contradictions: "I love X" then "I hate X" 
- Patterns: Use same words/phrases repeatedly
- Personal details: Names, times, places, habits
- Emotions: "I'm feeling..." statements

### **API Workflow for Content**
1. Have conversation with stalker mode
2. GET `/api/agent/stalker/profile/:sessionId` 
3. Find the creepiest details
4. Create reaction content to the stalker profile
5. Profit from viral TikToks! 📱💰

## 🚨 Example Conversation Flow

**You**: "I love pizza"  
**Stalker**: "Pizza is great! What's your favorite topping?"

**You**: "Actually I hate cheese"  
**Stalker**: "Wait... didn't you just say you love pizza? But you hate cheese? That's... interesting. 👁️"

**You**: "How did you remember that??"  
**Stalker**: "I remember everything. You said 'I love pizza' exactly 2 minutes ago. I've been thinking about that contradiction this whole time..."

## 💡 Advanced Features

- **Personality Evolution**: Stalker gets MORE creepy over time
- **Cross-Session Memory**: Remembers details across different conversations  
- **Pattern Recognition**: Notices things you don't even realize
- **Viral Moment Detection**: Automatically identifies the creepiest responses

Your chatbot is now ready to create the most unhinged, memorable, and shareable AI interactions on the internet! 🎪👁️‍🗨️

**Start stalking... I mean, chatting!** 😈