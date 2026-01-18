import os
import logging
import asyncio
import sqlite3
import datetime
import uuid
import json
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from functools import wraps

# Third-party imports
from dotenv import load_dotenv
from telegram import (
    Update, 
    InlineKeyboardButton, 
    InlineKeyboardMarkup,
    ReplyKeyboardMarkup,
    KeyboardButton,
    InlineKeyboardMarkup,
    WebAppInfo
)
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ContextTypes,
    filters,
    ApplicationBuilder
)
from telegram.constants import ParseMode
from flask import Flask, render_template, request, jsonify

# Load environment variables
load_dotenv()

# Flask app for web interface
flask_app = Flask(__name__)

# ==================== CONFIGURATION ====================
class Config:
    """Configuration settings for the bot"""
    
    # Bot settings
    BOT_TOKEN = os.getenv("BOT_TOKEN", "")
    ADMIN_IDS = json.loads(os.getenv("ADMIN_IDS", "[]"))
    WEBHOOK_URL = os.getenv("WEBHOOK_URL", "")
    PORT = int(os.getenv("PORT", 8080))
    
    # Database
    DB_PATH = os.getenv("DB_PATH", "data/bot_database.db")
    
    # Financial settings
    AD_EARNING_RATE = float(os.getenv("AD_EARNING_RATE", "5.0"))
    REFERRAL_BONUS = float(os.getenv("REFERRAL_BONUS", "10.0"))
    MINIMUM_WITHDRAWAL = float(os.getenv("MINIMUM_WITHDRAWAL", "100.0"))
    DAILY_EARNING_LIMIT = float(os.getenv("DAILY_EARNING_LIMIT", "50.0"))
    MAX_ADS_PER_DAY = int(os.getenv("MAX_ADS_PER_DAY", "10"))
    AD_COOLDOWN_SECONDS = int(os.getenv("AD_COOLDOWN_SECONDS", "60"))
    
    # UI Settings
    SITE_TITLE = "💰 EarnMoney Bot"
    SITE_DESCRIPTION = "Watch ads, earn money, and withdraw easily!"
    THEME_COLORS = {
        'primary': '#6366f1',
        'secondary': '#8b5cf6',
        'success': '#10b981',
        'danger': '#ef4444',
        'warning': '#f59e0b',
        'info': '#3b82f6',
        'dark': '#1f2937',
        'light': '#f9fafb'
    }

# ==================== DATABASE MODELS ====================
class Database:
    """Database manager with enhanced features"""
    
    def __init__(self, db_path: str = Config.DB_PATH):
        self.db_path = db_path
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.init_database()
    
    def init_database(self):
        """Initialize database with all tables"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Enable foreign keys
        cursor.execute('PRAGMA foreign_keys = ON')
        
        # Users table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER UNIQUE NOT NULL,
                username TEXT,
                first_name TEXT,
                last_name TEXT,
                referral_code TEXT UNIQUE NOT NULL,
                referred_by INTEGER,
                balance REAL DEFAULT 0.0,
                total_earned REAL DEFAULT 0.0,
                total_withdrawn REAL DEFAULT 0.0,
                total_ads_watched INTEGER DEFAULT 0,
                joined_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_banned INTEGER DEFAULT 0,
                is_premium INTEGER DEFAULT 0,
                language TEXT DEFAULT 'en',
                FOREIGN KEY (referred_by) REFERENCES users(id) ON DELETE SET NULL
            )
        ''')
        
        # Earnings table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS earnings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                amount REAL NOT NULL,
                type TEXT NOT NULL,
                description TEXT,
                earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')
        
        # Withdrawals table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS withdrawals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                amount REAL NOT NULL,
                method TEXT NOT NULL,
                mobile_number TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                transaction_id TEXT,
                requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                processed_at TIMESTAMP,
                notes TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')
        
        # Ads table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS ads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                url TEXT,
                earnings REAL NOT NULL,
                duration INTEGER DEFAULT 30,
                category TEXT DEFAULT 'general',
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # User ads table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_ads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                ad_id INTEGER NOT NULL,
                watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                earnings REAL NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE
            )
        ''')
        
        # Daily limits table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS daily_limits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                date DATE NOT NULL,
                ads_watched INTEGER DEFAULT 0,
                earned_today REAL DEFAULT 0.0,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(user_id, date)
            )
        ''')
        
        # Settings table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value TEXT NOT NULL,
                description TEXT
            )
        ''')
        
        # Notifications table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                is_read INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')
        
        # Insert default settings
        default_settings = [
            ('ad_earning_rate', str(Config.AD_EARNING_RATE), 'Earnings per ad'),
            ('referral_bonus', str(Config.REFERRAL_BONUS), 'Bonus per referral'),
            ('minimum_withdrawal', str(Config.MINIMUM_WITHDRAWAL), 'Minimum withdrawal amount'),
            ('daily_earning_limit', str(Config.DAILY_EARNING_LIMIT), 'Daily earning limit'),
            ('max_ads_per_day', str(Config.MAX_ADS_PER_DAY), 'Maximum ads per day'),
            ('ad_cooldown', str(Config.AD_COOLDOWN_SECONDS), 'Seconds between ads'),
            ('welcome_bonus', '0', 'Welcome bonus for new users'),
            ('premium_multiplier', '1.5', 'Earning multiplier for premium users'),
            ('site_title', Config.SITE_TITLE, 'Website title'),
            ('site_description', Config.SITE_DESCRIPTION, 'Website description')
        ]
        
        for key, value, desc in default_settings:
            cursor.execute('INSERT OR IGNORE INTO settings (key, value, description) VALUES (?, ?, ?)', 
                         (key, value, desc))
        
        # Insert sample ads
        cursor.execute('SELECT COUNT(*) FROM ads')
        if cursor.fetchone()[0] == 0:
            sample_ads = [
                ('📱 Mobile App Review', 'Watch this 30-second ad about new mobile app', 
                 'https://example.com', Config.AD_EARNING_RATE, 30, 'mobile'),
                ('🛍️ E-commerce Offer', 'Special discount offer for online shopping',
                 'https://example.com', Config.AD_EARNING_RATE, 45, 'shopping'),
                ('🎮 Game Promotion', 'Try this new exciting mobile game',
                 'https://example.com', Config.AD_EARNING_RATE, 60, 'gaming'),
                ('💼 Job Opportunity', 'Find your dream job with us',
                 'https://example.com', Config.AD_EARNING_RATE * 1.5, 90, 'jobs')
            ]
            for title, desc, url, earnings, duration, category in sample_ads:
                cursor.execute('INSERT INTO ads (title, description, url, earnings, duration, category) VALUES (?, ?, ?, ?, ?, ?)', 
                             (title, desc, url, earnings, duration, category))
        
        conn.commit()
        conn.close()
    
    def get_connection(self):
        """Get database connection with row factory"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    # User operations
    def register_user(self, telegram_id: int, username: str, first_name: str, last_name: str = "", referred_by: int = None) -> bool:
        """Register a new user with welcome bonus"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Generate unique referral code
        referral_code = f"REF{telegram_id}{uuid.uuid4().hex[:6].upper()}"
        
        try:
            # Get welcome bonus
            cursor.execute('SELECT value FROM settings WHERE key = "welcome_bonus"')
            welcome_bonus = float(cursor.fetchone()[0])
            
            cursor.execute('''
                INSERT INTO users (telegram_id, username, first_name, last_name, referral_code, referred_by, balance, total_earned)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (telegram_id, username, first_name, last_name, referral_code, referred_by, welcome_bonus, welcome_bonus))
            
            user_id = cursor.lastrowid
            
            # Record welcome bonus
            if welcome_bonus > 0:
                cursor.execute('''
                    INSERT INTO earnings (user_id, amount, type, description)
                    VALUES (?, ?, 'bonus', 'Welcome Bonus')
                ''', (user_id, welcome_bonus))
            
            # If referred by someone, give referral bonus
            if referred_by:
                self.add_referral_earning(referred_by, telegram_id, user_id)
            
            # Create notification
            cursor.execute('''
                INSERT INTO notifications (user_id, title, message)
                VALUES (?, 'Welcome!', 'Thanks for joining! You received welcome bonus.')
            ''', (user_id,))
            
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False
        finally:
            conn.close()
    
    def get_user(self, telegram_id: int) -> Optional[Dict]:
        """Get user by Telegram ID"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM users WHERE telegram_id = ?', (telegram_id,))
        row = cursor.fetchone()
        conn.close()
        
        return dict(row) if row else None
    
    def update_user_activity(self, telegram_id: int):
        """Update user last active timestamp"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE telegram_id = ?', (telegram_id,))
        conn.commit()
        conn.close()
    
    # Enhanced with more methods...
    # (Previous database methods from your code with improvements)

# ==================== TELEGRAM BOT ====================
class TelegramBot:
    """Enhanced Telegram bot with web interface"""
    
    def __init__(self):
        self.db = Database()
        self.application = None
        self.setup_commands()
    
    def setup_commands(self):
        """Setup bot commands for menu"""
        self.commands = [
            ("start", "Start the bot"),
            ("earn", "Earn money by watching ads"),
            ("balance", "Check your balance"),
            ("referral", "Get referral link"),
            ("withdraw", "Withdraw money"),
            ("stats", "View your statistics"),
            ("help", "Get help"),
            ("menu", "Show main menu")
        ]
    
    async def start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /start command with web app button"""
        user = update.effective_user
        telegram_id = user.id
        
        # Register user if not exists
        user_data = self.db.get_user(telegram_id)
        if not user_data:
            self.db.register_user(
                telegram_id=telegram_id,
                username=user.username or "",
                first_name=user.first_name,
                last_name=user.last_name or ""
            )
            user_data = self.db.get_user(telegram_id)
        
        # Update activity
        self.db.update_user_activity(telegram_id)
        
        # Create keyboard with Web App button
        keyboard = [
            [
                InlineKeyboardButton(
                    text="🌐 Open Web Dashboard",
                    web_app=WebAppInfo(url=f"https://your-domain.com/dashboard/{telegram_id}")
                )
            ],
            [
                InlineKeyboardButton("🎁 Earn Money", callback_data="earn_menu"),
                InlineKeyboardButton("💰 Balance", callback_data="balance")
            ],
            [
                InlineKeyboardButton("👥 Referrals", callback_data="referral"),
                InlineKeyboardButton("💸 Withdraw", callback_data="withdraw_menu")
            ],
            [
                InlineKeyboardButton("📊 Stats", callback_data="stats"),
                InlineKeyboardButton("🆘 Help", callback_data="help")
            ]
        ]
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        welcome_message = f"""
✨ **Welcome to {Config.SITE_TITLE}!** ✨

🎉 Hello {user.first_name}!

💰 **Your Balance:** {user_data['balance'] if user_data else '0'} BDT

📱 **Web Dashboard:** Click the button below to open our modern web interface with glassmorphism design!

🎯 **Features:**
• 📺 Watch ads & earn money
• 👥 Refer friends & earn bonuses
• 💸 Easy withdrawals
• 📊 Real-time statistics
• 🎨 Beautiful UI

👇 **Use buttons below or open web dashboard:**
        """
        
        await update.message.reply_text(
            welcome_message,
            reply_markup=reply_markup,
            parse_mode=ParseMode.MARKDOWN
        )
    
    # Other bot methods (similar to your original code but enhanced)
    # ... (Previous bot handlers with improvements)

# ==================== FLASK WEB INTERFACE ====================
@flask_app.route('/')
def home():
    """Home page"""
    return render_template('index.html',
                         title=Config.SITE_TITLE,
                         description=Config.SITE_DESCRIPTION,
                         colors=Config.THEME_COLORS)

@flask_app.route('/dashboard/<user_id>')
def dashboard(user_id):
    """User dashboard"""
    return render_template('index.html',
                         title=f"Dashboard | {Config.SITE_TITLE}",
                         user_id=user_id,
                         colors=Config.THEME_COLORS)

@flask_app.route('/api/user/<telegram_id>')
def get_user_data(telegram_id):
    """API endpoint to get user data"""
    db = Database()
    user = db.get_user(int(telegram_id))
    
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    # Get user stats
    conn = db.get_connection()
    cursor = conn.cursor()
    
    # Today's earnings
    today = datetime.date.today().isoformat()
    cursor.execute('SELECT earned_today FROM daily_limits WHERE user_id = ? AND date = ?', 
                  (user['id'], today))
    today_earned = cursor.fetchone()
    today_earned = today_earned[0] if today_earned else 0
    
    # Referral stats
    cursor.execute('SELECT COUNT(*) FROM users WHERE referred_by = ?', (user['id'],))
    total_refs = cursor.fetchone()[0]
    
    cursor.execute('''
        SELECT COUNT(DISTINCT u.id) 
        FROM users u
        JOIN earnings e ON u.id = e.user_id
        WHERE u.referred_by = ?
    ''', (user['id'],))
    active_refs = cursor.fetchone()[0]
    
    conn.close()
    
    return jsonify({
        "user": {
            "id": user['id'],
            "telegram_id": user['telegram_id'],
            "username": user['username'],
            "first_name": user['first_name'],
            "balance": user['balance'],
            "total_earned": user['total_earned'],
            "total_withdrawn": user['total_withdrawn'],
            "total_ads_watched": user['total_ads_watched'],
            "joined_date": user['joined_date'],
            "is_premium": bool(user['is_premium'])
        },
        "stats": {
            "today_earned": today_earned,
            "total_referrals": total_refs,
            "active_referrals": active_refs,
            "referral_earnings": user['total_earned'] - today_earned - (user['total_ads_watched'] * Config.AD_EARNING_RATE)
        }
    })

@flask_app.route('/api/ads')
def get_ads():
    """API endpoint to get available ads"""
    db = Database()
    ads = db.get_available_ads()
    
    return jsonify({
        "ads": [
            {
                "id": ad['id'],
                "title": ad['title'],
                "description": ad['description'],
                "earnings": ad['earnings'],
                "duration": ad['duration'],
                "category": ad['category']
            }
            for ad in ads
        ]
    })

@flask_app.route('/api/withdraw', methods=['POST'])
def create_withdrawal():
    """API endpoint to create withdrawal"""
    data = request.json
    telegram_id = data.get('telegram_id')
    amount = float(data.get('amount', 0))
    method = data.get('method')
    mobile = data.get('mobile')
    
    db = Database()
    success = db.create_withdrawal(telegram_id, amount, method, mobile)
    
    if success:
        return jsonify({"success": True, "message": "Withdrawal request submitted"})
    else:
        return jsonify({"success": False, "message": "Withdrawal failed"}), 400

# ==================== RUN BOT & WEB SERVER ====================
async def run_bot():
    """Run the Telegram bot"""
    if not Config.BOT_TOKEN:
        logging.error("BOT_TOKEN not found in environment variables")
        return
    
    # Create bot application
    application = ApplicationBuilder().token(Config.BOT_TOKEN).build()
    
    # Create bot instance
    bot = TelegramBot()
    
    # Setup handlers
    application.add_handler(CommandHandler("start", bot.start))
    # Add other handlers...
    
    # Setup webhook if WEBHOOK_URL is provided
    if Config.WEBHOOK_URL:
        await application.bot.set_webhook(
            url=f"{Config.WEBHOOK_URL}/{Config.BOT_TOKEN}",
            drop_pending_updates=True
        )
        logging.info("Webhook set")
    else:
        # Start polling
        await application.initialize()
        await application.start()
        await application.updater.start_polling()
        logging.info("Bot started with polling")
    
    return application

def run_web():
    """Run the Flask web server"""
    flask_app.run(
        host='0.0.0.0',
        port=Config.PORT,
        debug=os.getenv('DEBUG', 'False').lower() == 'true'
    )

if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Run both bot and web server
    import threading
    
    # Start web server in a thread
    web_thread = threading.Thread(target=run_web, daemon=True)
    web_thread.start()
    
    # Run bot in main thread
    asyncio.run(run_bot())
