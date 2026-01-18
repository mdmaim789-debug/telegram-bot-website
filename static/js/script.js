
class EarnMoneyBot {
    constructor() {
        this.userData = null;
        this.currentPage = 'dashboard';
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.checkAuth();
        this.loadPage('dashboard');
    }
    
    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = e.target.dataset.page;
                this.loadPage(page);
            });
        });
        
        // Theme toggle
        document.getElementById('themeToggle')?.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
        });
        
        // Watch ad button
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('watch-ad-btn')) {
                this.watchAd(e.target.dataset.adId);
            }
        });
    }
    
    async checkAuth() {
        const userId = new URLSearchParams(window.location.search).get('user_id');
        if (userId) {
            await this.loadUserData(userId);
        } else {
            this.showLoginModal();
        }
    }
    
    async loadUserData(userId) {
        try {
            const response = await fetch(`/api/user/${userId}`);
            if (response.ok) {
                this.userData = await response.json();
                this.updateUI();
                this.showNotification('User data loaded successfully!', 'success');
            } else {
                this.showLoginModal();
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            this.showNotification('Failed to load user data', 'error');
        }
    }
    
    updateUI() {
        if (!this.userData) return;
        
        // Update user info
        document.querySelectorAll('.user-name').forEach(el => {
            el.textContent = this.userData.user.first_name;
        });
        
        document.querySelectorAll('.user-balance').forEach(el => {
            el.textContent = `৳${this.userData.user.balance.toFixed(2)}`;
        });
        
        // Update stats
        const stats = this.userData.stats;
        document.getElementById('todayEarnings').textContent = `৳${stats.today_earned.toFixed(2)}`;
        document.getElementById('totalReferrals').textContent = stats.total_referrals;
        document.getElementById('activeReferrals').textContent = stats.active_referrals;
        document.getElementById('totalEarnings').textContent = `৳${this.userData.user.total_earned.toFixed(2)}`;
        document.getElementById('adsWatched').textContent = this.userData.user.total_ads_watched;
        
        // Update referral link
        const refLink = `https://t.me/${window.botUsername}?start=ref${this.userData.user.telegram_id}`;
        document.getElementById('referralLink').value = refLink;
    }
    
    async loadPage(page) {
        this.currentPage = page;
        
        // Update active nav button
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === page);
        });
        
        // Load page content
        const container = document.getElementById('mainContent');
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
        
        try {
            let html = '';
            
            switch(page) {
                case 'dashboard':
                    html = await this.getDashboardHTML();
                    break;
                case 'earn':
                    html = await this.getEarnHTML();
                    break;
                case 'referrals':
                    html = await this.getReferralsHTML();
                    break;
                case 'withdraw':
                    html = await this.getWithdrawHTML();
                    break;
                case 'history':
                    html = await this.getHistoryHTML();
                    break;
                case 'support':
                    html = await this.getSupportHTML();
                    break;
            }
            
            container.innerHTML = html;
            this.initializePageComponents(page);
        } catch (error) {
            console.error('Error loading page:', error);
            container.innerHTML = '<div class="error">Failed to load page</div>';
        }
    }
    
    async getDashboardHTML() {
        if (!this.userData) return '';
        
        return `
            <div class="fade-in">
                <div class="glass-card text-center mb-4">
                    <h2 class="text-2xl font-bold mb-2">👋 Welcome, ${this.userData.user.first_name}!</h2>
                    <p class="text-gray-300">Here's your earning overview</p>
                </div>
                
                <div class="stats-grid">
                    <div class="glass-card stat-card">
                        <div class="stat-label">Today's Earnings</div>
                        <div class="stat-value" id="todayEarnings">৳${this.userData.stats.today_earned.toFixed(2)}</div>
                        <div class="text-sm text-green-400">+2.5% from yesterday</div>
                    </div>
                    
                    <div class="glass-card stat-card">
                        <div class="stat-label">Total Balance</div>
                        <div class="stat-value">৳${this.userData.user.balance.toFixed(2)}</div>
                        <div class="text-sm text-blue-400">Available for withdrawal</div>
                    </div>
                    
                    <div class="glass-card stat-card">
                        <div class="stat-label">Total Referrals</div>
                        <div class="stat-value">${this.userData.stats.total_referrals}</div>
                        <div class="text-sm text-purple-400">${this.userData.stats.active_referrals} active</div>
                    </div>
                    
                    <div class="glass-card stat-card">
                        <div class="stat-label">Ads Watched</div>
                        <div class="stat-value">${this.userData.user.total_ads_watched}</div>
                        <div class="text-sm text-yellow-400">Keep watching to earn more!</div>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    <div class="glass-card">
                        <h3 class="text-lg font-bold mb-3">🎯 Quick Actions</h3>
                        <div class="space-y-3">
                            <button class="btn w-full watch-ad-btn" data-ad-id="1">
                                👁️ Watch Ad (৳5.00)
                            </button>
                            <button class="btn btn-secondary w-full" onclick="bot.loadPage('referrals')">
                                👥 Invite Friends
                            </button>
                            <button class="btn btn-success w-full" onclick="bot.loadPage('withdraw')">
                                💸 Withdraw Money
                            </button>
                        </div>
                    </div>
                    
                    <div class="glass-card">
                        <h3 class="text-lg font-bold mb-3">📈 Recent Activity</h3>
                        <div class="space-y-2">
                            <div class="flex justify-between items-center p-2 bg-white/5 rounded">
                                <span>Ad Watch</span>
                                <span class="text-green-400">+৳5.00</span>
                            </div>
                            <div class="flex justify-between items-center p-2 bg-white/5 rounded">
                                <span>Referral Bonus</span>
                                <span class="text-green-400">+৳10.00</span>
                            </div>
                            <div class="flex justify-between items-center p-2 bg-white/5 rounded">
                                <span>Welcome Bonus</span>
                                <span class="text-green-400">+৳20.00</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    async getEarnHTML() {
        try {
            const response = await fetch('/api/ads');
            const data = await response.json();
            
            let adsHTML = '';
            data.ads.forEach(ad => {
                adsHTML += `
                    <div class="glass-card ad-card fade-in">
                        <div class="ad-badge">+৳${ad.earnings.toFixed(2)}</div>
                        <h4 class="text-lg font-bold mb-2">${ad.title}</h4>
                        <p class="text-gray-300 mb-3">${ad.description}</p>
                        <div class="flex justify-between items-center">
                            <span class="ad-duration">${ad.duration}s</span>
                            <button class="btn watch-ad-btn" data-ad-id="${ad.id}">
                                👁️ Watch Now
                            </button>
                        </div>
                    </div>
                `;
            });
            
            return `
                <div class="fade-in">
                    <div class="glass-card mb-4">
                        <h2 class="text-2xl font-bold mb-2">🎁 Earn Money</h2>
                        <p class="text-gray-300">Watch ads and earn money instantly!</p>
                    </div>
                    
                    <div class="glass-card mb-4">
                        <div class="flex items-center justify-between mb-4">
                            <div>
                                <h3 class="text-lg font-bold">Today's Progress</h3>
                                <p class="text-sm text-gray-300">5/10 ads watched</p>
                            </div>
                            <div class="text-right">
                                <div class="text-2xl font-bold">৳25.00</div>
                                <p class="text-sm text-gray-300">Earned today</p>
                            </div>
                        </div>
                        <div class="w-full bg-gray-700 rounded-full h-2.5">
                            <div class="bg-gradient-to-r from-green-400 to-blue-500 h-2.5 rounded-full" style="width: 50%"></div>
                        </div>
                    </div>
                    
                    <h3 class="text-xl font-bold mb-4">📺 Available Ads</h3>
                    <div class="ads-grid">
                        ${adsHTML}
                    </div>
                    
                    <div class="glass-card mt-4">
                        <h4 class="font-bold mb-2">💡 Tips for earning more:</h4>
                        <ul class="space-y-1 text-sm text-gray-300">
                            <li>• Watch ads daily to maximize earnings</li>
                            <li>• Invite friends for referral bonuses</li>
                            <li>• Complete all available ads</li>
                            <li>• Check back regularly for new ads</li>
                        </ul>
                    </div>
                </div>
            `;
        } catch (error) {
            return '<div class="error">Failed to load ads</div>';
        }
    }
    
    async getReferralsHTML() {
        if (!this.userData) return '';
        
        const refLink = `https://t.me/EarnMoneyBD_bot?start=ref${this.userData.user.telegram_id}`;
        
        return `
            <div class="fade-in">
                <div class="glass-card mb-4">
                    <h2 class="text-2xl font-bold mb-2">👥 Refer & Earn</h2>
                    <p class="text-gray-300">Invite friends and earn ৳10.00 per referral!</p>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div class="glass-card stat-card text-center">
                        <div class="stat-label">Total Referrals</div>
                        <div class="stat-value">${this.userData.stats.total_referrals}</div>
                    </div>
                    
                    <div class="glass-card stat-card text-center">
                        <div class="stat-label">Active Referrals</div>
                        <div class="stat-value">${this.userData.stats.active_referrals}</div>
                    </div>
                    
                    <div class="glass-card stat-card text-center">
                        <div class="stat-label">Referral Earnings</div>
                        <div class="stat-value">৳${this.userData.stats.referral_earnings.toFixed(2)}</div>
                    </div>
                </div>
                
                <div class="glass-card mb-4">
                    <h3 class="text-lg font-bold mb-3">📋 Your Referral Link</h3>
                    <div class="flex gap-2 mb-3">
                        <input type="text" 
                               id="referralLink" 
                               value="${refLink}" 
                               readonly 
                               class="glass-input flex-1">
                        <button class="btn" onclick="bot.copyReferralLink()">
                            📋 Copy
                        </button>
                    </div>
                    <p class="text-sm text-gray-300">
                        Share this link with friends. When they join using your link, you'll get ৳10.00 bonus!
                    </p>
                </div>
                
                <div class="glass-card">
                    <h3 class="text-lg font-bold mb-3">📊 Referral Leaderboard</h3>
                    <div class="space-y-2">
                        <div class="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center justify-center font-bold">1</div>
                                <div>
                                    <div class="font-medium">@top_earner</div>
                                    <div class="text-sm text-gray-400">50 referrals</div>
                                </div>
                            </div>
                            <div class="text-green-400 font-bold">৳500.00</div>
                        </div>
                        
                        <div class="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-gradient-to-r from-gray-400 to-gray-600 flex items-center justify-center font-bold">2</div>
                                <div>
                                    <div class="font-medium">@smart_worker</div>
                                    <div class="text-sm text-gray-400">35 referrals</div>
                                </div>
                            </div>
                            <div class="text-green-400 font-bold">৳350.00</div>
                        </div>
                        
                        <div class="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-gradient-to-r from-orange-400 to-red-500 flex items-center justify-center font-bold">3</div>
                                <div>
                                    <div class="font-medium">@active_user</div>
                                    <div class="text-sm text-gray-400">25 referrals</div>
                                </div>
                            </div>
                            <div class="text-green-400 font-bold">৳250.00</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    async getWithdrawHTML() {
        if (!this.userData) return '';
        
        const methods = ['bKash', 'Nagad', 'Rocket'];
        const minWithdrawal = 100.00;
        
        return `
            <div class="fade-in">
                <div class="glass-card mb-4">
                    <h2 class="text-2xl font-bold mb-2">💸 Withdraw Money</h2>
                    <p class="text-gray-300">Withdraw your earnings to your mobile wallet</p>
                </div>
                
                <div class="glass-card mb-4">
                    <div class="flex justify-between items-center mb-4">
                        <div>
                            <h3 class="text-lg font-bold">Available Balance</h3>
                            <p class="text-2xl font-bold text-green-400">৳${this.userData.user.balance.toFixed(2)}</p>
                        </div>
                        <div class="text-right">
                            <div class="text-sm text-gray-300">Minimum Withdrawal</div>
                            <div class="text-lg font-bold">৳${minWithdrawal.toFixed(2)}</div>
                        </div>
                    </div>
                    
                    ${this.userData.user.balance < minWithdrawal ? `
                        <div class="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-4">
                            <p class="text-yellow-300">
                                ⚠️ You need at least ৳${minWithdrawal.toFixed(2)} to withdraw. 
                                Keep watching ads to reach the minimum amount!
                            </p>
                        </div>
                    ` : ''}
                </div>
                
                <div class="glass-card">
                    <h3 class="text-lg font-bold mb-4">💳 Select Payment Method</h3>
                    
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                        ${methods.map(method => `
                            <button class="payment-method-btn glass-card text-center p-4 hover:bg-white/5 transition-colors" data-method="${method}">
                                <div class="text-2xl mb-2">${this.getMethodIcon(method)}</div>
                                <div class="font-bold">${method}</div>
                            </button>
                        `).join('')}
                    </div>
                    
                    <form id="withdrawForm" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium mb-2">Payment Method</label>
                            <input type="text" id="selectedMethod" readonly class="glass-input" placeholder="Select a method above">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium mb-2">Mobile Number</label>
                            <input type="tel" id="mobileNumber" class="glass-input" placeholder="01XXXXXXXXX" required>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium mb-2">Amount (৳)</label>
                            <input type="number" id="withdrawAmount" class="glass-input" 
                                   min="${minWithdrawal}" max="${this.userData.user.balance}" 
                                   step="0.01" placeholder="Enter amount" required>
                            <p class="text-sm text-gray-400 mt-1">
                                Available: ৳${this.userData.user.balance.toFixed(2)}
                            </p>
                        </div>
                        
                        <button type="submit" class="btn btn-success w-full" ${this.userData.user.balance < minWithdrawal ? 'disabled' : ''}>
                            💸 Request Withdrawal
                        </button>
                    </form>
                </div>
                
                <div class="glass-card mt-4">
                    <h4 class="font-bold mb-2">📋 Withdrawal History</h4>
                    <div class="space-y-2">
                        <div class="flex justify-between items-center p-3 bg-white/5 rounded">
                            <div>
                                <div class="font-medium">bKash • ৳200.00</div>
                                <div class="text-sm text-gray-400">Pending • 01XXXXXXXXX</div>
                            </div>
                            <span class="text-yellow-400">⏳ Pending</span>
                        </div>
                        <div class="flex justify-between items-center p-3 bg-white/5 rounded">
                            <div>
                                <div class="font-medium">Nagad • ৳150.00</div>
                                <div class="text-sm text-gray-400">Completed • 01XXXXXXXXX</div>
                            </div>
                            <span class="text-green-400">✅ Approved</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    getMethodIcon(method) {
        const icons = {
            'bKash': '📱',
            'Nagad': '💳',
            'Rocket': '🚀'
        };
        return icons[method] || '💰';
    }
    
    copyReferralLink() {
        const linkInput = document.getElementById('referralLink');
        linkInput.select();
        linkInput.setSelectionRange(0, 99999);
        navigator.clipboard.writeText(linkInput.value);
        this.showNotification('Referral link copied!', 'success');
    }
    
    async watchAd(adId) {
        if (!this.userData) return;
        
        try {
            // Simulate ad watching
            this.showNotification('Starting ad...', 'info');
            
            // Show countdown
            const adCard = event.target.closest('.ad-card');
            const originalText = event.target.innerHTML;
            event.target.innerHTML = '⏳ Starting...';
            event.target.disabled = true;
            
            // Simulate ad watching duration
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Simulate API call
            const earnings = 5.00;
            
            // Update UI
            this.userData.user.balance += earnings;
            this.userData.user.total_ads_watched += 1;
            this.userData.stats.today_earned += earnings;
            
            this.updateUI();
            this.showNotification(`🎉 You earned ৳${earnings.toFixed(2)}!`, 'success');
            
            // Reset button
            event.target.innerHTML = originalText;
            event.target.disabled = false;
            
        } catch (error) {
            console.error('Error watching ad:', error);
            this.showNotification('Failed to watch ad', 'error');
        }
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type} fade-in`;
        notification.innerHTML = `
            <div class="flex items-center gap-2">
                <span>${this.getNotificationIcon(type)}</span>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    getNotificationIcon(type) {
        const icons = {
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️'
        };
        return icons[type] || 'ℹ️';
    }
    
    showLoginModal() {
        // Show login modal
        const modal = document.createElement('div');
        modal.className = 'login-modal';
        modal.innerHTML = `
            <div class="glass-container" style="max-width: 400px;">
                <h2 class="text-2xl font-bold mb-4">🔑 Authentication Required</h2>
                <p class="mb-4">Please open this page from Telegram bot to continue.</p>
                <button class="btn w-full" onclick="window.close()">
                    Open in Telegram
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    initializePageComponents(page) {
        switch(page) {
            case 'withdraw':
                this.initializeWithdrawForm();
                break;
        }
    }
    
    initializeWithdrawForm() {
        // Payment method selection
        document.querySelectorAll('.payment-method-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.payment-method-btn').forEach(b => {
                    b.style.background = '';
                });
                btn.style.background = 'rgba(99, 102, 241, 0.2)';
                document.getElementById('selectedMethod').value = btn.dataset.method;
            });
        });
        
        // Withdraw form submission
        document.getElementById('withdrawForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const method = document.getElementById('selectedMethod').value;
            const mobile = document.getElementById('mobileNumber').value;
            const amount = parseFloat(document.getElementById('withdrawAmount').value);
            
            if (!method) {
                this.showNotification('Please select payment method', 'error');
                return;
            }
            
            if (!mobile.match(/^01[3-9]\d{8}$/)) {
                this.showNotification('Please enter valid Bangladeshi mobile number', 'error');
                return;
            }
            
            if (amount < 100 || amount > this.userData.user.balance) {
                this.showNotification('Invalid amount', 'error');
                return;
            }
            
            try {
                const response = await fetch('/api/withdraw', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        telegram_id: this.userData.user.telegram_id,
                        amount: amount,
                        method: method,
                        mobile: mobile
                    })
                });
                
                if (response.ok) {
                    this.showNotification('Withdrawal request submitted successfully!', 'success');
                    this.userData.user.balance -= amount;
                    this.updateUI();
                    e.target.reset();
                } else {
                    this.showNotification('Withdrawal failed', 'error');
                }
            } catch (error) {
                console.error('Error submitting withdrawal:', error);
                this.showNotification('Network error', 'error');
            }
        });
    }
}

// Initialize bot when page loads
window.addEventListener('DOMContentLoaded', () => {
    window.bot = new EarnMoneyBot();
});
