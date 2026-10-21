import React, { useState, useEffect } from 'react';
import { Smartphone, Download, Check, ExternalLink } from 'lucide-react';

export const PwaInstallButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [showIosPrompt, setShowIosPrompt] = useState<boolean>(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed as PWA)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
      return;
    }

    // Check if iOS Safari
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIos) {
      setShowIosPrompt(true);
    } else {
      alert('मोबाईलवर ॲप इन्स्टॉल करण्यासाठी Chrome च्या वरील तीन ठिपक्यांवर (⋮) क्लिक करून "Add to Home Screen" किंवा "Install App" निवडा.');
    }
  };

  if (isInstalled) {
    return (
      <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/60 border border-emerald-800 rounded-lg text-emerald-400 text-xs font-semibold">
        <Check className="w-3.5 h-3.5" />
        <span className="text-[11px]">ॲप इन्स्टॉल आहे</span>
      </span>
    );
  }

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 hover:from-cyan-600/30 hover:to-blue-600/30 border border-cyan-500/40 text-cyan-300 rounded-lg text-xs font-bold transition shadow-sm active:scale-95"
        title="मोबाईलवर किंवा डेस्कटॉपवर ॲप इन्स्टॉल करा"
      >
        <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-[11px]">📲 ॲप इन्स्टॉल करा</span>
      </button>

      {/* iOS Safari Guide Modal */}
      {showIosPrompt && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d1424] border border-gray-800 rounded-2xl max-w-sm w-full p-5 space-y-3 text-center">
            <Smartphone className="w-10 h-10 text-cyan-400 mx-auto" />
            <h4 className="font-bold text-white text-sm">iPhone / iPad वर इन्स्टॉल कसे करावे?</h4>
            <div className="text-xs text-gray-300 text-left space-y-2 bg-black/40 p-3 rounded-xl border border-gray-800">
              <p>1. Safari ब्राउझरमध्ये खाली दिलेल्या <strong>Share</strong> बटणावर (चौरस आणि बाण) टॅप करा.</p>
              <p>2. खाली स्क्रोल करून <strong>"Add to Home Screen"</strong> (होम स्क्रीनवर जोडा) निवडा.</p>
              <p>3. वरील कोपऱ्यातील <strong>"Add"</strong> बटणावर क्लिक करा.</p>
            </div>
            <button
              onClick={() => setShowIosPrompt(false)}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition"
            >
              समजले (Close)
            </button>
          </div>
        </div>
      )}
    </>
  );
};
