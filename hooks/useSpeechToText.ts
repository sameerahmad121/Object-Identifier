import { useState, useRef, useEffect } from 'react';
import type { Language } from '../App';

// Fix: Use a type assertion to inform TypeScript about non-standard browser APIs.
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

interface SpeechToTextOptions {
    language: Language;
}

export const useSpeechToText = ({ language }: SpeechToTextOptions) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  // Fix: The variable 'SpeechRecognition' is a value, not a type. Use 'any' for the ref
  // because the Speech Recognition API is experimental and not fully typed in standard TypeScript libs.
  const recognitionRef = useRef<any | null>(null);

  useEffect(() => {
    if (!SpeechRecognition) {
      console.error("Speech Recognition API not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false; // Process single utterances
    recognition.lang = language;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const currentTranscript = event.results[event.results.length - 1][0].transcript;
      setTranscript(currentTranscript);
    };
    
    recognitionRef.current = recognition;

    // Cleanup function
    return () => {
        if (recognitionRef.current) {
            recognitionRef.current.abort();
        }
    }
  }, [language]); // Re-create the recognition object if the language changes
  
  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setTranscript('');
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  return { isListening, transcript, startListening, stopListening };
};