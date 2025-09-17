
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";
import { identifyObject } from './services/geminiService';
import { useTextToSpeech } from './hooks/useTextToSpeech';
import useIsMobile from './hooks/useIsMobile';
import type { Position } from './types';
import Spinner from './components/Spinner';
import ChatPanel from './components/ChatPanel';

// Ensure the environment variable is checked.
if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const BALL_DIAMETER = 64; // Further reduced ball size for precision
const BALL_RADIUS = BALL_DIAMETER / 2;

export type Language = 'it-IT' | 'en-US';

export interface ChatMessage {
  sender: 'user' | 'bot' | 'system';
  text: string;
}

const App: React.FC = () => {
  const [isCameraOn, setIsCameraOn] = useState<boolean>(false);
  const [ballPosition, setBallPosition] = useState<Position | null>(null);
  const [isIdentifying, setIsIdentifying] = useState<boolean>(false);
  const [isSendingMessage, setIsSendingMessage] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>('it-IT');
  const [isChatVisible, setIsChatVisible] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [zoom, setZoom] = useState(1);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chatRef = useRef<Chat | null>(null);
  const zoomCapabilitiesRef = useRef<{ min: number; max: number; step: number; } | null>(null);
  const pinchStateRef = useRef<{ startDistance: number; startZoom: number; } | null>(null);
  
  const isMobile = useIsMobile();
  const { speak } = useTextToSpeech();

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
    setBallPosition(null);
    setChatHistory([]);
    chatRef.current = null;
    setIsChatVisible(false);
    setZoom(1);
    zoomCapabilitiesRef.current = null;
  }, []);
  
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    stopCamera();
    setLanguage(e.target.value as Language);
  }

  const startCamera = useCallback(async () => {
    stopCamera(); 
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      streamRef.current = stream;
      
      const videoTrack = stream.getVideoTracks()[0];
      if (isMobile && videoTrack && typeof videoTrack.getCapabilities === 'function') {
        const capabilities = videoTrack.getCapabilities();
        if ('zoom' in capabilities && capabilities.zoom) {
            // FIX: Type assertion to handle non-standard browser API typings for zoom capabilities.
            zoomCapabilitiesRef.current = capabilities.zoom as { min: number; max: number; step: number; };
            const newZoom = 1;
            setZoom(newZoom); 
            // FIX: Cast to 'any' to allow the non-standard 'zoom' property in constraints.
            videoTrack.applyConstraints({ advanced: [{ zoom: newZoom } as any] });
        } else {
            zoomCapabilitiesRef.current = null;
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraOn(true);
      setError(null);
      const initialMessage = language === 'it-IT' 
        ? 'Clicca su un oggetto per identificarlo.' 
        : 'Click on an object to identify it.';
      setChatHistory([{ sender: 'system', text: initialMessage }]);
    } catch (err) {
      console.error("Error accessing camera:", err);
      const errorMessage = language === 'it-IT' 
        ? 'Impossibile accedere alla fotocamera. Controlla le autorizzazioni.'
        : 'Could not access camera. Please check permissions.';
      setError(errorMessage);
      setIsCameraOn(false);
    }
  }, [stopCamera, language, facingMode, isMobile]);

  useEffect(() => {
    if (isCameraOn) {
        startCamera();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);
  
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);
  
  useEffect(() => {
    if (!isMobile || !streamRef.current || !zoomCapabilitiesRef.current) return;
    
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (videoTrack) {
        // FIX: Cast to 'any' to allow the non-standard 'zoom' property in constraints.
        videoTrack.applyConstraints({ advanced: [{ zoom } as any] }).catch(err => {
            console.warn("Could not apply zoom:", err);
        });
    }
  }, [zoom, isMobile]);

  const handleContainerClick = async (event: React.MouseEvent<HTMLDivElement>) => {
    if (isIdentifying || !isCameraOn) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!video || !canvas || !container || video.readyState < 2) {
        setError(language === 'it-IT' ? "La fotocamera non è pronta. Riprova." : "Camera is not ready. Please try again.");
        return;
    }

    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setBallPosition({ x: x - BALL_RADIUS, y: y - BALL_RADIUS });
    setIsIdentifying(true);
    setError(null);

    try {
        const MAX_DIMENSION = 512;
        const { videoWidth, videoHeight } = video;

        let targetWidth = videoWidth;
        let targetHeight = videoHeight;

        if (videoWidth > MAX_DIMENSION || videoHeight > MAX_DIMENSION) {
            if (videoWidth > videoHeight) {
                targetWidth = MAX_DIMENSION;
                targetHeight = Math.round((videoHeight / videoWidth) * MAX_DIMENSION);
            } else {
                targetHeight = MAX_DIMENSION;
                targetWidth = Math.round((videoWidth / videoHeight) * MAX_DIMENSION);
            }
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Could not get canvas context");
        
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

        const scaleX = targetWidth / video.clientWidth;
        const scaleY = targetHeight / video.clientHeight;
        const circleCenterX = x * scaleX;
        const circleCenterY = y * scaleY;
        const circleRadius = BALL_RADIUS * Math.min(scaleX, scaleY);

        ctx.beginPath();
        ctx.arc(circleCenterX, circleCenterY, circleRadius, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = Math.max(2, 4 * Math.min(scaleX, scaleY));
        ctx.stroke();
        
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const base64Data = imageDataUrl.split(',')[1];
        if (!base64Data) throw new Error("Failed to extract image data.");

        const identifiedWord = await identifyObject(base64Data, language);
        speak(identifiedWord, language);
        
        const systemInstruction = language === 'it-IT'
          ? `Sei un assistente disponibile. L'utente ha appena identificato un oggetto: '${identifiedWord}'. Rispondi alle loro domande su questo oggetto in modo conciso e in italiano.`
          : `You are a helpful assistant. The user has just identified an object: '${identifiedWord}'. Answer their questions about this object concisely and in English.`;

        chatRef.current = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: { systemInstruction },
        });
        
        const chatAboutMessage = language === 'it-IT' ? `Chat sull'oggetto: ${identifiedWord}` : `Chatting about: ${identifiedWord}`;
        const botGreeting = language === 'it-IT' ? `Ho identificato: ${identifiedWord}. Chiedimi pure!` : `I've identified: ${identifiedWord}. Ask me anything!`;

        setChatHistory([
            { sender: 'system', text: chatAboutMessage},
            { sender: 'bot', text: botGreeting }
        ]);

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during analysis.';
        setError(errorMessage);
        console.error(err);
    } finally {
        setIsIdentifying(false);
    }
  };
  
  const handleSendMessage = async (message: string) => {
    if (!chatRef.current || isSendingMessage || !message.trim()) return;

    setIsSendingMessage(true);
    const userMessage: ChatMessage = { sender: 'user', text: message };
    setChatHistory(prev => [...prev, userMessage]);

    try {
        const response = await chatRef.current.sendMessage({ message });
        const botMessage: ChatMessage = { sender: 'bot', text: response.text };
        setChatHistory(prev => [...prev, botMessage]);
        speak(response.text, language);
    } catch (err) {
        console.error("Error sending message:", err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown chat error';
        const errorText = language === 'it-IT' ? `Spiacente, si è verificato un errore: ${errorMessage}` : `Sorry, an error occurred: ${errorMessage}`;
        const errorBotMessage: ChatMessage = { sender: 'bot', text: errorText };
        setChatHistory(prev => [...prev, errorBotMessage]);
    } finally {
        setIsSendingMessage(false);
    }
  };
  
  const handleSwitchCamera = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  // FIX: Corrected the type of `touches` to `TouchList` as it is not generic.
  // Also, cast the result of Array.from to Touch[] to provide types for touch objects.
  const getDistance = (touches: TouchList) => {
    const [touch1, touch2] = Array.from(touches) as Touch[];
    return Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
    );
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && zoomCapabilitiesRef.current) {
        pinchStateRef.current = {
            startDistance: getDistance(e.touches),
            startZoom: zoom,
        };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchStateRef.current && zoomCapabilitiesRef.current) {
        const newDistance = getDistance(e.touches);
        const scale = newDistance / pinchStateRef.current.startDistance;
        let newZoom = pinchStateRef.current.startZoom * scale;

        const { min, max } = zoomCapabilitiesRef.current;
        newZoom = Math.max(min, Math.min(newZoom, max));
        
        setZoom(newZoom);
    }
  };

  const handleTouchEnd = () => {
    pinchStateRef.current = null;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col font-sans overflow-hidden">
      <header className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center shadow-lg sticky top-0 z-40">
        <h1 className="text-xl font-bold text-cyan-300">
          sameer's ignorant helper
        </h1>
        <div className="flex items-center space-x-4">
            <select
                value={language}
                onChange={handleLanguageChange}
                className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-cyan-500 focus:border-cyan-500 block w-full p-2"
            >
                <option value="it-IT">Italiano</option>
                <option value="en-US">English</option>
            </select>
            <button
              onClick={isCameraOn ? stopCamera : startCamera}
              className="px-4 py-2 rounded-lg font-semibold text-white transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50"
              disabled={isIdentifying}
            >
              {isCameraOn ? 'Stop' : 'Start'} Camera
            </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Chat Panel */}
        <div className={`
          absolute top-0 left-0 h-full w-full z-30 bg-gray-800 
          transition-transform duration-300 ease-in-out transform
          md:relative md:w-1/3 md:translate-x-0 md:border-r md:border-gray-700
          ${isChatVisible ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <ChatPanel 
            chatHistory={chatHistory} 
            onSendMessage={handleSendMessage}
            isSendingMessage={isSendingMessage}
            isChatActive={!!chatRef.current}
            language={language}
            onClose={() => setIsChatVisible(false)}
          />
        </div>

        {/* Camera View */}
        <div className="w-full flex-1 flex flex-col items-center justify-center bg-gray-900 relative">
           {!isChatVisible && isCameraOn && (
              <button
                onClick={() => setIsChatVisible(true)}
                className="md:hidden absolute top-4 left-4 z-20 p-2 bg-gray-800/70 rounded-full text-white hover:bg-gray-700 transition-colors"
                aria-label="Open chat"
              >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            )}
            
            {isMobile && isCameraOn && (
                <button
                    onClick={handleSwitchCamera}
                    className="absolute bottom-4 right-4 z-20 p-3 bg-gray-800/70 rounded-full text-white hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    aria-label="Switch camera"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                </button>
            )}

          <div className="w-full h-full p-2 md:p-4 flex flex-col max-w-4xl">
            <div className="w-full h-full bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
              <main className="flex-grow p-1 md:p-2 h-full">
                <div 
                  ref={containerRef}
                  onClick={handleContainerClick}
                  onTouchStart={isMobile ? handleTouchStart : undefined}
                  onTouchMove={isMobile ? handleTouchMove : undefined}
                  onTouchEnd={isMobile ? handleTouchEnd : undefined}
                  className="relative w-full h-full bg-black rounded-lg overflow-hidden cursor-crosshair touch-none"
                >
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className={`w-full h-full object-cover transition-opacity duration-500 ${isCameraOn ? 'opacity-100' : 'opacity-0'}`}
                  />
                  {!isCameraOn && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 p-4 text-center">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      <p className="text-lg">Camera is off</p>
                      <p>Click "Start Camera" to begin</p>
                    </div>
                  )}
                  {ballPosition && isCameraOn && (
                    <div
                      className="absolute border-4 border-white/80 rounded-full bg-white/10 backdrop-blur-sm shadow-lg flex items-center justify-center transition-all duration-100"
                      style={{
                        left: `${ballPosition.x}px`,
                        top: `${ballPosition.y}px`,
                        width: `${BALL_DIAMETER}px`,
                        height: `${BALL_DIAMETER}px`,
                      }}
                    >
                      {isIdentifying && <Spinner />}
                    </div>
                  )}
                  <canvas ref={canvasRef} className="hidden" />
                </div>
              </main>
              
              <footer className="p-2 bg-gray-700/50 border-t border-gray-600">
                <div className="h-6 text-center font-medium text-lg">
                  {error && <p className="text-red-400">{error}</p>}
                </div>
              </footer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;