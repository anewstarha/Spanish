// js/utils.js

import { supabase } from './config.js';

const audio = new Audio();
let isAudioUnlocked = false;
let isGlobalClickListenerAdded = false; // 【修改】新增一个标志位

function unlockAudio() {
    if (isAudioUnlocked) return;
    const silentSoundSrc = "data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAAgAAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";
    const silentAudio = new Audio(silentSoundSrc);
    const playPromise = silentAudio.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            isAudioUnlocked = true;
            console.log("Audio context unlocked successfully.");
        }).catch(error => {
            console.warn("Audio unlock attempt failed (this is often expected):", error);
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

        const closeModal = (resolutionValue) => {
            confirmModal.style.display = 'none';
            confirmModal.removeEventListener('click', clickOutsideHandler);
            confirmBtn.removeEventListener('click', confirmHandler);
            cancelBtn.removeEventListener('click', cancelHandler);
            resolve(resolutionValue);
        };

        const confirmHandler = () => closeModal(true);
        const cancelHandler = () => closeModal(false);
        
        const clickOutsideHandler = (event) => {
            if (event.target === confirmModal) {
                closeModal(!showButtons); 
            }
        };

        if (!showButtons) {
            confirmModal.addEventListener('click', clickOutsideHandler);
        } else {
            confirmBtn.addEventListener('click', confirmHandler);
            cancelBtn.addEventListener('click', cancelHandler);
        }
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
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("用户未登录或会话已过期，请重新登录。");
        const response = await fetch(TTS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ text, isSlow }),
        });
        if (!response.ok) throw new Error(`TTS API 错误 (${response.status}): ${await response.text()}`);
        const data = await response.json();
        audio.src = `data:audio/mp3;base64,${data.audioContent}`;
        await new Promise((resolve, reject) => {
            audio.onended = () => {
                if (button) button.classList.remove('playing');
                resolve();
            };
            audio.onerror = () => {
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
    const stopWords = new Set(['a', 'al', 'ante', 'bajo', 'con', 'contra', 'de', 'del', 'desde', 'durante', 'en', 'entre', 'hacia', 'hasta', 'mediante', 'para', 'por', 'según', 'sin', 'so', 'sobre', 'tras', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'pero', 'mas', 'es', 'son', 'está', 'están', 'fue', 'fueron', 'ser', 'estar', 'haber', 'hay', 'ha', 'no', 'mi', 'tu', 'su', 'mí', 'te', 'se', 'me', 'nos', 'os', 'lo', 'los', 'la', 'las', 'le', 'les', 'que', 'quien', 'cuyo', 'donde', 'como', 'cuando', 'cual']);
    const punctuationRegex = /[.,;!?()"\-—:¿¡]/g;
    return sentence.toLowerCase().replace(punctuationRegex, '').split(/\s+/).filter(word => word.length > 1 && !stopWords.has(word));
}

export async function generateAndUpdateHighFrequencyWords(userId) {
     if (!userId) {
        console.error("生成高频词失败: 用户ID缺失。");
        return;
    }
    const { data: allSentencesData } = await supabase.from('sentences').select('spanish_text').eq('user_id', userId);
    const { data: existingWordsInDb } = await supabase.from('high_frequency_words').select('spanish_word, chinese_translation').eq('user_id', userId);
    const existingWordMap = new Map((existingWordsInDb || []).map(w => [w.spanish_word, w.chinese_translation]));
    const wordCounts = {};
    const wordSourceSentences = {};
    (allSentencesData || []).forEach(s => {
        const words = getWordsFromSentence(s.spanish_text);
        words.forEach(word => {
            wordCounts[word] = (wordCounts[word] || 0) + 1;
            if (!wordSourceSentences[word]) wordSourceSentences[word] = s.spanish_text;
        });
    });
    const newWordsToTranslate = Object.keys(wordCounts).filter(word => !existingWordMap.get(word));
    if (newWordsToTranslate.length > 0) {
        console.log(`发现 ${newWordsToTranslate.length} 个新词，正在调用 AI 进行翻译...`);
        try {
            const TRANSLATE_URL = `https://rvarfascuwvponxwdeoe.supabase.co/functions/v1/explain-sentence`;
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("用户未认证");
            const response = await fetch(TRANSLATE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify({ words: newWordsToTranslate, getTranslation: true })
            });
            if (!response.ok) throw new Error(`单词翻译API错误: ${await response.text()}`);
            const { translations } = await response.json();
            for (const word in translations) {
                if (Object.prototype.hasOwnProperty.call(translations, word)) {
                    existingWordMap.set(word, translations[word]);
                }
            }
        } catch (error) {
            console.error("调用AI翻译单词失败:", error);
        }
    }
    const wordsToUpsert = Object.keys(wordCounts).map(word => ({
        user_id: userId,
        spanish_word: word,
        frequency: wordCounts[word],
        source_sentence: wordSourceSentences[word],
        chinese_translation: existingWordMap.get(word) || null
    }));
    if (wordsToUpsert.length > 0) {
        const { error: upsertError } = await supabase.from('high_frequency_words').upsert(wordsToUpsert, { onConflict: 'user_id, spanish_word' });
        if (upsertError) console.error('Supabase 词汇更新错误:', upsertError);
    }
}

// 【修改】将“点击外部关闭”的逻辑移回到这里，并确保只绑定一次
export function initializeDropdowns() {
    const dropdownContainers = document.querySelectorAll('.dropdown-container');

    dropdownContainers.forEach(container => {
        const button = container.querySelector('button');
        const menu = container.querySelector('.dropdown-menu');

        if (!button || !menu) return;

        button.addEventListener('click', (event) => {
            event.stopPropagation();
            // 在切换当前菜单前，先关闭其他所有已打开的菜单
            document.querySelectorAll('.dropdown-menu.is-visible').forEach(openMenu => {
                if (openMenu !== menu) {
                    openMenu.classList.remove('is-visible');
                }
            });
            // 切换当前点击的菜单
            menu.classList.toggle('is-visible');
        });
    });

    // 确保这个全局监听器只被添加一次
    if (!isGlobalClickListenerAdded) {
        document.addEventListener('click', () => {
            // 这个监听器很简单：只要在页面任何地方点击，就关闭所有打开的菜单
            document.querySelectorAll('.dropdown-menu.is-visible').forEach(openMenu => {
                openMenu.classList.remove('is-visible');
            });
        });
        isGlobalClickListenerAdded = true;
    }
}