// js/utils.js

import { supabase } from './config.js';

const audio = new Audio();
let isAudioUnlocked = false;

function unlockAudio() {
    if (isAudioUnlocked) return;
    
    // 创建一个极短的无声 Base64 音频
    const silentSoundSrc = "data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAAgAAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";
    const silentAudio = new Audio(silentSoundSrc);
    
    const playPromise = silentAudio.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            isAudioUnlocked = true;
            console.log("Audio context unlocked successfully.");
        }).catch(error => {
            // 在某些浏览器严格模式下，即使用户交互，第一次播放也可能失败，但这没关系
            // 重要的是我们尝试过了，许多浏览器仍然会因此解锁上下文
            console.warn("Audio unlock attempt failed (this is often expected):", error);
            // 即使失败，我们也标记为true，避免重复尝试
            isAudioUnlocked = true; 
        });
    }
}

export function showCustomConfirm(message, showButtons = true) {
    return new Promise((resolve) => {
        const confirmModal = document.getElementById('confirmModal');
        const confirmMessage = document.getElementById('confirmMessage');
        const confirmBtn = document.getElementById('confirmBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        if (!confirmModal || !confirmMessage || !confirmBtn || !cancelBtn) return resolve(false);
        confirmMessage.innerText = message;
        confirmModal.style.display = 'flex';
        confirmBtn.style.display = showButtons ? 'inline-flex' : 'none';
        cancelBtn.style.display = showButtons ? 'inline-flex' : 'none';
        const onConfirm = () => {
            confirmModal.style.display = 'none';
            resolve(true);
        };
        const onCancel = () => {
            confirmModal.style.display = 'none';
            resolve(false);
        };
        confirmBtn.addEventListener('click', onConfirm, { once: true });
        cancelBtn.addEventListener('click', onCancel, { once: true });
    });
}

export async function readText(text, isSlow = false, button = null) {
    unlockAudio();

    if (!text) return;
    const TTS_URL = 'https://rvarfascuwvponxwdeoe.supabase.co/functions/v1/tts';
    
    if (!audio.paused) {
        audio.pause();
        audio.currentTime = 0;
    }
    document.querySelectorAll('.icon-btn.playing, .highlight-word.playing').forEach(btn => btn.classList.remove('playing'));
    if (button) button.classList.add('playing');

    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            throw new Error("用户未登录或会话已过期，请重新登录。");
        }

        const response = await fetch(TTS_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${session.access_token}` 
            },
            body: JSON.stringify({ text, isSlow }),
        });

        if (!response.ok) {
            throw new Error(`TTS API 错误 (${response.status}): ${await response.text()}`);
        }

        const data = await response.json();
        audio.src = `data:audio/mp3;base64,${data.audioContent}`;
        
        await new Promise((resolve, reject) => {
            audio.onended = () => {
                if (button) button.classList.remove('playing');
                resolve();
            };
            audio.onerror = (err) => {
                if (button) button.classList.remove('playing');
                reject(new Error("音频播放时发生错误。"));
            };

            audio.play().catch(playError => {
                if (button) button.classList.remove('playing');
                reject(playError);
            });
        });

    } catch (error) {
        console.error('从 Supabase TTS 获取音频失败或播放失败:', error);
        if (button) button.classList.remove('playing');
        await showCustomConfirm(`音频服务错误: ${error.message}`);
    }
}

export function getWordsFromSentence(sentence) {
    const stopWords = new Set([
        'a', 'al', 'ante', 'bajo', 'con', 'contra', 'de', 'del', 'desde', 'durante', 'en', 'entre',
        'hacia', 'hasta', 'mediante', 'para', 'por', 'según', 'sin', 'so', 'sobre', 'tras',
        'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'pero', 'mas',
        'es', 'son', 'está', 'están', 'fue', 'fueron', 'ser', 'estar', 'haber', 'hay', 'ha',
        'no', 'mi', 'tu', 'su', 'mí', 'te', 'se', 'me', 'nos', 'os', 'lo', 'los', 'la', 'las', 'le', 'les',
        'que', 'quien', 'cuyo', 'donde', 'como', 'cuando', 'cual'
    ]);
    const punctuationRegex = /[.,;!?()"\-—:¿¡]/g;
    return sentence.toLowerCase().replace(punctuationRegex, '').split(/\s+/).filter(word => word.length > 1 && !stopWords.has(word));
}

export async function generateAndUpdateHighFrequencyWords(userId) {
     if (!userId) {
        console.error("生成高频词失败: 用户ID缺失。");
        return;
    }

    const { data: allSentencesData, error: fetchAllError } = await supabase
        .from('sentences')
        .select('spanish_text')
        .eq('user_id', userId);
    if (fetchAllError) return console.error('获取用户句子失败:', fetchAllError);

    const { data: existingWordsInDb, error: fetchWordsError } = await supabase
        .from('high_frequency_words')
        .select('spanish_word, chinese_translation')
        .eq('user_id', userId);
    if (fetchWordsError) return console.error('获取用户现有词汇失败:', fetchWordsError);
    
    const existingWordMap = new Map((existingWordsInDb || []).map(w => [w.spanish_word, w.chinese_translation]));
    const wordCounts = {};
    const wordSourceSentences = {};

    (allSentencesData || []).forEach(s => {
        const words = getWordsFromSentence(s.spanish_text);
        words.forEach(word => {
            wordCounts[word] = (wordCounts[word] || 0) + 1;
            if (!wordSourceSentences[word]) {
                wordSourceSentences[word] = s.spanish_text;
            }
        });
    });

    const wordsToUpsert = Object.keys(wordCounts).map(word => ({
        user_id: userId,
        spanish_word: word,
        frequency: wordCounts[word],
        source_sentence: wordSourceSentences[word],
        chinese_translation: existingWordMap.get(word) || null
    }));

    if (wordsToUpsert.length > 0) {
        const { error: upsertError } = await supabase
            .from('high_frequency_words')
            .upsert(wordsToUpsert, { onConflict: 'user_id, spanish_word' });
        if (upsertError) console.error('Supabase 词汇更新错误:', upsertError);
    }
}