import React, { useState } from 'react';
import { Send, CheckCircle2, AlertCircle, X, ExternalLink, HelpCircle } from 'lucide-react';
import { TelegramService, type TelegramConfig } from '../services/telegramService';

interface TelegramSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: TelegramConfig;
  onSaveConfig: (cfg: TelegramConfig) => void;
}

export const TelegramSettingsModal: React.FC<TelegramSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [botToken, setBotToken] = useState<string>(config.botToken || '');
  const [chatId, setChatId] = useState<string>(config.chatId || '');
  const [testStatus, setTestStatus] = useState<string>('');
  const [isTesting, setIsTesting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleTestMessage = async () => {
    if (!botToken.trim() || !chatId.trim()) {
      setTestStatus('Please enter both Bot Token and Chat ID.');
      return;
    }

    setIsTesting(true);
    setTestStatus('Sending test message to Telegram...');

    const testText = `
🔔 <b>Market Signal Engine — Test Notification</b>

This is a test notification confirming your Telegram Bot connection is working!
• <b>Status:</b> Connected & Active
• <b>Timeframe:</b> 5-Minute Closed Candles
• <b>Instruments:</b> NIFTY 50, BANK NIFTY

────────────────────
⚠️ <i>Disclaimer: Analytical test message. Not financial advice.</i>
`.trim();

    const res = await TelegramService.sendDirectMessage(botToken.trim(), chatId.trim(), testText);
    setIsTesting(false);

    if (res.success) {
      setTestStatus('✓ Success! Check your Telegram app for the test message.');
    } else {
      setTestStatus(`✕ Failed: ${res.error || 'Unknown error'}`);
    }
  };

  const handleSave = () => {
    onSaveConfig({
      botToken: botToken.trim(),
      chatId: chatId.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-cardBg border border-borderCol rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-borderCol">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-950/70 border border-blue-800 rounded-lg text-blue-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Telegram Alerts Setup</h3>
              <p className="text-xs text-gray-400">Deliver 5m market signals straight to your phone</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="bg-darkBg/60 border border-borderCol rounded-xl p-3.5 text-xs text-gray-300 space-y-2">
          <span className="font-bold text-white block">Quick 2-Minute Setup:</span>
          <ol className="list-decimal list-inside space-y-1 text-gray-400">
            <li>
              Open Telegram and search for <strong className="text-blue-400">@BotFather</strong>, send <code>/newbot</code> to get your <b>Bot Token</b>.
            </li>
            <li>
              Start a chat with your new bot and press <b>Start</b>.
            </li>
            <li>
              Search for <strong className="text-blue-400">@userinfobot</strong> in Telegram and press Start to get your <b>Chat ID</b> (a numeric ID).
            </li>
          </ol>
        </div>

        {/* Form Fields */}
        <div className="space-y-3.5 text-xs">
          <div>
            <label className="text-gray-300 font-semibold block mb-1">
              Telegram Bot Token
            </label>
            <input
              type="text"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ..."
              className="w-full bg-darkBg border border-borderCol rounded-lg p-2.5 font-mono text-white focus:outline-none focus:border-neutralBlue"
            />
          </div>

          <div>
            <label className="text-gray-300 font-semibold block mb-1">
              Your Telegram Chat ID
            </label>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="e.g. 987654321"
              className="w-full bg-darkBg border border-borderCol rounded-lg p-2.5 font-mono text-white focus:outline-none focus:border-neutralBlue"
            />
          </div>
        </div>

        {/* Test Status feedback */}
        {testStatus && (
          <div className={`p-3 rounded-lg text-xs font-medium border ${
            testStatus.startsWith('✓')
              ? 'bg-emerald-950/70 border-emerald-800 text-emerald-200'
              : testStatus.startsWith('✕')
              ? 'bg-red-950/70 border-red-800 text-red-200'
              : 'bg-blue-950/70 border-blue-800 text-blue-200'
          }`}>
            {testStatus}
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-borderCol">
          <button
            onClick={handleTestMessage}
            disabled={isTesting}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-semibold transition"
          >
            <Send className="w-3.5 h-3.5" />
            {isTesting ? 'Sending...' : 'Send Test Alert'}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-neutralBlue hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition shadow-md"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
