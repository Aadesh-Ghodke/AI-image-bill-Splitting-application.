import * as React from 'react';
import { useState } from 'react';
import { Upload, Camera, Loader2 } from 'lucide-react';
import { BillData, ChatMessage } from './types';
import { parseReceiptImage, processChatCommand } from './services/geminiService';
import { BillView } from './components/BillView';
import { ChatView } from './components/ChatView';

const InitialWelcomeState: React.FC<{ onUpload: (file: File) => void; isAnalyzing: boolean }> = ({ onUpload, isAnalyzing }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUpload(e.target.files[0]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div>
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-200">
            <Camera className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">SplitSmart AI</h1>
          <p className="text-slate-600 text-lg">Upload a receipt and let AI help you split the bill with friends instantly.</p>
        </div>

        {isAnalyzing ? (
          <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-100">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-800 mb-2">Analyzing Receipt...</h3>
            <p className="text-slate-500">Identifying items, prices, and tax.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="group relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-300 rounded-2xl cursor-pointer bg-white hover:bg-slate-50 hover:border-indigo-500 transition-all">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-10 h-10 text-slate-400 group-hover:text-indigo-500 mb-3 transition-colors" />
                <p className="mb-2 text-sm text-slate-500"><span className="font-semibold text-indigo-600">Click to upload</span> or drag and drop</p>
                <p className="text-xs text-slate-400">PNG, JPG, HEIC up to 10MB</p>
              </div>
              <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
            </label>
          </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [bill, setBill] = useState<BillData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleUpload = async (file: File) => {
    setIsAnalyzing(true);
    try {
      const parsedBill = await parseReceiptImage(file);
      setBill(parsedBill);
      setMessages([
        {
          id: 'init',
          role: 'model',
          text: `I've analyzed your receipt! I found ${parsedBill.items.length} items totaling ${parsedBill.currency}${parsedBill.total}. Tell me who had what (e.g., "Mike had the steak" or "Alice and Bob shared the wine").`,
          timestamp: new Date()
        }
      ]);
    } catch (error) {
      console.error("Error parsing receipt:", error);
      alert("Failed to analyze receipt. Please try again with a clearer image.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!bill) return;

    // Optimistic user message update
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      const { updatedBill, responseText } = await processChatCommand(bill, text);
      
      setBill(updatedBill);
      
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMsg]);

    } catch (error) {
      console.error("Chat error:", error);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "Sorry, I had trouble updating the bill. Could you try rephrasing that?",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!bill) {
    return <InitialWelcomeState onUpload={handleUpload} isAnalyzing={isAnalyzing} />;
  }

  return (
    <div className="h-screen flex flex-col md:flex-row bg-slate-100 p-4 gap-4 overflow-hidden">
      {/* Mobile Header - only visible on small screens */}
      <div className="md:hidden flex items-center justify-between mb-2">
        <h1 className="font-bold text-lg text-slate-800 flex items-center gap-2">
           <Camera className="w-5 h-5 text-indigo-600" /> SplitSmart AI
        </h1>
        <button 
          onClick={() => setBill(null)}
          className="text-sm text-slate-500 underline"
        >
          Reset
        </button>
      </div>

      <div className="flex-1 h-1/2 md:h-full min-h-0">
        <BillView bill={bill} />
      </div>
      
      <div className="flex-1 h-1/2 md:h-full min-h-0">
        <ChatView 
          messages={messages} 
          onSendMessage={handleSendMessage} 
          isProcessing={isProcessing} 
        />
      </div>
    </div>
  );
}