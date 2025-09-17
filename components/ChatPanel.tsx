import React, { useState, useEffect, useRef } from 'react';
import type { ChatMessage, Language } from '../App';
import { useSpeechToText } from '../hooks/useSpeechToText';

interface ChatPanelProps {
  chatHistory: ChatMessage[];
  onSendMessage: (message: string) => void;
  isSendingMessage: boolean;
  isChatActive: boolean;
  language: Language;
  onClose?: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ chatHistory, onSendMessage, isSendingMessage, isChatActive, language, onClose }) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isListening, transcript, startListening, stopListening } = useSpeechToText({ language });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [chatHistory]);
  
  useEffect(() => {
    if (transcript) {
      setInputText(transcript);
    }
  }, [transcript]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText('');
    }
  };
  
  const handleMicClick = () => {
      if (isListening) {
          stopListening();
      } else {
          setInputText(''); // Clear text before new recording
          startListening();
      }
  };

  const getMessageStyle = (sender: ChatMessage['sender']) => {
    switch (sender) {
      case 'user':
        return 'bg-blue-600 self-end';
      case 'bot':
        return 'bg-gray-600 self-start';
      case 'system':
        return 'bg-gray-700 text-gray-400 text-sm self-center italic';
      default:
        return 'bg-gray-500 self-start';
    }
  };
  
  const placeholderText = {
      'it-IT': {
          active: "Chiedi informazioni sull'oggetto...",
          inactive: "Prima identifica un oggetto..."
      },
      'en-US': {
          active: "Ask about the object...",
          inactive: "Identify an object first..."
      }
  }

  return (
    <div className="flex flex-col h-full bg-gray-800">
      <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="text-lg font-bold text-cyan-300">Chat</h2>
        {onClose && (
            <button 
                onClick={onClose} 
                className="p-2 rounded-full hover:bg-gray-700 transition-colors"
                aria-label="Close chat"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        )}
      </div>
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {chatHistory.map((msg, index) => (
          <div
            key={index}
            className={`px-4 py-2 rounded-xl max-w-xs md:max-w-md break-words ${getMessageStyle(msg.sender)}`}
          >
            {msg.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 bg-gray-700/50 border-t border-gray-600">
        <form onSubmit={handleSubmit} className="flex items-center space-x-2">
          <button 
            type="button" 
            onClick={handleMicClick}
            disabled={!isChatActive || isSendingMessage}
            className={`p-2 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:opacity-50 ${isListening ? 'bg-red-500 animate-pulse' : 'bg-gray-600 hover:bg-gray-500'}`}
            aria-label={isListening ? 'Stop recording' : 'Start recording'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isChatActive ? placeholderText[language].active : placeholderText[language].inactive}
            disabled={!isChatActive || isSendingMessage || isListening}
            className="flex-1 p-2 bg-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
          />
          <button 
            type="submit" 
            disabled={!isChatActive || isSendingMessage || !inputText.trim()}
            className="p-2 bg-blue-600 rounded-full hover:bg-blue-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
            aria-label="Send message"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" transform="rotate(90 12 12)" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatPanel;