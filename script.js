/* =========================================
   AI Create Assistant - Application Logic (Phase 3)
   ========================================= */

const API_BASE_URL = window.location.origin + "/api";

// --- Application State Management ---
const AppState = {
    data: {
        onboardingCompleted: localStorage.getItem('ai_onboarded') === 'true',
        theme: 'dark',
        settings: {},
        chats: [],
        currentChatId: null,
        savedPrompts: [],
        generatedCodeHistory: [],
        knowledgeFiles: [],
        recentActivity: [],
        modelStatus: {}
    },
    abortController: null,

    async init() {
        if (!this.data.onboardingCompleted) {
            UI.dom.onboarding.classList.remove('hidden');
        } else {
            UI.dom.appContainer.classList.remove('hidden');
            await this.loadRemoteState();
            await ModelManagerUI.fetchStatus();
        }
    },

    async loadRemoteState() {
        try {
            const [settingsRes, chatsRes, promptsRes, codeRes, knowledgeRes] = await Promise.all([
                fetch(`${API_BASE_URL}/settings`),
                fetch(`${API_BASE_URL}/chats`),
                fetch(`${API_BASE_URL}/prompts`),
                fetch(`${API_BASE_URL}/code/history`),
                fetch(`${API_BASE_URL}/knowledge`)
            ]);
            
            if (settingsRes.ok) this.data.settings = await settingsRes.json();
            if (chatsRes.ok) this.data.chats = await chatsRes.json();
            if (promptsRes.ok) this.data.savedPrompts = await promptsRes.json();
            if (codeRes.ok) this.data.generatedCodeHistory = await codeRes.json();
            if (knowledgeRes.ok) this.data.knowledgeFiles = await knowledgeRes.json();
            
            UI.applyTheme(this.data.settings.theme || 'dark');
            UI.loadControlPanelState();
            UI.renderChatHistory();
            UI.renderSavedPrompts();
            UI.renderCodeHistory();
            KnowledgeHub.renderFiles();
            
            if (this.data.chats.length > 0) ChatEngine.loadChat(this.data.chats[0].id);
        } catch (error) {
            UI.showToast("Failed to connect to backend");
            console.error(error);
        }
    },
    
    logActivity(action) {
        this.data.recentActivity.unshift({ action, time: new Date().toLocaleTimeString() });
        if (this.data.recentActivity.length > 5) this.data.recentActivity.pop();
        UI.renderRecentActivity();
    }
};

// --- Model Management UI ---
const ModelManagerUI = {
    async fetchStatus() {
        try {
            const res = await fetch(`${API_BASE_URL}/model/status`);
            if (res.ok) {
                AppState.data.modelStatus = await res.json();
                this.updateUI();
            }
        } catch(e) { console.error("Model status error", e); }
    },
    
    async loadModel() {
        document.getElementById('model-status-text').textContent = "Loading...";
        document.getElementById('model-status-indicator').style.background = "orange";
        document.getElementById('btn-model-load').disabled = true;
        try {
            const res = await fetch(`${API_BASE_URL}/model/load`, { method: 'POST' });
            if (res.ok) {
                AppState.data.modelStatus = await res.json();
                UI.showToast("Model loaded successfully in " + AppState.data.modelStatus.load_time + "s");
            } else {
                const err = await res.json();
                UI.showToast("Error: " + err.detail);
            }
        } catch(e) { UI.showToast("Failed to load model."); }
        this.updateUI();
    },

    async unloadModel() {
        try {
            const res = await fetch(`${API_BASE_URL}/model/unload`, { method: 'POST' });
            if (res.ok) AppState.data.modelStatus = await res.json();
            UI.showToast("Model unloaded");
        } catch(e) {}
        this.updateUI();
    },

    updateUI() {
        const status = AppState.data.modelStatus;
        const text = document.getElementById('model-status-text');
        const ind = document.getElementById('model-status-indicator');
        const btnLoad = document.getElementById('btn-model-load');
        const btnUnload = document.getElementById('btn-model-unload');
        
        document.getElementById('model-path-text').textContent = status.model_path || "N/A";
        document.getElementById('model-ctx-text').textContent = status.context_size || "N/A";
        document.getElementById('model-max-text').textContent = status.max_tokens || "N/A";

        if (status.status === "ready") {
            text.textContent = "Ready";
            ind.style.background = "var(--success)";
            btnLoad.classList.add('hidden');
            btnUnload.classList.remove('hidden');
        } else if (status.status === "error") {
            text.textContent = "Error";
            ind.style.background = "var(--danger)";
            btnLoad.classList.remove('hidden');
            btnLoad.disabled = false;
            btnUnload.classList.add('hidden');
        } else if (status.status === "loading") {
            text.textContent = "Loading...";
            ind.style.background = "orange";
            btnLoad.disabled = true;
        } else {
            text.textContent = "Unloaded";
            ind.style.background = "gray";
            btnLoad.classList.remove('hidden');
            btnLoad.disabled = false;
            btnUnload.classList.add('hidden');
        }
    }
};

// --- UI Engine ---
const UI = {
    init() {
        this.cacheDOM();
        this.bindEvents();
    },
    cacheDOM() {
        this.dom = {
            onboarding: document.getElementById('onboarding'),
            btnStart: document.getElementById('btn-start'),
            appContainer: document.getElementById('app-container'),
            navLinks: document.querySelectorAll('.nav-links li, .nav-card'),
            sections: document.querySelectorAll('.app-section'),
            sectionTitle: document.getElementById('current-section-title'),
            btnTheme: document.getElementById('btn-theme-toggle'),
            toastContainer: document.getElementById('toast-container'),
            activityList: document.getElementById('recent-activity-list')
        };
    },
    bindEvents() {
        this.dom.btnStart.addEventListener('click', async () => {
            AppState.data.onboardingCompleted = true;
            localStorage.setItem('ai_onboarded', 'true');
            this.dom.onboarding.style.opacity = '0';
            setTimeout(async () => {
                this.dom.onboarding.classList.add('hidden');
                this.dom.appContainer.classList.remove('hidden');
                UI.showToast("Welcome to AI Create Assistant!");
                await AppState.loadRemoteState();
                await ModelManagerUI.fetchStatus();
            }, 500);
        });

        this.dom.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const target = e.currentTarget.getAttribute('data-target');
                if (target) this.navigate(target);
            });
        });

        this.dom.btnTheme.addEventListener('click', () => {
            const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            this.applyTheme(newTheme);
            ControlPanel.updateSetting('theme', newTheme);
        });
        document.getElementById('set-theme').addEventListener('change', (e) => {
            this.applyTheme(e.target.value);
            ControlPanel.updateSetting('theme', e.target.value);
        });
        document.getElementById('modal-btn-cancel').addEventListener('click', () => {
            document.getElementById('confirmation-modal').classList.add('hidden');
        });
        
        // Model Manager bindings
        document.getElementById('btn-model-refresh').addEventListener('click', () => ModelManagerUI.fetchStatus());
        document.getElementById('btn-model-load').addEventListener('click', () => ModelManagerUI.loadModel());
        document.getElementById('btn-model-unload').addEventListener('click', () => ModelManagerUI.unloadModel());
    },
    navigate(targetId) {
        document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
        const navItem = document.querySelector(`.nav-links li[data-target="${targetId}"]`);
        if (navItem) navItem.classList.add('active');

        this.dom.sections.forEach(sec => sec.classList.remove('active'));
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            targetSection.classList.add('active');
            const titles = { 'dashboard': 'Dashboard', 'chat': 'AI Chat', 'prompt': 'Prompt Studio', 'code': 'Code Generator', 'knowledge': 'Knowledge Hub', 'control': 'AI Control Panel', 'settings': 'Settings' };
            this.dom.sectionTitle.textContent = titles[targetId] || 'Assistant';
        }
    },
    applyTheme(theme) {
        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
        document.getElementById('set-theme').value = theme;
    },
    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        this.dom.toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },
    confirmAction(title, message, onConfirm) {
        const modal = document.getElementById('confirmation-modal');
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-message').textContent = message;
        modal.classList.remove('hidden');
        const confirmBtn = document.getElementById('modal-btn-confirm');
        const newBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
        newBtn.addEventListener('click', () => { onConfirm(); modal.classList.add('hidden'); });
    },
    renderRecentActivity() {
        const list = this.dom.activityList;
        list.innerHTML = '';
        if (AppState.data.recentActivity.length === 0) {
            list.innerHTML = '<li>No recent activity.</li>';
            return;
        }
        AppState.data.recentActivity.forEach(act => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${act.action}</span> <span>${act.time}</span>`;
            list.appendChild(li);
        });
    },
    renderChatHistory() {
        const list = document.getElementById('chat-history-list');
        list.innerHTML = '';
        AppState.data.chats.forEach(chat => {
            const li = document.createElement('li');
            li.textContent = chat.title;
            if (chat.id === AppState.data.currentChatId) li.classList.add('active');
            li.addEventListener('click', () => ChatEngine.loadChat(chat.id));
            list.appendChild(li);
        });
        const currentChat = AppState.data.chats.find(c => c.id === AppState.data.currentChatId);
        document.getElementById('current-chat-title').textContent = currentChat ? currentChat.title : 'No Chat Selected';
    },
    loadControlPanelState() {
        const s = AppState.data.settings;
        if (!s.ai_name) return;
        document.getElementById('ctrl-ai-name').value = s.ai_name;
        document.getElementById('ctrl-ai-role').value = s.ai_role;
        document.getElementById('ctrl-ai-personality').value = s.ai_personality;
        document.getElementById('ctrl-ai-purpose').value = s.ai_purpose;
        document.getElementById('ctrl-temp').value = s.temperature;
        document.getElementById('val-temp').textContent = s.temperature;
        document.getElementById('ctrl-prec').value = s.precision;
        document.getElementById('val-prec').textContent = s.precision;
        document.getElementById('ctrl-length').value = s.response_length;
        document.getElementById('ctrl-context').value = s.context_mode;
        document.getElementById('ctrl-system-inst').value = s.system_instructions;
    },
    renderSavedPrompts() {
        const list = document.getElementById('saved-prompts-list');
        list.innerHTML = '';
        AppState.data.savedPrompts.forEach(p => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${p.title}</span>
                <div>
                    <button class="icon-btn" style="width:24px; height:24px; font-size:0.8rem;" onclick="navigator.clipboard.writeText(\`${p.content.replace(/`/g, '\\`')}\`); UI.showToast('Copied')">📋</button>
                    <button class="icon-btn danger-text" style="width:24px; height:24px; font-size:0.8rem;" onclick="PromptStudio.deletePrompt(${p.id})">🗑️</button>
                </div>
            `;
            list.appendChild(li);
        });
    },
    renderCodeHistory() {
        const list = document.getElementById('code-history-list');
        list.innerHTML = '';
        AppState.data.generatedCodeHistory.forEach(h => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div style="flex:1; cursor:pointer;" onclick="document.getElementById('code-output').textContent = \`${h.generated_code.replace(/`/g, '\\`')}\`">
                    <strong>${h.project_type}</strong><br><span style="font-size:0.75rem">${h.language}</span>
                </div>
                <button class="icon-btn danger-text" style="width:24px; height:24px; font-size:0.8rem;" onclick="CodeGen.deleteHistory(${h.id})">🗑️</button>
            `;
            list.appendChild(li);
        });
    }
};

// --- Chat Section Logic ---
const ChatEngine = {
    init() { this.bindEvents(); },
    bindEvents() {
        document.getElementById('btn-send-chat').addEventListener('click', () => this.sendMessage());
        document.getElementById('chat-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
        });
        document.getElementById('btn-new-chat').addEventListener('click', () => this.createNewChat());
        document.getElementById('btn-delete-chat').addEventListener('click', () => {
            if(AppState.data.currentChatId) UI.confirmAction("Delete Chat", "Are you sure you want to delete this conversation?", () => this.deleteChat(AppState.data.currentChatId));
        });
        document.getElementById('btn-clear-chat').addEventListener('click', () => {
             UI.confirmAction("Clear Messages", "Clear all messages in this chat?", () => this.clearCurrentMessages());
        });
        document.getElementById('btn-stop-gen').addEventListener('click', () => this.stopGeneration());
        document.getElementById('chat-search').addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            document.querySelectorAll('.chat-history-list li').forEach(li => {
                li.style.display = li.textContent.toLowerCase().includes(query) ? 'block' : 'none';
            });
        });
    },
    async createNewChat() {
        try {
            const res = await fetch(`${API_BASE_URL}/chats`, { method: 'POST' });
            if (res.ok) {
                const chat = await res.json();
                AppState.data.chats.unshift(chat);
                AppState.data.currentChatId = chat.id;
                UI.renderChatHistory();
                this.renderMessages();
                document.getElementById('chat-input').focus();
            }
        } catch (e) { UI.showToast("Failed to create chat"); }
    },
    async loadChat(id) {
        try {
            const res = await fetch(`${API_BASE_URL}/chats/${id}`);
            if(res.ok) {
                const chat = await res.json();
                const index = AppState.data.chats.findIndex(c => c.id === id);
                if (index > -1) AppState.data.chats[index] = chat;
                AppState.data.currentChatId = id;
                UI.renderChatHistory();
                this.renderMessages();
            }
        } catch(e) { UI.showToast("Failed to load chat"); }
    },
    async deleteChat(id) {
        try {
            await fetch(`${API_BASE_URL}/chats/${id}`, { method: 'DELETE' });
            AppState.data.chats = AppState.data.chats.filter(c => c.id !== id);
            AppState.data.currentChatId = AppState.data.chats.length > 0 ? AppState.data.chats[0].id : null;
            UI.renderChatHistory();
            this.renderMessages();
        } catch(e) {}
    },
    async clearCurrentMessages() {
        try {
            await fetch(`${API_BASE_URL}/chats/${AppState.data.currentChatId}/messages`, { method: 'DELETE' });
            this.loadChat(AppState.data.currentChatId);
        } catch(e) {}
    },
    stopGeneration() {
        if(AppState.abortController) {
            AppState.abortController.abort();
            AppState.abortController = null;
            document.getElementById('typing-indicator').classList.add('hidden');
            document.getElementById('btn-stop-gen').classList.add('hidden');
            document.getElementById('btn-send-chat').classList.remove('hidden');
            UI.showToast("Generation stopped");
        }
    },
    async sendMessage() {
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        
        if (!AppState.data.currentChatId) await this.createNewChat();

        const chat = AppState.data.chats.find(c => c.id === AppState.data.currentChatId);
        chat.messages.push({ role: 'user', content: text, created_at: new Date().toISOString() });
        this.renderMessages();

        // Create temporary AI message wrapper for streaming
        const tempAiMsg = { role: 'assistant', content: '', created_at: new Date().toISOString(), _streaming: true };
        chat.messages.push(tempAiMsg);
        this.renderMessages();
        
        document.getElementById('typing-indicator').classList.remove('hidden');
        document.getElementById('btn-send-chat').classList.add('hidden');
        document.getElementById('btn-stop-gen').classList.remove('hidden');

        AppState.abortController = new AbortController();
        let fullText = "";

        try {
            const res = await fetch(`${API_BASE_URL}/chat/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, chat_id: AppState.data.currentChatId, stream: true }),
                signal: AppState.abortController.signal
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Server error");
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder("utf-8");

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                
                for (let line of lines) {
                    if (line.startsWith("data: ")) {
                        const dataStr = line.slice(6);
                        if (dataStr === "[DONE]") break;
                        try {
                            const dataObj = JSON.parse(dataStr);
                            if (dataObj.error) {
                                fullText += `\n**Error:** ${dataObj.error}`;
                            } else if (dataObj.text) {
                                fullText += dataObj.text;
                            }
                            tempAiMsg.content = fullText;
                            this.updateStreamingMessage(fullText);
                        } catch(e) {}
                    }
                }
            }

            // Save final message to backend
            if(fullText.trim()) {
                const formData = new FormData();
                formData.append('content', fullText);
                await fetch(`${API_BASE_URL}/chat/${AppState.data.currentChatId}/save_assistant_message`, {
                    method: 'POST',
                    body: formData
                });
            }

        } catch (e) {
            if (e.name === 'AbortError') {
                if(fullText.trim()) {
                    const formData = new FormData();
                    formData.append('content', fullText + '... (Stopped)');
                    fetch(`${API_BASE_URL}/chat/${AppState.data.currentChatId}/save_assistant_message`, { method: 'POST', body: formData });
                }
            } else {
                tempAiMsg.content = `*Error:* ${e.message}`;
                this.updateStreamingMessage(tempAiMsg.content);
                UI.showToast("Failed to connect to model");
            }
        } finally {
            document.getElementById('typing-indicator').classList.add('hidden');
            document.getElementById('btn-stop-gen').classList.add('hidden');
            document.getElementById('btn-send-chat').classList.remove('hidden');
            delete tempAiMsg._streaming;
            this.loadChat(AppState.data.currentChatId); // Sync full state
        }
    },
    updateStreamingMessage(text) {
        const msgs = document.getElementById('chat-messages').querySelectorAll('.message.ai .msg-content');
        if (msgs.length > 0) {
            const lastMsg = msgs[msgs.length - 1];
            let formatted = text.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
            formatted = formatted.replace(/```(.*?)<br>([\s\S]*?)(```|$)/g, '<div style="background:#0d1117; padding:10px; border-radius:5px; margin-top:5px; font-family:monospace;">$2</div>');
            lastMsg.innerHTML = formatted;
            
            const container = document.getElementById('chat-messages');
            container.scrollTop = container.scrollHeight;
        }
    },
    renderMessages() {
        const container = document.getElementById('chat-messages');
        const chat = AppState.data.chats.find(c => c.id === AppState.data.currentChatId);
        
        if (!chat || !chat.messages || chat.messages.length === 0) {
            container.innerHTML = `
                <div class="chat-empty-state">
                    <div class="logo-medium mb-2">AI</div>
                    <h3>How can I help you create today?</h3>
                    <div class="suggested-prompts">
                        <button class="btn-outline prompt-suggestion">Plan a modern web app</button>
                        <button class="btn-outline prompt-suggestion">Write a Python script for automation</button>
                    </div>
                </div>
            `;
            document.querySelectorAll('.prompt-suggestion').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.getElementById('chat-input').value = e.target.textContent;
                    this.sendMessage();
                });
            });
            return;
        }

        container.innerHTML = '';
        chat.messages.forEach(msg => {
            const msgDiv = document.createElement('div');
            msgDiv.className = `message ${msg.role}`;
            const avatar = msg.role === 'user' ? 'U' : 'AI';
            
            let formattedContent = msg.content
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>');
            formattedContent = formattedContent.replace(/```(.*?)<br>([\s\S]*?)(```|$)/g, '<div style="background:#0d1117; padding:10px; border-radius:5px; margin-top:5px; font-family:monospace;">$2</div>');

            const time = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Now';
            msgDiv.innerHTML = `
                <div class="msg-avatar">${avatar}</div>
                <div class="msg-content-wrapper" style="max-width: 100%;">
                    <div class="msg-content">${formattedContent}</div>
                    <div class="msg-actions">
                        <span>${time}</span>
                        ${msg.role === 'assistant' ? `<button onclick="navigator.clipboard.writeText(\`${msg.content.replace(/`/g, '\\`')}\`); UI.showToast('Copied')">Copy</button>` : ''}
                    </div>
                </div>
            `;
            container.appendChild(msgDiv);
        });
        container.scrollTop = container.scrollHeight;
    }
};

// --- Prompt Studio Logic ---
const PromptStudio = {
    init() {
        document.getElementById('btn-generate-prompt').addEventListener('click', () => this.generate());
        document.getElementById('btn-copy-prompt').addEventListener('click', () => this.copy());
        document.getElementById('btn-save-prompt').addEventListener('click', () => this.savePrompt());
    },
    async generate() {
        const idea = document.getElementById('prompt-idea').value;
        if (!idea) { UI.showToast("Please enter an idea first."); return; }
        document.getElementById('btn-generate-prompt').disabled = true;
        document.getElementById('prompt-output').value = "Generating prompt via AI model...";
        try {
            const res = await fetch(`${API_BASE_URL}/prompts/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idea, category: document.getElementById('prompt-category').value,
                    target: document.getElementById('prompt-target').value,
                    type: document.getElementById('prompt-type').value,
                    detail: document.getElementById('prompt-detail').value
                })
            });
            if(res.ok) {
                const data = await res.json();
                document.getElementById('prompt-output').value = data.content;
                AppState.logActivity("Generated a prompt");
                UI.showToast("Prompt Generated");
            } else {
                const err = await res.json();
                document.getElementById('prompt-output').value = "Error: " + err.detail;
            }
        } catch (e) { document.getElementById('prompt-output').value = "Network Error."; }
        finally { document.getElementById('btn-generate-prompt').disabled = false; }
    },
    copy() {
        const text = document.getElementById('prompt-output').value;
        if(text) { navigator.clipboard.writeText(text); UI.showToast("Copied"); }
    },
    async savePrompt() {
        const text = document.getElementById('prompt-output').value;
        if (!text || text.includes("Error:")) return;
        try {
            const res = await fetch(`${API_BASE_URL}/prompts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: document.getElementById('prompt-idea').value.substring(0, 30), content: text, category: 'General' })
            });
            if (res.ok) {
                const prompt = await res.json();
                AppState.data.savedPrompts.unshift(prompt);
                UI.renderSavedPrompts();
                UI.showToast("Prompt saved");
            }
        } catch (e) {}
    },
    async deletePrompt(id) {
        try {
            await fetch(`${API_BASE_URL}/prompts/${id}`, { method: 'DELETE' });
            AppState.data.savedPrompts = AppState.data.savedPrompts.filter(p => p.id !== id);
            UI.renderSavedPrompts();
        } catch (e) {}
    }
};

// --- Code Generator Logic ---
const CodeGen = {
    init() {
        document.getElementById('btn-generate-code').addEventListener('click', () => this.generate());
        document.getElementById('btn-copy-code').addEventListener('click', () => this.copy());
        document.getElementById('btn-download-code').addEventListener('click', () => this.download());
        document.getElementById('btn-clear-code').addEventListener('click', () => { document.getElementById('code-output').textContent = "/* Generated code will appear here... */"; });
        
        document.getElementById('btn-fullscreen-code').addEventListener('click', () => {
            const wrapper = document.querySelector('.code-panel-wrapper');
            wrapper.style.position = wrapper.style.position === 'fixed' ? 'relative' : 'fixed';
            if (wrapper.style.position === 'fixed') {
                wrapper.style.top = '0'; wrapper.style.left = '0'; wrapper.style.width = '100vw'; wrapper.style.height = '100vh';
                wrapper.style.zIndex = '9000'; wrapper.style.borderRadius = '0';
            } else {
                wrapper.style.width = 'auto'; wrapper.style.height = 'auto'; wrapper.style.zIndex = '1';
                wrapper.style.borderRadius = 'var(--radius-lg)';
            }
        });
    },
    async generate() {
        const req = {
            project_type: document.getElementById('code-project-type').value || 'Component',
            language: document.getElementById('code-language').value,
            style: document.getElementById('code-style').value,
            device: document.getElementById('code-device').value,
            request: document.getElementById('code-request').value
        };
        if (!req.request) { UI.showToast("Please provide a request."); return; }
        document.getElementById('btn-generate-code').disabled = true;
        document.getElementById('code-output').textContent = "/* Generating code via AI model... */";
        try {
            const res = await fetch(`${API_BASE_URL}/code/generate`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req)
            });
            if (res.ok) {
                const history = await res.json();
                document.getElementById('code-output').textContent = history.generated_code;
                AppState.data.generatedCodeHistory.unshift(history);
                UI.renderCodeHistory();
                UI.showToast("Code Generated");
            } else {
                const err = await res.json();
                document.getElementById('code-output').textContent = "/* Error: " + err.detail + " */";
            }
        } catch (e) { document.getElementById('code-output').textContent = "/* Network Error */"; }
        finally { document.getElementById('btn-generate-code').disabled = false; }
    },
    copy() {
        navigator.clipboard.writeText(document.getElementById('code-output').textContent);
        UI.showToast("Copied");
    },
    download() {
        const text = document.getElementById('code-output').textContent;
        const blob = new Blob([text], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `generated_code_${Date.now()}.txt`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    },
    async deleteHistory(id) {
        try {
            await fetch(`${API_BASE_URL}/code/history/${id}`, { method: 'DELETE' });
            AppState.data.generatedCodeHistory = AppState.data.generatedCodeHistory.filter(h => h.id !== id);
            UI.renderCodeHistory();
        } catch (e) {}
    }
};

// --- Knowledge Hub Logic ---
const KnowledgeHub = {
    init() {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        const browseBtn = document.getElementById('btn-browse-files');

        browseBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => this.handleFiles(e.target.files));
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); this.handleFiles(e.dataTransfer.files); });
    },
    async handleFiles(files) {
        const category = document.getElementById('knowledge-category').value;
        for(let file of Array.from(files)) {
            const formData = new FormData(); formData.append('file', file); formData.append('category', category);
            try {
                const res = await fetch(`${API_BASE_URL}/knowledge/upload`, { method: 'POST', body: formData });
                if(res.ok) {
                    const f = await res.json();
                    AppState.data.knowledgeFiles.unshift(f);
                }
            } catch (e) { UI.showToast(`Failed to upload ${file.name}`); }
        }
        this.renderFiles();
        UI.showToast("Upload complete");
    },
    renderFiles() {
        const list = document.getElementById('knowledge-list');
        list.innerHTML = '';
        AppState.data.knowledgeFiles.forEach(f => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div><strong>${f.filename}</strong><div style="font-size:0.8rem; color:var(--text-secondary);">${f.category} • ${(f.size/1024).toFixed(2)} KB</div></div>
                <button class="icon-btn danger-text" onclick="KnowledgeHub.deleteFile(${f.id})">🗑️</button>
            `;
            list.appendChild(li);
        });
    },
    async deleteFile(id) {
        try {
            await fetch(`${API_BASE_URL}/knowledge/${id}`, { method: 'DELETE' });
            AppState.data.knowledgeFiles = AppState.data.knowledgeFiles.filter(f => f.id !== id);
            this.renderFiles();
        } catch (e) {}
    }
};

// --- Control Panel Logic ---
const ControlPanel = {
    init() {
        const inputs = ['ctrl-ai-name', 'ctrl-ai-role', 'ctrl-ai-personality', 'ctrl-ai-purpose', 'ctrl-length', 'ctrl-context'];
        inputs.forEach(id => { document.getElementById(id).addEventListener('change', () => this.saveState()); });
        document.getElementById('ctrl-temp').addEventListener('change', (e) => { document.getElementById('val-temp').textContent = e.target.value; this.saveState(); });
        document.getElementById('ctrl-prec').addEventListener('change', (e) => { document.getElementById('val-prec').textContent = e.target.value; this.saveState(); });
        document.getElementById('btn-sys-save').addEventListener('click', () => { this.saveState(); UI.showToast("Settings saved"); });
        document.getElementById('btn-sys-reset').addEventListener('click', async () => {
            await fetch(`${API_BASE_URL}/settings/reset`, { method: 'POST' });
            await AppState.loadRemoteState();
            UI.showToast("Settings reset");
        });
    },
    async saveState() {
        const s = {
            theme: document.documentElement.getAttribute('data-theme'),
            ai_name: document.getElementById('ctrl-ai-name').value,
            ai_role: document.getElementById('ctrl-ai-role').value,
            ai_personality: document.getElementById('ctrl-ai-personality').value,
            ai_purpose: document.getElementById('ctrl-ai-purpose').value,
            system_instructions: document.getElementById('ctrl-system-inst').value,
            temperature: parseFloat(document.getElementById('ctrl-temp').value),
            creativity: parseFloat(document.getElementById('ctrl-temp').value),
            precision: parseFloat(document.getElementById('ctrl-prec').value),
            top_p: 0.9,
            response_length: document.getElementById('ctrl-length').value,
            context_mode: document.getElementById('ctrl-context').value,
            preferred_language: 'en',
            preferred_coding_language: 'JavaScript',
            response_style: 'Standard'
        };
        try {
            const res = await fetch(`${API_BASE_URL}/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
            if (res.ok) AppState.data.settings = await res.json();
        } catch (e) {}
    },
    async updateSetting(key, value) {
        if(!AppState.data.settings[key]) return;
        AppState.data.settings[key] = value;
        try { fetch(`${API_BASE_URL}/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(AppState.data.settings) }); } catch (e) {}
    }
};

// --- Settings Logic ---
const SettingsManager = {
    init() {
        document.getElementById('btn-export-data').addEventListener('click', () => this.exportData());
        document.getElementById('file-import-data').addEventListener('change', (e) => this.importData(e));
        document.getElementById('btn-clear-chats-data').addEventListener('click', () => {
            UI.confirmAction("Clear All Chats", "This will permanently delete all chat history.", async () => {
                for (const c of AppState.data.chats) await fetch(`${API_BASE_URL}/chats/${c.id}`, { method: 'DELETE' });
                AppState.data.chats = []; UI.renderChatHistory(); UI.showToast("All chats cleared");
            });
        });
        document.getElementById('btn-clear-prompts-data').addEventListener('click', () => {
            UI.confirmAction("Clear Saved Prompts", "This will permanently delete all saved prompts.", async () => {
                for (const p of AppState.data.savedPrompts) await fetch(`${API_BASE_URL}/prompts/${p.id}`, { method: 'DELETE' });
                AppState.data.savedPrompts = []; UI.renderSavedPrompts(); UI.showToast("Prompts cleared");
            });
        });
        document.getElementById('btn-reset-app').addEventListener('click', () => {
            UI.confirmAction("Factory Reset", "This will wipe ALL data and restore defaults. Are you sure?", async () => {
                localStorage.removeItem('ai_onboarded'); location.reload();
            });
        });
    },
    async exportData() {
        try {
            const res = await fetch(`${API_BASE_URL}/export`);
            if (res.ok) {
                const dataStr = JSON.stringify(await res.json(), null, 2);
                const blob = new Blob([dataStr], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `backup.json`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
            }
        } catch (e) {}
    },
    importData(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                const res = await fetch(`${API_BASE_URL}/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) });
                if(res.ok) { UI.showToast("Import successful. Reloading..."); setTimeout(() => location.reload(), 1000); }
            } catch (error) { UI.showToast("Invalid backup file"); }
        };
        reader.readAsText(file);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    UI.init();
    AppState.init().then(() => {
        ChatEngine.init();
        PromptStudio.init();
        CodeGen.init();
        KnowledgeHub.init();
        ControlPanel.init();
        SettingsManager.init();
    });
});
