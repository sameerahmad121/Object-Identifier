import { useCallback, useState, useEffect } from 'react';
import type { Language } from '../App';

export const useTextToSpeech = () => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const getVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
      }
    };
    
    // Voices can load asynchronously.
    getVoices();
    window.speechSynthesis.onvoiceschanged = getVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const speak = useCallback((text: string, lang: Language) => {
    if (!('speechSynthesis' in window)) {
      console.error("Text-to-speech not supported in this browser.");
      alert("Sorry, your browser doesn't support text-to-speech.");
      return;
    }

    // A simple check to avoid speaking raw error messages
    if (text.toLowerCase().startsWith('errore') || text.toLowerCase().startsWith('error')) {
        return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1; // Natural rate
    utterance.pitch = 1; // Natural pitch

    /**
     * Scores a voice based on quality indicators. Higher is better.
     * This helps us find the most natural-sounding voice available.
     */
    const getVoiceScore = (voice: SpeechSynthesisVoice): number => {
        if (voice.lang !== lang) return 0;

        const name = voice.name.toLowerCase();
        let score = 0;
        
        // Prioritize known high-quality voice engines/types
        if (name.includes('neural')) score += 5;
        if (name.includes('google')) score += 4;
        if (name.includes('natural')) score += 3;
        if (voice.localService === false) score += 3; // Cloud-based voices are usually better

        // Prefer female voices as requested
        if (name.includes('female') || name.includes('donna') || name.includes('femminile')) score += 2;
        
        // Basic score for being a valid option
        score += 1;

        return score;
    };

    const rankedVoices = voices
        .map(voice => ({ voice, score: getVoiceScore(voice) }))
        .filter(v => v.score > 0)
        .sort((a, b) => b.score - a.score);

    if (rankedVoices.length > 0) {
      const bestVoice = rankedVoices[0].voice;
      utterance.voice = bestVoice;
      // console.log(`Using voice: ${bestVoice.name} (Score: ${rankedVoices[0].score})`);
    } else {
      // Fallback if no specific voices were found
      const fallbackVoice = voices.find(v => v.lang === lang);
      if (fallbackVoice) {
        utterance.voice = fallbackVoice;
      }
    }
    
    // Ensure any previous speech is stopped before starting a new one
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [voices]);

  return { speak };
};
